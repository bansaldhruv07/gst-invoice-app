// Records money given to a worker.
import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/axios";
import Sheet from "../mobile/Sheet";
import { Cells, Cell } from "../mobile/Rows";
import { monthName } from "./statuses";
import { todayISO } from "../../lib/period";

export default function WorkerPayForm({ worker, month, onClose, onSaved }) {
  const due = worker.summary?.balance > 0 ? worker.summary.balance : "";
  const [form, setForm] = useState({ amount: due, date: todayISO(), kind: "salary", note: "" });
  const [saving, setSaving] = useState(false);
  const bind = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    className: "cell-input",
  });

  const save = async () => {
    if (saving) return;
    if (!(Number(form.amount) > 0)) return toast.error("Enter the amount paid");
    setSaving(true);
    try {
      await api.post(`/workers/${worker._id}/payments`, { ...form, amount: Number(form.amount), forMonth: month });
      toast.success("Payment recorded");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not record the payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      variant="bottom"
      title={`Pay ${worker.name}`}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary !hidden sm:!inline-flex">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary h-12 sm:h-10">{saving ? "Saving…" : "Record payment"}</button>
        </>
      }
    >
      <p className="px-4 py-2.5 text-sm text-slate-600 border-b border-slate-200">Counted against {monthName(month)}.</p>
      <Cells>
        <Cell label="Amount (₹)"><input required autoFocus type="number" inputMode="decimal" min="0.01" step="0.01" {...bind("amount")} /></Cell>
        <Cell label="Date"><input type="date" required {...bind("date")} /></Cell>
        <Cell label="Type">
          <select {...bind("kind")}>
            <option value="salary">Salary / wages</option>
            <option value="advance">Advance</option>
          </select>
        </Cell>
        <Cell label="Note (optional)"><input maxLength={200} {...bind("note")} /></Cell>
      </Cells>
    </Sheet>
  );
}
