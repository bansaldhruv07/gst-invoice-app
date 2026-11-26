const express = require("express");
const router = express.Router();
const Quotation = require("../models/Quotation");
const Invoice = require("../models/Invoice");
const Buyer = require("../models/Buyer");
const { protect } = require("../middleware/auth");
const { canCreateInvoice } = require("../middleware/checkPlan");
const { nextInvoiceNumber, nextInSeries, financialYear, escapeRegex } = require("../services/invoiceNumber");
const { buildDocument, createNumbered } = require("../services/documents");
const { BadRequest, route, findOwned } = require("../services/common");

router.use(protect);

router.get("/", route(async (req, res) => {
  const filter = { user: req.user._id };
  const { search, status } = req.query;
  if (status && status !== "all") filter.status = status;
  if (search) {
    const pattern = { $regex: escapeRegex(String(search)), $options: "i" };
    const buyers = await Buyer.find({ user: req.user._id, name: pattern }).select("_id");
    filter.$or = [{ buyer: { $in: buyers.map((b) => b._id) } }, { invoiceNumber: pattern }];
  }
  const quotations = await Quotation.find(filter)
    .select("-signatureUrl")
    .populate("buyer", "name gstin mobile")
    .sort({ createdAt: -1 })
    .limit(500);
  res.json({ success: true, quotations });
}));

router.get("/:id", route(async (req, res) => {
  const quotation = await findOwned(Quotation, req, req.params.id, "Quotation");
  await quotation.populate("buyer");
  res.json({ success: true, quotation });
}));

router.post("/", route(async (req, res) => {
  const fields = await buildDocument(req.user, req.body);
  const head = `QT-${financialYear(fields.invoiceDate)}/`;
  const quotation = await createNumbered(
    Quotation,
    { ...fields, validUntil: req.body.validUntil || null, status: "open", balanceAmount: 0 },
    "invoiceNumber",
    () => nextInSeries(Quotation, req.user._id, "invoiceNumber", head),
  );
  await quotation.populate("buyer");
  res.status(201).json({ success: true, quotation });
}));

router.put("/:id", route(async (req, res) => {
  const quotation = await findOwned(Quotation, req, req.params.id, "Quotation");
  if (quotation.status === "converted") {
    throw new BadRequest("This quotation has already become an invoice");
  }
  const fields = await buildDocument(req.user, req.body);
  quotation.set({ ...fields, validUntil: req.body.validUntil || null });
  await quotation.save();
  await quotation.populate("buyer");
  res.json({ success: true, quotation });
}));

router.put("/:id/status", route(async (req, res) => {
  if (!["open", "accepted", "declined"].includes(req.body.status)) {
    throw new BadRequest("Invalid status");
  }
  const quotation = await findOwned(Quotation, req, req.params.id, "Quotation");
  if (quotation.status === "converted") {
    throw new BadRequest("This quotation has already become an invoice");
  }
  quotation.status = req.body.status;
  await quotation.save();
  res.json({ success: true, quotation });
}));

// Makes an invoice, dated today, with the quoted items and prices
router.post("/:id/convert", canCreateInvoice, route(async (req, res) => {
  // Claim the quotation first so two quick clicks cannot create two invoices
  const quotation = await Quotation.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, status: { $ne: "converted" } },
    { status: "converted" },
    { new: false },
  );
  if (!quotation) throw new BadRequest("This quotation has already become an invoice, or no longer exists");

  try {
    const source = quotation.toObject();
    for (const key of ["_id", "__v", "createdAt", "updatedAt", "validUntil", "convertedInvoice"]) {
      delete source[key];
    }
    const invoiceDate = new Date(new Date().toISOString().slice(0, 10));
    const fields = {
      ...source,
      items: source.items.map(({ _id, ...line }) => line),
      invoiceDate,
      dueDate: null,
      dateOfSupply: null,
      status: "unpaid",
      paidAmount: 0,
      creditedAmount: 0,
      paymentHistory: [],
      balanceAmount: source.grandTotal,
    };
    const invoice = await createNumbered(Invoice, fields, "invoiceNumber", () =>
      nextInvoiceNumber(req.user, invoiceDate),
    );
    await Quotation.updateOne({ _id: quotation._id }, { convertedInvoice: invoice._id });
    if (req.sub) {
      req.sub.usage.invoicesThisMonth += 1;
      await req.sub.save();
    }
    res.status(201).json({ success: true, invoice });
  } catch (err) {
    await Quotation.updateOne({ _id: quotation._id }, { status: quotation.status });
    throw err;
  }
}));

router.delete("/:id", route(async (req, res) => {
  const quotation = await findOwned(Quotation, req, req.params.id, "Quotation");
  await quotation.deleteOne();
  res.json({ success: true });
}));

module.exports = router;
