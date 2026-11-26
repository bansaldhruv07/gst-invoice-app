const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { buildInsights } = require("../services/insights");

// GET /api/insights — figures and to-dos for the Overview page
router.get("/", protect, async (req, res) => {
  try {
    res.json({ success: true, insights: await buildInsights(req.user) });
  } catch (err) {
    console.error("Insights error:", err);
    res.status(500).json({ success: false, message: "Could not load your overview" });
  }
});

module.exports = router;
