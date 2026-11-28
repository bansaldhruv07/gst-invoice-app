// Choosing a bill design and its colour, with pictures of each.
import { Check } from "lucide-react";
import { TEMPLATES, COLORS, templateOf } from "../lib/billDesigns";
import { billImage } from "../lib/billImages";

export function ColorDots({ value, onChange, disabled }) {
  return (
    <div role="radiogroup" aria-label="Bill colour" className="flex flex-wrap gap-2.5">
      {COLORS.map((c) => (
        <button key={c.id} type="button" role="radio" aria-checked={value === c.id} aria-label={c.name} title={c.name}
          disabled={disabled} onClick={() => onChange(c.id)}
          className={`grid place-items-center w-9 h-9 rounded-full text-white transition hover:scale-110 disabled:opacity-30 disabled:hover:scale-100 ${
            value === c.id ? "ring-2 ring-offset-2 ring-slate-900" : ""
          }`}
          style={{ backgroundColor: c.hex }}>
          {value === c.id && <Check className="w-4 h-4" strokeWidth={4} />}
        </button>
      ))}
    </div>
  );
}

export default function BillDesignPicker({ template, color, onChange }) {
  const selected = templateOf(template);
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Bill design" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TEMPLATES.map((t) => {
          const on = selected.id === t.id;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => onChange({ template: t.id, color })}
              className={`group overflow-hidden rounded-xl border-2 bg-white text-left transition ${on ? "border-brand-600 shadow-lg" : "border-slate-200 hover:border-brand-300"}`}>
              <span className="block aspect-[4/3] overflow-hidden border-b border-slate-200 bg-slate-100">
                <img src={billImage(t.id, color)} alt="" loading="lazy" className="w-full transition-transform duration-500 group-hover:scale-105" />
              </span>
              <span className="flex items-center justify-between gap-2 px-3 py-2 text-sm font-bold">
                {t.name}
                {on && <Check className="w-4 h-4 text-brand-600" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ColorDots value={color} onChange={(next) => onChange({ template: selected.id, color: next })} disabled={!selected.coloured} />
        <p className="text-sm text-slate-500">{selected.coloured ? selected.note : `${selected.note}. It prints in black and white.`}</p>
      </div>
    </div>
  );
}
