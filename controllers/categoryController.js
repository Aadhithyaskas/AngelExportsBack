const Category = require("../models/Category");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const trimString = (value) =>
  value === undefined || value === null ? undefined : String(value).trim();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const getUploadedFile = (req) =>
  ["image", "photo", "categoryImage"].map((field) => req.files?.[field]?.[0]).find(Boolean);
const imagePath = (file) => (file ? `/uploads/categories/${file.filename}` : undefined);
const removeLocalUpload = (image) => {
  if (!image || !image.startsWith("/uploads/categories/")) return;
  fs.unlink(path.join(__dirname, "..", image), () => {});
};

// @desc    Create a new category
// @route   POST /api/categories
// @access  Private (owner only)
exports.createCategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;
    const uploadedImage = imagePath(getUploadedFile(req));

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const trimmedName = trimString(name);
    const existing = await Category.findOne({
      name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A category with this name already exists",
      });
    }

    const category = await Category.create({
      name: trimmedName,
      description: trimString(description) || "",
      image: uploadedImage || trimString(image) || "",
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single category by id
// @route   GET /api/categories/:id
// @access  Public
exports.getCategoryById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category id" });
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    res.status(200).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private (owner only)
exports.updateCategory = async (req, res) => {
  try {
    const { name, description, image } = req.body;
    const uploadedImage = imagePath(getUploadedFile(req));

    if (!isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category id" });
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    if (name) {
      const trimmedName = trimString(name);
      const existing = await Category.findOne({
        _id: { $ne: category._id },
        name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: "A category with this name already exists",
        });
      }

      category.name = trimmedName;
    }
    if (description !== undefined) category.description = trimString(description);
    if (uploadedImage) {
      removeLocalUpload(category.image);
      category.image = uploadedImage;
    } else if (image !== undefined) {
      removeLocalUpload(category.image);
      category.image = trimString(image) || "";
    }

    await category.save();

    res.status(200).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a category (blocks deletion if products still reference it)
// @route   DELETE /api/categories/:id
// @access  Private (owner only)
exports.deleteCategory = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category id" });
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const productCount = await Product.countDocuments({
      category: category._id,
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: ${productCount} product(s) still belong to it`,
      });
    }

    removeLocalUpload(category.image);
    await category.deleteOne();

    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
