// The plans on sale. They are written to the database when the server starts.
//
// To change a price or limit, edit it here and raise VERSION: each stored plan is
// updated once. Changes made directly in the database are kept until then.
const Plan = require("../models/Plan");

const VERSION = 2;

// Features every plan has
const COMMON = {
  paymentTracking: true,
  gstReports: true,
  customLogo: true,
  emailInvoice: true,
  multiUser: false,
  prioritySupport: false,
};

// price is charged monthly; listPrice is the regular price it is discounted from
// during the launch offer (set it equal to price to end the offer). -1 means no
// limit.
const PLANS = [
  {
    name: "free", displayName: "Free", price: 0, listPrice: 0, yearlyPrice: 0,
    limits: { invoicesPerMonth: 20, buyers: 10, items: 10 }, features: COMMON, isActive: true,
  },
  {
    name: "starter", displayName: "Starter", price: 499, listPrice: 699, yearlyPrice: 4999,
    limits: { invoicesPerMonth: 100, buyers: 50, items: 50 }, features: COMMON, isActive: true,
  },
  {
    name: "growth", displayName: "Growth", price: 799, listPrice: 1299, yearlyPrice: 7999,
    limits: { invoicesPerMonth: -1, buyers: -1, items: -1 },
    features: { ...COMMON, multiUser: true }, isActive: true,
  },
];

// No longer sold. Anyone who paid for one keeps it until it ends.
const RETIRED = ["pro"];

async function seedPlans() {
  let changed = 0;
  for (const plan of PLANS) {
    const stored = await Plan.findOne({ name: plan.name });
    if (!stored) await Plan.create({ ...plan, version: VERSION });
    else if ((stored.version || 1) < VERSION) {
      // A Razorpay auto-debit plan charges a fixed amount, so after a change of
      // price the old one must not be used. Payments become one-time orders until
      // the id of a Razorpay plan with the new price is added.
      if (stored.price !== plan.price && stored.razorpayPlanId) {
        console.warn(`⚠️  ${plan.name}: price changed, so Razorpay plan ${stored.razorpayPlanId} is no longer used`);
        stored.razorpayPlanId = "";
      }
      stored.set({ ...plan, version: VERSION });
      await stored.save();
    } else continue;
    changed += 1;
  }
  const retired = await Plan.updateMany({ name: { $in: RETIRED }, isActive: true }, { isActive: false });
  if (changed || retired.modifiedCount) console.log("✅ Plans updated");
}

module.exports = { seedPlans, VERSION };
