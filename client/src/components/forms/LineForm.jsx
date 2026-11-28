// One product line on a bill.
import { useState } from "react";
import toast from "react-hot-toast";
import Sheet from "../mobile/Sheet";
import { Cells, Cell } from "../mobile/Rows";
import PriceFields from "./PriceFields";
import { calculateLine } from "../../lib/gst";
import { shortDate } from "../../lib/format";

export default function LineForm({ line, isNew, billOfSupply, lastPrice, onSave, onClose, onRemove }) {
  const [form, setForm] = useState(line);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    if (!form.name.trim()) return toast.error("Enter the item name");
    if (!(Number(form.quantity) > 0)) return toast.error("Enter a quantity");
    if (!(Number(form.rate) > 0)) return toast.error("Enter the rate");
    const worked = calculateLine(form, "cgst_sgst", form.taxMode || "exclusive", billOfSupply);
    if (form.discountType === "amount" ? Number(form.discountValue) > worked.gross : Number(form.discountValue) > 100) {
      return toast.error("The discount is more than the value");
    }
    onSave({ ...form, name: form.name.trim() });
  };

  return (
    <Sheet
      wide
      title={isNew ? "Add Product" : "Edit product"}
      onClose={onClose}
      onSubmit={save}
      action={<button type="submit" className="sm:hidden px-3 py-2 font-bold text-brand-700">Save</button>}
      footer={
        <>
          {onRemove && (
            <button type="button" onClick={onRemove} className="btn !flex-none text-red-700 hover:bg-red-50">Remove</button>
          )}
          <button type="button" onClick={onClose} className="btn-secondary !hidden sm:!inline-flex">Cancel</button>
          <button type="submit" className="btn-primary h-12 sm:h-10">Save</button>
        </>
      }
    >
      <Cells>
        <Cell label="Name" wide><input className="cell-input" value={form.name} onChange={(e) => set("name", e.target.value)} /></Cell>
        <Cell label="Description (optional)" wide>
          <input className="cell-input" value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
        </Cell>
      </Cells>
      {lastPrice && (
        <button type="button" onClick={() => set("rate", lastPrice.rate)}
          title={`${lastPrice.invoiceNumber} on ${shortDate(lastPrice.date)}`}
          className="block w-full px-4 py-2 text-left text-sm font-semibold text-brand-700 bg-brand-50 border-b border-slate-200">
          Last ₹{lastPrice.rate}{Number(lastPrice.rate) !== Number(form.rate) && " — tap to use it"}
        </button>
      )}
      <PriceFields form={form} set={set} priceKey="rate" priceLabel="Rate (₹)" quantityKey="quantity"
        billOfSupply={billOfSupply} />
    </Sheet>
  );
}
