// Add or change a worker.
import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/axios";
import Sheet from "../mobile/Sheet";
import { Cells, Cell } from "../mobile/Rows";
import { todayISO } from "../../lib/period";

export default function WorkerForm({ worker, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: worker?.name || "", mobile: worker?.mobile || "", work: worker?.work || "",
    payType: worker?.payType || "daily", rate: worker?.rate || "", joinedOn: worker?.joinedOn || todayISO(),
  });
  const [saving, setSaving] = useState(false);
  const bind = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    className: "cell-input",
  });

  const run = async (work, done) => {
    setSaving(true);
    try {
      const result = await work();
      toast.success(done(result.data));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (saving) return;
    if (!form.name.trim()) return toast.error("Enter the worker's name");
    const body = { ...form, rate: Number(form.rate) || 0 };
    return run(
      () => (worker ? api.put(`/workers/${worker._id}`, body) : api.post("/workers", body)),
      () => (worker ? "Worker saved" : "Worker added"),
    );
  };

  const remove = () => {
    if (!window.confirm(`Remove ${worker.name}? Past attendance and payments are kept.`)) return;
    run(() => api.delete(`/workers/${worker._id}`), (data) => (data.kept ? `${worker.name} marked as left` : "Worker removed"));
  };

  const rejoin = () => run(() => api.put(`/workers/${worker._id}`, { active: true }), () => `${worker.name} is working again`);

  return (
    <Sheet
      title={worker ? "Edit worker" : "Add worker"}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {worker && (worker.leftOn
            ? <button type="button" onClick={rejoin} className="btn-secondary">Working again</button>
            : <button type="button" onClick={remove} className="btn !flex-none text-red-700 hover:bg-red-50">Remove</button>)}
          <button type="button" onClick={onClose} className="btn-secondary !hidden sm:!inline-flex">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary h-12 sm:h-10">{saving ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <Cells>
        <Cell label="Name" wide><input required autoFocus maxLength={80} {...bind("name")} /></Cell>
        <Cell label="Mobile (optional)"><input type="tel" inputMode="tel" maxLength={15} {...bind("mobile")} /></Cell>
        <Cell label="Work (optional)"><input placeholder="Helper, driver…" maxLength={60} {...bind("work")} /></Cell>
        <Cell label="Pay type">
          <select {...bind("payType")}>
            <option value="daily">Daily wage</option>
            <option value="monthly">Monthly salary</option>
          </select>
        </Cell>
        <Cell label={form.payType === "daily" ? "Wage per day (₹)" : "Salary per month (₹)"}>
          <input type="number" inputMode="decimal" min="0" step="0.01" {...bind("rate")} />
        </Cell>
        <Cell label="Joining date" wide><input type="date" required {...bind("joinedOn")} /></Cell>
      </Cells>
    </Sheet>
  );
}
