// Above the bill preview: change the design every bill is printed in.
import { useState } from "react";
import toast from "react-hot-toast";
import { Palette, ChevronDown } from "lucide-react";
import api from "../../api/axios";
import BillDesignPicker from "../BillDesignPicker";
import { templateOf, colorOf } from "../../lib/billDesigns";

export default function DesignBar({ business, onSaved }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const template = templateOf(business.template);
  const color = colorOf(business.color);

  const choose = async (design) => {
    if (saving) return;
    setSaving(true);
    try {
      const { data } = await api.put("/auth/supplier-info", design);
      // The preview redraws when the business details change
      onSaved(data.supplier);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not change the design");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Bill design" className="bg-white lg:card border-b border-slate-200 lg:mb-4">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <Palette className="w-5 h-5 text-brand-600" />
        <span className="text-sm font-bold">Bill design</span>
        <span className="flex items-center gap-2 text-sm text-slate-500">
          {template.name}
          {template.coloured && <span aria-hidden="true" className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: color.hex }} />}
        </span>
        <span className="ml-auto text-sm font-bold text-brand-700">{open ? "Close" : "Change"}</span>
        <ChevronDown className={`w-4 h-4 text-brand-700 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-slate-200 p-4 animate-rise">
          <BillDesignPicker template={template.id} color={color.id} onChange={choose} />
          <p className="mt-3 text-xs text-slate-500">The design you pick is used for all your bills.</p>
        </div>
      )}
    </section>
  );
}
