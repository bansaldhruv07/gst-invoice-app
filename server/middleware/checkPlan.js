const User         = require("../models/User");
const Subscription = require("../models/Subscription");
const Plan         = require("../models/Plan");
const Invoice      = require("../models/Invoice");
const Buyer        = require("../models/Buyer");
const Item         = require("../models/Item");

// ─── Helper: get user's active plan + limits ──────────────────────────────────
async function getUserPlan(userId) {
  const user = await User.findById(userId).populate({
    path:     "subscription",
    populate: { path: "plan" },
  });

  // If no subscription or expired, use free plan
  const sub    = user.subscription;
  const isActive = sub && ["active", "trialing"].includes(sub.status);

  if (!isActive) {
    const freePlan = await Plan.findOne({ name: "free" });
    return { plan: freePlan, sub: null, isActive: false };
  }

  return { plan: sub.plan, sub, isActive: true };
}

// ─── Middleware: check if user can create an invoice ──────────────────────────
const canCreateInvoice = async (req, res, next) => {
  try {
    const { plan, sub } = await getUserPlan(req.user._id);

    const limit = plan.limits.invoicesPerMonth;

    // -1 means unlimited
    if (limit === -1) return next();

    // Count invoices created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const count = await Invoice.countDocuments({
      user:        req.user._id,
      createdAt:   { $gte: startOfMonth },
    });

    if (count >= limit) {
      return res.status(403).json({
        success:     false,
        limitReached: true,
        message:     `Invoice limit reached (${limit}/month on ${plan.displayName} plan). Please upgrade.`,
        current:     count,
        limit,
        upgrade:     true,
      });
    }

    // Attach plan info to request for use in route
    req.plan = plan;
    req.sub  = sub;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Middleware: check if user can add a buyer ────────────────────────────────
const canAddBuyer = async (req, res, next) => {
  try {
    const { plan } = await getUserPlan(req.user._id);
    const limit    = plan.limits.buyers;

    if (limit === -1) return next();

    const count = await Buyer.countDocuments({ user: req.user._id });

    if (count >= limit) {
      return res.status(403).json({
        success:      false,
        limitReached: true,
        message:      `Buyer limit reached (${limit} on ${plan.displayName} plan). Please upgrade.`,
        current:      count,
        limit,
        upgrade:      true,
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Middleware: check if user can add an item ────────────────────────────────
const canAddItem = async (req, res, next) => {
  try {
    const { plan } = await getUserPlan(req.user._id);
    const limit    = plan.limits.items;

    if (limit === -1) return next();

    const count = await Item.countDocuments({ user: req.user._id });

    if (count >= limit) {
      return res.status(403).json({
        success:      false,
        limitReached: true,
        message:      `Item limit reached (${limit} on ${plan.displayName} plan). Please upgrade.`,
        current:      count,
        limit,
        upgrade:      true,
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Middleware: check feature flag ──────────────────────────────────────────
// Usage: checkFeature("paymentTracking")
const checkFeature = (feature) => async (req, res, next) => {
  try {
    const { plan } = await getUserPlan(req.user._id);

    if (!plan.features[feature]) {
      return res.status(403).json({
        success:  false,
        message:  `${feature} is not available on ${plan.displayName} plan. Please upgrade.`,
        upgrade:  true,
        feature,
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { canCreateInvoice, canAddBuyer, canAddItem, checkFeature };