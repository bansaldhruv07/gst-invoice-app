const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },

    // Custom logo URL (Pro/Starter feature)
    logoUrl: { type: String, default: "" },

    // Supplier details for business profile
    supplierName: { type: String, default: "" },
    supplierGstin: { type: String, default: "" },
    supplierAddress: { type: String, default: "" },
    supplierCity: { type: String, default: "" },
    supplierState: { type: String, default: "" },
    supplierPincode: { type: String, default: "" },
    supplierPhone: { type: String, default: "" },
    supplierEmail: { type: String, default: "" },
    supplierBankName: { type: String, default: "" },
    supplierBankAccount: { type: String, default: "" },
    supplierBankIfsc: { type: String, default: "" },
    supplierBankBranch: { type: String, default: "" },
    supplierStateCode: { type: String, default: "07" },
  },

  {
    timestamps: true, // adds createdAt and updatedAt automatically
  },
);

// ─── Pre-save hook: hash password before saving to DB ─────────────────────────
// This runs automatically every time a user document is saved
userSchema.pre("save", async function (next) {
  // Only hash if password was actually changed (not on other updates)
  if (!this.isModified("password")) return next();

  // Salt rounds = 10 means bcrypt runs 2^10 = 1024 hashing iterations
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance method: compare plain password with hashed one ──────────────────
// Used during login: user.comparePassword("mypassword123")
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
