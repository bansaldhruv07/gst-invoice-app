const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const reports = require("../services/reports");
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

module.exports = router;
