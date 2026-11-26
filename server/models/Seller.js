const mongoose = require("mongoose");
const { stateCodeFor } = require("../services/states");

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
    // What the business already owed this seller when they were added here
    openingBalance: { type: Number, default: 0, min: 0 },
    email:   { type: String, default: "", lowercase: true },
  },
  { timestamps: true }
);

// Auto-extract state code from GSTIN
sellerSchema.pre("save", function (next) {
  if (this.gstin && this.gstin.length >= 2) {
    this.stateCode = this.gstin.substring(0, 2);
  } else if (this.isModified("state") || this.isModified("gstin")) {
    this.stateCode = stateCodeFor(this.state);
  }
  next();
});

module.exports = mongoose.model("Seller", sellerSchema);