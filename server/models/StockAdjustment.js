const mongoose = require("mongoose");

// A manual change to stock: damage, counting difference, and so on
const stockAdjustmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    date: { type: Date, default: Date.now },
    quantity: { type: Number, required: true }, // positive adds, negative removes
    reason: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

stockAdjustmentSchema.index({ user: 1, item: 1 });

module.exports = mongoose.model("StockAdjustment", stockAdjustmentSchema);
