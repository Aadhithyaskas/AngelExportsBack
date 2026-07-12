const express = require("express");
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductById,
  getProductsByCategory,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const upload = require("../middleware/upload");
const productImageUpload = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "image", maxCount: 1 },
  { name: "productImage", maxCount: 1 },
]);

// Public - customer-facing catalog pages can view/filter products
router.get("/", optionalAuth, getProducts);
router.get("/category/:categoryId", getProductsByCategory);
router.get("/:id", optionalAuth, getProductById);

// Owner only
router.post(
  "/",
  protect,
  authorize("owner"),
  productImageUpload,
  createProduct
);
router.put("/:id", protect, authorize("owner"), productImageUpload, updateProduct);
router.delete("/:id", protect, authorize("owner"), deleteProduct);

module.exports = router;
