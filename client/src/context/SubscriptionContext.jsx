import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "./AuthContext";

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [plan,  setPlan]  = useState(null);
  const [usage, setUsage] = useState(null);
  const [sub,   setSub]   = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data } = await api.get("/subscriptions/me");
      setPlan(data.plan);
      setUsage(data.usage);
      setSub(data.subscription);
    } catch {
      // silently fail — user continues on free
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubscription(); }, [user]);

  // ── Helper: check if feature is available ──────────────────────────────────
  const hasFeature = (feature) => plan?.features?.[feature] === true;

  // ── Helper: check if within limit ─────────────────────────────────────────
  const withinLimit = (type) => {
    if (!plan) return false;
    const limit = plan.limits?.[type];
    if (limit === -1) return true; // unlimited
    if (type === "invoicesPerMonth") return (usage?.invoicesThisMonth || 0) < limit;
    return true;
  };

  const isActive   = sub?.status === "active" || sub?.status === "trialing";
  const planName   = plan?.name || "free";
  const isPaid     = planName !== "free";

  return (
    <SubscriptionContext.Provider value={{
      plan, usage, sub, loading,
      hasFeature, withinLimit,
      isActive, planName, isPaid,
      refresh: fetchSubscription,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}