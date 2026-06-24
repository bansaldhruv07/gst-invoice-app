const mongoose = require("mongoose");

// ─── Sub-schema: each line item on the invoice ────────────────────────────────
const invoiceItemSchema = new mongoose.Schema({
  // Reference to Item master (optional — can also be ad-hoc)
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    default: null,
  },
  name:        { type: String, required: true },
  hsn:         { type: String, default: "" },
  unit:        { type: String, default: "pcs" },
  quantity:    { type: Number, required: true, min: 0 },
  rate:        { type: Number, required: true, min: 0 }, // price per unit (excl. GST)
  gstPercent:  { type: Number, default: 18 },

  // Calculated fields (stored so PDF doesn't need to recalculate)
  taxableAmount: { type: Number, default: 0 }, // quantity × rate
  cgstPercent:   { type: Number, default: 0 },
  cgstAmount:    { type: Number, default: 0 },
  sgstPercent:   { type: Number, default: 0 },
  sgstAmount:    { type: Number, default: 0 },
  igstPercent:   { type: Number, default: 0 },
  igstAmount:    { type: Number, default: 0 },
  totalAmount:   { type: Number, default: 0 }, // taxableAmount + all GST
});

// ─── Sub-schema: payment history entries ──────────────────────────────────────
const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date:   { type: Date,   default: Date.now },
  mode: {
    type: String,
    enum: ["cash", "upi", "bank_transfer", "cheque", "card", "other"],
    default: "upi",
  },
  note: { type: String, default: "" },
});

// ─── Main Invoice schema ───────────────────────────────────────────────────────
const invoiceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Auto-generated: INV-2024-0001 format
    invoiceNumber: {
      type: String,
      required: true,
    },

    invoiceDate: {
      type: Date,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    // Reference to buyer
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Buyer",
      required: true,
    },

    // Invoice type affects PDF header
    invoiceType: {
      type: String,
      enum: ["tax_invoice", "bill_of_supply"],
      default: "tax_invoice",
      // bill_of_supply is used for exempt/nil-rated goods (no GST)
    },

    // Whether rates entered are GST-inclusive or exclusive
    taxMode: {
      type: String,
      enum: ["exclusive", "inclusive"],
      default: "exclusive",
      // exclusive: rate + GST = total
      // inclusive: rate already includes GST, we back-calculate
    },

    // Whether CGST+SGST or IGST applies
    // Determined by comparing buyer's state with supplier's state
    taxType: {
      type: String,
      enum: ["cgst_sgst", "igst"],
      default: "cgst_sgst",
    },

    items: [invoiceItemSchema],

    // ── Discount ──────────────────────────────────────────────────────────────
    discountType: {
      type: String,
      enum: ["percent", "amount"],
      default: "amount",
    },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 }, // actual rupee discount

    // ── Invoice-level totals ──────────────────────────────────────────────────
    subTotal:      { type: Number, default: 0 }, // sum of all item taxableAmounts
    totalCgst:     { type: Number, default: 0 },
    totalSgst:     { type: Number, default: 0 },
    totalIgst:     { type: Number, default: 0 },
    totalTax:      { type: Number, default: 0 }, // totalCgst + totalSgst + totalIgst
    totalAmount:   { type: Number, default: 0 }, // subTotal - discount + totalTax
    roundOff:      { type: Number, default: 0 }, // difference after rounding
    grandTotal:    { type: Number, default: 0 }, // final rounded total

    // ── Payment tracking ──────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["unpaid", "partial", "paid", "cancelled"],
      default: "unpaid",
    },
    paidAmount:    { type: Number, default: 0 }, // sum of all payments
    balanceAmount: { type: Number, default: 0 }, // grandTotal - paidAmount
    paymentHistory: [paymentSchema],

    // ── Supplier Details Override (for this bill only) ───────────────────────
    supplierName:      { type: String, default: "" },
    supplierGstin:     { type: String, default: "" },
    supplierAddress:   { type: String, default: "" },
    supplierCity:      { type: String, default: "" },
    supplierState:     { type: String, default: "" },
    supplierPincode:   { type: String, default: "" },
    supplierPhone:     { type: String, default: "" },
    supplierEmail:     { type: String, default: "" },
    supplierStateCode: { type: String, default: "" },

    // ── Optional fields ───────────────────────────────────────────────────────
    notes:  { type: String, default: "" },
    terms:  { type: String, default: "Payment due within 30 days." },

    // ── Transportation Details ────────────────────────────────────────────────
    transportMode:   { type: String, default: "none" },
    vehicleNumber:   { type: String, default: "" },
    lrNumber:        { type: String, default: "" },
    lrDate:          { type: Date, default: null },
    dateOfSupply:    { type: Date, default: null },
    placeOfSupply:   { type: String, default: "" },
    transporterName: { type: String, default: "" },
    transporterId:   { type: String, default: "" },

    // ── Custom Optional Fields ────────────────────────────────────────────────
    optionalField1:  { type: String, default: "" },
    optionalValue1:  { type: String, default: "" },
    optionalField2:  { type: String, default: "" },
    optionalValue2:  { type: String, default: "" },

    // ── Bank Details Override & Signature ─────────────────────────────────────
    bankDetailsOverride: {
      bankName:       { type: String, default: "" },
      bankAccount:    { type: String, default: "" },
      bankIfsc:       { type: String, default: "" },
      bankBranch:     { type: String, default: "" },
      bankHolderName: { type: String, default: "" },
    },
    signatureUrl: { type: String, default: "" }, // Base64 image
    printCopies:  { type: [String], default: ["recipient", "transporter", "supplier"] },
  },
  {
    timestamps: true,
  }
);

invoiceSchema.index({ user: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model("Invoice", invoiceSchema);