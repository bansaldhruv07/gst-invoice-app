const express = require("express");
const router = express.Router();
const Invoice = require("../models/Invoice");
const Buyer = require("../models/Buyer");
const CreditNote = require("../models/CreditNote");
const { protect } = require("../middleware/auth");
const { canCreateInvoice } = require("../middleware/checkPlan");
const { nextInvoiceNumber, escapeRegex } = require("../services/invoiceNumber");
const { buildDocument, createNumbered } = require("../services/documents");
const { refreshBalance, AUTO_PAID_NOTE } = require("../services/balance");
const { round2, BadRequest, route, findOwned } = require("../services/common");

// All invoice routes require login
router.use(protect);

// ─── POST /api/invoices ───────────────────────────────────────────────────────
router.post("/", canCreateInvoice, route(async (req, res) => {
  const fields = await buildDocument(req.user, req.body);
  const invoice = await createNumbered(
    Invoice,
    { ...fields, status: "unpaid", paidAmount: 0, balanceAmount: fields.grandTotal },
    "invoiceNumber",
    () => nextInvoiceNumber(req.user, fields.invoiceDate),
  );

  await invoice.populate("buyer");
  if (req.sub) {
    req.sub.usage.invoicesThisMonth += 1;
    await req.sub.save();
  }
  res.status(201).json({ success: true, message: "Invoice created successfully", invoice });
}));

// ─── GET /api/invoices/stats ──────────────────────────────────────────────────
// Must be defined before /:id
router.get("/stats", route(async (req, res) => {
  const [totals] = await Invoice.aggregate([
    { $match: { user: req.user._id, status: { $ne: "cancelled" } } },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalAmount: { $sum: "$grandTotal" },
        totalPaid: { $sum: "$paidAmount" },
        totalBalance: { $sum: "$balanceAmount" },
      },
    },
  ]);
  const counts = await Invoice.aggregate([
    { $match: { user: req.user._id } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  const count = (status) => counts.find((c) => c._id === status)?.n || 0;

  res.json({
    success: true,
    stats: {
      totalInvoices: totals?.totalInvoices || 0,
      totalAmount: round2(totals?.totalAmount),
      totalPaid: round2(totals?.totalPaid),
      totalBalance: round2(totals?.totalBalance),
      unpaidCount: count("unpaid"),
      partialCount: count("partial"),
      paidCount: count("paid"),
      cancelledCount: count("cancelled"),
    },
  });
}));

// ─── GET /api/invoices ────────────────────────────────────────────────────────
router.get("/", route(async (req, res) => {
  const { status, startDate, endDate, search, page = 1, limit = 20 } = req.query;
  const filter = { user: req.user._id };

  if (status && status !== "all") filter.status = status;
  if (startDate || endDate) {
    filter.invoiceDate = {};
    if (startDate) filter.invoiceDate.$gte = new Date(startDate);
    if (endDate) filter.invoiceDate.$lte = new Date(`${endDate}T23:59:59.999Z`);
  }
  if (search) {
    const pattern = { $regex: escapeRegex(String(search)), $options: "i" };
    const buyers = await Buyer.find({ user: req.user._id, name: pattern }).select("_id");
    filter.$or = [{ buyer: { $in: buyers.map((b) => b._id) } }, { invoiceNumber: pattern }];
  }

  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 5000);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * pageSize;
  const total = await Invoice.countDocuments(filter);
  const invoices = await Invoice.find(filter)
    .select("-signatureUrl")
    .populate("buyer", "name gstin city state")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);

  res.json({
    success: true,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / pageSize),
    invoices,
  });
}));

// ─── GET /api/invoices/:id ────────────────────────────────────────────────────
router.get("/:id", route(async (req, res) => {
  const invoice = await findOwned(Invoice, req, req.params.id, "Invoice");
  await invoice.populate("buyer");
  const creditNotes = await CreditNote.find({ user: req.user._id, invoice: invoice._id }).sort({ createdAt: 1 });
  res.json({ success: true, invoice, creditNotes });
}));

// ─── PUT /api/invoices/:id ────────────────────────────────────────────────────
// Corrects an invoice. The number stays the same.
router.put("/:id", route(async (req, res) => {
  const invoice = await findOwned(Invoice, req, req.params.id, "Invoice");
  if (invoice.status === "cancelled") {
    throw new BadRequest("A cancelled invoice cannot be edited");
  }
  if (await CreditNote.exists({ invoice: invoice._id })) {
    throw new BadRequest("This invoice has a credit note. Delete the credit note before editing.");
  }

  const fields = await buildDocument(req.user, req.body);
  if (invoice.paidAmount > 0 && String(fields.buyer) !== String(invoice.buyer)) {
    throw new BadRequest("Payments are recorded on this invoice, so the buyer cannot be changed");
  }
  if (fields.grandTotal < invoice.paidAmount) {
    throw new BadRequest("The new total is less than what has already been received");
  }

  invoice.set(fields);
  refreshBalance(invoice);
  await invoice.save();
  await invoice.populate("buyer");
  res.json({ success: true, message: "Invoice updated", invoice });
}));

// ─── PUT /api/invoices/:id/status ────────────────────────────────────────────
router.put("/:id/status", route(async (req, res) => {
  const { status } = req.body;
  if (!["unpaid", "partial", "paid", "cancelled"].includes(status)) {
    throw new BadRequest("Invalid status. Must be: unpaid, partial, paid, or cancelled");
  }
  const invoice = await findOwned(Invoice, req, req.params.id, "Invoice");

  if (status === "cancelled") {
    if (await CreditNote.exists({ invoice: invoice._id })) {
      throw new BadRequest("Delete this invoice's credit notes before cancelling it");
    }
    invoice.status = "cancelled";
  } else {
    if (status === "paid") {
      const due = round2(invoice.grandTotal - invoice.paidAmount - invoice.creditedAmount);
      if (due > 0) invoice.paymentHistory.push({ amount: due, mode: "other", note: AUTO_PAID_NOTE });
    } else {
      // Undo an earlier "mark as paid"; payments recorded by hand are kept.
      invoice.paymentHistory = invoice.paymentHistory.filter((p) => p.note !== AUTO_PAID_NOTE);
    }
    invoice.status = "unpaid";
    refreshBalance(invoice);
  }
  await invoice.save();

  res.json({ success: true, message: `Invoice marked as ${invoice.status}`, invoice });
}));

// ─── POST /api/invoices/:id/payment ──────────────────────────────────────────
router.post("/:id/payment", route(async (req, res) => {
  const { date, mode, note } = req.body;
  const amount = Number(req.body.amount);
  if (!(amount > 0)) throw new BadRequest("Payment amount must be greater than 0");

  const invoice = await findOwned(Invoice, req, req.params.id, "Invoice");
  if (invoice.status === "cancelled") {
    throw new BadRequest("Cannot record payment for a cancelled invoice");
  }
  if (amount > invoice.balanceAmount + 0.001) {
    throw new BadRequest("Payment is more than the balance due");
  }

  invoice.paymentHistory.push({
    amount: round2(amount),
    date: date ? new Date(date) : new Date(),
    mode: mode || "upi",
    note: note || "",
  });
  refreshBalance(invoice);
  await invoice.save();

  res.json({
    success: true,
    message: "Payment recorded successfully",
    paidAmount: invoice.paidAmount,
    balanceAmount: invoice.balanceAmount,
    status: invoice.status,
    invoice,
  });
}));

module.exports = router;
