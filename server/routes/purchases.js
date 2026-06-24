const express  = require("express");
const router   = express.Router();
const Purchase = require("../models/Purchase");
const Seller   = require("../models/Seller");
const { protect } = require("../middleware/auth");

router.use(protect);

// ─── Helper: GST calculation (same logic as invoices) ────────────────────────
function calcItem(item, taxType, taxMode) {
  const qty        = parseFloat(item.quantity) || 0;
  const rate       = parseFloat(item.rate)     || 0;
  const gstPercent = parseFloat(item.gstPercent) || 0;

  let taxableAmount, gstAmount;
  if (taxMode === "inclusive") {
    const gross = qty * rate;
    taxableAmount = gross / (1 + gstPercent / 100);
    gstAmount     = gross - taxableAmount;
  } else {
    taxableAmount = qty * rate;
    gstAmount     = (taxableAmount * gstPercent) / 100;
  }

  taxableAmount = Math.round(taxableAmount * 100) / 100;
  gstAmount     = Math.round(gstAmount     * 100) / 100;

  let cgstPercent=0, cgstAmount=0, sgstPercent=0, sgstAmount=0, igstPercent=0, igstAmount=0;

  if (taxType === "cgst_sgst") {
    cgstPercent = gstPercent / 2; sgstPercent = gstPercent / 2;
    cgstAmount  = Math.round((gstAmount / 2) * 100) / 100;
    sgstAmount  = Math.round((gstAmount / 2) * 100) / 100;
  } else {
    igstPercent = gstPercent;
    igstAmount  = gstAmount;
  }

  return {
    ...item, taxableAmount,
    cgstPercent, cgstAmount,
    sgstPercent, sgstAmount,
    igstPercent, igstAmount,
    totalAmount: Math.round((taxableAmount + gstAmount) * 100) / 100,
  };
}

// ─── Helper: auto-generate purchase number ────────────────────────────────────
async function generatePurchaseNumber(userId) {
  const year   = new Date().getFullYear();
  const prefix = `PUR-${year}-`;
  const last   = await Purchase.findOne({
    user: userId,
    purchaseNumber: { $regex: `^${prefix}` },
  }).sort({ purchaseNumber: -1 });

  if (!last) return `${prefix}0001`;
  const num = parseInt(last.purchaseNumber.split("-")[2], 10);
  return `${prefix}${String(num + 1).padStart(4, "0")}`;
}

// ─── GET /api/purchases/stats ─────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const userId = req.user._id;
    const stats  = await Purchase.aggregate([
      { $match: { user: userId, status: { $ne: "cancelled" } } },
      { $group: {
        _id: null,
        totalPurchases: { $sum: 1 },
        totalAmount:    { $sum: "$grandTotal" },
        totalPaid:      { $sum: "$paidAmount" },
        totalBalance:   { $sum: "$balanceAmount" },
      }},
    ]);

    const unpaidCount    = await Purchase.countDocuments({ user: userId, status: "unpaid" });
    const partialCount   = await Purchase.countDocuments({ user: userId, status: "partial" });
    const paidCount      = await Purchase.countDocuments({ user: userId, status: "paid" });
    const cancelledCount = await Purchase.countDocuments({ user: userId, status: "cancelled" });

    const d = stats[0] || { totalPurchases: 0, totalAmount: 0, totalPaid: 0, totalBalance: 0 };
    res.json({ success: true, stats: { ...d, unpaidCount, partialCount, paidCount, cancelledCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/purchases ───────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status, startDate, endDate, search, page=1, limit=20 } = req.query;
    const filter = { user: req.user._id };

    if (status && status !== "all") filter.status = status;
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.$gte = new Date(startDate);
      if (endDate)   filter.purchaseDate.$lte = new Date(endDate);
    }
    if (search) {
      const matchingSellers = await Seller.find({
        user: req.user._id,
        name: { $regex: search, $options: "i" },
      }).select("_id");
      filter.$or = [
        { seller: { $in: matchingSellers.map(s => s._id) } },
        { purchaseNumber: { $regex: search, $options: "i" } },
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Purchase.countDocuments(filter);
    const purchases = await Purchase.find(filter)
      .populate("seller", "name gstin city state")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ success: true, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)), purchases });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/purchases/:id ───────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const purchase = await Purchase.findOne({ _id: req.params.id, user: req.user._id })
      .populate("seller");
    if (!purchase) return res.status(404).json({ success: false, message: "Purchase not found" });
    res.json({ success: true, purchase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/purchases ──────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      sellerId, purchaseDate, dueDate, purchaseType,
      taxMode, items, discountType, discountValue,
      sellerInvoiceNumber, notes, terms,
    } = req.body;

    if (!sellerId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Seller and items are required" });
    }

    const seller = await Seller.findOne({ _id: sellerId, user: req.user._id });
    if (!seller) return res.status(404).json({ success: false, message: "Seller not found" });

    const supplierStateCode = process.env.SUPPLIER_STATE_CODE || "07";
    const taxType = seller.stateCode && seller.stateCode !== supplierStateCode
      ? "igst" : "cgst_sgst";

    const calcItems    = items.map(i => calcItem(i, taxType, taxMode || "exclusive"));
    const subTotal     = calcItems.reduce((s, i) => s + i.taxableAmount, 0);
    const totalCgst    = calcItems.reduce((s, i) => s + i.cgstAmount,    0);
    const totalSgst    = calcItems.reduce((s, i) => s + i.sgstAmount,    0);
    const totalIgst    = calcItems.reduce((s, i) => s + i.igstAmount,    0);
    const totalTax     = totalCgst + totalSgst + totalIgst;

    const dValue = parseFloat(discountValue) || 0;
    const discountAmount = discountType === "percent"
      ? Math.round((subTotal * dValue / 100) * 100) / 100
      : dValue;

    const totalAmount = subTotal - discountAmount + totalTax;
    const grandTotal  = Math.round(totalAmount);
    const roundOff    = Math.round((grandTotal - totalAmount) * 100) / 100;

    const purchaseNumber = await generatePurchaseNumber(req.user._id);

    const purchase = await Purchase.create({
      user: req.user._id,
      purchaseNumber,
      sellerInvoiceNumber: sellerInvoiceNumber || "",
      purchaseDate:  purchaseDate || new Date(),
      dueDate:       dueDate || null,
      seller:        sellerId,
      purchaseType:  purchaseType || "tax_invoice",
      taxMode:       taxMode      || "exclusive",
      taxType,
      items:         calcItems,
      discountType:  discountType  || "amount",
      discountValue: dValue,
      discountAmount,
      subTotal:    Math.round(subTotal  * 100) / 100,
      totalCgst:   Math.round(totalCgst * 100) / 100,
      totalSgst:   Math.round(totalSgst * 100) / 100,
      totalIgst:   Math.round(totalIgst * 100) / 100,
      totalTax:    Math.round(totalTax  * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      roundOff,
      grandTotal,
      status:       "unpaid",
      paidAmount:   0,
      balanceAmount: grandTotal,
      notes: notes || "",
      terms: terms || "",
    });

    await purchase.populate("seller");
    res.status(201).json({ success: true, message: "Purchase created", purchase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/purchases/:id/status ───────────────────────────────────────────
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["unpaid","partial","paid","cancelled"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const purchase = await Purchase.findOne({ _id: req.params.id, user: req.user._id });
    if (!purchase) return res.status(404).json({ success: false, message: "Purchase not found" });
    purchase.status = status;
    await purchase.save();
    res.json({ success: true, message: `Marked as ${status}`, purchase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/purchases/:id/payment ─────────────────────────────────────────
router.post("/:id/payment", async (req, res) => {
  try {
    const { amount, date, mode, note } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount required" });
    }

    const purchase = await Purchase.findOne({ _id: req.params.id, user: req.user._id });
    if (!purchase) return res.status(404).json({ success: false, message: "Purchase not found" });
    if (purchase.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Cannot pay cancelled purchase" });
    }

    purchase.paymentHistory.push({
      amount: parseFloat(amount),
      date:   date ? new Date(date) : new Date(),
      mode:   mode || "upi",
      note:   note || "",
    });

    purchase.paidAmount    = purchase.paymentHistory.reduce((s, p) => s + p.amount, 0);
    purchase.balanceAmount = Math.max(0, purchase.grandTotal - purchase.paidAmount);
    purchase.status = purchase.paidAmount >= purchase.grandTotal
      ? "paid" : purchase.paidAmount > 0 ? "partial" : "unpaid";

    await purchase.save();
    res.json({ success: true, message: "Payment recorded", purchase });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/purchases/:id ────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const purchase = await Purchase.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!purchase) return res.status(404).json({ success: false, message: "Purchase not found" });
    res.json({ success: true, message: "Purchase deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;