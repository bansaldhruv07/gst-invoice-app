const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    // Every item belongs to the logged-in user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    // HSN = Harmonized System of Nomenclature — mandatory for GST invoices
    // e.g. "8471" for computers, "6109" for t-shirts
    hsn: {
      type: String,
      trim: true,
      default: "",
    },
    // Unit of measurement: pcs, kg, ltr, mtr, box, hrs, etc.
    unit: {
      type: String,
      trim: true,
      default: "pcs",
      enum: {
        values: ["pcs", "kg", "ltr", "mtr", "box", "hrs", "nos", "set", "pair", "dozen", "other"],
        message: "Invalid unit type",
      },
    },
    // Base selling price (exclusive of GST)
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    // GST rate applicable on this item
    // Common rates in India: 0, 5, 12, 18, 28
    gstPercent: {
      type: Number,
      required: [true, "GST percent is required"],
      default: 18,
      enum: {
        values: [0, 5, 12, 18, 28],
        message: "GST percent must be 0, 5, 12, 18, or 28",
      },
    },
    // Optional description for the item
    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Item", itemSchema);