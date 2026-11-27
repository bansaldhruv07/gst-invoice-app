// Account statement of one buyer or seller.
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { ArrowLeft, Download, IndianRupee, MessageCircle, Plus, FileSpreadsheet } from "lucide-react";
import Modal, { Field } from "../components/Modal";
import { useBusiness } from "../context/BusinessContext";
import { Spinner, EmptyState } from "../components/ui";
import { money, shortDate } from "../lib/format";
import { downloadCsv } from "../lib/csv";
import { downloadStatementPdf } from "../lib/statementPdf";
import { todayISO } from "../lib/period";

function ReceiveForm({ buyer, outstanding, openInvoices, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: outstanding.total, date: todayISO(), mode: "upi", note: "" });
  const [saving, setSaving] = useState(false);
  const bind = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    className: "input",
  });

  // Preview of where the money goes: old dues first, then the oldest invoices
  const bills = [
    ...(outstanding.opening > 0 ? [{ ref: "Opening balance", balance: outstanding.opening }] : []),
    ...openInvoices.map((i) => ({ ref: i.invoiceNumber, balance: i.balance })),
  ];
  const shares = bills.reduce(
    ({ left, list }, bill) => {
      const part = Math.max(0, Math.min(left, bill.balance));
      return { left: left - part, list: part > 0 ? [...list, { ...bill, part }] : list };
    },
    { left: Number(form.amount) || 0, list: [] },
  ).list;

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/ledger/buyer/${buyer._id}/receive`, { ...form, amount: Number(form.amount) });
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
    <Modal
      title="Receive payment"
      subtitle={`${buyer.name} owes ${money(outstanding.total)}`}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Record payment"}</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount (₹)" wide>
          <input autoFocus required type="number" min="0.01" step="0.01" max={outstanding.total} {...bind("amount")} />
        </Field>
        <Field label="Date"><input type="date" required {...bind("date")} /></Field>
        <Field label="Paid by">
          <select {...bind("mode")}>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Note (optional)" wide><input {...bind("note")} /></Field>
      </div>
      {shares.length > 0 && (
        <div className="mt-4 text-sm">
          <p className="text-slate-500 mb-1">This will be applied to</p>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {shares.map((s) => (
              <li key={s.ref} className="flex justify-between px-3 py-1.5">
                <span>{s.ref}{s.part < s.balance && <span className="text-slate-500"> (part)</span>}</span>
                <span className="tabular">{money(s.part)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

export default function Ledger({ kind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { business } = useBusiness();
  const isBuyer = kind === "buyer";
  const [data, setData] = useState(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const [receiving, setReceiving] = useState(false);

  const load = useCallback(
    () =>
      api.get(`/ledger/${kind}/${id}`, { params: range })
        .then((res) => setData({ ...res.data, id }))
        .catch(() => {
          toast.error("Could not open the statement");
          navigate(`/${kind}s`);
        }),
    [kind, id, range, navigate],
  );

  useEffect(() => {
    load();
  }, [load]);

  if (!data || data.id !== id) return <div className="flex justify-center py-20"><Spinner /></div>;

  const { party, ledger } = data;
  const due = ledger.outstanding.total;

  let digits = String(party.mobile || "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) digits = `91${digits}`;
  const reminder =
    isBuyer && due > 0 && digits.length >= 11 &&
    `https://wa.me/${digits}?text=${encodeURIComponent(
      `Dear ${party.name},\n\nYour account shows ${money(due)} outstanding as on ${shortDate(todayISO())}. ` +
        `Kindly arrange the payment.\n\nThank you,\n${business?.name || ""}`,
    )}`;

  const pdf = async () => {
    try {
      await downloadStatementPdf({ business, party, ledger, ...range, kind });
    } catch (err) {
      console.error(err);
      toast.error("Could not create the PDF");
    }
  };

  const csv = () =>
    downloadCsv(`statement-${party.name.replace(/[^A-Za-z0-9]+/g, "-")}.csv`, [
      ["Date", "Type", "Reference", "Note", "Debit", "Credit", "Balance"],
      ["", "Balance brought forward", "", "", "", "", ledger.broughtForward],
      ...ledger.rows.map((r) => [r.date, r.type, r.ref, r.note, r.debit, r.credit, r.balance]),
    ]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => navigate(`/${kind}s`)} aria-label="Back" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="mr-auto min-w-0">
          <h2 className="text-xl font-semibold">{party.name}</h2>
          <p className="text-sm text-slate-500">
            {[party.gstin, party.mobile, party.city].filter(Boolean).join(" · ") || "No contact details"}
          </p>
        </div>
        {reminder && (
          <a href={reminder} target="_blank" rel="noreferrer" className="btn-secondary">
            <MessageCircle className="w-4 h-4" /> Send reminder
          </a>
        )}
        <button onClick={csv} className="btn-secondary"><FileSpreadsheet className="w-4 h-4" /> CSV</button>
        <button onClick={pdf} className="btn-secondary"><Download className="w-4 h-4" /> Statement PDF</button>
        {isBuyer && (
          <>
            {due > 0 && (
              <button onClick={() => setReceiving(true)} className="btn-secondary">
                <IndianRupee className="w-4 h-4" /> Receive payment
              </button>
            )}
            <Link to={`/invoices/create?buyer=${party._id}`} className="btn-primary"><Plus className="w-4 h-4" /> New invoice</Link>
          </>
        )}
      </div>

      <section className="card grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="px-5 py-4">
          <p className="text-xs text-slate-500">{isBuyer ? "They owe you now" : "You owe them now"}</p>
          <p className={`mt-1 text-2xl font-semibold tabular ${due > 0 ? "text-red-700" : ""}`}>{money(due)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-slate-500">{isBuyer ? "Billed in this period" : "Paid in this period"}</p>
          <p className="mt-1 text-2xl font-semibold tabular">{money(ledger.totalDebit)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-slate-500">{isBuyer ? "Received and credited" : "Purchased in this period"}</p>
          <p className="mt-1 text-2xl font-semibold tabular">{money(ledger.totalCredit)}</p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-200">
          <h3 className="card-title mr-auto px-2">Statement</h3>
          <input type="date" aria-label="From date" value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="input w-auto" />
          <span className="text-sm text-slate-500">to</span>
          <input type="date" aria-label="To date" value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="input w-auto" />
        </div>
        {ledger.rows.length === 0 && !ledger.broughtForward ? (
          <EmptyState title="Nothing in this period" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Entry</th>
                  <th className="th text-right">Debit</th>
                  <th className="th text-right">Credit</th>
                  <th className="th text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="td text-slate-500" colSpan={4}>Balance brought forward</td>
                  <td className="td text-right whitespace-nowrap">{money(ledger.broughtForward)}</td>
                </tr>
                {ledger.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="td whitespace-nowrap">{shortDate(r.date)}</td>
                    <td className="td">
                      <span className="block whitespace-nowrap">
                        {r.type}{" "}
                        {r.link ? <Link to={r.link} className="text-brand-700 hover:underline">{r.ref}</Link> : r.ref}
                      </span>
                      {r.note && <span className="block text-xs text-slate-500">{r.note}</span>}
                    </td>
                    <td className="td text-right whitespace-nowrap">{r.debit ? money(r.debit) : ""}</td>
                    <td className="td text-right whitespace-nowrap">{r.credit ? money(r.credit) : ""}</td>
                    <td className="td text-right whitespace-nowrap font-medium">{money(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {receiving && (
        <ReceiveForm buyer={party} outstanding={ledger.outstanding} openInvoices={ledger.openInvoices}
          onClose={() => setReceiving(false)} onSaved={load} />
      )}
    </div>
  );
}
