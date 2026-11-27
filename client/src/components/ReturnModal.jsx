// Sales return: choose how much of each line came back, to make a credit note.
import { useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import Modal, { Field } from "./Modal";
import { money } from "../lib/format";
import { todayISO } from "../lib/period";

export default function ReturnModal({ invoice, creditNotes, onClose, onSaved }) {
  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayISO());
  const [restock, setRestock] = useState(true);
  const [saving, setSaving] = useState(false);

  const lines = invoice.items.map((item) => {
    const returned = creditNotes.reduce(
      (t, n) => t + n.items.filter((l) => l.sourceLine === item._id).reduce((s, l) => s + l.quantity, 0),
      0,
    );
    return { ...item, left: Math.round((item.quantity - returned) * 1000) / 1000 };
  });
  const chosen = lines
    .map((l) => ({ lineId: l._id, quantity: Number(quantities[l._id]) || 0, line: l }))
    .filter((c) => c.quantity > 0);
  // Estimate; the server applies discount share and round off
  const value = chosen.reduce((t, c) => t + (c.line.totalAmount / c.line.quantity) * c.quantity, 0);

  const save = async () => {
    if (!chosen.length) return toast.error("Enter the quantity returned");
    setSaving(true);
    try {
      const { data } = await api.post("/credit-notes", {
        invoiceId: invoice._id,
        date,
        reason,
        restock,
        items: chosen.map(({ lineId, quantity }) => ({ lineId, quantity })),
      });
      toast.success(`${data.creditNote.number} created`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not create the credit note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      wide
      title="Sales return"
      subtitle={`Credit note against ${invoice.invoiceNumber}`}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving || !chosen.length} className="btn-primary">
            {saving ? "Saving…" : "Create credit note"}
          </button>
        </>
      }
    >
      <table className="w-full mb-4">
        <thead>
          <tr>
            <th className="th">Item</th>
            <th className="th text-right">Can return</th>
            <th className="th text-right">Returning</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l._id}>
              <td className="td">{l.name}</td>
              <td className="td text-right whitespace-nowrap">{l.left} {l.unit}</td>
              <td className="td text-right">
                <input
                  type="number" min="0" max={l.left} step="0.001" disabled={l.left <= 0}
                  aria-label={`Quantity of ${l.name} returned`}
                  value={quantities[l._id] ?? ""}
                  onChange={(e) => setQuantities((q) => ({ ...q, [l._id]: e.target.value }))}
                  className="input w-24 text-right"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Date"><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input" /></Field>
        <Field label="Reason"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged, wrong item…" className="input" /></Field>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
        The goods came back into stock
      </label>
      {chosen.length > 0 && (
        <p className="mt-3 text-sm text-slate-600">
          Credit of about <strong className="font-semibold">{money(value)}</strong> including GST.
        </p>
      )}
    </Modal>
  );
}
