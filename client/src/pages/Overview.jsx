import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Check, ChevronRight, MessageCircle, TrendingUp, ArrowDownLeft, ArrowUpRight, Landmark, SendHorizonal,
  ClipboardList, ShoppingCart, Wallet, BarChart3, BookOpen,
} from "lucide-react";
import api from "../api/axios";
import { useBusiness } from "../context/BusinessContext";
import { useAuth } from "../context/AuthContext";
import { useAssistant } from "../context/AssistantContext";
import { money, rupees, shortDate, whatsappReminder } from "../lib/format";
import { EmptyState } from "../components/ui";
import TrendChart from "../components/TrendChart";
import { Spark } from "../components/Logo";
import { useCountUp } from "../hooks/motion";
import { ASSISTANT_NAME } from "../lib/assistant";

const SEVERITY = {
  high: { dot: "bg-red-600", ring: "bg-red-50", label: "Urgent" },
  medium: { dot: "bg-saffron-500", ring: "bg-saffron-100", label: "Soon" },
  low: { dot: "bg-slate-400", ring: "bg-slate-100", label: "Tidy up" },
};

const count = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

const AGE_COLOURS = ["bg-brand-500", "bg-amber-400", "bg-orange-500", "bg-red-600", "bg-slate-400"];

const PROMPTS = ["Who owes me money?", "What is my current stock value?", "Top selling products this month", "How much GST do I owe?"];

const SHORTCUTS = [
  ["New quotation", "/quotations/create", ClipboardList],
  ["Record purchase", "/purchases/create", ShoppingCart],
  ["Add expense", "/expenses", Wallet],
  ["Profit report", "/reports", BarChart3],
  ["Day book", "/reports?tab=daybook", BookOpen],
];

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

// Hero with the question box that opens the assistant
function AskBar() {
  const { user } = useAuth();
  const { ask, setOpen, busy } = useAssistant();
  const [question, setQuestion] = useState("");

  const send = (text) => {
    if (!text.trim()) return;
    setOpen(true);
    ask(text);
    setQuestion("");
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-900 px-5 py-6 sm:px-8 sm:py-7 text-white shadow-xl">
      <div aria-hidden="true" className="absolute -top-20 right-10 w-64 h-64 rounded-full bg-white/10 blur-2xl animate-float" />
      <div aria-hidden="true" className="absolute -bottom-24 right-1/3 w-56 h-56 rounded-full bg-brand-300/30 blur-3xl animate-float [animation-delay:2s]" />
      <div className="relative">
        <h2 className="text-2xl sm:text-3xl font-bold">
          {greeting()}, {user?.name?.split(" ")[0]}
        </h2>
        <p className="mt-1 text-brand-100">Ask {ASSISTANT_NAME} about your business, or tell it what to write.</p>
        <form onSubmit={(e) => { e.preventDefault(); send(question); }} className="mt-4 flex gap-2 max-w-2xl rounded-2xl bg-white p-1.5 shadow-lg focus-within:ring-4 focus-within:ring-white/40">
          <span className="hidden sm:grid place-items-center pl-2 text-brand-600"><Spark className="w-5 h-5" /></span>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1000}
            placeholder="Create invoice for Raj Traders with Laptop of Rs.25,000"
            aria-label={`Ask ${ASSISTANT_NAME}`}
            className="flex-1 min-w-0 h-11 px-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          <button type="submit" disabled={busy || !question.trim()} aria-label="Ask" className="btn-primary h-11 w-11 px-0 rounded-xl">
            <SendHorizonal className="w-5 h-5" />
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {PROMPTS.map((p) => (
            <button key={p} onClick={() => send(p)} className="h-8 px-3 rounded-full text-xs font-bold bg-white/15 border border-white/20 transition hover:bg-white hover:text-brand-700 hover:-translate-y-0.5">
              {p}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Figure({ label, value, note, icon: Icon, accent, to, tone = "" }) {
  const shown = useCountUp(value);
  return (
    <Link to={to} className="card card-lift group p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <span className={`grid place-items-center w-9 h-9 rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${accent}`}>
          <Icon className="w-4 h-4" strokeWidth={2.4} />
        </span>
      </div>
      <p className={`mt-2 text-[1.7rem] leading-tight font-bold tabular tracking-tight ${tone || "text-slate-900"}`}>{rupees(shown)}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </Link>
  );
}

function Setup({ steps }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Finish setting up</h2>
        <span className="text-xs font-bold text-brand-700">{done} of {steps.length} done</span>
      </div>
      <div className="h-1.5 bg-slate-100">
        <div className="h-full origin-left bg-gradient-to-r from-brand-400 to-brand-600 animate-widen" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="grid sm:grid-cols-2 gap-x-6 px-5 py-3">
        {steps.map((s) => (
          <li key={s.id}>
            {s.done ? (
              <span className="flex items-center gap-2.5 py-1.5 text-sm text-slate-400">
                <Check className="w-4 h-4 text-emerald-600" strokeWidth={3} /> {s.label}
              </span>
            ) : (
              <Link to={s.to} className="group flex items-center gap-2.5 py-1.5 text-sm font-semibold text-brand-700">
                <span className="w-4 h-4 rounded-full border-2 border-brand-300 transition group-hover:bg-brand-600 group-hover:border-brand-600" />
                {s.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Loading() {
  return (
    <div className="max-w-6xl mx-auto space-y-5" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-52 rounded-3xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />)}
      </div>
      <div className="skeleton h-72" />
    </div>
  );
}

export default function Overview() {
  const { business } = useBusiness();
  const { messages } = useAssistant();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  // Figures refresh after the assistant saves something
  const saved = messages.reduce(
    (n, m) => n + (m.parts?.filter((p) => p.type === "card" && p.card.kind === "done").length || 0),
    0,
  );

  const load = useCallback(() => {
    setError("");
    api.get("/insights")
      .then((res) => setData(res.data.insights))
      .catch((err) => setError(err.response?.data?.message || "Could not load your overview."));
  }, []);

  useEffect(() => {
    load();
  }, [load, saved]);

  if (error) {
    return (
      <div className="card max-w-lg mx-auto">
        <EmptyState title={error} action={<button onClick={load} className="btn-secondary">Try again</button>} />
      </div>
    );
  }
  if (!data) return <Loading />;

  const { thisMonth, lastMonth, receivables, payables, attention, topBuyers, setup, plan, trend, lowStock, openQuotations } = data;
  const setupPending = setup.some((s) => !s.done);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <AskBar />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <Figure
          to="/invoices" icon={TrendingUp} accent="bg-brand-50 text-brand-600"
          label={`Sales in ${thisMonth.label}`}
          value={thisMonth.sales}
          note={`${count(thisMonth.invoiceCount, "invoice")} · ${rupees(lastMonth.sales)} last month`}
        />
        <Figure
          to="/buyers" icon={ArrowDownLeft} accent="bg-red-50 text-red-600"
          label="To collect"
          value={receivables.total}
          note={
            receivables.overdueCount
              ? `${rupees(receivables.overdueTotal)} overdue`
              : count(receivables.count, "open invoice")
          }
          tone={receivables.overdueCount ? "text-red-700" : ""}
        />
        <Figure
          to="/purchases" icon={ArrowUpRight} accent="bg-saffron-100 text-saffron-700"
          label="To pay sellers"
          value={payables.total}
          note={count(payables.count, "open bill")}
        />
        <Figure
          to="/reports?tab=gst" icon={Landmark} accent="bg-emerald-50 text-emerald-700"
          label={thisMonth.netTax < 0 ? "GST credit this month" : "GST payable this month"}
          value={Math.abs(thisMonth.netTax)}
          note={`Estimate: ${rupees(thisMonth.outputTax)} collected − ${rupees(thisMonth.inputTax)} paid`}
        />
      </section>

      <div className="flex flex-wrap gap-2">
        {SHORTCUTS.map(([label, to, Icon]) => (
          <Link key={to} to={to} className="btn-secondary btn-sm">
            <Icon className="w-3.5 h-3.5" /> {label}
          </Link>
        ))}
        {openQuotations.count > 0 && (
          <Link to="/quotations" className="btn btn-sm text-brand-700 hover:underline">
            {count(openQuotations.count, "open quotation")} worth {rupees(openQuotations.value)}
          </Link>
        )}
      </div>

      {setupPending && <Setup steps={setup} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <TrendChart data={trend} />

          <section className="card overflow-hidden">
            <div className="card-head">
              <h2 className="card-title">Needs your attention</h2>
              {attention.length > 0 && <span className="badge bg-brand-50 text-brand-700 border-brand-200">{attention.length}</span>}
            </div>
            {attention.length === 0 ? (
              <EmptyState title="Nothing is waiting on you" hint="Overdue bills and missing details will show up here." />
            ) : (
              <ul className="divide-y divide-slate-100 stagger">
                {attention.map((a) => (
                  <li key={a.id}>
                    <Link to={a.to} className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-brand-50">
                      <span title={SEVERITY[a.severity].label} className={`grid place-items-center w-7 h-7 rounded-full flex-shrink-0 ${SEVERITY[a.severity].ring}`}>
                        <span className={`w-2 h-2 rounded-full ${SEVERITY[a.severity].dot}`} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold">{a.title}</span>
                        <span className="block text-sm text-slate-500">{a.detail}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 mt-1 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-brand-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {receivables.overdue.length > 0 && (
            <section className="card overflow-hidden">
              <div className="card-head">
                <h2 className="card-title">Overdue invoices</h2>
                <span className="text-xs text-slate-500">Largest first</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th">Buyer</th>
                      <th className="th">Invoice</th>
                      <th className="th">Due</th>
                      <th className="th text-right">Balance</th>
                      <th className="th text-right">Remind</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.overdue.map((i) => {
                      const link = whatsappReminder({ ...i, business: business?.name });
                      return (
                        <tr key={i.id}>
                          <td className="td font-bold">{i.buyer}</td>
                          <td className="td">
                            <Link to={`/invoices/${i.id}`} className="font-semibold text-brand-700 hover:underline">
                              {i.invoiceNumber}
                            </Link>
                          </td>
                          <td className="td whitespace-nowrap">
                            {shortDate(i.dueDate)}
                            <span className="block text-xs text-red-700">{count(i.daysOverdue, "day")} late</span>
                          </td>
                          <td className="td text-right whitespace-nowrap">{money(i.balance)}</td>
                          <td className="td text-right">
                            {link ? (
                              <a href={link} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                              </a>
                            ) : (
                              <Link to="/buyers" className="text-xs text-slate-500 hover:underline">Add mobile</Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Money to collect, by age</h2>
            </div>
            <div className="px-5 py-4">
              {receivables.total > 0 && (
                <div className="flex h-2.5 mb-4 rounded-full overflow-hidden bg-slate-100 origin-left animate-widen">
                  {receivables.ageing.map((a, i) => (
                    <div
                      key={a.label}
                      className={AGE_COLOURS[i]}
                      style={{ width: `${(a.amount / receivables.total) * 100}%` }}
                    />
                  ))}
                </div>
              )}
              <dl className="space-y-2 text-sm">
                {receivables.ageing.map((a, i) => (
                  <div key={a.label} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${AGE_COLOURS[i]}`} />
                    <dt className="flex-1 text-slate-600">{a.label}</dt>
                    <dd className="tabular font-bold">{rupees(a.amount)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-slate-400">Invoices without a due date are due after 30 days.</p>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="card-head">
              <h2 className="card-title">Top buyers, last 90 days</h2>
            </div>
            {topBuyers.length === 0 ? (
              <EmptyState title="No sales yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {topBuyers.map((b, i) => (
                  <li key={b.name} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="grid place-items-center w-8 h-8 flex-shrink-0 rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      {b.id ? (
                        <Link to={`/buyers/${b.id}`} className="block truncate font-semibold text-slate-800 hover:text-brand-700">{b.name}</Link>
                      ) : (
                        <span className="block truncate">{b.name}</span>
                      )}
                      <span className="block text-xs text-slate-500">{count(b.invoices, "invoice")}</span>
                    </span>
                    <span className="tabular font-bold">{rupees(b.sales)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {lowStock.length > 0 && (
            <section className="card overflow-hidden">
              <div className="card-head">
                <h2 className="card-title">Low stock</h2>
                <Link to="/stock" className="text-sm font-bold text-brand-700 hover:underline">All stock</Link>
              </div>
              <ul className="divide-y divide-slate-100">
                {lowStock.slice(0, 6).map((s) => (
                  <li key={s.name} className="flex justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="truncate">{s.name}</span>
                    <span className="tabular font-bold text-red-700 whitespace-nowrap">{s.stock} {s.unit}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.invoices.limit > 0 && (
            <section className="card px-5 py-4 text-sm">
              <div className="flex justify-between">
                <span className="font-bold">{plan.name} plan</span>
                <Link to="/pricing" className="font-bold text-brand-700 hover:underline">See plans</Link>
              </div>
              <p className="mt-1 text-slate-500">
                {plan.invoices.used} of {plan.invoices.limit} invoices used this month
              </p>
              <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full origin-left rounded-full bg-gradient-to-r from-brand-400 to-brand-600 animate-widen"
                  style={{ width: `${Math.min(100, (plan.invoices.used / plan.invoices.limit) * 100)}%` }}
                />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
