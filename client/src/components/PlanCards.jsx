// The plans side by side, with a monthly or yearly price. Used on the home page
// and on the Plans screen. Every price and saving comes from the plan records.
import { Check } from "lucide-react";
import { rupees } from "../lib/format";
import { priceOf } from "../lib/pricing";

const count = (value, noun) => (value === -1 ? `Unlimited ${noun}` : `${value} ${noun}`);

const points = (plan) => [
  count(plan.limits.invoicesPerMonth, "invoices a month"),
  count(plan.limits.buyers, "buyers"),
  count(plan.limits.items, "products"),
  ...(plan.limits.workers ? [`Attendance and pay for ${plan.limits.workers === -1 ? "unlimited" : plan.limits.workers} workers`] : []),
  ...(plan.features?.multiUser ? ["Staff logins and activity log"] : []),
];

export function PeriodSwitch({ period, onChange, plans }) {
  const best = Math.max(0, ...plans.map((p) => priceOf(p, "yearly").percent));
  return (
    <div role="group" aria-label="Billing period" className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      {[["monthly", "Monthly"], ["yearly", "Yearly"]].map(([key, label]) => (
        <button key={key} type="button" aria-pressed={period === key} onClick={() => onChange(key)}
          className={`flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-bold transition ${
            period === key ? "bg-brand-600 text-white shadow-glow" : "text-slate-600 hover:text-brand-700"
          }`}>
          {label}
          {key === "yearly" && best > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${period === key ? "bg-white/20" : "bg-emerald-100 text-emerald-800"}`}>
              Save up to {best}%
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// `action(plan)` draws the button; `current` is the name of the plan in use
export default function PlanCards({ plans, period, current, action }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
      {plans.map((plan) => {
        const { amount, before, percent, perMonth, saving } = priceOf(plan, period);
        const featured = plan.name === "starter";
        const inUse = current === plan.name;
        return (
          <article key={plan._id} aria-label={`${plan.displayName} plan`}
            className={`relative flex flex-col rounded-3xl border bg-white p-6 transition hover:shadow-xl ${
              inUse ? "border-brand-600 ring-2 ring-brand-600" : featured ? "border-brand-500 shadow-lg" : "border-slate-200"
            }`}>
            <div className="flex items-center justify-between gap-2 min-h-[1.75rem]">
              <h3 className="text-lg font-bold text-slate-900">{plan.displayName}</h3>
              {inUse ? <span className="badge bg-brand-50 text-brand-700 border-brand-200">Current</span>
                : featured && <span className="badge bg-brand-600 text-white border-brand-600">Recommended</span>}
            </div>

            <p className="mt-3 flex items-center gap-2 min-h-[1.75rem] text-sm">
              {before > amount && (
                <>
                  <s className="text-slate-400 tabular">{rupees(before)}</s>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    {percent}% off{period === "monthly" ? " · Launch offer" : ""}
                  </span>
                </>
              )}
            </p>
            <p className="text-4xl font-bold tabular text-slate-900">
              {rupees(amount)}<span className="text-sm font-medium text-slate-400"> /{period === "yearly" && amount > 0 ? "year" : "month"}</span>
            </p>
            <p className="mt-1 min-h-[1.25rem] text-xs text-slate-500">
              {amount === 0 ? "No card needed"
                : period === "yearly" ? `About ${rupees(perMonth)} a month${saving > 0 ? `, you save ${rupees(saving)}` : ""}`
                  : "Billed every month"}
            </p>

            <ul className="mt-5 mb-6 space-y-2.5 text-sm text-slate-700">
              {points(plan).map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0 text-brand-600" strokeWidth={3} /> {point}
                </li>
              ))}
            </ul>
            <div className="mt-auto">{action(plan, featured)}</div>
          </article>
        );
      })}
    </div>
  );
}
