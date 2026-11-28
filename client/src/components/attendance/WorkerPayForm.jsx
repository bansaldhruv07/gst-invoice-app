// Records money given to a worker: an advance they took, or their salary.
import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/axios";
import Sheet from "../mobile/Sheet";
import { Cells, Cell } from "../mobile/Rows";
import { monthName } from "./statuses";
import { todayISO } from "../../lib/period";

// `kind` is "advance" or "salary". An advance counts against the month it was
// taken in; salary against the month being looked at.
export default function WorkerPayForm({ worker, kind, date, month, onClose, onSaved }) {
  const advance = kind === "advance";
  const due = !advance && worker.summary?.balance > 0 ? worker.summary.balance : "";
  const [form, setForm] = useState({ amount: due, date: date || todayISO(), note: "" });
  const [saving, setSaving] = useState(false);
  const forMonth = advance ? form.date.slice(0, 7) : month;
  const bind = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    className: "cell-input",
  });

  const save = async () => {
    if (saving) return;
    if (!(Number(form.amount) > 0)) return toast.error("Enter the amount");
    setSaving(true);
    try {
      await api.post(`/workers/${worker._id}/payments`, { ...form, kind, amount: Number(form.amount), forMonth });
      toast.success(advance ? "Money taken is recorded" : "Salary payment recorded");
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
      title={advance ? `Money taken by ${worker.name}` : `Pay ${worker.name}`}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary !hidden sm:!inline-flex">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary h-12 sm:h-10">{saving ? "Saving…" : "Save"}</button>
        </>
      }
    >
      {forMonth && (
        <p className="px-4 py-2.5 text-sm text-slate-600 border-b border-slate-200">
          {advance ? "Taken before pay day. " : ""}Counted against {monthName(forMonth)}.
        </p>
      )}
      <Cells>
        <Cell label="Amount (₹)"><input required autoFocus type="number" inputMode="decimal" min="0.01" step="0.01" {...bind("amount")} /></Cell>
        <Cell label="Date"><input type="date" required max={todayISO()} {...bind("date")} /></Cell>
        <Cell label="Note (optional)" wide>
          <input maxLength={200} placeholder={advance ? "Reason, such as medicine or rent" : ""} {...bind("note")} />
        </Cell>
      </Cells>
    </Sheet>
  );
}
