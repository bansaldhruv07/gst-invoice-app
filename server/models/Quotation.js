const mongoose = require("mongoose");
const Invoice = require("./Invoice");

// A quotation has the same shape as an invoice (so it prints on the same format)
// but lives in its own collection and never counts as a sale. `invoiceNumber`
// holds the quotation number.
const quotationSchema = Invoice.schema.clone();

quotationSchema.path("status", {
  type: String,
  enum: ["open", "accepted", "declined", "converted"],
  default: "open",
});
quotationSchema.add({
  validUntil: { type: Date, default: null },
  convertedInvoice: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
});

module.exports = mongoose.model("Quotation", quotationSchema);
