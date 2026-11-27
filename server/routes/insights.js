const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { buildInsights } = require("../services/insights");

// Billing staff see sales and dues, not purchases, expenses, tax or setup
function forStaff({ payables: _payables, ...all }) {
  const sales = ({ month, label, invoiceCount, sales }) => ({ month, label, invoiceCount, sales });
  return {
    ...all,
    thisMonth: sales(all.thisMonth),
    lastMonth: sales(all.lastMonth),
    trend: all.trend.map(({ month, label, sales }) => ({ month, label, sales })),
    setup: [],
    attention: all.attention.filter((a) => ["overdue", "credit", "stock", "quotes", "mobile"].includes(a.id)),
    openQuotations: all.openQuotations,
    restricted: true,
  };
}

// GET /api/insights — figures and to-dos for the Overview page
router.get("/", protect, async (req, res) => {
  try {
    const insights = await buildInsights(req.user);
    res.json({ success: true, insights: req.role === "staff" ? forStaff(insights) : insights });
  } catch (err) {
    console.error("Insights error:", err);
    res.status(500).json({ success: false, message: "Could not load your overview" });
  }
});

module.exports = router;
