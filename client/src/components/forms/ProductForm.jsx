// Add or edit a product, in two tabs.
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "../../api/axios";
import Sheet from "../mobile/Sheet";
import { Cells, Cell } from "../mobile/Rows";
import PriceFields from "./PriceFields";
import { todayISO } from "../../lib/period";
import { money } from "../../lib/format";

const EMPTY = {
  name: "", description: "", defaultQuantity: 1, hsn: "", unit: "pcs", price: "", taxMode: "exclusive",
  discountType: "percent", discountValue: "", gstPercent: 18, cessType: "percent", cessValue: "",
  category: "", mrp: "", purchasePrice: "", purchaseTaxMode: "exclusive", wholesalePrice: "",
  minWholesaleQty: "", trackStock: false, openingStock: "", lowStockAt: "", stockSince: "",
};
const NUMBERS = [
  "price", "defaultQuantity", "discountValue", "gstPercent", "cessValue", "mrp", "purchasePrice",
  "wholesalePrice", "minWholesaleQty", "openingStock", "lowStockAt",
];
const TABS = [["basic", "Basic Details"], ["optional", "Optional Details"]];

export default function ProductForm({ product = {}, onClose, onSaved, onLimit }) {
  const [form, setForm] = useState({
    ...EMPTY,
    ...product,
    stockSince: product.stockSince ? product.stockSince.slice(0, 10) : todayISO(),
  });
  const [tab, setTab] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const bind = (key, props = {}) => ({
    value: form[key] ?? "",
    onChange: (e) => set(key, e.target.value),
    className: "cell-input",
    ...props,
  });
  const amount = { type: "number", min: "0", step: "0.01", inputMode: "decimal" };

  // Categories already in use are offered while typing
  useEffect(() => {
    api.get("/items")
      .then(({ data }) => setCategories([...new Set(data.items.map((i) => i.category).filter(Boolean))].sort()))
      .catch(() => {});
  }, []);

  const price = Number(form.price) || 0;
  const cost = Number(form.purchasePrice) || 0;
  const inclusive = form.taxMode === "inclusive";

  const save = async () => {
    if (form.price === "" || form.price === null) {
      setTab("basic");
      return toast.error("Enter the selling price");
    }
    setSaving(true);
    const body = { ...form, ...Object.fromEntries(NUMBERS.map((key) => [key, Number(form[key]) || 0])) };
    try {
      const { data } = product._id
        ? await api.put(`/items/${product._id}`, body)
        : await api.post("/items", body);
      toast.success("Product saved");
      onSaved?.(data.item);
      onClose();
    } catch (err) {
      if (err.response?.data?.upgrade && onLimit) onLimit(err.response.data.message);
      else toast.error(err.response?.data?.message || "Could not save the product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      wide
      title={product._id ? "Edit product" : "New product"}
      onClose={onClose}
      onSubmit={save}
      action={<button type="submit" disabled={saving} className="sm:hidden px-3 py-2 font-bold text-brand-700">Save</button>}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary !hidden sm:!inline-flex">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary h-12 sm:h-10">{saving ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <Cells>
        <Cell label="Name" wide><input required autoFocus placeholder="Item name" {...bind("name")} /></Cell>
      </Cells>
      <div role="tablist" className="grid grid-cols-2 border-b border-slate-200">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`py-3 text-sm font-bold border-b-[3px] transition ${
              tab === key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-transparent text-slate-500 hover:bg-slate-50"
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div hidden={tab !== "basic"}>
        <Cells>
          <Cell label="Description (optional)" wide><input {...bind("description")} /></Cell>
        </Cells>
        <PriceFields form={form} set={set} priceKey="price" quantityKey="defaultQuantity"
          priceLabel={inclusive ? "Selling price (₹, with GST)" : "Selling price (₹, before GST)"} />
      </div>

      <div hidden={tab !== "optional"}>
        <Cells>
          <Cell label="Category" wide>
            <input list="product-categories" placeholder="Select or type a category" {...bind("category")} />
            <datalist id="product-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Cell>
          <Cell label="MRP" wide><input {...bind("mrp", amount)} /></Cell>
          <Cell
            label={form.purchaseTaxMode === "inclusive" ? "Purchase price (₹, with GST)" : "Purchase price (₹, before GST)"}
            note={cost > 0 && price > 0 && form.purchaseTaxMode === form.taxMode
              ? `Margin ${money(price - cost)} (${(((price - cost) / price) * 100).toFixed(1)}%)`
              : "Needed for profit and stock value."}
          >
            <input {...bind("purchasePrice", amount)} />
          </Cell>
          <Cell label="Purchase price includes">
            <select {...bind("purchaseTaxMode")}>
              <option value="exclusive">Exclusive GST</option>
              <option value="inclusive">Inclusive GST</option>
            </select>
          </Cell>
          <Cell label="Wholesale Price"><input {...bind("wholesalePrice", amount)} /></Cell>
          <Cell label="Min. Wholesale Qty."><input {...bind("minWholesaleQty", { ...amount, step: "0.001" })} /></Cell>
        </Cells>
        <label className="flex items-center justify-between gap-3 px-4 py-4 bg-slate-100 border-b border-slate-200 text-sm font-bold cursor-pointer">
          Track stock for this product
          <input type="checkbox" role="switch" className="switch" checked={Boolean(form.trackStock)}
            onChange={(e) => set("trackStock", e.target.checked)} />
        </label>
        {form.trackStock && (
          <Cells className="animate-rise">
            <Cell label="Opening stock"><input {...bind("openingStock", { type: "number", step: "0.001" })} /></Cell>
            <Cell label="Counted on" note="Stock at the start of this day.">
              <input {...bind("stockSince", { type: "date" })} />
            </Cell>
            <Cell label="Warn me when stock is at or below" wide>
              <input {...bind("lowStockAt", { type: "number", min: "0", step: "0.001" })} />
            </Cell>
          </Cells>
        )}
      </div>
    </Sheet>
  );
}
