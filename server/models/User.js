const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { BILL_TEMPLATES, BILL_COLORS } = require("../services/billDesigns");

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
    // Optional second way to sign in: ten digits, left out when not given
    mobile: { type: String, trim: true, default: undefined },
    // Staff logins point at the business owner's account; owners have none
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    role: { type: String, enum: ["owner", "staff", "accountant"], default: "owner" },
    disabled: { type: Boolean, default: false },

    // Sign-ins issued before this moment stop working
    passwordChangedAt: { type: Date, default: null },
    resetTokenHash: { type: String, default: undefined, index: { sparse: true } },
    resetTokenExpires: { type: Date, default: undefined },

    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    pan:{
      type: String,
      unique: true,
      sparse: true, // users without a PAN are left out of the unique index
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
    supplierPan: { type: String, default: "" },   
    supplierEmail: { type: String, default: "" },
    supplierBankName: { type: String, default: "" },
    supplierBankAccount: { type: String, default: "" },
    supplierBankIfsc: { type: String, default: "" },
    supplierBankBranch: { type: String, default: "" },
    supplierStateCode: { type: String, default: "07" },
    supplierSignatureUrl: { type: String, default: "" },

    // Invoice preferences
    // Deleted bills still count towards the month's plan limit
    invoiceDeletions: { month: { type: String, default: "" }, count: { type: Number, default: 0 } },
    invoicePrefix: { type: String, default: "", uppercase: true, trim: true, maxlength: 5 },
    invoiceStartNumber: { type: Number, default: 1, min: 1, max: 99999 },
    defaultTerms: { type: String, default: "" },
    upiId: { type: String, default: "", trim: true, maxlength: 100 },
    // How printed bills look
    billTemplate: { type: String, enum: BILL_TEMPLATES, default: "classic" },
    billColor: { type: String, enum: BILL_COLORS, default: "blue" },
  },

  {
    timestamps: true, // adds createdAt and updatedAt automatically
  },
);

// One account per mobile number; accounts without one are left out
userSchema.index(
  { mobile: 1 },
  { unique: true, partialFilterExpression: { mobile: { $type: "string" } } },
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
