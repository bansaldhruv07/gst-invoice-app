import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useSubscription } from "../context/SubscriptionContext";
import toast from "react-hot-toast";
import { Check, Zap, Star, Crown, ArrowRight } from "lucide-react";


// ─── Load Razorpay script ─────────────────────────────────────────────────────
function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script    = document.createElement("script");
    script.src      = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload   = () => resolve(true);
    script.onerror  = () => resolve(false);
    document.body.appendChild(script);
  });
}

const PLAN_ICONS = {
  free:    Zap,
  starter: Star,
  growth:  ArrowRight,
  pro:     Crown,
};

const PLAN_COLORS = {
  free:    { bg: "bg-slate-50",   border: "border-slate-200", badge: "", button: "bg-slate-800 hover:bg-slate-900" },
  starter: { bg: "bg-blue-50",    border: "border-blue-200",  badge: "bg-blue-100 text-blue-700",    button: "bg-blue-600 hover:bg-blue-700" },
  growth:  { bg: "bg-indigo-50",  border: "border-indigo-300",badge: "bg-indigo-600 text-white",     button: "bg-indigo-600 hover:bg-indigo-700", popular: true },
  pro:     { bg: "bg-purple-50",  border: "border-purple-200",badge: "bg-purple-100 text-purple-700",button: "bg-purple-600 hover:bg-purple-700" },
};

const FEATURE_LABELS = {
  paymentTracking: "Payment Recording & Tracking",
  gstReports:      "GST Reports (GSTR-1 ready)",
  multiUser:       "Multi-user (5 seats)",
  customLogo:      "Custom Logo on PDF",
  emailInvoice:    "Email Invoice to Buyer",
  prioritySupport: "Priority Support",
};

export default function Pricing() {
  const navigate = useNavigate();
  const { plan: currentPlan, refresh } = useSubscription();

  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying,  setPaying]  = useState(null); // planId being processed

  useEffect(() => {
    api.get("/subscriptions/plans")
      .then(({ data }) => setPlans(data.plans))
      .finally(() => setLoading(false));
  }, []);

  // ── Handle subscribe / upgrade ─────────────────────────────────────────────
  const handleSubscribe = async (plan) => {
    if (plan.price === 0) return; // free plan — nothing to pay
    if (currentPlan?.name === plan.name) return; // already on this plan

    setPaying(plan._id);
    try {
      // 1. Load Razorpay checkout script
      const loaded = await loadRazorpay();
      if (!loaded) {
        toast.error("Failed to load payment gateway. Check your internet.");
        return;
      }

      // 2. Create order on backend
      const { data } = await api.post("/subscriptions/create-order", {
        planId: plan._id,
      });

      // 3. Open Razorpay checkout modal
      const options = {
        key:          data.keyId,
        amount:       data.amount,
        currency:     data.currency || "INR",
        name:         "GST Invoice Manager",
        description:  `${data.plan.name} Plan — Monthly`,
        order_id:     data.orderId,          // for order-based
        subscription_id: data.subscriptionId, // for subscription-based
        prefill: {
          name:  data.user.name,
          email: data.user.email,
        },
        theme:   { color: "#4f46e5" },
        modal:   {
          ondismiss: () => {
            setPaying(null);
            toast("Payment cancelled", { icon: "ℹ️" });
          },
        },

        // 4. Verify on success
        handler: async (response) => {
          try {
            await api.post("/subscriptions/verify-payment", {
              planId:                   plan._id,
              razorpay_order_id:        response.razorpay_order_id,
              razorpay_payment_id:      response.razorpay_payment_id,
              razorpay_signature:       response.razorpay_signature,
              razorpay_subscription_id: response.razorpay_subscription_id,
            });

            toast.success(`🎉 Welcome to ${plan.displayName}!`);
            await refresh(); // refresh subscription context
            navigate("/dashboard");
          } catch {
            toast.error("Payment succeeded but activation failed. Contact support.");
          } finally {
            setPaying(null);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        toast.error(`Payment failed: ${response.error.description}`);
        setPaying(null);
      });
      rzp.open();

    } catch (err) {
      toast.error(err.response?.data?.message || "Payment initiation failed");
      setPaying(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-16 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Start free. Upgrade when your business grows.
            All plans include PDF download and GST calculation.
          </p>
          {currentPlan && (
            <div className="mt-4 inline-block px-4 py-2 bg-indigo-900 border border-indigo-700 rounded-full text-indigo-300 text-sm">
              Current plan: <strong>{currentPlan.displayName}</strong>
            </div>
          )}
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const colors   = PLAN_COLORS[plan.name] || PLAN_COLORS.free;
            const Icon     = PLAN_ICONS[plan.name]  || Zap;
            const isCurrent = currentPlan?.name === plan.name;
            const isProcessing = paying === plan._id;

            return (
              <div
                key={plan._id}
                className={`relative rounded-2xl border-2 p-6 transition-all ${colors.bg} ${colors.border} ${
                  colors.popular ? "scale-105 shadow-2xl shadow-indigo-500/20" : "shadow-lg"
                }`}
              >
                {/* Popular badge */}
                {colors.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                {/* Current plan badge */}
                {isCurrent && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      CURRENT
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.badge || "bg-slate-200"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{plan.displayName}</h3>
                    <p className="text-xs text-slate-500">
                      {plan.name === "free" ? "Forever free" : "per month"}
                    </p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-800">
                    {plan.price === 0 ? "₹0" : `₹${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-slate-500 text-sm">/mo</span>
                  )}
                  {plan.price > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      ₹{plan.price * 12}/year · saves ₹{Math.round(plan.price * 12 * 0.17)} vs monthly
                    </p>
                  )}
                </div>

                {/* Limits */}
                <div className="space-y-2 mb-6 pb-6 border-b border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">
                      {plan.limits.invoicesPerMonth === -1
                        ? "Unlimited"
                        : plan.limits.invoicesPerMonth}
                    </span>{" "}
                    invoices/month
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">
                      {plan.limits.buyers === -1 ? "Unlimited" : plan.limits.buyers}
                    </span>{" "}
                    buyers
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">
                      {plan.limits.items === -1 ? "Unlimited" : plan.limits.items}
                    </span>{" "}
                    items
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                    <li key={key} className="flex items-center gap-2 text-sm">
                      <span className={plan.features[key] ? "text-green-600" : "text-slate-300"}>
                        {plan.features[key] ? <Check className="w-4 h-4" /> : "×"}
                      </span>
                      <span className={plan.features[key] ? "text-slate-700" : "text-slate-400"}>
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={isCurrent || isProcessing || plan.price === 0}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${colors.button}`}
                >
                  {isProcessing
                    ? "Processing..."
                    : isCurrent
                    ? "Current Plan"
                    : plan.price === 0
                    ? "Free Forever"
                    : `Upgrade to ${plan.displayName}`
                  }
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust signals */}
        <div className="mt-12 text-center">
          <div className="flex items-center justify-center gap-8 flex-wrap text-slate-400 text-sm">
            <span>🔒 Payments secured by Razorpay</span>
            <span>🔄 Cancel anytime</span>
            <span>📄 GST invoice for every payment</span>
            <span>💬 Support via email</span>
          </div>
        </div>
      </div>
    </div>
  );
}