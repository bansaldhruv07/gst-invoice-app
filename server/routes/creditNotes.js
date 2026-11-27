const express = require("express");
const router = express.Router();
const CreditNote = require("../models/CreditNote");
const Invoice = require("../models/Invoice");
const { protect } = require("../middleware/auth");
const { nextInSeries, financialYear } = require("../services/invoiceNumber");
const { createNumbered } = require("../services/documents");
const { computeTotals } = require("../services/gst");
const { refreshBalance } = require("../services/balance");
const { round2, sum, BadRequest, route, findOwned, retryOnConflict, withLock } = require("../services/common");

router.use(protect);

// Keeps the invoice's credited amount and balance in step with its credit notes
async function applyToInvoice(invoiceId) {
  await retryOnConflict(async () => {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return;
    const notes = await CreditNote.find({ invoice: invoice._id }).select("grandTotal");
    invoice.creditedAmount = sum(notes, (n) => n.grandTotal);
    refreshBalance(invoice);
    await invoice.save();
  });
}

router.get("/", route(async (req, res) => {
  const creditNotes = await CreditNote.find({ user: req.user._id })
    .populate("buyer", "name")
    .populate("invoice", "invoiceNumber")
    .sort({ createdAt: -1 })
    .limit(500);
  res.json({ success: true, creditNotes });
}));

router.get("/:id", route(async (req, res) => {
  const creditNote = await findOwned(CreditNote, req, req.params.id, "Credit note");
  await creditNote.populate("buyer");
  await creditNote.populate("invoice");
  res.json({ success: true, creditNote });
}));

// body: { invoiceId, date, reason, restock, items: [{ lineId, quantity }] }
router.post("/", route(async (req, res) => {
  const { invoiceId } = req.body;
  if (!invoiceId) throw new BadRequest("Choose an invoice");
  const target = await findOwned(Invoice, req, invoiceId, "Invoice");
  // Held while we count what has already been returned, so it cannot be returned twice
  await withLock(Invoice, target._id, () => createCreditNote(req, res));
}));

async function createCreditNote(req, res) {
  const { invoiceId, date, reason, restock = true, items } = req.body;
  const invoice = await findOwned(Invoice, req, invoiceId, "Invoice");
  if (invoice.status === "cancelled") throw new BadRequest("This invoice is cancelled");

  const earlier = await CreditNote.find({ invoice: invoice._id });
  const returned = (lineId) =>
    earlier.reduce(
      (total, note) =>
        total + note.items.filter((l) => String(l.sourceLine) === lineId).reduce((s, l) => s + l.quantity, 0),
      0,
    );

  const requested = (Array.isArray(items) ? items : []).filter((l) => Number(l.quantity) > 0);
  if (!requested.length) throw new BadRequest("Enter the quantity being returned");

  const seen = new Set();
  const lines = requested.map((r) => {
    const lineId = String(r.lineId);
    const source = invoice.items.id(lineId);
    if (!source || seen.has(lineId)) throw new BadRequest("That item is not on this invoice");
    seen.add(lineId);
    const quantity = Number(r.quantity);
    const left = Math.round((source.quantity - returned(lineId)) * 1000) / 1000;
    if (quantity > left) throw new BadRequest(`Only ${left} of ${source.name} can still be returned`);
    return {
      item: source.item, name: source.name, hsn: source.hsn, unit: source.unit,
      quantity, rate: source.rate, gstPercent: source.gstPercent,
    };
  });

  const totals = computeTotals(lines, {
    taxType: invoice.taxType,
    taxMode: invoice.taxMode,
    billOfSupply: invoice.invoiceType === "bill_of_supply",
  });
  totals.items.forEach((line, i) => {
    line.sourceLine = requested[i].lineId;
  });

  // The invoice discount is returned in proportion to the value returned
  const invoiceLines = sum(invoice.items, (l) => l.totalAmount);
  const share = invoiceLines ? sum(totals.items, (l) => l.totalAmount) / invoiceLines : 0;
  const discountAmount = round2(invoice.discountAmount * share);
  const exact = round2(totals.totalAmount - discountAmount);

  // The last return makes the notes add up to exactly the invoice total
  const completesReturn = invoice.items.every((l) => {
    const now = requested.find((r) => String(r.lineId) === String(l._id));
    return returned(String(l._id)) + Number(now?.quantity || 0) >= l.quantity - 0.0005;
  });
  const remaining = round2(invoice.grandTotal - sum(earlier, (n) => n.grandTotal));
  const grandTotal = completesReturn ? remaining : Math.min(Math.round(exact), remaining);
  if (!(grandTotal > 0)) throw new BadRequest("There is no value left to credit on this invoice");

  const noteDate = date ? new Date(date) : new Date();
  const head = `CN-${financialYear(noteDate)}/`;
  const creditNote = await createNumbered(
    CreditNote,
    {
      ...totals,
      user: req.user._id,
      invoice: invoice._id,
      buyer: invoice.buyer,
      date: noteDate,
      reason: String(reason || ""),
      restock: Boolean(restock),
      taxType: invoice.taxType,
      taxMode: invoice.taxMode,
      discountAmount,
      grandTotal,
      roundOff: round2(grandTotal - exact),
    },
    "number",
    () => nextInSeries(CreditNote, req.user._id, "number", head),
  );

  await applyToInvoice(invoice._id);
  res.status(201).json({ success: true, creditNote });
}

router.delete("/:id", route(async (req, res) => {
  const creditNote = await findOwned(CreditNote, req, req.params.id, "Credit note");
  await creditNote.deleteOne();
  await applyToInvoice(creditNote.invoice);
  res.json({ success: true });
}));

module.exports = router;
