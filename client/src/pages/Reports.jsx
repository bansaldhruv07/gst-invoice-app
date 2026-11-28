// The list of reports, and the chosen one for a period.
import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import api from "../api/axios";
import { Spinner, EmptyState } from "../components/ui";
import { shortDate } from "../lib/format";
import { PERIODS, periodRange } from "../lib/period";
import { GROUPS, REPORTS, OLD_TABS } from "../components/reports/catalogue";
import { PartyWise, ProductWise, GstRegister } from "../components/reports/TradeReports";
import { Gstr1, Gstr3b } from "../components/reports/GstReturns";
import Gstr2 from "../components/reports/Gstr2";
import StockReport from "../components/reports/StockReport";
import Ledgers from "../components/reports/Ledgers";
import DayBook from "../components/reports/DayBook";
import Profit from "../components/reports/Profit";

const VIEWS = {
  "party-sales": (p) => <PartyWise {...p} side="sales" />,
  "product-sales": (p) => <ProductWise {...p} side="sales" />,
  "gst-sales": (p) => <GstRegister {...p} side="sales" />,
  "party-purchases": (p) => <PartyWise {...p} side="purchases" />,
  "product-purchases": (p) => <ProductWise {...p} side="purchases" />,
  "gst-purchases": (p) => <GstRegister {...p} side="purchases" />,
  gstr1: (p) => <Gstr1 {...p} />,
  gstr2: (p) => <Gstr2 {...p} />,
  gstr3b: (p) => <Gstr3b {...p} />,
  stock: (p) => <StockReport {...p} />,
  ledgers: (p) => <Ledgers {...p} />,
  daybook: (p) => <DayBook {...p} />,
  profit: (p) => <Profit {...p} />,
};

function Menu({ href }) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {GROUPS.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h2 className="mb-2 text-sm font-bold text-slate-500">{group.title}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
            {group.reports.map(({ id, title, text, icon: Icon }) => (
              <li key={id}>
                <Link to={href(id)} className="card card-lift group flex h-full items-center gap-3.5 p-4">
                  <span className="grid place-items-center w-11 h-11 flex-shrink-0 rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-slate-900">{title}</span>
                    <span className="block text-xs text-slate-500">{text}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 flex-shrink-0 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const wanted = params.get("report") || OLD_TABS[params.get("tab")];
  const chosen = REPORTS.find((r) => r.id === wanted);
  const period = params.get("period") || "this-month";
  const range =
    period === "custom"
      ? { from: params.get("from") || periodRange("this-month").from, to: params.get("to") || periodRange("this-month").to }
      : periodRange(period);
  const ledgerView = ["debtors", "creditors", "both"].includes(params.get("view")) ? params.get("view") : "both";

  // Reports without dates ignore the period
  const key = chosen ? (chosen.dated ? `${chosen.data}|${range.from}|${range.to}` : chosen.data) : "";
  const [result, setResult] = useState({ key: "" });

  useEffect(() => {
    if (!key) return undefined;
    let current = true;
    const [path, from, to] = key.split("|");
    api.get(`/reports/${path}`, { params: from ? { from, to } : {} })
      .then(({ data }) => current && setResult({ key, report: data.report }))
      .catch((err) => current && setResult({ key, error: err.response?.data?.message || "Could not build the report" }));
    return () => {
      current = false;
    };
  }, [key]);

  const kept = { period, ...(period === "custom" ? range : {}) };
  const href = (id) => `?${new URLSearchParams({ report: id, ...kept })}`;

  if (!chosen) return <Menu href={href} />;

  const update = (changes) =>
    setParams({ report: chosen.id, ...kept, ...(chosen.id === "ledgers" ? { view: ledgerView } : {}), ...changes }, { replace: true });
  const file = chosen.dated ? `${chosen.id}-${range.from}-to-${range.to}` : chosen.id;
  const ready = result.key === key;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/reports" className="btn-secondary" aria-label="All reports">
          <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">All reports</span>
        </Link>
        <select aria-label="Report" value={chosen.id} onChange={(e) => setParams({ report: e.target.value, ...kept })}
          className="input w-auto flex-1 sm:flex-none sm:min-w-[17rem] font-bold">
          {GROUPS.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.reports.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </optgroup>
          ))}
        </select>
        {chosen.dated && (
          <>
            <select aria-label="Period" value={period}
              onChange={(e) => setParams({ report: chosen.id, period: e.target.value, ...(e.target.value === "custom" ? range : {}) }, { replace: true })}
              className="input w-auto sm:ml-auto">
              {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {period === "custom" ? (
              <>
                <input type="date" aria-label="From date" value={range.from} onChange={(e) => update({ from: e.target.value })} className="input w-auto" />
                <input type="date" aria-label="To date" value={range.to} onChange={(e) => update({ to: e.target.value })} className="input w-auto" />
              </>
            ) : (
              <span className="text-sm text-slate-500">{shortDate(range.from)} to {shortDate(range.to)}</span>
            )}
          </>
        )}
      </div>

      {!ready ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : result.error ? (
        <EmptyState title={result.error} />
      ) : (
        // A new report or period starts with nothing picked
        <div key={`${chosen.id}|${key}`} className="space-y-4">
          {VIEWS[chosen.id]({
            report: result.report, file,
            ...(chosen.id === "ledgers" && { view: ledgerView, onView: (view) => update({ view }) }),
          })}
        </div>
      )}
    </div>
  );
}
