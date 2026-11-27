// ─── Seed default plans on startup ───────────────────────────────────────────
const Plan = require("../models/Plan");

async function seedPlans() {
  const count = await Plan.countDocuments();
  if (count > 0) return; // already seeded

  await Plan.insertMany([
    {
      name: "free",
      displayName: "Free",
      price: 0,
      limits: { invoicesPerMonth: 10, buyers: 5, items: 10 },
      features: {
        paymentTracking: false,
        gstReports: false,
        multiUser: false,
        customLogo: false,
        emailInvoice: false,
        prioritySupport: false,
      },
    },
    {
      name: "starter",
      displayName: "Starter",
      price: 299,
      limits: { invoicesPerMonth: 100, buyers: 50, items: 100 },
      features: {
        paymentTracking: true,
        gstReports: false,
        multiUser: false,
        customLogo: true,
        emailInvoice: false,
        prioritySupport: false,
      },
    },
    {
      name: "growth",
      displayName: "Growth",
      price: 799,
      limits: { invoicesPerMonth: -1, buyers: -1, items: -1 },
      features: {
        paymentTracking: true,
        gstReports: true,
        multiUser: false,
        customLogo: true,
        emailInvoice: true,
        prioritySupport: false,
      },
    },
    {
      name: "pro",
      displayName: "Pro",
      price: 1999,
      limits: { invoicesPerMonth: -1, buyers: -1, items: -1 },
      features: {
        paymentTracking: true,
        gstReports: true,
        multiUser: true,
        customLogo: true,
        emailInvoice: true,
        prioritySupport: true,
      },
    },
  ]);
  console.log("✅ Plans seeded");
}

module.exports = { seedPlans };
