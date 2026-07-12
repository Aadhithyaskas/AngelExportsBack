const express = require("express");
const router = express.Router();
const {
  login,
  setPasswordFirstLogin,
  forgotPassword,
  resetPassword,
  getMe,
} = require("../controllers/authController");
const { protect, protectTemp } = require("../middleware/authMiddleware");

// Public
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Private - temp token only (first-login dummy password flow)
router.post("/set-password", protectTemp, setPasswordFirstLogin);

// Private - full token
router.get("/me", protect, getMe);

module.exports = router;
