// A phone making a bill: choose the buyer, add products, save, share. The
// screens mirror the app's own, and the final picture is the sample sale printed
// by the app's bill designs (lib/sampleBill.js, assets/bills).
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Plus, Check, Search, Printer, Download, MoreVertical, IndianRupee, Send, Truck, MessageCircle,
} from "lucide-react";
import FitStage from "./FitStage";
import Progress from "./Progress";
import { useTimeline } from "./useTimeline";
import { useCountUp, prefersReducedMotion } from "../../hooks/motion";
import { BUYERS, LINES, totalsFor, sampleInvoice } from "../../lib/sampleBill";
import { TEMPLATES } from "../../lib/billDesigns";
import { billImage, SHOWN_COLOR } from "../../lib/billImages";

const INVOICE = sampleInvoice();

const STEPS = [
  { id: "buyer", label: "Buyer", title: "Choose the buyer", duration: 4200 },
  { id: "items", label: "Products", title: "Add the products", duration: 4800 },
  { id: "save", label: "Save", title: "Save the bill", duration: 2800 },
  { id: "share", label: "Share", title: "Share the PDF", duration: 7600 },
];

const inr = (n, decimals = 2) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

// The ring that shows where a finger touched
function Tap({ show, className }) {
  if (!show) return null;
  return (
    <span aria-hidden="true" className={`absolute grid place-items-center w-11 h-11 ${className}`}>
      <span className="absolute inset-0 rounded-full bg-brand-500/40 animate-ping" />
      <span className="w-5 h-5 rounded-full bg-brand-600/60 ring-2 ring-white" />
    </span>
  );
}

function Band({ children }) {
  return <p className="px-3 py-1.5 bg-slate-100 border-y border-slate-200 text-[11px] font-bold text-slate-600">{children}</p>;
}

function AddRow({ label }) {
  return (
    <p className="flex items-center gap-2 px-3 py-2.5 text-[12px] font-bold text-brand-700">
      <Plus className="w-4 h-4" /> {label}
    </p>
  );
}

// ── The new invoice screen ───────────────────────────────────────────────────
function Form({ hasBuyer, shown, pressed, children }) {
  const totals = totalsFor(shown);
  const total = useCountUp(shown ? totals.grandTotal : 0, 600);
  return (
    <div className="relative flex h-full flex-col bg-white">
      <p className="flex items-center gap-3 h-11 px-3 border-b border-slate-200 text-sm font-bold">
        <ArrowLeft className="w-4 h-4" /> New invoice
      </p>
      <p className="flex gap-4 px-3 py-2 text-[11px] font-bold">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-[3.5px] border-brand-600" /> Tax Invoice</span>
        <span className="flex items-center gap-1.5 text-slate-500"><span className="w-3 h-3 rounded-full border border-slate-400" /> Bill Of Supply</span>
      </p>
      <div className="grid grid-cols-2 gap-px bg-slate-200 border-t border-slate-200">
        {[["Invoice Date", "28 Nov 2026"], ["Invoice No.", INVOICE.invoiceNumber]].map(([label, value]) => (
          <p key={label} className="bg-white px-3 py-1.5">
            <span className="block text-[9px] font-semibold text-slate-500">{label}</span>
            <b className="text-[11px]">{value}</b>
          </p>
        ))}
      </div>

      <Band>Buyer Details</Band>
      {hasBuyer ? (
        <div className="px-3 py-2 animate-rise">
          <b className="block text-[13px]">{INVOICE.buyer.name}</b>
          <span className="block text-[10px] text-slate-500">GSTIN {INVOICE.buyer.gstin} · {INVOICE.buyer.state}</span>
        </div>
      ) : (
        <AddRow label="Add Buyer" />
      )}

      <Band>Product Details</Band>
      <ul>
        {LINES.slice(0, shown).map((line, i) => (
          <li key={line.name} className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-100 animate-slide-in">
            <span className="min-w-0">
              <b className="block truncate text-[12px]">{line.name}</b>
              <span className="block text-[10px] text-slate-500">
                {line.quantity} {line.unit} × {inr(line.rate)} · GST {line.gstPercent}%
              </span>
            </span>
            <b className="text-[12px] tabular">{inr(totals.items[i].totalAmount)}</b>
          </li>
        ))}
      </ul>
      <AddRow label="Add Product" />

      {shown > 0 && (
        <dl className="mx-3 mt-1 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-600 animate-fade">
          {[["Taxable amount", totals.subTotal], ["CGST", totals.totalCgst], ["SGST", totals.totalSgst]].map(([label, value]) => (
            <div key={label} className="flex justify-between"><dt>{label}</dt><dd className="tabular font-semibold">{inr(value)}</dd></div>
          ))}
        </dl>
      )}

      <div className="mt-auto flex items-center gap-3 border-t border-slate-200 px-3 py-2.5">
        <p className="leading-tight">
          <span className="block text-[10px] font-semibold text-slate-500">Total</span>
          <b className="text-base tabular">{inr(Math.round(total), 0)}</b>
        </p>
        <span className={`relative ml-auto grid place-items-center h-10 w-32 rounded-xl text-[13px] font-bold text-white transition ${pressed ? "scale-95 bg-brand-800" : "bg-brand-600"}`}>
          Save invoice
        </span>
      </div>
      {children}
    </div>
  );
}

const BUYER_MOMENTS = [700, 1900, 2800];
function BuyerStep() {
  const passed = useTimeline(BUYER_MOMENTS);
  return (
    <Form hasBuyer={passed >= 3} shown={0}>
      {passed >= 1 && passed < 3 && (
        <div className="absolute inset-0 flex flex-col justify-end bg-slate-900/40 animate-fade">
          <div className="rounded-t-3xl bg-white pb-3 animate-sheet">
            <p className="px-4 py-3 text-sm font-bold border-b border-slate-200">Add Buyer</p>
            <p className="mx-3 my-2 flex items-center gap-2 h-9 rounded-xl border border-slate-200 px-3 text-[11px] text-slate-400">
              <Search className="w-3.5 h-3.5" /> Search name or mobile
            </p>
            {BUYERS.map((buyer, i) => (
              <p key={buyer.name} className={`relative flex items-center gap-2.5 px-4 py-2.5 border-b border-slate-100 ${i === 0 && passed >= 2 ? "bg-brand-50" : ""}`}>
                <span className="grid place-items-center w-8 h-8 rounded-full bg-brand-100 text-[12px] font-bold text-brand-700">{buyer.name[0]}</span>
                <b className="text-[12px]">{buyer.name}</b>
                {i === 0 && passed >= 2 && <Check className="ml-auto w-4 h-4 text-brand-600" strokeWidth={3} />}
                {i === 0 && <Tap show={passed === 2} className="right-14 top-1" />}
              </p>
            ))}
          </div>
        </div>
      )}
    </Form>
  );
}

const ITEM_MOMENTS = [500, 1600, 2700];
function ItemsStep() {
  const passed = useTimeline(ITEM_MOMENTS);
  return <Form hasBuyer shown={passed} />;
}

const SAVE_MOMENTS = [500, 900, 1400];
function SaveStep() {
  const passed = useTimeline(SAVE_MOMENTS);
  return (
    <Form hasBuyer shown={LINES.length} pressed={passed === 2}>
      <Tap show={passed >= 1 && passed < 3} className="right-12 bottom-1.5" />
      {passed >= 3 && (
        <div className="absolute inset-0 grid place-items-center bg-white/85 animate-fade">
          <div className="text-center animate-pop">
            <span className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-emerald-600 text-white shadow-xl">
              <Check className="w-8 h-8" strokeWidth={4} />
            </span>
            <b className="mt-3 block text-base">Invoice saved</b>
            <span className="text-[11px] text-slate-500">{INVOICE.invoiceNumber}</span>
          </div>
        </div>
      )}
    </Form>
  );
}

// ── The bill preview screen ──────────────────────────────────────────────────
const SHARE_MOMENTS = [1600, 3000, 4400, 5800];
function ShareStep() {
  const passed = useTimeline(SHARE_MOMENTS);
  // Classic first, then each of the other designs
  const [still] = useState(prefersReducedMotion);
  const active = still ? TEMPLATES[1] : TEMPLATES[Math.min(passed, TEMPLATES.length - 1)];
  return (
    <div className="relative flex h-full flex-col bg-slate-50">
      <div className="flex items-center gap-2 h-11 px-3 border-b border-slate-200 bg-white text-[13px] font-bold">
        <ArrowLeft className="w-4 h-4" />
        <span className="mr-auto">{INVOICE.invoiceNumber}</span>
        <Printer className="w-4 h-4" /><Download className="w-4 h-4" /><MoreVertical className="w-4 h-4" />
      </div>
      <p className="flex justify-between px-4 py-2 bg-white border-b border-slate-200 text-[11px] font-bold">
        {["Original", "Duplicate", "Triplicate"].map((copy, i) => (
          <span key={copy} className="flex items-center gap-1.5">
            <span className={`grid place-items-center w-3.5 h-3.5 rounded border ${i === 0 ? "bg-brand-600 border-brand-600 text-white" : "border-slate-400"}`}>
              {i === 0 && <Check className="w-2.5 h-2.5" strokeWidth={4} />}
            </span>
            {copy}
          </span>
        ))}
      </p>
      <div className="relative flex-1 min-h-0 p-2.5">
        {/* All four are loaded together, so changing between them is instant */}
        {TEMPLATES.map((t) => (
          <img key={t.id} src={billImage(t.id, SHOWN_COLOR[t.id])}
            alt={t.id === active.id ? `The finished bill in the ${t.name} design, total ${inr(INVOICE.grandTotal, 0)}` : ""}
            className={`absolute inset-x-2.5 top-2.5 mx-auto w-[calc(100%-1.25rem)] bg-white shadow-lg transition-opacity duration-500 ${t.id === active.id ? "opacity-100 animate-rise" : "opacity-0"}`} />
        ))}
      </div>
      <p className="flex justify-center gap-1.5 pb-2">
        {TEMPLATES.map((t) => (
          <span key={t.id} className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${t.id === active.id ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"}`}>
            {t.name}
          </span>
        ))}
      </p>
      <div className="relative flex border-t border-slate-200 bg-white px-2 py-2">
        {[[Truck, "E-way Bill"], [IndianRupee, "Record Payment"], [Send, "Share"]].map(([Icon, label]) => (
          <span key={label} className="flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold text-slate-700">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-brand-50 text-brand-700"><Icon className="w-4 h-4" /></span>
            {label}
          </span>
        ))}
        <Tap show={passed === 4 && !still} className="right-6 top-1" />
      </div>
      {passed >= 4 && (
        <p className="absolute right-3 bottom-[7.5rem] flex items-center gap-2 rounded-2xl bg-emerald-600 px-3.5 py-2.5 text-[11px] font-bold text-white shadow-2xl animate-pop">
          <MessageCircle className="w-4 h-4" /> Send it on WhatsApp
        </p>
      )}
    </div>
  );
}

const SCREENS = { buyer: BuyerStep, items: ItemsStep, save: SaveStep, share: ShareStep };

// `dark` suits a coloured background
export default function PhoneDemo({ dark = false, className = "" }) {
  const [still] = useState(prefersReducedMotion);
  // People who prefer less motion see the finished bill and choose steps themselves
  const [index, setIndex] = useState(() => (still ? STEPS.length - 1 : 0));
  const [run, setRun] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(true);
  const ref = useRef(null);
  const step = STEPS[index];
  const Screen = SCREENS[step.id];

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const select = (i) => {
    setIndex(i);
    setRun((n) => n + 1);
  };

  return (
    <figure ref={ref} aria-label="How a bill is made" className={`flex flex-col gap-4 ${className}`}>
      <div data-phone className="flex-1 min-h-0" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <FitStage width={300} height={600} max={1.1}>
          <div className="relative h-full w-full rounded-[2.75rem] bg-slate-900 p-3 shadow-2xl">
            <div aria-hidden="true" className="absolute left-1/2 top-4 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
            <div className="h-full overflow-hidden rounded-[2.1rem] bg-white pt-8 text-left text-slate-900">
              <Screen key={`${step.id}-${run}`} />
            </div>
          </div>
        </FitStage>
      </div>

      <figcaption>
        <p key={step.id} className={`mb-2 text-center text-sm font-bold animate-rise ${dark ? "text-white" : "text-slate-800"}`}>
          Step {index + 1}: {step.title}
        </p>
        <div role="tablist" aria-label="Steps" className="flex justify-center gap-2">
          {STEPS.map((s, i) => {
            const on = i === index;
            return (
              <button key={s.id} type="button" role="tab" aria-selected={on} onClick={() => select(i)}
                className={`relative overflow-hidden flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold transition ${
                  on
                    ? dark ? "bg-white text-brand-700 shadow-xl" : "bg-brand-600 text-white shadow-glow"
                    : dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-slate-600 border border-slate-200 hover:border-brand-300"
                }`}>
                <span>{i + 1}</span>
                <span className={on ? "" : "hidden sm:inline"}>{s.label}</span>
                {on && !still && (
                  <Progress key={`${s.id}-${run}`} duration={s.duration} paused={hovered || !visible}
                    onDone={() => select((i + 1) % STEPS.length)}
                    className="absolute inset-x-0 bottom-0 h-[3px] bg-saffron-400" />
                )}
              </button>
            );
          })}
        </div>
      </figcaption>
    </figure>
  );
}
