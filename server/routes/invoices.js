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
const Activity = require("../models/Activity");
const Quotation = require("../models/Quotation");
const User = require("../models/User");
const { thisMonth, deletedThisMonth } = require("../services/usage");
const { round2, BadRequest, route, findOwned, retryOnConflict, isDateString, withLock } = require("../services/common");

// All invoice routes require login
router.use(protect);

// GST allows up to 16 characters: letters, digits, "-" and "/"
function checkNumber(value) {
  if (!/^[A-Za-z0-9/-]{1,16}$/.test(value)) {
    throw new BadRequest("An invoice number can have up to 16 letters, digits, - or /");
  }
}

// ─── POST /api/invoices ───────────────────────────────────────────────────────
router.post("/", canCreateInvoice, route(async (req, res) => {
  const fields = await buildDocument(req.user, req.body);
  const record = { ...fields, status: "unpaid", paidAmount: 0, balanceAmount: fields.grandTotal };
  // The owner may type the number, for example to continue an old bill book
  const typed = req.role === "owner" ? String(req.body.invoiceNumber || "").trim() : "";

  let invoice;
  if (typed) {
    checkNumber(typed);
    try {
      invoice = await Invoice.create({ ...record, invoiceNumber: typed });
    } catch (err) {
      if (err.code !== 11000) throw err;
      throw new BadRequest(`Invoice number ${typed} is already used`);
    }
  } else {
    invoice = await createNumbered(Invoice, record, "invoiceNumber", () =>
      nextInvoiceNumber(req.user, fields.invoiceDate),
    );
  }

  await invoice.populate("buyer");
  if (req.sub) {
    req.sub.usage.invoicesThisMonth += 1;
    await req.sub.save();
  }
  res.status(201).json({ success: true, message: "Invoice created successfully", invoice });
}));

// ─── GET /api/invoices/next-number ────────────────────────────────────────────
// What the next bill would be called, split for the form
router.get("/next-number", route(async (req, res) => {
  const date = isDateString(req.query.date) ? new Date(req.query.date) : new Date();
  const invoiceNumber = await nextInvoiceNumber(req.user, date);
  const [, prefix, number] = invoiceNumber.match(/^(.*?)(\d+)$/) || [null, "", invoiceNumber];
  res.json({ success: true, invoiceNumber, prefix, number });
}));

// ─── GET /api/invoices/stats ──────────────────────────────────────────────────
// Must be defined before /:id
router.get("/stats", route(async (req, res) => {
  const [[totals], counts] = await Promise.all([
    Invoice.aggregate([
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
    ]),
    Invoice.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
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
  if (req.query.type === "bill_of_supply") filter.invoiceType = "bill_of_supply";
  if (req.query.einvoice === "1") filter.irn = { $nin: ["", null] };
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
  const [total, invoices] = await Promise.all([
    Invoice.countDocuments(filter),
    Invoice.find(filter)
      .select("-signatureUrl")
      .populate("buyer", "name gstin city state")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
  ]);

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
  const invoice = await retryOnConflict(() => changeStatus(req, status));
  res.json({ success: true, message: `Invoice marked as ${invoice.status}`, invoice });
}));

async function changeStatus(req, status) {
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
  return invoice;
}

// ─── POST /api/invoices/:id/payment ──────────────────────────────────────────
router.post("/:id/payment", route(async (req, res) => {
  const { date, mode, note } = req.body;
  const amount = Number(req.body.amount);
  if (!(amount > 0)) throw new BadRequest("Payment amount must be greater than 0");

  // Two payments recorded at once: the second re-reads the new balance first
  const invoice = await retryOnConflict(async () => {
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
    return invoice.save();
  });

  res.json({
    success: true,
    message: "Payment recorded successfully",
    paidAmount: invoice.paidAmount,
    balanceAmount: invoice.balanceAmount,
    status: invoice.status,
    invoice,
  });
}));

// ─── PUT /api/invoices/:id/compliance ─────────────────────────────────────────
// Records the numbers received from the e-invoice and e-way bill portals. These
// do not change any amount, so they can be added after payments and returns.
router.put("/:id/compliance", route(async (req, res) => {
  const text = (v, max) => String(v ?? "").trim().slice(0, max);
  const invoice = await retryOnConflict(async () => {
    const invoice = await findOwned(Invoice, req, req.params.id, "Invoice");
    if (invoice.status === "cancelled") throw new BadRequest("This invoice is cancelled");
    const { irn, ackNumber, ackDate, ewayBillNumber, ewayBillDate } = req.body;
    if (irn !== undefined) {
      const value = text(irn, 64);
      if (value && !/^[A-Za-z0-9]{10,64}$/.test(value)) {
        throw new BadRequest("The IRN is a long code of letters and digits from the e-invoice portal");
      }
      invoice.irn = value;
    }
    if (ackNumber !== undefined) invoice.ackNumber = text(ackNumber, 30);
    if (ackDate !== undefined) invoice.ackDate = ackDate || null;
    if (ewayBillNumber !== undefined) {
      const value = text(ewayBillNumber, 20).replace(/\s/g, "");
      if (value && !/^\d{12}$/.test(value)) throw new BadRequest("An e-way bill number has 12 digits");
      invoice.ewayBillNumber = value;
    }
    if (ewayBillDate !== undefined) invoice.ewayBillDate = ewayBillDate || null;
    return invoice.save();
  });
  await invoice.populate("buyer");
  res.json({ success: true, invoice });
}));

// ─── PUT /api/invoices/:id/signature ──────────────────────────────────────────
router.put("/:id/signature", route(async (req, res) => {
  const signatureUrl = String(req.body.signatureUrl || "");
  if (signatureUrl && !/^data:image\/(png|jpe?g|webp);base64,/.test(signatureUrl)) {
    throw new BadRequest("Choose an image file for the signature");
  }
  if (signatureUrl.length > 900000) throw new BadRequest("That image is too large");
  const invoice = await retryOnConflict(async () => {
    const invoice = await findOwned(Invoice, req, req.params.id, "Invoice");
    invoice.signatureUrl = signatureUrl;
    return invoice.save();
  });
  await invoice.populate("buyer");
  res.json({ success: true, invoice });
}));

// ─── GET /api/invoices/:id/history ────────────────────────────────────────────
router.get("/:id/history", route(async (req, res) => {
  const invoice = await findOwned(Invoice, req, req.params.id, "Invoice");
  const entries = await Activity.find({ user: req.user._id, target: invoice._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({
    success: true,
    createdAt: invoice.createdAt,
    entries: entries.map((e) => ({ id: e._id, at: e.createdAt, who: e.actorName, action: e.action, detail: e.label })),
  });
}));

// ─── DELETE /api/invoices/:id ─────────────────────────────────────────────────
// Only a bill with no money against it. Cancelling is better, as it keeps the
// number; the screen says so.
router.delete("/:id", route(async (req, res) => {
  const found = await findOwned(Invoice, req, req.params.id, "Invoice");
  await withLock(Invoice, found._id, async () => {
    const invoice = await findOwned(Invoice, req, req.params.id, "Invoice");
    if (invoice.paymentHistory.length) {
      throw new BadRequest("Payments are recorded on this invoice, so it cannot be deleted. Cancel it instead.");
    }
    if (await CreditNote.exists({ invoice: invoice._id })) {
      throw new BadRequest("This invoice has a credit note, so it cannot be deleted");
    }
    const removed = await Invoice.deleteOne({ _id: invoice._id, __v: invoice.__v });
    if (!removed.deletedCount) throw new BadRequest("This invoice just changed. Please try again.", 409);

    await Quotation.updateMany(
      { user: req.user._id, convertedInvoice: invoice._id },
      { status: "accepted", convertedInvoice: null },
    );
    if (invoice.createdAt.toISOString().slice(0, 7) === thisMonth()) {
      const user = await User.findById(req.user._id);
      user.invoiceDeletions = { month: thisMonth(), count: deletedThisMonth(user) + 1 };
      await user.save();
    }
  });
  res.json({ success: true, message: "Invoice deleted", invoiceNumber: found.invoiceNumber });
}));

module.exports = router;
