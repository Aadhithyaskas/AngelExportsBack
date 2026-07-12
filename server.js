require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const ensureOwnerAccount = require("./utils/seedOwner");
const path = require("path");


const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");

const app = express();

// Core middleware

app.use(cors({
  origin: "https://angelexportsback.onrender.com",
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
app.get("/", (req, res) => {
  res.status(200).json({ message: "Tamil Authentic Foods API is running" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler (catches thrown errors / rejected promises passed via next(err))
app.use((err, req, res, next) => {
  console.error(err.stack);
  const isUploadError = err.name === "MulterError" || err.message?.startsWith("Only image files");
  res.status(isUploadError ? 400 : err.statusCode || 500).json({
    success: false,
    message:
      err.code === "LIMIT_FILE_SIZE"
        ? "Image must be 5MB or smaller"
        : err.message || "Server Error",
  });
});

// app.use(
//   "/uploads",
//   express.static(path.join(__dirname, "uploads"))
// );

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await ensureOwnerAccount();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error(`Server startup failed: ${error.message}`);
  process.exit(1);
});
