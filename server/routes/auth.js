const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Stored emails are lower-case, so lookups must be too
const normaliseEmail = (email) => String(email).trim().toLowerCase();

// ─── Helper: generate JWT token ───────────────────────────────────────────────
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },                         // payload stored inside token
    process.env.JWT_SECRET,                 // secret key to sign with
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } // token expiry
  );
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Creates a new user account
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: normaliseEmail(email) });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Create user — password gets hashed automatically via pre-save hook
    const user = await User.create({ name, email, password });

    // Generate token immediately so user is logged in after register
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Logs in existing user and returns JWT
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user by email
    const user = await User.findOne({ email: normaliseEmail(email) });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Compare entered password with hashed password in DB
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Returns currently logged-in user's data (requires token)
const { protect } = require("../middleware/auth");

router.get("/me", protect, async (req, res) => {
  // req.user is set by the protect middleware
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
    },
  });
});

router.put("/password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (String(newPassword || "").length < 6) {
      return res.status(400).json({ success: false, message: "The new password needs at least 6 characters" });
    }
    const user = await User.findById(req.user._id);
    // 400, not 401: a wrong current password must not sign the user out
    if (!(await user.comparePassword(String(currentPassword || "")))) {
      return res.status(400).json({ success: false, message: "The current password is not correct" });
    }
    user.password = String(newPassword);
    await user.save();
    res.json({ success: true, message: "Password changed" });
  } catch (err) {
    console.error("Password change error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── Business profile ────────────────────────────────────────────────────────
// API field name -> User field name
const PROFILE_FIELDS = {
  name: "supplierName",
  gstin: "supplierGstin",
  pan: "supplierPan",
  address: "supplierAddress",
  city: "supplierCity",
  state: "supplierState",
  pincode: "supplierPincode",
  phone: "supplierPhone",
  email: "supplierEmail",
  bankName: "supplierBankName",
  bankAccount: "supplierBankAccount",
  bankIfsc: "supplierBankIfsc",
  bankBranch: "supplierBankBranch",
  stateCode: "supplierStateCode",
  logoUrl: "logoUrl",
  signatureUrl: "supplierSignatureUrl",
  invoicePrefix: "invoicePrefix",
  invoiceStartNumber: "invoiceStartNumber",
  defaultTerms: "defaultTerms",
};

// Each business sees only its own details; there are no server-wide defaults.
const toProfile = (user) =>
  Object.fromEntries(
    Object.entries(PROFILE_FIELDS).map(([key, field]) => [key, user[field] ?? ""]),
  );

router.get("/supplier-info", protect, (req, res) => {
  res.json({ success: true, supplier: toProfile(req.user) });
});

router.put("/supplier-info", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Only fields present in the request are changed
    for (const [key, field] of Object.entries(PROFILE_FIELDS)) {
      if (req.body[key] === undefined) continue;
      user[field] = req.body[key];
    }
    if (user.invoicePrefix && !/^[A-Z0-9-]{1,5}$/.test(user.invoicePrefix)) {
      return res.status(400).json({
        success: false,
        message: "Invoice prefix can use up to 5 letters, numbers or hyphens",
      });
    }
    if (!user.invoiceStartNumber) user.invoiceStartNumber = 1;
    if (!user.supplierStateCode) user.supplierStateCode = "07";

    await user.save();

    res.json({
      success: true,
      message: "Business details updated successfully",
      supplier: toProfile(user),
    });
  } catch (err) {
    const status = err.name === "ValidationError" ? 400 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
});

module.exports = router;