import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Search, FileSpreadsheet, Trash2, IndianRupee, TriangleAlert, Boxes } from "lucide-react";
import Modal, { Field } from "../components/Modal";
import { Spinner, EmptyState, Stats } from "../components/ui";
import { rupees, money, shortDate } from "../lib/format";
import { downloadCsv } from "../lib/csv";
import { todayISO } from "../lib/period";

function AdjustForm({ row, onClose, onSaved }) {
  const [form, setForm] = useState({ direction: "remove", quantity: "", reason: "", date: todayISO() });
  const [saving, setSaving] = useState(false);
  const bind = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    className: "input",
  });
  const change = (form.direction === "add" ? 1 : -1) * (Number(form.quantity) || 0);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/stock/adjust", { itemId: row.id, quantity: change, reason: form.reason, date: form.date });
      toast.success("Stock updated");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update the stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Adjust ${row.name}`}
      subtitle={`In stock now: ${row.stock} ${row.unit}`}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Change">
          <select {...bind("direction")}>
            <option value="remove">Remove stock</option>
            <option value="add">Add stock</option>
          </select>
        </Field>
        <Field label="Quantity"><input autoFocus required type="number" min="0.001" step="0.001" {...bind("quantity")} /></Field>
        <Field label="Date"><input type="date" required {...bind("date")} /></Field>
        <Field label="Reason"><input placeholder="Damage, recount…" {...bind("reason")} /></Field>
      </div>
      {change !== 0 && (
        <p className="mt-4 text-sm text-slate-600">
          New quantity: <strong className="font-semibold">{Math.round((row.stock + change) * 1000) / 1000} {row.unit}</strong>
        </p>
      )}
    </Modal>
  );
}

function History({ row, onClose, onChanged }) {
  const [data, setData] = useState(null);

  const load = useCallback(
    () => api.get(`/stock/${row.id}/history`).then((res) => setData(res.data)).catch(() => toast.error("Could not load history")),
    [row.id],
  );
  useEffect(() => {
    load();
  }, [load]);

  const removeAdjustment = async (id) => {
    if (!window.confirm("Remove this adjustment?")) return;
    try {
      await api.delete(`/stock/adjust/${id}`);
      load();
      onChanged();
    } catch {
      toast.error("Could not remove it");
    }
  };

  return (
    <Modal wide title={row.name} subtitle={`Opening ${row.opening} ${row.unit} on ${shortDate(row.since)}`} onClose={onClose}>
      {!data ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : data.history.length === 0 ? (
        <EmptyState title="No movement since the opening count" />
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Date</th>
              <th className="th">Entry</th>
              <th className="th text-right">Change</th>
              <th className="th text-right">Stock</th>
            </tr>
          </thead>
          <tbody>
            {data.history.map((m, i) => (
              <tr key={i}>
                <td className="td whitespace-nowrap">{shortDate(m.date)}</td>
                <td className="td">{m.type} <span className="text-slate-500">{m.ref}</span></td>
                <td className={`td text-right ${m.quantity < 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {m.quantity > 0 ? "+" : ""}{m.quantity}
                </td>
                <td className="td text-right font-medium">{m.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data?.adjustments.length > 0 && (
        <div className="mt-5 text-sm">
          <p className="text-slate-500 mb-1">Manual adjustments</p>
          <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {data.adjustments.map((a) => (
              <li key={a._id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span>{shortDate(a.date)} · {a.quantity > 0 ? "+" : ""}{a.quantity} {a.reason && `· ${a.reason}`}</span>
                <button onClick={() => removeAdjustment(a._id)} aria-label="Remove adjustment" className="p-1 text-slate-500 hover:text-red-700">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

export default function Stock() {
  const [stock, setStock] = useState(null);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(
    () =>
      api.get("/stock").then(({ data }) => setStock(data.stock)).catch(() => {
        setStock([]);
        toast.error("Could not load stock");
      }),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  if (stock === null) return <div className="flex justify-center py-20"><Spinner /></div>;

  const shown = stock.filter(
    (s) => (!lowOnly || s.low) && s.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const value = stock.reduce((t, s) => t + s.value, 0);
  const lowCount = stock.filter((s) => s.low).length;
  const noCost = stock.filter((s) => !s.cost).length;

  const csv = () =>
    downloadCsv(`stock-${todayISO()}.csv`, [
      ["Product", "HSN", "Unit", "Opening", "Purchased", "Sold", "Returned", "Adjusted", "In stock", "Purchase price", "Value"],
      ...shown.map((s) => [s.name, s.hsn, s.unit, s.opening, s.purchased, s.sold, s.returned, s.adjusted, s.stock, s.cost, s.value]),
    ]);

  if (stock.length === 0) {
    return (
      <div className="card max-w-lg mx-auto">
        <EmptyState
          title="No products are tracked yet"
          hint="Edit a product and tick “Track stock”. Sales, purchases and returns then update the count by themselves."
          action={<Link to="/items" className="btn-primary">Go to Products</Link>}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Stats
        items={[
          { label: "Stock value at cost", value: rupees(value), icon: IndianRupee },
          { label: "Low stock", value: lowCount, icon: TriangleAlert, tone: lowCount ? "red" : "green" },
          { label: "Products tracked", value: stock.length, icon: Boxes, tone: "amber" },
        ]}
      />
      {noCost > 0 && (
        <p className="text-sm text-slate-500">{noCost} without a purchase price are valued at ₹0.</p>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap gap-3 items-center p-3 border-b border-slate-200">
          <div className="relative flex-1 min-w-[14rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products"
              aria-label="Search stock" className="input pl-9" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only
          </label>
          <button onClick={csv} className="btn-secondary"><FileSpreadsheet className="w-4 h-4" /> Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Product</th>
                <th className="th text-right">In stock</th>
                <th className="th text-right hidden md:table-cell">Purchased</th>
                <th className="th text-right hidden md:table-cell">Sold</th>
                <th className="th text-right hidden md:table-cell">Sold in 30 days</th>
                <th className="th text-right">Value</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="td">
                    <button onClick={() => setViewing(s)} className="font-medium text-brand-700 hover:underline text-left">{s.name}</button>
                  </td>
                  <td className="td text-right whitespace-nowrap">
                    <span className={`font-semibold ${s.low ? "text-red-700" : ""}`}>{s.stock}</span>{" "}
                    <span className="text-xs text-slate-500 uppercase">{s.unit}</span>
                    {s.low && <span className="block text-xs text-red-700">Low (warn at {s.lowStockAt})</span>}
                  </td>
                  <td className="td text-right hidden md:table-cell">{s.purchased}</td>
                  <td className="td text-right hidden md:table-cell">{s.sold}</td>
                  <td className="td text-right hidden md:table-cell">{s.soldRecently}</td>
                  <td className="td text-right whitespace-nowrap">{money(s.value)}</td>
                  <td className="td text-right">
                    <button onClick={() => setAdjusting(s)} className="btn-secondary btn-sm">Adjust</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && <EmptyState title="Nothing matches" />}
      </section>

      {adjusting && <AdjustForm row={adjusting} onClose={() => setAdjusting(null)} onSaved={load} />}
      {viewing && <History row={viewing} onClose={() => setViewing(null)} onChanged={load} />}
    </div>
  );
}
