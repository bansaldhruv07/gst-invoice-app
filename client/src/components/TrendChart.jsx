// Monthly sales and purchases as paired bars, with a tooltip and a table view.
import { useState } from "react";
import { rupees } from "../lib/format";

// Checked for colour-blind separation and contrast on white
const SERIES = [
  ["sales", "Sales", "#2b59f6"],
  ["purchases", "Purchases", "#e0760c"],
];

// A round number just above the largest value, for the top gridline
function ceiling(max) {
  if (max <= 0) return 1000;
  const unit = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 2.5, 5, 10].map((m) => m * unit).find((v) => v >= max);
}

const compact = (n) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export default function TrendChart({ data }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const top = ceiling(Math.max(...data.flatMap((d) => SERIES.map(([k]) => d[k]))));

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Last six months</h2>
        <div className="flex items-center gap-4">
          {!asTable && SERIES.map(([key, label, colour]) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: colour }} /> {label}
            </span>
          ))}
          <button onClick={() => setAsTable((v) => !v)} className="text-xs font-bold text-brand-700 hover:underline">
            {asTable ? "Show chart" : "Show table"}
          </button>
        </div>
      </div>

      {asTable ? (
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Month</th>
              <th className="th text-right">Sales</th>
              <th className="th text-right">Purchases</th>
              <th className="th text-right">Expenses</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month}>
                <td className="td">{d.label}</td>
                <td className="td text-right">{rupees(d.sales)}</td>
                <td className="td text-right">{rupees(d.purchases)}</td>
                <td className="td text-right">{rupees(d.expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="px-5 pt-6 pb-3">
          <div className="flex gap-2">
            <div className="relative w-12 h-48 text-xs text-slate-400 tabular" aria-hidden="true">
              {[1, 0.5, 0].map((f) => (
                <span key={f} className="absolute right-0 translate-y-1/2" style={{ bottom: `${f * 100}%` }}>
                  {compact(top * f)}
                </span>
              ))}
            </div>
            <div className="relative flex-1 h-48">
              {[1, 0.5].map((f) => (
                <div key={f} className="absolute inset-x-0 border-t border-dashed border-slate-200" style={{ bottom: `${f * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex border-b border-slate-300">
                {data.map((d, i) => (
                  <div
                    key={d.month}
                    tabIndex={0}
                    role="img"
                    aria-label={`${d.label}: sales ${rupees(d.sales)}, purchases ${rupees(d.purchases)}`}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className={`relative flex-1 flex items-end justify-center gap-0.5 rounded-t-lg transition-colors ${hover === i ? "bg-brand-50" : ""}`}
                  >
                    {SERIES.map(([key, , colour], s) => (
                      <div
                        key={key}
                        className="w-1/4 max-w-[1.5rem] rounded-t origin-bottom animate-grow"
                        style={{
                          height: `${Math.max(0, (d[key] / top) * 100)}%`,
                          minHeight: d[key] > 0 ? 2 : 0,
                          background: colour,
                          animationDelay: `${200 + i * 70 + s * 50}ms`,
                        }}
                      />
                    ))}
                    {hover === i && (
                      <div
                        className={`absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-xl pointer-events-none animate-pop ${
                          i === 0 ? "left-0" : i === data.length - 1 ? "right-0" : ""
                        }`}
                      >
                        <p className="font-bold">{d.label}</p>
                        {SERIES.map(([key, label]) => <p key={key}>{label}: {rupees(d[key])}</p>)}
                        <p>Expenses: {rupees(d.expenses)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex ml-14 mt-1.5 text-xs text-slate-500">
            {data.map((d) => <span key={d.month} className="flex-1 text-center">{d.label.split(" ")[0]}</span>)}
          </div>
        </div>
      )}
    </section>
  );
}
