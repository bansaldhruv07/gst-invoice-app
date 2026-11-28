const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { allows } = require("../services/permissions");
const activity = require("../services/activity");
const { getUserPlan } = require("./checkPlan");

const refuse = (res, status, message) => res.status(status).json({ success: false, message });

// Left out of every request: secrets, and the logo and signature pictures, which
// are large and only needed on the business profile
const PRIVATE_FIELDS = "-password -resetTokenHash -resetTokenExpires -logoUrl -supplierSignatureUrl";

// ─── protect middleware ───────────────────────────────────────────────────────
// Add this to any route that requires login. It sets:
//   req.user  — the business account that owns the data
//   req.actor — the person signed in (the same, unless it is a staff login)
//   req.role  — "owner", "staff" or "accountant"
// and refuses requests that the role does not allow.
const protect = async (req, res, next) => {
  try {
    // JWT is sent in the Authorization header as: "Bearer <token>"
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return refuse(res, 401, "Not authorized — no token provided");

    // Throws if the token is expired or has been tampered with
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

    const actor = await User.findById(decoded.id).select(PRIVATE_FIELDS);
    if (!actor || actor.disabled) {
      return refuse(res, 401, "Not authorized — this login is no longer active");
    }
    // A password change signs out older sessions
    if (actor.passwordChangedAt && decoded.iat < Math.floor(actor.passwordChangedAt / 1000)) {
      return refuse(res, 401, "Please sign in again");
    }

    let user = actor;
    if (actor.owner) {
      user = await User.findById(actor.owner).select(PRIVATE_FIELDS);
      if (!user) return refuse(res, 401, "Not authorized — the business account no longer exists");
      const { plan } = await getUserPlan(user._id);
      if (!plan?.features?.multiUser) {
        return refuse(res, 403, "Team logins are paused. Ask the owner to renew the plan.");
      }
    }

    req.user = user;
    req.actor = actor;
    req.role = actor.owner ? actor.role : "owner";
    user.$locals.role = req.role;

    const path = (req.baseUrl + req.path).replace(/\/+$/, "");
    if (!allows(req.role, req.method, path)) {
      return refuse(res, 403, "Your login does not have access to this. Ask the business owner.");
    }
    activity.watch(req, res, path);
    next();
  } catch (err) {
    if (!["JsonWebTokenError", "TokenExpiredError", "NotBeforeError", "CastError"].includes(err.name)) {
      console.error("Auth middleware error:", err);
      return refuse(res, 500, "Something went wrong. Please try again.");
    }
    return refuse(res, 401, "Not authorized — invalid or expired token");
  }
};

module.exports = { protect };
