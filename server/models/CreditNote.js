const mongoose = require("mongoose");
const Invoice = require("./Invoice");

// Goods returned or value reduced against an invoice
const lineSchema = Invoice.schema.path("items").schema.clone();
lineSchema.add({ sourceLine: { type: mongoose.Schema.Types.ObjectId, required: true } });

const creditNoteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    number: { type: String, required: true },
    date: { type: Date, default: Date.now },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "Buyer", required: true },
    reason: { type: String, default: "", trim: true },
    restock: { type: Boolean, default: true }, // whether the goods came back into stock
    taxType: { type: String, enum: ["cgst_sgst", "igst"], default: "cgst_sgst" },
    taxMode: { type: String, enum: ["exclusive", "inclusive"], default: "exclusive" },
    items: [lineSchema],
    subTotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalCgst: { type: Number, default: 0 },
    totalSgst: { type: Number, default: 0 },
    totalIgst: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    totalCess: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
  { timestamps: true },
);

creditNoteSchema.index({ user: 1, number: 1 }, { unique: true });
creditNoteSchema.index({ user: 1, invoice: 1 });

module.exports = mongoose.model("CreditNote", creditNoteSchema);
