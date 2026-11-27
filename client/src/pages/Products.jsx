import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Plus, Search, Pencil, Trash2, Upload } from "lucide-react";
import Modal, { Field } from "../components/Modal";
import UpgradePrompt from "../components/UpgradePrompt";
import { Spinner, EmptyState } from "../components/ui";
import { UNITS, UNIT_LABELS, GST_RATES } from "../lib/units";
import { money } from "../lib/format";
import { todayISO } from "../lib/period";

const EMPTY = {
  name: "", hsn: "", unit: "pcs", price: "", purchasePrice: "", gstPercent: 18, description: "",
  trackStock: false, openingStock: "", lowStockAt: "", stockSince: "",
};

function ProductForm({ product, onClose, onSaved, onLimit }) {
  const [form, setForm] = useState({
    ...EMPTY,
    ...product,
    stockSince: product.stockSince ? product.stockSince.slice(0, 10) : todayISO(),
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const bind = (key) => ({ value: form[key] ?? "", onChange: (e) => set(key, e.target.value), className: "input" });

  const price = Number(form.price) || 0;
  const cost = Number(form.purchasePrice) || 0;

  const save = async () => {
    setSaving(true);
    const body = {
      ...form,
      price,
      purchasePrice: cost,
      gstPercent: Number(form.gstPercent),
      openingStock: Number(form.openingStock) || 0,
      lowStockAt: Number(form.lowStockAt) || 0,
    };
    try {
      if (product._id) await api.put(`/items/${product._id}`, body);
      else await api.post("/items", body);
      toast.success("Product saved");
      onSaved();
      onClose();
    } catch (err) {
      if (err.response?.data?.upgrade) onLimit(err.response.data.message);
      else toast.error(err.response?.data?.message || "Could not save the product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      wide
      title={product._id ? "Edit product" : "New product"}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name" wide><input required autoFocus {...bind("name")} /></Field>
        <Field label="HSN / SAC code"><input {...bind("hsn")} /></Field>
        <Field label="Unit">
          <select {...bind("unit")}>
            {UNITS.map((u) => <option key={u} value={u}>{u.toUpperCase()} — {UNIT_LABELS[u]}</option>)}
          </select>
        </Field>
        <Field label="Selling price (₹, before GST)"><input required type="number" min="0" step="0.01" {...bind("price")} /></Field>
        <Field label="GST rate">
          <select {...bind("gstPercent")}>
            {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
          </select>
        </Field>
        <Field
          label="Purchase price (₹, before GST)"
          wide
          note={cost > 0 && price > 0 ? `Margin ${money(price - cost)} (${(((price - cost) / price) * 100).toFixed(1)}%)` : "Needed for profit and stock value."}
        >
          <input type="number" min="0" step="0.01" {...bind("purchasePrice")} />
        </Field>

        <label className="sm:col-span-2 flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={Boolean(form.trackStock)} onChange={(e) => set("trackStock", e.target.checked)} />
          Track stock for this product
        </label>
        {form.trackStock && (
          <>
            <Field label="Opening stock"><input type="number" step="0.001" {...bind("openingStock")} /></Field>
            <Field label="Counted on" note="Stock at the start of this day. Later bills change it.">
              <input type="date" required {...bind("stockSince")} />
            </Field>
            <Field label="Warn me when stock is at or below"><input type="number" min="0" step="0.001" {...bind("lowStockAt")} /></Field>
          </>
        )}
        <Field label="Description (optional)" wide><input {...bind("description")} /></Field>
      </div>
    </Modal>
  );
}

export default function Products() {
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [limit, setLimit] = useState("");

  const load = useCallback(
    () =>
      api.get("/items", { params: search ? { search } : {} })
        .then(({ data }) => setItems(data.items))
        .catch(() => {
          setItems([]);
          toast.error("Could not load products");
        }),
    [search],
  );

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.name}? Past invoices keep their lines.`)) return;
    try {
      await api.delete(`/items/${item._id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <section className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 items-center p-3 border-b border-slate-200">
          <div className="relative flex-1 min-w-[14rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="search" value={search} placeholder="Search products by name" aria-label="Search products"
              onChange={(e) => setParams(e.target.value ? { search: e.target.value } : {}, { replace: true })}
              className="input pl-9" />
          </div>
          <Link to="/settings#import" className="btn-secondary"><Upload className="w-4 h-4" /> Import</Link>
          <button onClick={() => setEditing({})} className="btn-primary"><Plus className="w-4 h-4" /> Add product</button>
        </div>

        {items === null ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState title={search ? "No match" : "No products yet"}
            hint={search ? "Try another name." : "Add what you sell to bill faster."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Product</th>
                  <th className="th">HSN/SAC</th>
                  <th className="th">Unit</th>
                  <th className="th text-right">Selling price</th>
                  <th className="th text-right hidden md:table-cell">Purchase price</th>
                  <th className="th text-right">GST</th>
                  <th className="th hidden md:table-cell">Stock</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i._id} className="hover:bg-slate-50">
                    <td className="td font-medium">{i.name}</td>
                    <td className="td">{i.hsn || <span className="text-amber-700">Missing</span>}</td>
                    <td className="td uppercase text-xs">{i.unit}</td>
                    <td className="td text-right whitespace-nowrap">{money(i.price)}</td>
                    <td className="td text-right whitespace-nowrap hidden md:table-cell">{i.purchasePrice ? money(i.purchasePrice) : "—"}</td>
                    <td className="td text-right">{i.gstPercent}%</td>
                    <td className="td hidden md:table-cell">
                      {i.trackStock ? <Link to="/stock" className="text-brand-700 hover:underline">Tracked</Link> : <span className="text-slate-500">Off</span>}
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(i)} title="Edit" aria-label={`Edit ${i.name}`} className="btn btn-sm text-slate-600 hover:bg-slate-100">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(i)} title="Delete" aria-label={`Delete ${i.name}`} className="btn btn-sm text-slate-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {items?.length > 0 && (
          <p className="px-4 py-2.5 text-sm text-slate-500">{items.length} product{items.length === 1 ? "" : "s"}</p>
        )}
      </section>

      {editing && <ProductForm product={editing} onClose={() => setEditing(null)} onSaved={load} onLimit={setLimit} />}
      {limit && <UpgradePrompt message={limit} onClose={() => setLimit("")} />}
    </div>
  );
}
