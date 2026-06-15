const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ─── Helper: generate JWT token ───────────────────────────────────────────────
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },                         // payload stored inside token
    process.env.JWT_SECRET,                 // secret key to sign with
    { expiresIn: process.env.JWT_EXPIRES_IN } // token expiry (e.g. "7d")
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
    const existingUser = await User.findOne({ email });
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
    const user = await User.findOne({ email });
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

router.get("/supplier-info", protect, (req, res) => {
  res.json({
    success: true,
    supplier: {
      name:        process.env.SUPPLIER_NAME        || "Your Business Name",
      gstin:       process.env.SUPPLIER_GSTIN       || "",
      address:     process.env.SUPPLIER_ADDRESS     || "",
      city:        process.env.SUPPLIER_CITY        || "",
      state:       process.env.SUPPLIER_STATE       || "",
      pincode:     process.env.SUPPLIER_PINCODE     || "",
      phone:       process.env.SUPPLIER_PHONE       || "",
      email:       process.env.SUPPLIER_EMAIL       || "",
      bankName:    process.env.SUPPLIER_BANK_NAME   || "",
      bankAccount: process.env.SUPPLIER_BANK_ACCOUNT|| "",
      bankIfsc:    process.env.SUPPLIER_BANK_IFSC   || "",
      bankBranch:  process.env.SUPPLIER_BANK_BRANCH || "",
      stateCode:   process.env.SUPPLIER_STATE_CODE  || "07",
    },
  });
});

module.exports = router;