import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useSubscription } from "../context/SubscriptionContext";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import { shortDate } from "../lib/format";
import { Spinner, EmptyState } from "../components/ui";
import PlanCards, { PeriodSwitch } from "../components/PlanCards";
import { INCLUDED } from "../lib/pricing";

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

export default function Pricing() {
  const navigate = useNavigate();
  const { plan: currentPlan, sub, refresh } = useSubscription();

  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying,  setPaying]  = useState(null); // planId being processed
  const [chosen,  setChosen]  = useState(null); // billing period picked here

  useEffect(() => {
    api.get("/subscriptions/plans")
      .then(({ data }) => setPlans(data.plans))
      .catch(() => toast.error("Could not load plans"))
      .finally(() => setLoading(false));
  }, []);

  const paidUntil = currentPlan?.price > 0 && sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const currentPeriod = sub?.billingPeriod || "monthly";
  const period = chosen || (paidUntil ? currentPeriod : "monthly");

  // ── Handle subscribe / upgrade ─────────────────────────────────────────────
  const handleSubscribe = async (plan) => {
    if (plan.price === 0) return; // free plan — nothing to pay
    // A different plan starts today
    if (paidUntil > new Date() && currentPlan.name !== plan.name &&
      !window.confirm(`Your ${currentPlan.displayName} plan is paid until ${shortDate(paidUntil)}. The ${plan.displayName} plan starts today and the remaining days are not carried over. Continue?`)) {
      return;
    }

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
        period,
      });

      // 3. Open Razorpay checkout modal
      const options = {
        key:          data.keyId,
        amount:       data.amount,
        currency:     data.currency || "INR",
        name:         "GST Invoice",
        description:  `${data.plan.name} plan, ${period}`,
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

  const action = (plan, featured) => {
    const inUse = currentPlan?.name === plan.name;
    // The plan in use can be renewed, or moved from monthly to yearly
    const renewing = inUse && plan.price > 0 && period === "yearly";
    return (
      <button
        onClick={() => handleSubscribe(plan)}
        disabled={paying !== null || plan.price === 0 || (inUse && !renewing)}
        className={`w-full h-11 ${featured && !inUse ? "btn-primary" : "btn-secondary"}`}
      >
        {paying === plan._id
          ? "Opening payment…"
          : renewing
            ? currentPeriod === "yearly" ? "Add another year" : "Switch to yearly"
            : inUse
              ? "Current plan"
              : plan.price === 0
                ? "Free"
                : `Choose ${plan.displayName}`}
      </button>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {currentPlan && <>You are on the <strong className="font-semibold">{currentPlan.displayName}</strong> plan</>}
          {paidUntil && paidUntil > new Date() ? `, paid until ${shortDate(paidUntil)}.` : currentPlan ? "." : ""}
        </p>
        <PeriodSwitch period={period} onChange={setChosen} plans={plans} />
      </div>

      <PlanCards plans={plans} period={period} current={currentPlan?.name} action={action} />

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
