const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  "User",
    required: true,
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  "Plan",
    required: true,
  },

  status: {
    type: String,
    enum: ["active", "cancelled", "expired", "past_due", "trialing"],
    default: "trialing",
  },

  // Razorpay subscription ID
  razorpaySubscriptionId: { type: String, default: "" },

  // Current billing period
  currentPeriodStart: { type: Date, default: Date.now },
  currentPeriodEnd:   { type: Date, default: null },

  // Usage tracking (resets every billing cycle)
  usage: {
    invoicesThisMonth: { type: Number, default: 0 },
    lastResetDate:     { type: Date, default: Date.now },
  },

  // Trial
  trialEndsAt:  { type: Date, default: null },
  cancelledAt:  { type: Date, default: null },

  // Payment history
  payments: [{
    razorpayPaymentId: String,
    amount:            Number,
    status:            String,
    paidAt:            Date,
  }],
}, { timestamps: true });

module.exports = mongoose.model("Subscription", subscriptionSchema);