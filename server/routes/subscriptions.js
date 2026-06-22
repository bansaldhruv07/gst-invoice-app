const express      = require("express");
const router       = express.Router();
const Razorpay     = require("razorpay");
const crypto       = require("crypto");
const Plan         = require("../models/Plan");
const Subscription = require("../models/Subscription");
const User         = require("../models/User");
const { protect }  = require("../middleware/auth");

// ─── Razorpay instance ────────────────────────────────────────────────────────
// const razorpay = new Razorpay({
//   key_id:     process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// ─── GET /api/subscriptions/plans ────────────────────────────────────────────
// Returns all active plans — shown on pricing page
router.get("/plans", async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/subscriptions/me ────────────────────────────────────────────────
// Returns current user's subscription + usage
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path:     "subscription",
        populate: { path: "plan" },
      });

    if (!user.subscription) {
      // No subscription — return free plan limits
      const freePlan = await Plan.findOne({ name: "free" });
      return res.json({
        success: true,
        subscription: null,
        plan: freePlan,
        usage: { invoicesThisMonth: 0 },
      });
    }

    // Reset monthly usage counter if new billing period
    const sub = user.subscription;
    const now  = new Date();
    const lastReset = new Date(sub.usage.lastResetDate);
    if (
      now.getMonth()    !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()
    ) {
      sub.usage.invoicesThisMonth = 0;
      sub.usage.lastResetDate     = now;
      await sub.save();
    }

    res.json({
      success:      true,
      subscription: sub,
      plan:         sub.plan,
      usage:        sub.usage,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/subscriptions/create-order ────────────────────────────────────
// Creates Razorpay order for one-time payment (monthly manual renewal)
// OR subscription for auto-debit
router.post("/create-order", protect, async (req, res) => {
  try {
    const { planId } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan || plan.price === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan",
      });
    }

    // ── Option A: Razorpay Subscription (auto-debit monthly) ──────────────
    // Use this if you have Razorpay route activation approved
    if (plan.razorpayPlanId) {
      const rzpSubscription = await razorpay.subscriptions.create({
        plan_id:         plan.razorpayPlanId,
        total_count:     12, // 12 billing cycles (1 year)
        quantity:        1,
        customer_notify: 1,
        notes: {
          userId:   req.user._id.toString(),
          planName: plan.name,
        },
      });

      return res.json({
        success:        true,
        type:           "subscription",
        subscriptionId: rzpSubscription.id,
        keyId:          process.env.RAZORPAY_KEY_ID,
        plan: {
          name:  plan.displayName,
          price: plan.price,
        },
        user: {
          name:  req.user.name,
          email: req.user.email,
        },
      });
    }

    // ── Option B: One-time order (simpler, works without route activation) ─
    const order = await razorpay.orders.create({
      amount:   plan.price * 100, // Razorpay takes paise
      currency: "INR",
      receipt:  `receipt_${req.user._id}_${Date.now()}`,
      notes: {
        userId:   req.user._id.toString(),
        planId:   plan._id.toString(),
        planName: plan.name,
      },
    });

    res.json({
      success:  true,
      type:     "order",
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
      plan: {
        name:  plan.displayName,
        price: plan.price,
      },
      user: {
        name:  req.user.name,
        email: req.user.email,
      },
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/subscriptions/verify-payment ──────────────────────────────────
// Called after Razorpay payment is completed on frontend
// Verifies signature and activates subscription
router.post("/verify-payment", protect, async (req, res) => {
  try {
    const {
      planId,
      // For order-based payment
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      // For subscription-based payment
      razorpay_subscription_id,
    } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    // ── Verify Razorpay signature (CRITICAL — prevents fraud) ─────────────
    let isValid = false;

    if (razorpay_subscription_id) {
      // Subscription payment verification
      const body      = `${razorpay_payment_id}|${razorpay_subscription_id}`;
      const expected  = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");
      isValid = expected === razorpay_signature;
    } else {
      // One-time order verification
      const body      = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expected  = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");
      isValid = expected === razorpay_signature;
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed — invalid signature",
      });
    }

    // ── Activate subscription ──────────────────────────────────────────────
    const now       = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month from now

    // Find existing subscription or create new one
    let sub = await Subscription.findOne({ user: req.user._id });

    if (sub) {
      // Upgrade / renew
      sub.plan                   = plan._id;
      sub.status                 = "active";
      sub.currentPeriodStart     = now;
      sub.currentPeriodEnd       = periodEnd;
      sub.razorpaySubscriptionId = razorpay_subscription_id || "";
      sub.payments.push({
        razorpayPaymentId: razorpay_payment_id,
        amount:            plan.price,
        status:            "captured",
        paidAt:            now,
      });
    } else {
      sub = await Subscription.create({
        user:                  req.user._id,
        plan:                  plan._id,
        status:                "active",
        currentPeriodStart:    now,
        currentPeriodEnd:      periodEnd,
        razorpaySubscriptionId: razorpay_subscription_id || "",
        usage: {
          invoicesThisMonth: 0,
          lastResetDate:     now,
        },
        payments: [{
          razorpayPaymentId: razorpay_payment_id,
          amount:            plan.price,
          status:            "captured",
          paidAt:            now,
        }],
      });
    }

    await sub.save();

    // Link subscription to user
    await User.findByIdAndUpdate(req.user._id, { subscription: sub._id });

    res.json({
      success:      true,
      message:      `Successfully subscribed to ${plan.displayName}!`,
      subscription: sub,
    });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/subscriptions/cancel ──────────────────────────────────────────
// Cancels at period end — user keeps access till currentPeriodEnd
router.post("/cancel", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("subscription");
    const sub  = user.subscription;

    if (!sub) {
      return res.status(400).json({
        success: false,
        message: "No active subscription",
      });
    }

    // Cancel on Razorpay if subscription-based
    if (sub.razorpaySubscriptionId) {
      try {
        await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId);
      } catch (e) {
        console.error("Razorpay cancel error:", e.message);
      }
    }

    sub.status      = "cancelled";
    sub.cancelledAt = new Date();
    await sub.save();

    res.json({
      success: true,
      message: `Subscription cancelled. Access continues until ${sub.currentPeriodEnd?.toDateString()}.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/subscriptions/webhook ─────────────────────────────────────────
// Razorpay calls this URL for auto-renewal events
// Add this URL in Razorpay dashboard → Webhooks
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const body      = req.body.toString();

    // Verify webhook signature
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== signature) {
      return res.status(400).json({ success: false });
    }

    const event = JSON.parse(body);

    // Handle subscription renewal
    if (event.event === "subscription.charged") {
      const razorpaySubId = event.payload.subscription.entity.id;
      const payment       = event.payload.payment.entity;

      const sub = await Subscription.findOne({
        razorpaySubscriptionId: razorpaySubId,
      });

      if (sub) {
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        sub.status             = "active";
        sub.currentPeriodEnd   = periodEnd;
        sub.usage.invoicesThisMonth = 0; // reset monthly usage
        sub.usage.lastResetDate     = new Date();
        sub.payments.push({
          razorpayPaymentId: payment.id,
          amount:            payment.amount / 100,
          status:            payment.status,
          paidAt:            new Date(),
        });
        await sub.save();
      }
    }

    // Handle subscription expiry
    if (event.event === "subscription.completed" || event.event === "subscription.expired") {
      const razorpaySubId = event.payload.subscription.entity.id;
      const sub = await Subscription.findOne({
        razorpaySubscriptionId: razorpaySubId,
      });
      if (sub) {
        sub.status = "expired";
        await sub.save();
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;