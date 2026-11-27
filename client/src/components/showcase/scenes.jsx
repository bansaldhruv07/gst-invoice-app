// Short animated stories, one per feature. All names and figures are made up.
// Each scene is drawn on a 460 × 400 stage and replays whenever it is mounted.
import { useState, useEffect } from "react";
import {
  Check, Download, MessageCircle, Percent, ShoppingCart, FileText, TriangleAlert, IndianRupee, FileSpreadsheet,
} from "lucide-react";
import { UserBubble, BotRow, BotBubble, Typing, CardFrame } from "../assistant/Bubbles";
import { Spark } from "../Logo";
import { useCountUp, prefersReducedMotion } from "../../hooks/motion";
import { ASSISTANT_NAME } from "../../lib/assistant";

// How many of the given moments (ms after mounting) have passed.
// Pass a constant array so the clock is not restarted on every render.
function useTimeline(moments) {
  const [passed, setPassed] = useState(() => (prefersReducedMotion() ? moments.length : 0));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timers = moments.map((ms, i) => setTimeout(() => setPassed(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [moments]);
  return passed;
}

function Typed({ text, run, speed = 45 }) {
  const [length, setLength] = useState(() => (prefersReducedMotion() ? text.length : 0));
  useEffect(() => {
    if (!run || length >= text.length) return;
    const timer = setTimeout(() => setLength((n) => n + 1), speed);
    return () => clearTimeout(timer);
  }, [run, length, text, speed]);
  return (
    <>
      {text.slice(0, length)}
      {run && length < text.length && <span className="caret" />}
    </>
  );
}

const inr = (n, decimals = 0) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// A small floating note beside the main card
function Chip({ show, icon: Icon, title, note, tone = "bg-brand-50 text-brand-600", className = "" }) {
  return (
    <div className={`absolute flex items-center gap-2.5 rounded-2xl bg-white py-2.5 pl-2.5 pr-3.5 text-left shadow-2xl ${show ? "animate-pop" : "opacity-0"} ${className}`}>
      <span className={`grid place-items-center w-9 h-9 flex-shrink-0 rounded-xl ${tone}`}>
        <Icon className="w-[18px] h-[18px]" strokeWidth={2.4} />
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-bold text-slate-900 whitespace-nowrap">{title}</span>
        <span className="block text-[11px] text-slate-500 whitespace-nowrap">{note}</span>
      </span>
    </div>
  );
}

// ── Making an invoice ───────────────────────────────────────────────────────
const INVOICE_MOMENTS = [300, 1200, 1650, 2100, 2700, 3700, 4300, 4900];
const BILL_ROWS = [
  ["Wall putty", "HSN 32141000", "10 bag", "450.00", "4,500.00"],
  ["White cement", "HSN 25232100", "5 bag", "650.00", "3,250.00"],
  ["Tile adhesive", "HSN 35069190", "4 bag", "380.00", "1,520.00"],
];

export function InvoiceScene() {
  const passed = useTimeline(INVOICE_MOMENTS);
  const at = (n, animation = "animate-rise") => (passed >= n ? animation : "opacity-0");
  const taxable = useCountUp(passed >= 5 ? 9270 : 0, 800);
  const half = useCountUp(passed >= 5 ? 834.3 : 0, 800);
  const total = useCountUp(passed >= 5 ? 10938.6 : 0, 1000);
  const columns = "grid grid-cols-[1fr_52px_52px_62px] gap-2 px-3";

  return (
    <div className="relative w-full h-full text-left text-slate-800">
      <div className="absolute left-0 top-1 w-[296px] overflow-hidden rounded-xl bg-white shadow-2xl animate-rise">
        <div className="h-1.5 bg-gradient-to-r from-brand-500 via-brand-600 to-saffron-400" />
        <p className="py-2 text-center text-sm font-bold tracking-wide border-b border-slate-200">TAX INVOICE</p>
        <div className="grid grid-cols-2 text-[11px] leading-relaxed border-b border-slate-200">
          <p className="px-3 py-2 border-r border-slate-200">
            <span className="text-slate-400">Invoice No.</span>
            <br />
            <b>INV-2026-0042</b>
          </p>
          <p className="px-3 py-2">
            <span className="text-slate-400">Billed to</span>
            <br />
            <b className="inline-block min-h-[1.2em]"><Typed text="Raj Traders" run={passed >= 1} /></b>
          </p>
        </div>
        <div className={`${columns} py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500`}>
          <span>Item</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span>
        </div>
        {BILL_ROWS.map(([name, hsn, qty, rate, amount], i) => (
          <div key={name} className={`${columns} items-center h-10 text-[11px] border-t border-slate-100 ${at(i + 2)}`}>
            <span className="leading-tight">
              <b className="block">{name}</b>
              <span className="block text-[9px] text-slate-400">{hsn}</span>
            </span>
            <span className="text-right">{qty}</span>
            <span className="text-right tabular">{rate}</span>
            <span className="text-right tabular font-bold">{amount}</span>
          </div>
        ))}
        <div className="px-3 py-2 space-y-0.5 text-[11px] text-slate-500 border-t border-slate-200">
          {[["Taxable value", taxable], ["CGST 9%", half], ["SGST 9%", half]].map(([label, value]) => (
            <p key={label} className="flex justify-end gap-4">
              <span>{label}</span>
              <span className="w-20 text-right tabular text-slate-800">{inr(value, 2)}</span>
            </p>
          ))}
        </div>
        <p className="flex items-center justify-between px-3 py-2.5 bg-brand-600 text-white">
          <span className="text-xs font-bold">Total with GST</span>
          <span className="text-lg font-bold tabular">₹{inr(total, 2)}</span>
        </p>
        <div className="relative h-11">
          <p className={`px-3 pt-3 text-[10px] text-slate-400 ${at(5, "animate-fade")}`}>Amount in words is added for you</p>
          <span className={`absolute right-4 top-1.5 -rotate-12 rounded-md border-[3px] border-emerald-600 px-3 py-0.5 text-sm font-black tracking-[0.2em] text-emerald-600 ${at(6, "animate-stamp")}`}>
            SAVED
          </span>
        </div>
      </div>

      <Chip show={passed >= 5} icon={Percent} title="GST split done" note="By state" className="right-0 top-14" />
      <Chip show={passed >= 7} icon={Download} title="PDF ready" note="3 copies" tone="bg-saffron-100 text-saffron-700" className="right-0 top-[190px]" />
      <Chip show={passed >= 8} icon={MessageCircle} title="Share it" note="WhatsApp" tone="bg-emerald-50 text-emerald-700" className="right-0 top-[268px]" />
    </div>
  );
}

// ── Asking the assistant ────────────────────────────────────────────────────
const ASK_MOMENTS = [250, 1000, 2200, 2550, 2900, 3800];
const TOP = [
  ["White cement", "₹86,400", 100],
  ["Wall putty", "₹54,200", 63],
  ["Tile adhesive", "₹31,780", 37],
];

export function AssistantScene() {
  const passed = useTimeline(ASK_MOMENTS);

  return (
    <div className="mx-auto flex flex-col w-[400px] h-full overflow-hidden rounded-3xl bg-white text-left text-sm text-slate-800 shadow-2xl animate-rise">
      <div className="flex items-center gap-2 px-4 h-11 flex-shrink-0 border-b border-slate-150 bg-slate-50">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="ml-2 flex items-center gap-1.5 font-bold"><Spark className="w-4 h-4 text-brand-600" /> {ASSISTANT_NAME}</span>
      </div>
      <div className="flex-1 space-y-3 p-4">
        {passed >= 1 && <UserBubble>Top selling products this month?</UserBubble>}
        {passed >= 2 && (
          <BotRow>
            {passed < 3 ? (
              <Typing status="Reading your bills" />
            ) : (
              <>
                <div><BotBubble>Here are your top 3 by sales:</BotBubble></div>
                <CardFrame>
                  {TOP.map(([name, value, width], i) => (
                    <div key={name} className={`px-3.5 py-2.5 border-b border-slate-100 last:border-0 ${passed >= i + 3 ? "animate-rise" : "opacity-0"}`}>
                      <p className="flex justify-between"><span>{name}</span><b className="tabular">{value}</b></p>
                      <span className="block mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        {passed >= i + 3 && <span className="block h-full rounded-full bg-brand-500 origin-left animate-widen" style={{ width: `${width}%` }} />}
                      </span>
                    </div>
                  ))}
                </CardFrame>
                <div className={`flex flex-wrap gap-1.5 ${passed >= 6 ? "animate-rise" : "opacity-0"}`}>
                  {["Who owes me?", "Stock value", "Make a bill"].map((t) => (
                    <span key={t} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{t}</span>
                  ))}
                </div>
              </>
            )}
          </BotRow>
        )}
      </div>
    </div>
  );
}

// ── Stock ───────────────────────────────────────────────────────────────────
const STOCK_MOMENTS = [500, 1400, 2300, 3700, 4500];

export function StockScene() {
  const passed = useTimeline(STOCK_MOMENTS);
  const quantity = passed >= 5 ? 49 : passed >= 2 ? 9 : 17;
  const low = quantity <= 10 && passed >= 3;
  const shownQuantity = useCountUp(quantity, 700);
  const value = useCountUp(120000 + 33600 + quantity * 360, 700);
  const rows = [
    ["White cement", "240 bag", 92, "bg-brand-500"],
    ["Wall putty", "112 bag", 66, "bg-brand-400"],
    ["Tile adhesive", `${Math.round(shownQuantity)} bag`, passed >= 5 ? 48 : passed >= 2 ? 9 : 18, low ? "bg-red-500" : "bg-saffron-500"],
  ];

  return (
    <div className="relative w-full h-full text-left text-slate-800">
      <div className="absolute left-0 top-[72px] w-[292px] overflow-hidden rounded-2xl bg-white shadow-2xl animate-rise">
        <div className="px-5 py-4 border-b border-slate-150">
          <p className="text-xs font-semibold text-slate-500">Stock value at cost</p>
          <p className="text-3xl font-bold tabular">₹{inr(value)}</p>
        </div>
        {rows.map(([name, text, width, colour], i) => (
          <div key={name} className={`px-5 py-3.5 border-b border-slate-100 last:border-0 transition-colors duration-500 ${i === 2 && low ? "bg-red-50" : ""}`}>
            <p className="flex items-center justify-between text-sm">
              <span className="font-bold">
                {name}
                {i === 2 && low && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] text-white animate-pop">Low</span>}
              </span>
              <span className={`tabular font-bold ${i === 2 && low ? "text-red-700" : "text-slate-600"}`}>{text}</span>
            </p>
            <span className="block mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
              <span className={`block h-full rounded-full transition-all duration-700 ${colour}`} style={{ width: `${width}%` }} />
            </span>
          </div>
        ))}
      </div>

      <Chip show={passed >= 1} icon={FileText} title="Sold 8 bags" note="Tile adhesive · billed" className="right-0 top-3" />
      <Chip show={passed >= 3} icon={TriangleAlert} title="Running low" note="Warn at 10" tone="bg-red-50 text-red-600" className="right-0 top-[196px]" />
      <Chip show={passed >= 4} icon={ShoppingCart} title="Bought 40 bags" note="Stock goes back up" tone="bg-emerald-50 text-emerald-700" className="right-6 bottom-0" />
    </div>
  );
}

// ── Getting paid ────────────────────────────────────────────────────────────
const PAY_MOMENTS = [900, 1500, 3900, 4500];

export function PaymentScene() {
  const passed = useTimeline(PAY_MOMENTS);
  const paid = passed >= 4;
  const due = useCountUp(paid ? 0 : 23250, 800);
  const total = useCountUp(paid ? 33875 : 57125, 900);

  return (
    <div className="relative w-full h-full text-left text-slate-800">
      <div className="absolute left-0 top-1 w-[330px] rounded-2xl bg-white p-5 shadow-2xl animate-rise">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold">Verma Hardware</p>
            <p className="text-xs text-slate-500">INV-2026-0038</p>
          </div>
          <span key={String(paid)} className={`rounded-full px-3 py-1 text-xs font-bold animate-pop ${paid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
            {paid ? "Paid" : "12 days late"}
          </span>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">Balance due</p>
        <p className={`text-4xl font-bold tabular transition-colors duration-500 ${paid ? "text-emerald-700" : "text-slate-900"}`}>₹{inr(due)}</p>
      </div>

      <div className={`absolute right-0 top-[152px] w-[264px] rounded-2xl rounded-tr-md bg-[#e3fbd3] p-4 text-sm leading-relaxed text-slate-800 shadow-2xl ${passed >= 1 ? "animate-slide-in" : "opacity-0"}`}>
        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-emerald-800">
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp reminder
        </p>
        <p className="min-h-[4.9em]">
          <Typed text="Dear Verma Hardware, ₹23,250 is pending on invoice INV-2026-0038. Kindly pay at the earliest." run={passed >= 2} speed={18} />
        </p>
        <p className={`text-right text-xs font-bold text-sky-600 ${passed >= 3 ? "animate-fade" : "opacity-0"}`}>✓✓</p>
      </div>

      <Chip show={passed >= 3} icon={Check} title="₹23,250 received" note="By UPI, just now" tone="bg-emerald-600 text-white" className="left-0 top-[176px] !z-10" />

      <div className="absolute left-0 bottom-1 flex items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-2xl animate-rise [animation-delay:200ms]">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-brand-50 text-brand-600"><IndianRupee className="w-[18px] h-[18px]" /></span>
        <span>
          <span className="block text-[11px] font-semibold text-slate-500">Total to collect</span>
          <span className="block text-xl font-bold tabular">₹{inr(total)}</span>
        </span>
      </div>
    </div>
  );
}

// ── Reports ─────────────────────────────────────────────────────────────────
const REPORT_MOMENTS = [400, 1600, 2500, 3400];
const MONTHS = [["Jun", 46, 30], ["Jul", 58, 41], ["Aug", 52, 33], ["Sep", 70, 48], ["Oct", 82, 51], ["Nov", 96, 58]];

export function ReportScene() {
  const passed = useTimeline(REPORT_MOMENTS);
  const profit = useCountUp(passed >= 1 ? 118400 : 0, 1100);
  const gst = useCountUp(passed >= 2 ? 21360 : 0, 900);

  return (
    <div className="relative flex flex-col gap-3 w-full h-full text-left text-slate-800">
      <div className="grid grid-cols-2 gap-3">
        {[["Estimated profit", profit, "text-emerald-700"], ["GST payable", gst, "text-slate-900"]].map(([label, value, tone], i) => (
          <div key={label} className="rounded-2xl bg-white px-5 py-3.5 shadow-2xl animate-rise" style={{ animationDelay: `${i * 100}ms` }}>
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className={`text-3xl font-bold tabular ${tone}`}>₹{inr(value)}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col rounded-2xl bg-white p-4 shadow-2xl animate-rise [animation-delay:150ms]">
        <div className="flex items-center justify-between text-xs">
          <b className="text-sm">Last six months</b>
          <span className="flex gap-3 text-slate-500">
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-[#2b59f6]" /> Sales</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-[#e0760c]" /> Purchases</span>
          </span>
        </div>
        <div className="flex-1 flex items-stretch gap-3 mt-3">
          {MONTHS.map(([month, sales, purchases], i) => (
            <div key={month} className="flex-1 flex flex-col">
              <div className="flex-1 flex items-end justify-center gap-0.5 border-b border-slate-300">
                {[[sales, "bg-[#2b59f6]"], [purchases, "bg-[#e0760c]"]].map(([height, colour], s) => (
                  <span key={colour} className={`w-4 rounded-t origin-bottom ${colour} ${passed >= 1 ? "animate-grow" : "opacity-0"}`}
                    style={{ height: `${height}%`, animationDelay: `${i * 110 + s * 60}ms` }} />
                ))}
              </div>
              <span className="mt-1 text-center text-[11px] text-slate-500">{month}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {[["CGST", "₹9,840"], ["SGST", "₹9,840"], ["IGST", "₹1,680"]].map(([name, value], i) => (
          <span key={name} className={`rounded-xl bg-white px-3 py-2 leading-tight shadow-xl ${passed >= 3 ? "animate-pop" : "opacity-0"}`} style={{ animationDelay: `${i * 100}ms` }}>
            <span className="block text-[10px] font-semibold text-slate-500">{name}</span>
            <span className="block text-sm font-bold tabular">{value}</span>
          </span>
        ))}
        <span className={`ml-auto flex items-center gap-2 rounded-xl bg-saffron-400 px-3.5 py-3 text-xs font-bold text-slate-900 shadow-xl ${passed >= 4 ? "animate-pop" : "opacity-0"}`}>
          <FileSpreadsheet className="w-4 h-4" /> GSTR-3B sheet
        </span>
      </div>
    </div>
  );
}
