const mongoose = require("mongoose");

const buyerSchema = new mongoose.Schema(
  {
    // Every buyer belongs to the logged-in user (multi-user support)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Buyer name is required"],
      trim: true,
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      // GSTIN format: 22AAAAA0000A1Z5 (15 characters)
      validate: {
        validator: function (v) {
          // Allow empty string (unregistered buyers / B2C)
          if (!v || v === "") return true;
          return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
        },
        message: "Invalid GSTIN format",
      },
    },
    // State code is the first 2 digits of GSTIN (e.g. "07" for Delhi)
    // Used to decide CGST+SGST vs IGST on invoices
    stateCode: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    pincode: {
      type: String,
      trim: true,
      default: "",
    },
    mobile: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// ─── Auto-extract state code from GSTIN before saving ────────────────────────
// GSTIN starts with 2-digit state code, e.g. "07AAAAA0000A1Z5" → stateCode = "07"
buyerSchema.pre("save", function (next) {
  if (this.gstin && this.gstin.length >= 2) {
    this.stateCode = this.gstin.substring(0, 2);
  }
  next();
});

module.exports = mongoose.model("Buyer", buyerSchema);