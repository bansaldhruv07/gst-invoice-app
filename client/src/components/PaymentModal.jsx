import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import api from "../api/axios";
import { money } from "../lib/format";

const MODES = [
  ["upi", "UPI"],
  ["bank_transfer", "Bank transfer"],
  ["cash", "Cash"],
  ["cheque", "Cheque"],
  ["card", "Card"],
  ["other", "Other"],
];

// Records money received on an invoice, or paid against a purchase bill
export default function PaymentModal({ title, endpoint, balance, onClose, onSuccess }) {
  const [form, setForm] = useState({
    amount: balance || "",
    date: new Date().toISOString().split("T")[0],
    mode: "upi",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return toast.error("Enter an amount");
    if (amount > balance) return toast.error(`The balance is only ${money(balance)}`);
    setSaving(true);
    try {
      await api.post(endpoint, { ...form, amount });
      toast.success("Payment recorded");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not record the payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="!m-0 fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <form
        onSubmit={submit}
        role="dialog"
        aria-label={title}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl"
      >
        <div className="card-head">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-sm text-slate-500">Balance {money(balance)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-4">
          <label className="col-span-2">
            <span className="label">Amount (₹)</span>
            <input autoFocus type="number" min="0.01" step="0.01" max={balance} value={form.amount} onChange={set("amount")} className="input" />
          </label>
          <label>
            <span className="label">Date</span>
            <input type="date" value={form.date} onChange={set("date")} className="input" />
          </label>
          <label>
            <span className="label">Paid by</span>
            <select value={form.mode} onChange={set("mode")} className="input">
              {MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="col-span-2">
            <span className="label">Note (optional)</span>
            <input value={form.note} onChange={set("note")} placeholder="UPI reference or cheque number" className="input" />
          </label>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Record payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
