// The web application. index.js connects the database and starts it; the tests
// start it on their own.
const express = require("express");
const cors = require("cors");
const { securityHeaders } = require("./middleware/security");
const { sendError } = require("./services/common");

const app = express();

// Render and similar hosts sit one proxy in front of the app. This decides which
// address the attempt limits see.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(securityHeaders);

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
// Routes read fields from the body, so it is always an object
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

app.get("/", (req, res) => {
  res.send("GST Invoice API is running 🚀");
});

// Visit /api/health to confirm the server is running
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "GST Invoice API is running",
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
const { team, activity } = require("./routes/team");

app.use("/api/auth", require("./routes/auth"));
app.use("/api/buyers", require("./routes/buyers"));
app.use("/api/items", require("./routes/items"));
app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/subscriptions", require("./routes/subscriptions"));
app.use("/api/sellers", require("./routes/sellers"));
app.use("/api/purchases", require("./routes/purchases"));
app.use("/api/insights", require("./routes/insights"));
app.use("/api/assistant", require("./routes/assistant"));
app.use("/api/quotations", require("./routes/quotations"));
app.use("/api/credit-notes", require("./routes/creditNotes"));
app.use("/api/stock", require("./routes/stock"));
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/ledger", require("./routes/ledger"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/data", require("./routes/data"));
app.use("/api/team", team);
app.use("/api/activity", activity);

app.use((req, res) => res.status(404).json({ success: false, message: "Not found" }));

// ─── Global error handler ─────────────────────────────────────────────────────
// Catches errors passed on by routes and the body parser. Must stay last.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "That file is too large" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "The request could not be read" });
  }
  sendError(req, res, err);
});

module.exports = app;
