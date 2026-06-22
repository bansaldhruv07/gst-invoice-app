const express = require("express");
const router = express.Router();
const Invoice = require("../models/Invoice");
const Buyer = require("../models/Buyer");
const { protect } = require("../middleware/auth");
const { canCreateInvoice } = require("../middleware/checkPlan");

// All invoice routes require login
router.use(protect);

// ─── Helper: convert number to words (for PDF "Amount in Words") ──────────────
function numberToWords(amount) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertHundreds(n) {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + " " + ones[n % 10] + " ";
    return ones[Math.floor(n / 100)] + " Hundred " + convertHundreds(n % 100);
  }

  function convertToWords(n) {
    if (n === 0) return "Zero";
    let result = "";
    // Indian numbering: crore, lakh, thousand
    if (n >= 10000000) {
      result += convertHundreds(Math.floor(n / 10000000)) + "Crore ";
      n %= 10000000;
    }
    if (n >= 100000) {
      result += convertHundreds(Math.floor(n / 100000)) + "Lakh ";
      n %= 100000;
    }
    if (n >= 1000) {
      result += convertHundreds(Math.floor(n / 1000)) + "Thousand ";
      n %= 1000;
    }
    result += convertHundreds(n);
    return result.trim();
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let words = "Rupees " + convertToWords(rupees);
  if (paise > 0) words += " and " + convertToWords(paise) + " Paise";
  return words + " Only";
}

// ─── Helper: auto-generate invoice number ─────────────────────────────────────
// Format: INV-2024-0001, INV-2024-0002, etc.
async function generateInvoiceNumber(userId) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  // Find the latest invoice for this user in the current year
  const lastInvoice = await Invoice.findOne({
    user: userId,
    invoiceNumber: { $regex: `^${prefix}` },
  }).sort({ invoiceNumber: -1 });

  if (!lastInvoice) {
    return `${prefix}0001`;
  }

  // Extract the numeric part and increment
  const lastNumber = parseInt(lastInvoice.invoiceNumber.split("-")[2], 10);
  const nextNumber = String(lastNumber + 1).padStart(4, "0");
  return `${prefix}${nextNumber}`;
}

// ─── Helper: calculate GST for all items ─────────────────────────────────────
// taxType: "cgst_sgst" (intra-state) or "igst" (inter-state)
// taxMode: "exclusive" (rate excl GST) or "inclusive" (rate incl GST)
function calculateItems(items, taxType, taxMode) {
  return items.map((item) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const gstPercent = Number(item.gstPercent) || 0;

    let taxableAmount, gstAmount;

    if (taxMode === "inclusive") {
      // Rate includes GST — back-calculate taxable amount
      // taxableAmount = (rate × qty) / (1 + gstPercent/100)
      const grossAmount = rate * qty;
      taxableAmount = grossAmount / (1 + gstPercent / 100);
      gstAmount = grossAmount - taxableAmount;
    } else {
      // Exclusive: taxable = rate × qty, then add GST on top
      taxableAmount = rate * qty;
      gstAmount = (taxableAmount * gstPercent) / 100;
    }

    // Round to 2 decimal places
    taxableAmount = Math.round(taxableAmount * 100) / 100;
    gstAmount = Math.round(gstAmount * 100) / 100;

    let cgstPercent = 0,
      cgstAmount = 0;
    let sgstPercent = 0,
      sgstAmount = 0;
    let igstPercent = 0,
      igstAmount = 0;

    if (taxType === "cgst_sgst") {
      // Intra-state: split GST equally into CGST and SGST
      cgstPercent = gstPercent / 2;
      sgstPercent = gstPercent / 2;
      cgstAmount = Math.round((gstAmount / 2) * 100) / 100;
      sgstAmount = Math.round((gstAmount / 2) * 100) / 100;
    } else {
      // Inter-state: full GST as IGST
      igstPercent = gstPercent;
      igstAmount = gstAmount;
    }

    const totalAmount = Math.round((taxableAmount + gstAmount) * 100) / 100;

    return {
      ...item,
      taxableAmount,
      cgstPercent,
      cgstAmount,
      sgstPercent,
      sgstAmount,
      igstPercent,
      igstAmount,
      totalAmount,
    };
  });
}

// ─── POST /api/invoices ───────────────────────────────────────────────────────
// Create a new invoice
router.post("/", canCreateInvoice, async (req, res) => {
  try {
    const {
      buyerId,
      invoiceDate,
      dueDate,
      invoiceType,
      taxMode,
      items,
      discountType,
      discountValue,
      notes,
      terms,
    } = req.body;

    // Validate required fields
    if (!buyerId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Buyer and at least one item are required",
      });
    }

    // Fetch buyer to determine tax type (intra vs inter state)
    const buyer = await Buyer.findOne({ _id: buyerId, user: req.user._id });
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: "Buyer not found",
      });
    }

    // Compare supplier state code (from .env) with buyer state code
    const supplierStateCode = process.env.SUPPLIER_STATE_CODE || "07";
    const buyerStateCode = buyer.stateCode || "";
    const taxType =
      buyerStateCode && buyerStateCode !== supplierStateCode
        ? "igst" // different state → IGST
        : "cgst_sgst"; // same state or unknown → CGST + SGST

    // Calculate GST for each line item
    const calculatedItems = calculateItems(
      items,
      taxType,
      taxMode || "exclusive",
    );

    // Sum up all item totals
    const subTotal = calculatedItems.reduce((s, i) => s + i.taxableAmount, 0);
    const totalCgst = calculatedItems.reduce((s, i) => s + i.cgstAmount, 0);
    const totalSgst = calculatedItems.reduce((s, i) => s + i.sgstAmount, 0);
    const totalIgst = calculatedItems.reduce((s, i) => s + i.igstAmount, 0);
    const totalTax = totalCgst + totalSgst + totalIgst;

    // Calculate discount
    let discountAmount = 0;
    const dValue = Number(discountValue) || 0;
    if (discountType === "percent") {
      discountAmount = Math.round(((subTotal * dValue) / 100) * 100) / 100;
    } else {
      discountAmount = dValue;
    }

    // Total before rounding
    const totalAmount = subTotal - discountAmount + totalTax;

    // Round off to nearest rupee
    const grandTotal = Math.round(totalAmount);
    const roundOff = Math.round((grandTotal - totalAmount) * 100) / 100;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(req.user._id);

    // Amount in words
    const amountInWords = numberToWords(grandTotal);

    const invoice = await Invoice.create({
      user: req.user._id,
      invoiceNumber,
      invoiceDate: invoiceDate || new Date(),
      dueDate: dueDate || null,
      buyer: buyerId,
      invoiceType: invoiceType || "tax_invoice",
      taxMode: taxMode || "exclusive",
      taxType,
      items: calculatedItems,
      discountType: discountType || "amount",
      discountValue: dValue,
      discountAmount,
      subTotal: Math.round(subTotal * 100) / 100,
      totalCgst: Math.round(totalCgst * 100) / 100,
      totalSgst: Math.round(totalSgst * 100) / 100,
      totalIgst: Math.round(totalIgst * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      roundOff,
      grandTotal,
      amountInWords,
      status: "unpaid",
      paidAmount: 0,
      balanceAmount: grandTotal,
      notes: notes || "",
      terms: terms || "Payment due within 30 days.",
    });

    // Populate buyer details before returning
    await invoice.populate("buyer");
    if (req.sub) {
      req.sub.usage.invoicesThisMonth += 1;
      await req.sub.save();
    }
    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      invoice,
    });
  } catch (err) {
    console.error("Create invoice error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/invoices/stats ──────────────────────────────────────────────────
// Dashboard stats — MUST be defined before /:id route
router.get("/stats", async (req, res) => {
  try {
    const userId = req.user._id;

    // MongoDB aggregation to compute stats in a single DB query
    const stats = await Invoice.aggregate([
      {
        // Only this user's invoices, exclude cancelled
        $match: {
          user: userId,
          status: { $ne: "cancelled" },
        },
      },
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

    // Count by status
    const unpaidCount = await Invoice.countDocuments({
      user: userId,
      status: "unpaid",
    });
    const partialCount = await Invoice.countDocuments({
      user: userId,
      status: "partial",
    });
    const paidCount = await Invoice.countDocuments({
      user: userId,
      status: "paid",
    });
    const cancelledCount = await Invoice.countDocuments({
      user: userId,
      status: "cancelled",
    });

    const data = stats[0] || {
      totalInvoices: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalBalance: 0,
    };

    res.json({
      success: true,
      stats: {
        totalInvoices: data.totalInvoices,
        totalAmount: Math.round(data.totalAmount * 100) / 100,
        totalPaid: Math.round(data.totalPaid * 100) / 100,
        totalBalance: Math.round(data.totalBalance * 100) / 100,
        unpaidCount,
        partialCount,
        paidCount,
        cancelledCount,
      },
    });
  } catch (err) {
    console.error("Stats error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET /api/invoices ────────────────────────────────────────────────────────
// List all invoices with filters
router.get("/", async (req, res) => {
  try {
    const {
      status,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { user: req.user._id };

    // Filter by status
    if (status && status !== "all") {
      filter.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) filter.invoiceDate.$lte = new Date(endDate);
    }

    // If search provided, find buyers whose names match, then filter invoices
    if (search) {
      const matchingBuyers = await Buyer.find({
        user: req.user._id,
        name: { $regex: search, $options: "i" },
      }).select("_id");

      const buyerIds = matchingBuyers.map((b) => b._id);

      filter.$or = [
        { buyer: { $in: buyerIds } },
        { invoiceNumber: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Invoice.countDocuments(filter);

    const invoices = await Invoice.find(filter)
      .populate("buyer", "name gstin city state") // only fetch needed buyer fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      invoices,
    });
  } catch (err) {
    console.error("Get invoices error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET /api/invoices/:id ────────────────────────────────────────────────────
// Single invoice with full buyer details
router.get("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate("buyer");

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.json({ success: true, invoice });
  } catch (err) {
    console.error("Get invoice error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PUT /api/invoices/:id/status ────────────────────────────────────────────
// Update invoice status manually
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["unpaid", "partial", "paid", "cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be: unpaid, partial, paid, or cancelled",
      });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    invoice.status = status;
    await invoice.save();

    res.json({
      success: true,
      message: `Invoice marked as ${status}`,
      invoice,
    });
  } catch (err) {
    console.error("Update status error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST /api/invoices/:id/payment ──────────────────────────────────────────
// Record a payment against an invoice
router.post("/:id/payment", async (req, res) => {
  try {
    const { amount, date, mode, note } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than 0",
      });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (invoice.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot record payment for a cancelled invoice",
      });
    }

    // Add payment to history
    invoice.paymentHistory.push({
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      mode: mode || "upi",
      note: note || "",
    });

    // Recalculate paid and balance amounts
    invoice.paidAmount = invoice.paymentHistory.reduce(
      (s, p) => s + p.amount,
      0,
    );
    invoice.balanceAmount = Math.max(
      0,
      invoice.grandTotal - invoice.paidAmount,
    );

    // Auto-update status based on payment
    if (invoice.paidAmount >= invoice.grandTotal) {
      invoice.status = "paid";
    } else if (invoice.paidAmount > 0) {
      invoice.status = "partial";
    }

    await invoice.save();

    res.json({
      success: true,
      message: "Payment recorded successfully",
      paidAmount: invoice.paidAmount,
      balanceAmount: invoice.balanceAmount,
      status: invoice.status,
      invoice,
    });
  } catch (err) {
    console.error("Payment error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
