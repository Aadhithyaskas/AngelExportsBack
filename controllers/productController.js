const Product = require("../models/Product");
const Category = require("../models/Category");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const getUploadedFile = (req) =>
  req.file || ["photo", "image", "productImage"].map((field) => req.files?.[field]?.[0]).find(Boolean);
const removeLocalPhoto = (photo) => {
  if (!photo || !photo.startsWith("/uploads/products/")) return;
  fs.unlink(path.join(__dirname, "..", photo), () => {});
};
const trimString = (value) =>
  value === undefined || value === null ? undefined : String(value).trim();

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

const normalizeProductBody = (body = {}) => ({
  name: trimString(body.name),
  description: trimString(body.description),
  price: body.price === undefined ? undefined : Number(body.price),
  stock: body.stock === undefined ? undefined : Number(body.stock),
  category: body.category,
  isAvailable: parseBoolean(body.isAvailable),
});

// @desc    Create a new product under a category
// @route   POST /api/products
// @access  Private (owner only)
exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, stock, category } =
      normalizeProductBody(req.body);

    const uploadedFile = getUploadedFile(req);
    const photo = uploadedFile ? `/uploads/products/${uploadedFile.filename}` : undefined;

    if (!name || !photo || price === undefined || !category) {
      return res.status(400).json({
        success: false,
        message: "name, photo, price and category are required",
      });
    }

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({
        success: false,
        message: "Product price must be a valid non-negative number",
      });
    }

    if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
      return res.status(400).json({
        success: false,
        message: "Product stock must be a valid non-negative integer",
      });
    }

    if (!isValidObjectId(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category id",
      });
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Category does not exist",
      });
    }

    const product = await Product.create({
      name,
      description,
      photo,
      price,
      stock: stock ?? 0,
      category,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all products, optionally filtered by category and/or search
// @route   GET /api/products?category=<id>&search=<text>&minPrice=&maxPrice=
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice } = req.query;
    const filter = {};

    if (category) {
      if (!isValidObjectId(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category id",
        });
      }
      filter.category = category;
    }

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);

      if (
        (minPrice && !Number.isFinite(filter.price.$gte)) ||
        (maxPrice && !Number.isFinite(filter.price.$lte))
      ) {
        return res.status(400).json({
          success: false,
          message: "Price filters must be valid numbers",
        });
      }
    }

    if (!req.user || req.user.role !== "owner") {
      filter.isAvailable = true;
    }

    const products = await Product.find(filter)
      .populate("category", "name description image")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single product
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findById(req.params.id).populate(
      "category",
      "name description image"
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if ((!req.user || req.user.role !== "owner") && !product.isAvailable) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all products belonging to one category
// @route   GET /api/products/category/:categoryId
// @access  Public
exports.getProductsByCategory = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.categoryId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category id" });
    }

    const category = await Category.findById(req.params.categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const products = await Product.find({
      category: req.params.categoryId,
      isAvailable: true,
    }).populate("category", "name");

    res.status(200).json({
      success: true,
      category: category.name,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private (owner only)
exports.updateProduct = async (req, res) => {
  try {
    const { name, description, photo, price, stock, category, isAvailable } =
      normalizeProductBody(req.body);

    if (!isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if (category) {
      if (!isValidObjectId(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category id",
        });
      }

      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res
          .status(400)
          .json({ success: false, message: "Category does not exist" });
      }
      product.category = category;
    }

    if (name) product.name = name;
    if (description !== undefined) product.description = description;
    const uploadedFile = getUploadedFile(req);
    if (uploadedFile) {
      // delete old image file if it exists on disk
      removeLocalPhoto(product.photo);
      product.photo = `/uploads/products/${uploadedFile.filename}`;
    }
    if (price !== undefined) {
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: "Product price must be a valid non-negative number",
        });
      }
      product.price = price;
    }
    if (stock !== undefined) {
      if (!Number.isInteger(stock) || stock < 0) {
        return res.status(400).json({
          success: false,
          message: "Product stock must be a valid non-negative integer",
        });
      }
      product.stock = stock;
    }
    if (isAvailable !== undefined) product.isAvailable = isAvailable;

    await product.save();

    res.status(200).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private (owner only)
exports.deleteProduct = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    removeLocalPhoto(product.photo);
    await product.deleteOne();

    res.status(200).json({ success: true, message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
