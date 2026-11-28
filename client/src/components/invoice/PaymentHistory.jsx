// Money received and goods returned against an invoice.
import toast from "react-hot-toast";
import { Download, Trash2 } from "lucide-react";
import api from "../../api/axios";
import { downloadCreditNotePdf } from "../../lib/invoicePdf";
import { money, shortDate } from "../../lib/format";
import { useCan } from "../../context/AuthContext";

const MODE_LABELS = {
  upi: "UPI", bank_transfer: "Bank transfer", cash: "Cash", cheque: "Cheque", card: "Card", other: "Other",
};

const Band = ({ children }) => (
  <h3 className="px-4 py-2.5 bg-slate-100 border-y border-slate-200 text-sm font-bold text-slate-700">{children}</h3>
);

export default function PaymentHistory({ invoice, creditNotes, onChanged }) {
  const can = useCan();

  const downloadNote = async (note) => {
    try {
      await downloadCreditNotePdf(note, invoice);
    } catch (err) {
      console.error("PDF error:", err);
      toast.error("Could not create the PDF");
    }
  };

  const deleteNote = async (note) => {
    if (!window.confirm(`Delete credit note ${note.number}? The amount becomes due again.`)) return;
    try {
      await api.delete(`/credit-notes/${note._id}`);
      toast.success("Credit note deleted");
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete it");
    }
  };

  return (
    <>
      <Band>Payments</Band>
      {invoice.paymentHistory?.length ? (
        <ul className="divide-y divide-slate-100">
          {invoice.paymentHistory.map((p) => (
            <li key={p._id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span>
                <span className="block font-semibold">{MODE_LABELS[p.mode] || p.mode}</span>
                <span className="block text-slate-500">{shortDate(p.date)}{p.note && ` · ${p.note}`}</span>
              </span>
              <span className="tabular font-bold">{money(p.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-slate-500">No payment recorded yet.</p>
      )}

      {creditNotes.length > 0 && (
        <>
          <Band>Credit notes</Band>
          <ul className="divide-y divide-slate-100">
            {creditNotes.map((n) => (
              <li key={n._id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="mr-auto min-w-0">
                  <span className="block font-semibold">{n.number}</span>
                  <span className="block text-slate-500">
                    {shortDate(n.date)} · {n.items.map((l) => `${l.quantity} ${l.unit} ${l.name}`).join(", ")}
                    {n.reason && ` · ${n.reason}`}
                  </span>
                </span>
                <span className="tabular font-bold whitespace-nowrap">{money(n.grandTotal)}</span>
                <button type="button" onClick={() => downloadNote(n)} aria-label={`Download ${n.number}`} className="btn-secondary btn-sm">
                  <Download className="w-3.5 h-3.5" />
                </button>
                {can("returns") && (
                  <button type="button" onClick={() => deleteNote(n)} aria-label={`Delete ${n.number}`} className="btn btn-sm text-slate-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
