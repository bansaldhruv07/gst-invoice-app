const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    category: { type: String, required: [true, "Choose a category"], trim: true },
    amount: { type: Number, required: true, min: [0.01, "Enter an amount"] }, // including GST
    gstAmount: { type: Number, default: 0, min: 0 },
    mode: {
      type: String,
      enum: ["cash", "upi", "bank_transfer", "cheque", "card", "other"],
      default: "cash",
    },
    payee: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

expenseSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
