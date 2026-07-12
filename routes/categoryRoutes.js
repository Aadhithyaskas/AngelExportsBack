const express = require("express");
const router = express.Router();
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { protect } = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const upload = require("../middleware/upload");
const categoryImageUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "photo", maxCount: 1 },
  { name: "categoryImage", maxCount: 1 },
]);

// Public - customer-facing catalog pages can view categories
router.get("/", getCategories);
router.get("/:id", getCategoryById);

// Owner only
router.post("/", protect, authorize("owner"), categoryImageUpload, createCategory);
router.put("/:id", protect, authorize("owner"), categoryImageUpload, updateCategory);
router.delete("/:id", protect, authorize("owner"), deleteCategory);

module.exports = router;
