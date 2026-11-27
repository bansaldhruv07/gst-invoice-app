import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useSubscription } from "../context/SubscriptionContext";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import { rupees } from "../lib/format";
import { Spinner, EmptyState } from "../components/ui";

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

// Only list features that exist in the app
const INCLUDED = [
  "GST tax invoices and bills of supply as PDF",
  "CGST, SGST and IGST worked out automatically",
  "Payment recording and WhatsApp reminders",
  "Purchases, sellers and GST estimate",
  "Your logo and signature on the bill",
  "Sales register export (CSV)",
];

const limitText = (value, noun) => (value === -1 ? `Unlimited ${noun}` : `${value} ${noun}`);

export default function Pricing() {
  const navigate = useNavigate();
  const { plan: currentPlan, refresh } = useSubscription();

  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying,  setPaying]  = useState(null); // planId being processed

  useEffect(() => {
    api.get("/subscriptions/plans")
      .then(({ data }) => setPlans(data.plans))
      .catch(() => toast.error("Could not load plans"))
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
        toast.error("Could not load the payment window. Check your internet connection.");
        setPaying(null);
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
        name:         "GST Invoice",
        description:  `${data.plan.name} plan, monthly`,
        order_id:     data.orderId,          // for order-based
        subscription_id: data.subscriptionId, // for subscription-based
        prefill: {
          name:  data.user.name,
          email: data.user.email,
        },
        theme:   { color: "#2856f0" },
        modal:   {
          ondismiss: () => {
            setPaying(null);
            toast("Payment cancelled");
          },
        },

        // 4. Verify on success
        handler: async (response) => {
          try {
            await api.post("/subscriptions/verify-payment", {
              razorpay_order_id:        response.razorpay_order_id,
              razorpay_payment_id:      response.razorpay_payment_id,
              razorpay_signature:       response.razorpay_signature,
              razorpay_subscription_id: response.razorpay_subscription_id,
            });

            toast.success(`You are now on the ${plan.displayName} plan`);
            await refresh(); // refresh subscription context
            navigate("/dashboard");
          } catch {
            toast.error("Payment received, but the plan was not activated. Contact support.");
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
      toast.error(err.response?.data?.message || "Could not start the payment");
      setPaying(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner /></div>;
  }
  if (!plans.length) {
    return <EmptyState title="No plans are available right now" />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <p className="text-sm text-slate-600">
        Prices are per month.
        {currentPlan && <> You are on the <strong className="font-semibold">{currentPlan.displayName}</strong> plan.</>}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {plans.map((plan) => {
          const isCurrent = currentPlan?.name === plan.name;
          return (
            <section
              key={plan._id}
              className={`card card-lift flex flex-col p-6 ${isCurrent ? "border-brand-600 ring-2 ring-brand-600" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">{plan.displayName}</h2>
                {isCurrent && <span className="badge bg-brand-50 text-brand-700 border-brand-200">Current</span>}
              </div>
              <p className="mt-3 text-4xl font-bold tabular">
                {rupees(plan.price)}<span className="text-sm font-medium text-slate-400"> /month</span>
              </p>
              <ul className="mt-5 mb-6 space-y-2 text-sm text-slate-600">
                {[
                  limitText(plan.limits.invoicesPerMonth, "invoices a month"),
                  limitText(plan.limits.buyers, "buyers"),
                  limitText(plan.limits.items, "products"),
                  ...(plan.features?.multiUser ? ["Staff logins and activity log"] : []),
                ].map((text) => (
                  <li key={text} className="flex items-center gap-2">
                    <Check className="w-4 h-4 flex-shrink-0 text-brand-600" strokeWidth={3} /> {text}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan)}
                disabled={isCurrent || paying !== null || plan.price === 0}
                className={`mt-auto w-full ${plan.price === 0 ? "btn-secondary" : "btn-primary"}`}
              >
                {paying === plan._id
                  ? "Opening payment…"
                  : isCurrent
                    ? "Current plan"
                    : plan.price === 0
                      ? "Free"
                      : `Choose ${plan.displayName}`}
              </button>
            </section>
          );
        })}
      </div>

      <section className="card p-5">
        <h2 className="text-sm font-semibold mb-3">In every plan</h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm text-slate-600">
          {INCLUDED.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Check className="w-4 h-4 text-brand-600 flex-shrink-0" /> {feature}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">Payments are processed by Razorpay.</p>
      </section>
    </div>
  );
}
