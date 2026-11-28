// Price, discount, tax and CESS, worked out as you type. Used by the product
// form and by a line on a bill.
import { Cells, Cell, TotalRow } from "../mobile/Rows";
import { calculateLine } from "../../lib/gst";
import { UNITS, UNIT_LABELS, GST_RATES } from "../../lib/units";
import { money } from "../../lib/format";

const KINDS = [
  ["percent", "(% Percent wise)"],
  ["amount", "(₹ Amount wise)"],
];

// A value with a choice of percent or rupees beside it
function ValueWithKind({ label, form, set, valueKey, kindKey, disabled }) {
  return (
    <>
      <Cell label={label}>
        <span className="flex items-center gap-2">
          <input type="number" min="0" step="0.01" placeholder="0" disabled={disabled} className="cell-input" aria-label={label}
            value={form[valueKey] || ""} onChange={(e) => set(valueKey, e.target.value)} />
          <span className="text-slate-400">{form[kindKey] === "amount" ? "₹" : "%"}</span>
        </span>
      </Cell>
      <Cell label={`${label} type`}>
        <select className="cell-input" disabled={disabled} value={form[kindKey]} onChange={(e) => set(kindKey, e.target.value)}>
          {KINDS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </Cell>
    </>
  );
}

export default function PriceFields({ form, set, priceKey, priceLabel, quantityKey, billOfSupply, priceExtra, requireQuantity }) {
  const line = calculateLine(
    { ...form, rate: form[priceKey], quantity: form[quantityKey] },
    "cgst_sgst",
    form.taxMode || "exclusive",
    billOfSupply,
  );
  const inclusive = (form.taxMode || "exclusive") === "inclusive";
  const input = (key, props) => (
    <input className="cell-input" value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} {...props} />
  );

  return (
    <>
      <Cells>
        <Cell label="Quantity">
          {input(quantityKey, { type: "number", min: "0", step: "0.001", inputMode: "decimal", required: requireQuantity })}
        </Cell>
        <Cell label="HSN / SAC code">{input("hsn", { inputMode: "numeric" })}</Cell>
        <Cell label={priceLabel} note={priceExtra}>
          {input(priceKey, { type: "number", min: "0", step: "0.001", inputMode: "decimal" })}
        </Cell>
        <Cell label="Unit">
          <select className="cell-input" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u.toUpperCase()} — {UNIT_LABELS[u]}</option>)}
          </select>
        </Cell>
      </Cells>
      <TotalRow label="Total" value={money(line.gross)} />
      <Cells>
        <ValueWithKind label="Discount" form={form} set={set} valueKey="discountValue" kindKey="discountType" />
      </Cells>
      <TotalRow label="Taxable amount" value={money(line.taxableAmount)} />

      <div className="flex items-center justify-center gap-4 py-3.5 border-b border-slate-200 text-sm">
        <span className={inclusive ? "font-bold text-brand-700" : "text-slate-500"}>Tax Inclusive</span>
        <button type="button" role="switch" aria-checked={!inclusive} aria-label="Tax Exclusive"
          onClick={() => set("taxMode", inclusive ? "exclusive" : "inclusive")}
          className="relative w-14 h-8 rounded-full bg-brand-600 transition">
          <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all duration-300 ${inclusive ? "left-1" : "left-7"}`} />
        </button>
        <span className={inclusive ? "text-slate-500" : "font-bold text-brand-700"}>Tax Exclusive</span>
      </div>

      <Cells>
        <Cell label="GST rate" wide note={billOfSupply ? "A bill of supply charges no tax." : undefined}>
          <select className="cell-input" disabled={billOfSupply} value={billOfSupply ? 0 : form.gstPercent}
            onChange={(e) => set("gstPercent", e.target.value)}>
            {GST_RATES.map((r) => <option key={r} value={r}>{r === 0 ? "0% (No GST)" : `${r}%`}</option>)}
          </select>
        </Cell>
        <ValueWithKind label="CESS" form={form} set={set} valueKey="cessValue" kindKey="cessType" disabled={billOfSupply} />
      </Cells>
      <TotalRow label="Total Amount" value={money(line.totalAmount)} />
    </>
  );
}
