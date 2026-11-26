const mongoose = require("mongoose");
const UNITS = require("../services/units");
const { GST_RATES } = require("../services/gst");
const { istDate } = require("../services/common");

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
        values: UNITS,
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
        values: GST_RATES,
        message: "That GST rate is not supported",
      },
    },
    // What the item costs to buy (excl. GST); used for profit and stock value
    purchasePrice: { type: Number, default: 0, min: 0 },
    // Stock is worked out from this opening count plus later purchases, sales,
    // returns and adjustments
    trackStock: { type: Boolean, default: false },
    openingStock: { type: Number, default: 0 },
    stockSince: { type: Date, default: null },
    lowStockAt: { type: Number, default: 0, min: 0 },

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

// Stock counting starts today unless another date is given
itemSchema.pre("save", function (next) {
  if (this.trackStock && !this.stockSince) {
    this.stockSince = new Date(istDate(Date.now()));
  }
  next();
});

module.exports = mongoose.model("Item", itemSchema);