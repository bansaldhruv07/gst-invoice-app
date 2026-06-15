// ─── Core imports ─────────────────────────────────────────────────────────────
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────

// Allow requests from your React frontend (localhost:5173 in dev)
app.use(
  cors({
    origin: [
      "http://localhost:5173", // Vite dev server
      "http://localhost:3000", // fallback
      process.env.CLIENT_URL || "", // production frontend URL (set later)
    ],
    credentials: true,
  }),
);

// Parse incoming JSON request bodies
app.use(express.json());

// ─── Route imports (we'll create these files in Steps 4–7) ────────────────────
const authRoutes = require("./routes/auth");
const buyerRoutes = require("./routes/buyers");
const itemRoutes = require("./routes/items");
const invoiceRoutes = require("./routes/invoices");

// ─── Mount routes ─────────────────────────────────────────────────────────────
// All auth routes live at /api/auth  (e.g. POST /api/auth/login)

app.use("/api/auth", authRoutes);

// // All buyer routes live at /api/buyers
app.use("/api/buyers", buyerRoutes);

// // All item routes live at /api/items
app.use("/api/items", itemRoutes);

// // All invoice routes live at /api/invoices
app.use("/api/invoices", invoiceRoutes);

app.get("/", (req, res) => {
  res.send("GST Invoice API is running 🚀");
});
// ─── Health check route ───────────────────────────────────────────────────────
// Visit http://localhost:5000/api/health to confirm server is running
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "GST Invoice API is running",
    timestamp: new Date().toISOString(),
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// Catches any error thrown inside route handlers via next(err)
app.use((err, req, res, next) => {
  console.error("Global error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ─── MongoDB connection + Server start ────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");

    // Only start listening after DB is connected
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1); // Exit process if DB fails — no point running without DB
  });
