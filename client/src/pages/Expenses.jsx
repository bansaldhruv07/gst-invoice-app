import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, FileSpreadsheet } from "lucide-react";
import Modal, { Field } from "../components/Modal";
import { Spinner, EmptyState } from "../components/ui";
import { money, rupees, shortDate } from "../lib/format";
import { downloadCsv } from "../lib/csv";
import { PERIODS, periodRange, todayISO } from "../lib/period";
import { useCan } from "../context/AuthContext";

const CATEGORIES = [
  "Rent", "Salary and wages", "Transport and freight", "Electricity", "Phone and internet",
  "Repairs", "Office supplies", "Tea and food", "Bank charges", "Professional fees", "Marketing", "Other",
];

const MODES = {
  cash: "Cash", upi: "UPI", bank_transfer: "Bank transfer", cheque: "Cheque", card: "Card", other: "Other",
};

function ExpenseForm({ expense, onClose, onSaved }) {
  const [form, setForm] = useState({
    category: "", amount: "", gstAmount: "", mode: "cash", payee: "", note: "",
    ...expense,
    date: expense.date ? expense.date.slice(0, 10) : todayISO(),
  });
  const [saving, setSaving] = useState(false);
  const bind = (key) => ({
    value: form[key] ?? "",
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    className: "input",
  });

  const save = async () => {
    setSaving(true);
    const body = { ...form, amount: Number(form.amount), gstAmount: Number(form.gstAmount) || 0 };
    try {
      if (expense._id) await api.put(`/expenses/${expense._id}`, body);
      else await api.post("/expenses", body);
      toast.success("Expense saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save the expense");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={expense._id ? "Edit expense" : "New expense"}
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
        <Field label="Category" wide>
          <input required autoFocus list="expense-categories" placeholder="Pick or type one" {...bind("category")} />
          <datalist id="expense-categories">
            {CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label="Amount (₹)"><input required type="number" min="0.01" step="0.01" {...bind("amount")} /></Field>
        <Field label="GST included (₹)"><input type="number" min="0" step="0.01" placeholder="0" {...bind("gstAmount")} /></Field>
        <Field label="Date"><input type="date" required {...bind("date")} /></Field>
        <Field label="Paid by">
          <select {...bind("mode")}>
            {Object.entries(MODES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Paid to" wide><input {...bind("payee")} /></Field>
        <Field label="Note" wide><input {...bind("note")} /></Field>
      </div>
    </Modal>
  );
}

export default function Expenses() {
  const can = useCan();
  const [period, setPeriod] = useState("this-month");
  const [range, setRange] = useState(() => periodRange("this-month"));
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(
    () =>
      api.get("/expenses", { params: range })
        .then((res) => setData(res.data))
        .catch(() => {
          setData({ expenses: [], total: 0, byCategory: [] });
          toast.error("Could not load expenses");
        }),
    [range],
  );
  useEffect(() => {
    load();
  }, [load]);

  const choose = (key) => {
    setPeriod(key);
    if (key !== "custom") setRange(periodRange(key));
  };

  const remove = async (e) => {
    if (!window.confirm(`Delete this ${e.category} expense of ${money(e.amount)}?`)) return;
    try {
      await api.delete(`/expenses/${e._id}`);
      load();
    } catch {
      toast.error("Could not delete");
    }
  };

  const csv = () =>
    downloadCsv(`expenses-${range.from}-to-${range.to}.csv`, [
      ["Date", "Category", "Paid to", "Note", "Mode", "GST", "Amount"],
      ...data.expenses.map((e) => [e.date.slice(0, 10), e.category, e.payee, e.note, MODES[e.mode], e.gstAmount, e.amount]),
    ]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Period" value={period} onChange={(e) => choose(e.target.value)} className="input w-auto">
          {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {period === "custom" && (
          <>
            <input type="date" aria-label="From date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="input w-auto" />
            <input type="date" aria-label="To date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="input w-auto" />
          </>
        )}
        <button onClick={csv} disabled={!data?.expenses.length} className="btn-secondary ml-auto">
          <FileSpreadsheet className="w-4 h-4" /> Export CSV
        </button>
        {can("editExpenses") && (
          <button onClick={() => setEditing({})} className="btn-primary"><Plus className="w-4 h-4" /> Add expense</button>
        )}
      </div>

      {data === null ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <section className="card overflow-hidden lg:col-span-2">
            {data.expenses.length === 0 ? (
              <EmptyState title="No expenses in this period" hint="Rent, salaries and transport go here, so profit is accurate." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th">Date</th>
                      <th className="th">Expense</th>
                      <th className="th text-right">Amount</th>
                      <th className="th text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expenses.map((e) => (
                      <tr key={e._id}>
                        <td className="td whitespace-nowrap">{shortDate(e.date)}</td>
                        <td className="td">
                          <span className="block font-medium">{e.category}</span>
                          <span className="block text-xs text-slate-500">
                            {[e.payee, MODES[e.mode], e.note].filter(Boolean).join(" · ")}
                          </span>
                        </td>
                        <td className="td text-right whitespace-nowrap">{money(e.amount)}</td>
                        <td className="td">
                          <div className="flex justify-end gap-1">
                            {can("editExpenses") && (
                              <button onClick={() => setEditing(e)} aria-label="Edit expense" className="btn btn-sm text-slate-600 hover:bg-slate-100">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {can("editExpenses") && (
                              <button onClick={() => remove(e)} aria-label="Delete expense" className="btn btn-sm text-slate-500 hover:text-red-700 hover:bg-red-50">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">By category</h2>
              <span className="text-sm font-semibold tabular">{rupees(data.total)}</span>
            </div>
            <ul className="px-5 py-3 space-y-3 text-sm">
              {data.byCategory.length === 0 && <li className="text-slate-500">Nothing yet.</li>}
              {data.byCategory.map((c) => (
                <li key={c.category}>
                  <div className="flex justify-between gap-3">
                    <span>{c.category}</span>
                    <span className="tabular">{rupees(c.amount)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(c.amount / data.total) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {editing && <ExpenseForm expense={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}
