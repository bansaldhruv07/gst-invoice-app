// Security headers and limits on repeated attempts.
const helmet = require("helmet");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const securityHeaders = helmet({
  // The website calls this API from another address
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

const MINUTE = 60 * 1000;
const address = (req) => ipKeyGenerator(req.ip || "");
const addressAndEmail = (req) =>
  `${address(req)}|${String(req.body?.email || "").trim().toLowerCase().slice(0, 200)}`;

// Counts are kept in memory, so they restart with the server
const limit = ({ minutes, max, key = address, onlyFailures = false, message }) =>
  rateLimit({
    windowMs: minutes * MINUTE,
    limit: max,
    keyGenerator: key,
    skipSuccessfulRequests: onlyFailures,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message },
  });

const WAIT = "Too many attempts. Please wait 15 minutes and try again.";
const LATER = "Too many requests. Please try again in an hour.";

module.exports = {
  securityHeaders,
  // Wrong passwords for one account from one place, and from one place overall
  loginLimits: [
    limit({ minutes: 15, max: 10, key: addressAndEmail, onlyFailures: true, message: WAIT }),
    limit({ minutes: 15, max: 100, onlyFailures: true, message: WAIT }),
  ],
  signupLimit: limit({ minutes: 60, max: 40, message: LATER }),
  forgotLimit: limit({ minutes: 60, max: 5, key: addressAndEmail, message: LATER }),
  resetLimit: limit({ minutes: 60, max: 20, message: LATER }),
  passwordLimit: limit({ minutes: 15, max: 10, onlyFailures: true, message: WAIT }),
};
