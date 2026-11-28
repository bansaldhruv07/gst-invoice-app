// Home page: the sample bill in whichever design and colour the visitor picks.
import { useState } from "react";
import { Check } from "lucide-react";
import { ColorDots } from "../BillDesignPicker";
import { TEMPLATES, templateOf } from "../../lib/billDesigns";
import { billImage, SHOWN_COLOR } from "../../lib/billImages";

export default function DesignGallery() {
  const [template, setTemplate] = useState("modern");
  const [color, setColor] = useState(SHOWN_COLOR.modern);
  const selected = templateOf(template);

  const choose = (id) => {
    setTemplate(id);
    if (templateOf(id).coloured) setColor(SHOWN_COLOR[id]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-8 lg:gap-14 items-center">
      <div>
        <div role="radiogroup" aria-label="Bill design" className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          {TEMPLATES.map((t) => {
            const on = t.id === template;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => choose(t.id)}
                className={`flex items-center gap-3 rounded-2xl border p-3 sm:p-4 text-left transition ${
                  on ? "border-brand-600 bg-white shadow-xl" : "border-slate-200 bg-white/60 hover:bg-white hover:shadow-md"
                }`}>
                <span className={`grid place-items-center w-7 h-7 flex-shrink-0 rounded-full transition ${on ? "bg-brand-600 text-white" : "border border-slate-300"}`}>
                  {on && <Check className="w-4 h-4" strokeWidth={4} />}
                </span>
                <span>
                  <span className="block font-bold text-slate-900">{t.name}</span>
                  <span className="hidden sm:block text-sm text-slate-500">{t.note}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="text-sm font-bold text-slate-700">Colour</span>
          <ColorDots value={color} onChange={setColor} disabled={!selected.coloured} />
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-lg">
        <div aria-hidden="true" className="absolute inset-6 rounded-3xl bg-brand-300/40 blur-3xl" />
        <img key={`${template}-${color}`} src={billImage(template, color)} loading="lazy" width="900" height="1273"
          alt={`A sample GST bill in the ${selected.name} design`}
          className="relative w-full h-auto rounded-xl border border-slate-200 bg-white shadow-2xl animate-rise" />
      </div>
    </div>
  );
}
