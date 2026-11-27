const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { getUserPlan } = require("../middleware/checkPlan");
const security = require("../middleware/security");
const { mailConfigured, sendMail } = require("../services/mailer");
const { abilities } = require("../services/permissions");
const { route, BadRequest } = require("../services/common");

const MIN_PASSWORD = 8;
const RESET_MINUTES = 30;

// Stored emails are lower-case, so lookups must be too
const normaliseEmail = (email) => String(email).trim().toLowerCase();
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const isText = (...values) => values.every((v) => typeof v === "string" && v.trim());

function checkNewPassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    throw new BadRequest(`The password needs at least ${MIN_PASSWORD} characters`);
  }
  if (password.length > 72) throw new BadRequest("The password can be at most 72 characters");
}

// ─── Helper: generate JWT token ───────────────────────────────────────────────
const generateToken = (userId) =>
  jwt.sign(
    { id: userId },                         // payload stored inside token
    process.env.JWT_SECRET,                 // secret key to sign with
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }, // token expiry
  );

const publicUser = (actor) => {
  const role = actor.owner ? actor.role : "owner";
  return { id: actor._id, name: actor.name, email: actor.email, role, can: abilities(role) };
};

// What this server offers on the sign-in screens
router.get("/options", (req, res) => {
  res.json({ success: true, passwordReset: mailConfigured() });
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Creates a new business account
router.post("/register", security.signupLimit, route(async (req, res) => {
  const { name, email, password } = req.body;
  if (!isText(name, email, password)) throw new BadRequest("Name, email and password are required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new BadRequest("Enter a valid email address");
  checkNewPassword(password);

  if (await User.exists({ email: normaliseEmail(email) })) {
    throw new BadRequest("Email already registered");
  }

  // Only these fields are taken; the password is hashed by the model
  const user = await User.create({ name: name.trim(), email, password });

  res.status(201).json({
    success: true,
    message: "Account created successfully",
    token: generateToken(user._id), // signed in straight away
    user: publicUser(user),
  });
}));

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", ...security.loginLimits, route(async (req, res) => {
  const { email, password } = req.body;
  if (!isText(email, password)) throw new BadRequest("Email and password are required");

  const user = await User.findOne({ email: normaliseEmail(email) });
  // The same answer whether the email or the password is wrong
  if (!user || !(await user.comparePassword(password)) || user.disabled) {
    throw new BadRequest("Invalid email or password", 401);
  }
  if (user.owner) {
    const { plan } = await getUserPlan(user.owner);
    if (!plan?.features?.multiUser) {
      throw new BadRequest("Team logins are paused. Ask the owner to renew the plan.", 403);
    }
  }

  res.json({
    success: true,
    message: "Login successful",
    token: generateToken(user._id),
    user: publicUser(user),
  });
}));

// ─── Forgotten password ───────────────────────────────────────────────────────
router.post("/forgot-password", security.forgotLimit, route(async (req, res) => {
  if (!mailConfigured()) {
    return res.status(503).json({
      success: false,
      message: "Password reset by email is not set up yet. Please contact support.",
    });
  }
  const { email } = req.body;
  if (!isText(email)) throw new BadRequest("Enter your email address");

  const user = await User.findOne({ email: normaliseEmail(email), disabled: { $ne: true } });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await User.updateOne(
      { _id: user._id },
      { resetTokenHash: hashToken(token), resetTokenExpires: new Date(Date.now() + RESET_MINUTES * 60000) },
    );
    const link = `${process.env.CLIENT_URL.replace(/\/+$/, "")}/reset-password?token=${token}`;
    // Not awaited, so the reply takes the same time whether or not the account exists
    sendMail({
      to: user.email,
      subject: "Reset your GST Invoice password",
      text: `Hello ${user.name},\n\nOpen this link to choose a new password. It works once, for ${RESET_MINUTES} minutes:\n${link}\n\nIf you did not ask for this, ignore this email.`,
    }).catch((err) => console.error("Password reset email:", err.message));
  }

  res.json({ success: true, message: "If that email has an account, a reset link is on its way." });
}));

router.post("/reset-password", security.resetLimit, route(async (req, res) => {
  const { token, password } = req.body;
  checkNewPassword(password);
  if (!isText(token)) throw new BadRequest("This reset link is not valid");

  // Taking the token and clearing it in one step means it works only once
  const user = await User.findOneAndUpdate(
    { resetTokenHash: hashToken(token), resetTokenExpires: { $gt: new Date() }, disabled: { $ne: true } },
    { $unset: { resetTokenHash: 1, resetTokenExpires: 1 } },
    { new: true },
  );
  if (!user) throw new BadRequest("This reset link has expired or was already used. Ask for a new one.");

  user.password = password;
  user.passwordChangedAt = new Date();
  await user.save();
  res.json({ success: true, message: "Password changed. You can sign in now." });
}));

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// The person signed in
router.get("/me", protect, (req, res) => {
  res.json({ success: true, user: publicUser(req.actor) });
});

router.put("/password", protect, security.passwordLimit, route(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  checkNewPassword(newPassword);

  const person = await User.findById(req.actor._id);
  // 400, not 401: a wrong current password must not sign the user out
  if (!(await person.comparePassword(String(currentPassword || "")))) {
    throw new BadRequest("The current password is not correct");
  }
  person.password = newPassword;
  person.passwordChangedAt = new Date();
  person.resetTokenHash = undefined;
  person.resetTokenExpires = undefined;
  await person.save();
  // Other sessions stop working; this one continues with a new token
  res.json({ success: true, message: "Password changed", token: generateToken(person._id) });
}));

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
  upiId: "upiId",
};

// Each business sees only its own details; there are no server-wide defaults.
const toProfile = (user) =>
  Object.fromEntries(
    Object.entries(PROFILE_FIELDS).map(([key, field]) => [key, user[field] ?? ""]),
  );

router.get("/supplier-info", protect, (req, res) => {
  res.json({ success: true, supplier: toProfile(req.user) });
});

router.put("/supplier-info", protect, route(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new BadRequest("User not found", 404);

  // Only fields present in the request are changed
  for (const [key, field] of Object.entries(PROFILE_FIELDS)) {
    if (req.body[key] === undefined) continue;
    user[field] = req.body[key];
  }
  if (user.invoicePrefix && !/^[A-Z0-9-]{1,5}$/.test(user.invoicePrefix)) {
    throw new BadRequest("Invoice prefix can use up to 5 letters, numbers or hyphens");
  }
  if (user.upiId && !/^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9.-]+$/.test(user.upiId)) {
    throw new BadRequest("A UPI ID looks like shopname@bank");
  }
  if (!user.invoiceStartNumber) user.invoiceStartNumber = 1;
  if (!user.supplierStateCode) user.supplierStateCode = "07";

  await user.save();

  res.json({
    success: true,
    message: "Business details updated successfully",
    supplier: toProfile(user),
  });
}));

module.exports = router;
