const express = require("express");
const router = express.Router();
const Expense = require("../models/Expense");
const { protect } = require("../middleware/auth");
const { BadRequest, route, findOwned, isDateString, round2, sum } = require("../services/common");

router.use(protect);

const FIELDS = ["date", "category", "amount", "gstAmount", "mode", "payee", "note"];

function pickFields(body) {
  const fields = {};
  for (const key of FIELDS) if (body[key] !== undefined && body[key] !== "") fields[key] = body[key];
  for (const key of ["payee", "note"]) if (body[key] === "") fields[key] = "";
  if (body.gstAmount === "") fields.gstAmount = 0;
  return fields;
}

function check(expense) {
  if (expense.gstAmount > expense.amount) {
    throw new BadRequest("GST cannot be more than the amount");
  }
}

router.get("/", route(async (req, res) => {
  const { from, to, category } = req.query;
  const filter = { user: req.user._id };
  if (isDateString(from) || isDateString(to)) {
    filter.date = {};
    if (isDateString(from)) filter.date.$gte = new Date(`${from}T00:00:00Z`);
    if (isDateString(to)) filter.date.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  if (category) filter.category = String(category);

  const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 }).limit(2000).lean();
  const byCategory = new Map();
  for (const e of expenses) byCategory.set(e.category, round2((byCategory.get(e.category) || 0) + e.amount));

  res.json({
    success: true,
    expenses,
    total: sum(expenses, (e) => e.amount),
    byCategory: [...byCategory].map(([name, amount]) => ({ category: name, amount })).sort((a, b) => b.amount - a.amount),
  });
}));

router.post("/", route(async (req, res) => {
  const expense = new Expense({ ...pickFields(req.body), user: req.user._id });
  check(expense);
  await expense.save();
  res.status(201).json({ success: true, expense });
}));

router.put("/:id", route(async (req, res) => {
  const expense = await findOwned(Expense, req, req.params.id, "Expense");
  expense.set(pickFields(req.body));
  check(expense);
  await expense.save();
  res.json({ success: true, expense });
}));

router.delete("/:id", route(async (req, res) => {
  const expense = await findOwned(Expense, req, req.params.id, "Expense");
  await expense.deleteOne();
  res.json({ success: true });
}));

module.exports = router;
