// Security headers, limits on repeated requests, and refusal of hostile input.
const helmet = require("helmet");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { loginName } = require("../services/identity");

const securityHeaders = helmet({
  // The website calls this API from another address
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

const MINUTE = 60 * 1000;
const address = (req) => ipKeyGenerator(req.ip || "");
const account = (req) => loginName(req.body?.login ?? req.body?.email).slice(0, 200);
const addressAndAccount = (req) => `${address(req)}|${account(req)}`;

// Counts are kept in memory, so they restart with the server
const limit = ({ minutes, max, key = address, onlyFailures = false, message, skip }) =>
  rateLimit({
    windowMs: minutes * MINUTE,
    limit: max,
    keyGenerator: key,
    skip,
    skipSuccessfulRequests: onlyFailures,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message },
  });

const WAIT = "Too many attempts. Please wait 15 minutes and try again.";
const LATER = "Too many requests. Please try again in an hour.";

// ─── Hostile input ───────────────────────────────────────────────────────────
// Names that change how a database query or an object behaves
const UNSAFE_KEY = /^\$|^(__proto__|prototype|constructor)$/;
const MAX_TEXT = 20000;
const IMAGE_FIELDS = new Set(["logoUrl", "signatureUrl"]);

// Returns what is wrong with a value, or "" when it is fine
function problem(value, key = "", depth = 0) {
  if (typeof value === "string") {
    return value.length > MAX_TEXT && !IMAGE_FIELDS.has(key) ? "Some text in this request is too long" : "";
  }
  if (!value || typeof value !== "object") return "";
  if (depth > 8) return "The request could not be read";
  for (const [name, inner] of Object.entries(value)) {
    if (UNSAFE_KEY.test(name)) return "The request could not be read";
    const found = problem(inner, Array.isArray(value) ? key : name, depth + 1);
    if (found) return found;
  }
  return "";
}

function refuseHostileInput(req, res, next) {
  // Payment webhooks arrive as raw bytes and are checked by their signature
  const found = (Buffer.isBuffer(req.body) ? "" : problem(req.body)) || problem(req.query);
  if (found) return res.status(400).json({ success: false, message: found });
  next();
}

module.exports = {
  securityHeaders,
  refuseHostileInput,
  // A ceiling for any one address, far above what a busy shop needs
  generalLimit: limit({
    minutes: 5,
    max: Number(process.env.REQUEST_LIMIT) || 1500,
    skip: (req) => req.path === "/health" || req.path === "/subscriptions/webhook",
    message: "Too many requests. Please slow down and try again in a few minutes.",
  }),
  // Wrong passwords: for one account from one place, from one place overall,
  // and for one account from anywhere
  loginLimits: [
    limit({ minutes: 15, max: 10, key: addressAndAccount, onlyFailures: true, message: WAIT }),
    limit({ minutes: 15, max: 100, onlyFailures: true, message: WAIT }),
    limit({ minutes: 60, max: 60, key: account, onlyFailures: true, message: LATER }),
  ],
  signupLimit: limit({ minutes: 60, max: 40, message: LATER }),
  forgotLimit: limit({ minutes: 60, max: 5, key: addressAndAccount, message: LATER }),
  resetLimit: limit({ minutes: 60, max: 20, message: LATER }),
  passwordLimit: limit({ minutes: 15, max: 10, onlyFailures: true, message: WAIT }),
};
