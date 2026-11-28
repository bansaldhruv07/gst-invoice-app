// Emails, mobile numbers and passwords: how they are read and checked.
const { BadRequest } = require("./common");

const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Stored emails are lower-case, so lookups must be too
const normaliseEmail = (email) => String(email ?? "").trim().toLowerCase();

// A ten-digit Indian mobile number, however it was typed (+91, 0, spaces).
// Returns "" when it is not one.
function normaliseMobile(value) {
  const digits = String(value ?? "").replace(/[\s()-]/g, "");
  const match = digits.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  return match ? match[1] : "";
}

// What someone typed to sign in, in the form it is stored
const loginName = (value) => normaliseMobile(value) || normaliseEmail(value);

// The database filter for a sign-in name, or null when it cannot be one
function loginFilter(value) {
  const mobile = normaliseMobile(value);
  if (mobile) return { mobile };
  const email = normaliseEmail(value);
  return EMAIL.test(email) ? { email } : null;
}

// Passwords that are tried first by anyone guessing
const COMMON = new Set([
  "password", "password1", "password12", "password@123", "passw0rd", "12345678", "123456789",
  "1234567890", "123123123", "87654321", "11223344", "qwertyui", "qwertyuiop", "qwerty123",
  "1q2w3e4r", "abcd1234", "abc12345", "iloveyou", "india123", "admin123", "welcome1", "welcome123",
]);

function checkNewPassword(password, { email, mobile } = {}) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    throw new BadRequest(`The password needs at least ${MIN_PASSWORD} characters`);
  }
  if (password.length > 72) throw new BadRequest("The password can be at most 72 characters");
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) {
    throw new BadRequest("That password is too easy to guess. Choose another one.");
  }
  if ((email && lower === normaliseEmail(email)) || (mobile && password.includes(mobile))) {
    throw new BadRequest("Do not use your email or mobile number as the password");
  }
}

// An optional mobile number from a form: "" when left empty
function readMobile(value) {
  if (value === undefined || value === null || String(value).trim() === "") return "";
  const mobile = normaliseMobile(value);
  if (!mobile) throw new BadRequest("Enter a 10-digit mobile number");
  return mobile;
}

module.exports = { EMAIL, normaliseEmail, normaliseMobile, loginName, loginFilter, checkNewPassword, readMobile };
