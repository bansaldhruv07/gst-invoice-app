const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const reports = require("../services/reports");
const registers = require("../services/registers");
const { route, isDateString, BadRequest } = require("../services/common");

router.use(protect);

function period({ from, to }) {
  if (!isDateString(from) || !isDateString(to) || from > to) {
    throw new BadRequest("Choose a valid date range");
  }
  return [from, to];
}

router.get("/summary", route(async (req, res) => {
  res.json({ success: true, report: await reports.summaryReport(req.user._id, ...period(req.query)) });
}));

router.get("/gst", route(async (req, res) => {
  res.json({ success: true, report: await reports.gstReport(req.user, ...period(req.query)) });
}));

router.get("/daybook", route(async (req, res) => {
  res.json({ success: true, report: await reports.dayBook(req.user._id, ...period(req.query)) });
}));

router.get("/sales", route(async (req, res) => {
  res.json({ success: true, report: await registers.salesReport(req.user, ...period(req.query)) });
}));

router.get("/purchases", route(async (req, res) => {
  res.json({ success: true, report: await registers.purchaseReport(req.user, ...period(req.query)) });
}));

router.get("/gstr2", route(async (req, res) => {
  res.json({ success: true, report: await registers.gstr2Report(req.user, ...period(req.query)) });
}));

// These two show the position now, so they take no dates
router.get("/stock", route(async (req, res) => {
  res.json({ success: true, report: await registers.stockReport(req.user._id) });
}));

router.get("/outstanding", route(async (req, res) => {
  res.json({ success: true, report: await registers.outstandingReport(req.user._id) });
}));

module.exports = router;
