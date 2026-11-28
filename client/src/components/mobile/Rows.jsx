// Building blocks for forms laid out as bands, cells and rows.
import { Plus } from "lucide-react";

// A titled part of a form, with a shaded band as its heading
export function Section({ title, extra, children }) {
  return (
    <section aria-label={title} className="border-b border-slate-200 last:border-b-0">
      <div className="flex items-center justify-between gap-3 min-h-[44px] px-4 py-1.5 bg-slate-100 border-b border-slate-200">
        <h2 className="text-sm font-bold text-slate-700">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function AddRow({ icon: Icon = Plus, label, onClick, children }) {
  return (
    <div className="flex items-center gap-3 px-4">
      <button type="button" onClick={onClick} className="flex flex-1 items-center gap-3 py-4 text-left text-[15px] font-semibold text-brand-700 transition hover:translate-x-0.5">
        <Icon className="w-5 h-5" /> {label}
      </button>
      {children}
    </div>
  );
}

export function RoundButton({ icon: Icon, label, onClick, tone = "primary" }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={`grid place-items-center w-10 h-10 flex-shrink-0 rounded-full transition active:scale-95 ${
        tone === "primary" ? "bg-brand-600 text-white shadow-glow hover:bg-brand-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}>
      <Icon className="w-4 h-4" />
    </button>
  );
}

// A two-column block of labelled inputs separated by lines
export function Cells({ children, className = "" }) {
  return <div className={`grid grid-cols-2 gap-px bg-slate-200 border-b border-slate-200 ${className}`}>{children}</div>;
}

export function Cell({ label, wide, note, children }) {
  return (
    <label className={`block min-w-0 bg-white px-4 py-2.5 focus-within:bg-brand-50 transition-colors ${wide ? "col-span-2" : ""}`}>
      <span className="block text-xs font-semibold text-slate-500">{label}</span>
      {children}
      {note && <span className="block text-xs text-slate-500">{note}</span>}
    </label>
  );
}

// A shaded line showing a worked-out amount
export function TotalRow({ label, value }) {
  return (
    <p className="flex items-center justify-end gap-6 px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-sm">
      <span className="font-bold text-slate-600">{label}</span>
      <span className="min-w-[6rem] text-right font-bold tabular">{value}</span>
    </p>
  );
}
