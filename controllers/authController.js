const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// Helper: sign a normal, full-access JWT
const signToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};

// Helper: sign a short-lived token only valid for the "set password" step
const signTempToken = (user) => {
  return jwt.sign(
    { id: user._id, purpose: "first-login-set-password" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_TEMP_EXPIRE || "15m" }
  );
};

const userPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

// @desc    Login (owner only)
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Only the owner account can log in",
      });
    }

    // Check if user logged in using the default password
    const isDefaultPassword = password === process.env.OWNER_DUMMY_PASSWORD;

    if (isDefaultPassword) {
      const tempToken = signTempToken(user);

      return res.status(200).json({
        success: true,
        firstLogin: true,
        requiresPasswordReset: true,
        redirectTo: "/set-password",
        tempToken,
        message: "Please change your default password.",
        user: userPayload(user),
      });
    }

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      firstLogin: false,
      token,
      user: userPayload(user),
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// @desc    Set a new password after first login (dummy password flow)
// @route   POST /api/auth/set-password
// @access  Private (temp token only)
exports.setPasswordFirstLogin = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = req.user; // set by protectTemp middleware
    user.password = newPassword;
    user.isFirstLogin = false;
    await user.save();

    const token = signToken(user);

    res.status(200).json({
      success: true,
      message: "Password set successfully",
      token,
      user: userPayload(user),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Request a password reset link via email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({
      email: email?.trim().toLowerCase(),
      role: "owner",
    });
    if (!user) {
      // Respond the same way whether or not the user exists, to avoid
      // leaking which emails are registered.
      return res.status(200).json({
        success: true,
        message: "If that email exists, a reset link has been sent",
      });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    const html = `
      <p>You requested a password reset for your Tamil Authentic Foods account.</p>
      <p>Click the link below to set a new password. This link expires in
      ${Math.round(Number(process.env.RESET_TOKEN_EXPIRE) / 60000)} minutes.</p>
      <a href="${resetUrl}" target="_blank">${resetUrl}</a>
      <p>If you did not request this, you can safely ignore this email.</p>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Request",
        html,
      });

      res.status(200).json({
        success: true,
        message: "If that email exists, a reset link has been sent",
      });
    } catch (emailError) {
      // Roll back the token if email sending fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: "Email could not be sent, please try again later",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset password using the token from the emailed link
// @route   POST /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
      role: "owner",
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Reset link is invalid or has expired",
      });
    }

    user.password = newPassword;
    user.isFirstLogin = false;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    const token = signToken(user);

    res.status(200).json({
      success: true,
      message: "Password reset successful",
      token,
      user: userPayload(user),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get currently logged-in user's profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: userPayload(req.user),
  });
};
