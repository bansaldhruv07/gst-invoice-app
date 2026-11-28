// Payments, credit notes and who changed what on one invoice.
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "../../api/axios";
import Sheet from "../mobile/Sheet";
import PaymentHistory from "./PaymentHistory";
import { useCan } from "../../context/AuthContext";

const when = (value) =>
  new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function HistorySheet({ invoice, creditNotes, onChanged, onClose }) {
  const can = useCan();
  const [history, setHistory] = useState(null);
  const allowed = can("invoiceHistory");

  useEffect(() => {
    if (!allowed) return;
    let current = true;
    api.get(`/invoices/${invoice._id}/history`)
      .then(({ data }) => current && setHistory(data))
      .catch(() => current && toast.error("Could not load the history"));
    return () => {
      current = false;
    };
  }, [invoice._id, allowed]);

  const entries = history?.entries || [];

  return (
    <Sheet title="View History (Logs)" onClose={onClose}>
      <PaymentHistory invoice={invoice} creditNotes={creditNotes} onChanged={onChanged} />
      {allowed && (
        <>
          <h3 className="px-4 py-2.5 bg-slate-100 border-y border-slate-200 text-sm font-bold text-slate-700">Activity</h3>
          <ol className="px-4 py-3 space-y-3">
            {entries.map((e) => (
              <li key={e.id} className="border-l-2 border-brand-300 pl-3 text-sm">
                <p className="font-semibold">{e.action}</p>
                <p className="text-xs text-slate-500">{e.who} · {when(e.at)}</p>
              </li>
            ))}
            {history && !entries.some((e) => /^(Created|Turned|Saved a draft)/.test(e.action)) && (
              <li className="border-l-2 border-slate-200 pl-3 text-sm">
                <p className="font-semibold">Invoice made</p>
                <p className="text-xs text-slate-500">{when(invoice.createdAt)}</p>
              </li>
            )}
          </ol>
        </>
      )}
    </Sheet>
  );
}
