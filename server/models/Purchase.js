const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  hsn:           { type: String, default: "" },
  unit:          { type: String, default: "pcs" },
  quantity:      { type: Number, required: true, min: 0 },
  rate:          { type: Number, required: true, min: 0 },
  gstPercent:    { type: Number, default: 18 },
  taxableAmount: { type: Number, default: 0 },
  cgstPercent:   { type: Number, default: 0 },
  cgstAmount:    { type: Number, default: 0 },
  sgstPercent:   { type: Number, default: 0 },
  sgstAmount:    { type: Number, default: 0 },
  igstPercent:   { type: Number, default: 0 },
  igstAmount:    { type: Number, default: 0 },
  totalAmount:   { type: Number, default: 0 },
});

const purchasePaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date:   { type: Date, default: Date.now },
  mode: {
    type: String,
    enum: ["cash", "upi", "bank_transfer", "cheque", "card", "other"],
    default: "upi",
  },
  note: { type: String, default: "" },
});

const purchaseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Auto-generated: PUR-2024-0001
    purchaseNumber: {
      type: String,
      required: true,
      unique: true,
    },

    // Seller's invoice number (what they gave you)
    sellerInvoiceNumber: { type: String, default: "" },

    purchaseDate: { type: Date, default: Date.now },
    dueDate:      { type: Date, default: null },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
    },

    purchaseType: {
      type: String,
      enum: ["tax_invoice", "bill_of_supply"],
      default: "tax_invoice",
    },

    taxMode: {
      type: String,
      enum: ["exclusive", "inclusive"],
      default: "exclusive",
    },

    taxType: {
      type: String,
      enum: ["cgst_sgst", "igst"],
      default: "cgst_sgst",
    },

    items: [purchaseItemSchema],

    discountType:   { type: String, enum: ["percent", "amount"], default: "amount" },
    discountValue:  { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },

    subTotal:    { type: Number, default: 0 },
    totalCgst:   { type: Number, default: 0 },
    totalSgst:   { type: Number, default: 0 },
    totalIgst:   { type: Number, default: 0 },
    totalTax:    { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    roundOff:    { type: Number, default: 0 },
    grandTotal:  { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["unpaid", "partial", "paid", "cancelled"],
      default: "unpaid",
    },

    paidAmount:     { type: Number, default: 0 },
    balanceAmount:  { type: Number, default: 0 },
    paymentHistory: [purchasePaymentSchema],

    notes: { type: String, default: "" },
    terms: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Purchase", purchaseSchema);