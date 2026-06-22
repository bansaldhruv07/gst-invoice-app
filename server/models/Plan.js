const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  name:        { type: String, required: true }, // "free", "starter", "growth", "pro"
  displayName: { type: String, required: true }, // "Free", "Starter", etc.
  price:       { type: Number, required: true }, // monthly price in INR (0 for free)
  
  // Razorpay plan ID — created on Razorpay dashboard
  razorpayPlanId: { type: String, default: "" },

  // Feature limits (-1 = unlimited)
  limits: {
    invoicesPerMonth: { type: Number, default: 10 },
    buyers:           { type: Number, default: 5  },
    items:            { type: Number, default: 10 },
  },

  // Feature flags
  features: {
    paymentTracking: { type: Boolean, default: false },
    gstReports:      { type: Boolean, default: false },
    multiUser:       { type: Boolean, default: false },
    customLogo:      { type: Boolean, default: false },
    emailInvoice:    { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
  },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Plan", planSchema);