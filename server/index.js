// ─── Core imports ─────────────────────────────────────────────────────────────
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const subscriptionRoutes = require("./routes/subscriptions");
const sellerRoutes = require("./routes/sellers");
const purchaseRoutes = require("./routes/purchases");

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
      // production frontend URL, tolerating a trailing slash in the setting
      (process.env.CLIENT_URL || "").replace(/\/+$/, ""),
    ].filter(Boolean),
    credentials: true,
  }),
);

// Razorpay signs the exact bytes it sends, so this must run before the JSON parser
app.use("/api/subscriptions/webhook", express.raw({ type: "application/json" }));

// Parse incoming JSON request bodies (logo and signature images are included)
app.use(express.json({ limit: "3mb" }));

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

app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/insights", require("./routes/insights"));
app.use("/api/assistant", require("./routes/assistant"));
app.use("/api/quotations", require("./routes/quotations"));
app.use("/api/credit-notes", require("./routes/creditNotes"));
app.use("/api/stock", require("./routes/stock"));
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/ledger", require("./routes/ledger"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/data", require("./routes/data"));

// ─── Global error handler ─────────────────────────────────────────────────────
// Catches any error thrown inside route handlers via next(err)
// Must stay after all routes, or it won't catch their errors
app.use((err, req, res, next) => {
  console.error("Global error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ─── Seed default plans on startup ───────────────────────────────────────────
const Plan = require("./models/Plan");

async function seedPlans() {
  const count = await Plan.countDocuments();
  if (count > 0) return; // already seeded

  await Plan.insertMany([
    {
      name: "free",
      displayName: "Free",
      price: 0,
      limits: { invoicesPerMonth: 10, buyers: 5, items: 10 },
      features: {
        paymentTracking: false,
        gstReports: false,
        multiUser: false,
        customLogo: false,
        emailInvoice: false,
        prioritySupport: false,
      },
    },
    {
      name: "starter",
      displayName: "Starter",
      price: 299,
      limits: { invoicesPerMonth: 100, buyers: 50, items: 100 },
      features: {
        paymentTracking: true,
        gstReports: false,
        multiUser: false,
        customLogo: true,
        emailInvoice: false,
        prioritySupport: false,
      },
    },
    {
      name: "growth",
      displayName: "Growth",
      price: 799,
      limits: { invoicesPerMonth: -1, buyers: -1, items: -1 },
      features: {
        paymentTracking: true,
        gstReports: true,
        multiUser: false,
        customLogo: true,
        emailInvoice: true,
        prioritySupport: false,
      },
    },
    {
      name: "pro",
      displayName: "Pro",
      price: 1999,
      limits: { invoicesPerMonth: -1, buyers: -1, items: -1 },
      features: {
        paymentTracking: true,
        gstReports: true,
        multiUser: true,
        customLogo: true,
        emailInvoice: true,
        prioritySupport: true,
      },
    },
  ]);
  console.log("✅ Plans seeded");
}

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected successfully");

    await seedPlans();

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
