const jwt = require("jsonwebtoken");
const User = require("../models/User");

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return null;
};

// Protects routes - verifies JWT and attaches user to req.user
const protect = async (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, no token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.purpose) {
      return res.status(401).json({
        success: false,
        message: "This token cannot access protected routes",
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, user no longer exists",
      });
    }

    if (user.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Only the owner account can access this resource",
      });
    }

    if (user.isFirstLogin) {
      return res.status(403).json({
        success: false,
        message: "Please set a new password before continuing",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, token failed or expired",
    });
  }
};

// Used only on the "set password" step, which is authenticated using a
// short-lived temp token rather than the normal full-access JWT.
const protectTemp = async (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, no token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.purpose !== "first-login-set-password") {
      return res.status(401).json({
        success: false,
        message: "Invalid token for this action",
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, user no longer exists",
      });
    }

    if (user.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Only the owner account can access this resource",
      });
    }

    if (!user.isFirstLogin) {
      return res.status(400).json({
        success: false,
        message: "Password has already been changed",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, token failed or expired",
    });
  }
};

const optionalAuth = async (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.purpose) {
      const user = await User.findById(decoded.id);
      if (user?.role === "owner") {
        req.user = user;
      }
    }
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, token failed or expired",
    });
  }

  next();
};

module.exports = { protect, protectTemp, optionalAuth };
