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
const { EMAIL, normaliseEmail, loginFilter, checkNewPassword, readMobile } = require("../services/identity");
const { BILL_TEMPLATES, BILL_COLORS } = require("../services/billDesigns");

const RESET_MINUTES = 30;
const WRONG_SIGN_IN = "Invalid email, mobile number or password";
const MOBILE_TAKEN = "That mobile number is already used by another account";

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const isText = (...values) => values.every((v) => typeof v === "string" && v.trim());

// ─── Helper: generate JWT token ───────────────────────────────────────────────
const generateToken = (userId) =>
  jwt.sign(
    { id: userId },                         // payload stored inside token
    process.env.JWT_SECRET,                 // secret key to sign with
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }, // token expiry
  );

const publicUser = (actor) => {
  const role = actor.owner ? actor.role : "owner";
  return { id: actor._id, name: actor.name, email: actor.email, mobile: actor.mobile || "", role, can: abilities(role) };
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
  if (!EMAIL.test(email.trim())) throw new BadRequest("Enter a valid email address");
  const mobile = readMobile(req.body.mobile);
  checkNewPassword(password, { email, mobile });

  if (await User.exists({ email: normaliseEmail(email) })) {
    throw new BadRequest("Email already registered");
  }
  if (mobile && (await User.exists({ mobile }))) throw new BadRequest(MOBILE_TAKEN);

  // Only these fields are taken; the password is hashed by the model
  const user = await User.create({ name: name.trim(), email, password, ...(mobile && { mobile }) });

  res.status(201).json({
    success: true,
    message: "Account created successfully",
    token: generateToken(user._id), // signed in straight away
    user: publicUser(user),
  });
}));

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// "login" is an email or a mobile number; "email" is accepted from older pages
router.post("/login", ...security.loginLimits, route(async (req, res) => {
  const login = req.body.login ?? req.body.email;
  const { password } = req.body;
  if (!isText(login, password)) throw new BadRequest("Enter your email or mobile number, and your password");

  const filter = loginFilter(login);
  const user = filter && (await User.findOne(filter));
  // The same answer whether the name or the password is wrong
  if (!user || !(await user.comparePassword(password)) || user.disabled) {
    throw new BadRequest(WRONG_SIGN_IN, 401);
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
  const login = req.body.login ?? req.body.email;
  if (!isText(login)) throw new BadRequest("Enter your email address or mobile number");

  // The link always goes to the account's email address
  const filter = loginFilter(login);
  const user = filter && (await User.findOne({ ...filter, disabled: { $ne: true } }));
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

  res.json({ success: true, message: "If there is an account, a reset link is on its way to its email address." });
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

// The mobile number a person signs in with; empty removes it
router.put("/mobile", protect, security.passwordLimit, route(async (req, res) => {
  const mobile = readMobile(req.body.mobile);
  const person = await User.findById(req.actor._id);
  // Changing how an account is signed in to needs the password again.
  // 400, not 401: a wrong password here must not sign the user out
  if (!(await person.comparePassword(String(req.body.currentPassword || "")))) {
    throw new BadRequest("The current password is not correct");
  }
  if (mobile && (await User.exists({ mobile, _id: { $ne: person._id } }))) {
    throw new BadRequest(MOBILE_TAKEN);
  }
  person.mobile = mobile || undefined;
  await person.save();
  res.json({
    success: true,
    message: mobile ? "You can now sign in with this mobile number" : "Mobile number removed",
    user: publicUser(person),
  });
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
  template: "billTemplate",
  color: "billColor",
};

// Pictures are kept inside the record, or linked from a web address
const IMAGE = /^(https?:\/\/|data:image\/(png|jpe?g|webp|gif);base64,)/i;

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

  const { template, color } = req.body;
  if (template !== undefined && !BILL_TEMPLATES.includes(template)) {
    throw new BadRequest("Choose one of the bill designs");
  }
  if (color !== undefined && !BILL_COLORS.includes(color)) throw new BadRequest("Choose one of the bill colours");
  for (const [key, label] of [["logoUrl", "logo"], ["signatureUrl", "signature"]]) {
    const value = req.body[key];
    // A value saved earlier is left alone
    if (value && value !== user[PROFILE_FIELDS[key]] && !IMAGE.test(String(value))) {
      throw new BadRequest(`The ${label} must be a picture or a web address`);
    }
  }

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
