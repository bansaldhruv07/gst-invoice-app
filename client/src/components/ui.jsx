const STATUS_STYLES = {
  paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
  partial: "bg-amber-50 text-amber-800 border-amber-200",
  unpaid: "bg-red-50 text-red-800 border-red-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

export const statusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES.unpaid;

export function StatusBadge({ status }) {
  return <span className={`badge ${statusStyle(status)}`}>{status}</span>;
}

const TONES = {
  blue: "bg-brand-50 text-brand-600",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-600",
  amber: "bg-saffron-100 text-saffron-700",
};

// The headline figures above a list
export function Stats({ items }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 stagger">
      {items.map(({ label, value, icon: Icon, tone = "blue" }) => (
        <div key={label} className="card card-lift flex items-center gap-3.5 p-4 last:col-span-2 sm:last:col-span-1">
          <span aria-hidden="true" className={`hidden sm:grid place-items-center w-11 h-11 flex-shrink-0 rounded-xl ${TONES[tone]}`}>
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
            <dd className="text-xl font-bold tabular truncate text-slate-900">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

export function Spinner({ className = "h-8 w-8" }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 ${className}`}
    />
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
