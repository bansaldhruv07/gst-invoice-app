const mongoose = require("mongoose");

const sellerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name:    { type: String, required: true, trim: true },
    gstin:   { type: String, trim: true, uppercase: true, default: "" },
    stateCode: { type: String, default: "" },
    address: { type: String, default: "" },
    city:    { type: String, default: "" },
    state:   { type: String, default: "" },
    pincode: { type: String, default: "" },
    mobile:  { type: String, default: "" },
    email:   { type: String, default: "", lowercase: true },
  },
  { timestamps: true }
);

// Auto-extract state code from GSTIN
sellerSchema.pre("save", function (next) {
  if (this.gstin && this.gstin.length >= 2) {
    this.stateCode = this.gstin.substring(0, 2);
  }
  next();
});

module.exports = mongoose.model("Seller", sellerSchema);