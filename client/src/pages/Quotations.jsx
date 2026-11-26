import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Plus, Search, Download, Pencil, Trash2, MessageCircle } from "lucide-react";
import UpgradePrompt from "../components/UpgradePrompt";
import { Spinner, EmptyState } from "../components/ui";
import { money, shortDate } from "../lib/format";
import { downloadQuotationPdf } from "../lib/invoicePdf";
import { useBusiness } from "../context/BusinessContext";
import { todayISO } from "../lib/period";

const STYLES = {
  open: "bg-amber-50 text-amber-800 border-amber-200",
  accepted: "bg-emerald-50 text-emerald-800 border-emerald-200",
  declined: "bg-slate-100 text-slate-500 border-slate-200",
  converted: "bg-brand-50 text-brand-700 border-brand-200",
};

function whatsappQuote(q, business) {
  let digits = String(q.buyer?.mobile || "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11) return null;
  const lines = q.items.map((i) => `• ${i.name}: ${i.quantity} ${i.unit} × ${money(i.rate)}`);
  const text = [
    `Dear ${q.buyer.name},`,
    `Quotation ${q.invoiceNumber}:`,
    lines.join("\n"),
    `Total ${money(q.grandTotal)} (${q.taxMode === "inclusive" ? "GST included in rates" : "including GST"})` +
      (q.validUntil ? `, valid until ${shortDate(q.validUntil)}` : ""),
    business ? `Thank you,\n${business}` : "Thank you.",
  ].join("\n\n");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default function Quotations() {
  const navigate = useNavigate();
  const { business } = useBusiness();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState("");
  const [limit, setLimit] = useState("");

  const load = useCallback(
    () =>
      api.get("/quotations", { params: search ? { search } : {} })
        .then(({ data }) => setList(data.quotations))
        .catch(() => {
          setList([]);
          toast.error("Could not load quotations");
        }),
    [search],
  );
  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const run = async (id, action, failure) => {
    setBusy(id);
    try {
      await action();
    } catch (err) {
      if (err.response?.data?.upgrade) setLimit(err.response.data.message);
      else toast.error(err.response?.data?.message || failure);
    } finally {
      setBusy("");
    }
  };

  const convert = (q) => {
    if (!window.confirm(`Make an invoice from ${q.invoiceNumber}, dated today?`)) return;
    run(q._id, async () => {
      const { data } = await api.post(`/quotations/${q._id}/convert`);
      toast.success(`Invoice ${data.invoice.invoiceNumber} created`);
      navigate(`/invoices/${data.invoice._id}`);
    }, "Could not create the invoice");
  };

  const setStatus = (q, status) =>
    run(q._id, async () => {
      await api.put(`/quotations/${q._id}/status`, { status });
      await load();
    }, "Could not update the status");

  const remove = (q) => {
    if (!window.confirm(`Delete quotation ${q.invoiceNumber}?`)) return;
    run(q._id, async () => {
      await api.delete(`/quotations/${q._id}`);
      await load();
    }, "Could not delete");
  };

  const download = (q) => run(q._id, () => downloadQuotationPdf(q._id), "Could not create the PDF");

  return (
    <div className="max-w-6xl mx-auto">
      <section className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 items-center p-3 border-b border-slate-200">
          <div className="relative flex-1 min-w-[14rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="search" value={search} placeholder="Buyer or quotation number" aria-label="Search quotations"
              onChange={(e) => setParams(e.target.value ? { search: e.target.value } : {}, { replace: true })}
              className="input pl-9" />
          </div>
          <Link to="/quotations/create" className="btn-primary"><Plus className="w-4 h-4" /> New quotation</Link>
        </div>

        {list === null ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState title={search ? "No match" : "No quotations yet"}
            hint={search ? "Try another search." : "Send a price offer, then turn it into an invoice in one click."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Quotation</th>
                  <th className="th">Buyer</th>
                  <th className="th text-right">Amount</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((q) => {
                  const converted = q.status === "converted";
                  const expired = q.status === "open" && q.validUntil && q.validUntil.slice(0, 10) < todayISO();
                  const link = !converted && whatsappQuote(q, business?.name);
                  return (
                    <tr key={q._id}>
                      <td className="td whitespace-nowrap">
                        <span className="block font-medium">{q.invoiceNumber}</span>
                        <span className="block text-xs text-slate-500">{shortDate(q.invoiceDate)}</span>
                      </td>
                      <td className="td">
                        <span className="block">{q.buyer?.name || "—"}</span>
                        {q.validUntil && (
                          <span className={`block text-xs ${expired ? "text-red-700" : "text-slate-500"}`}>
                            {expired ? "Expired" : "Valid until"} {shortDate(q.validUntil)}
                          </span>
                        )}
                      </td>
                      <td className="td text-right whitespace-nowrap font-medium">{money(q.grandTotal)}</td>
                      <td className="td">
                        {converted ? (
                          <Link to={q.convertedInvoice ? `/invoices/${q.convertedInvoice}` : "/invoices"} className={`badge ${STYLES.converted}`}>
                            Invoiced
                          </Link>
                        ) : (
                          <select aria-label={`Status of ${q.invoiceNumber}`} value={q.status} disabled={busy === q._id}
                            onChange={(e) => setStatus(q, e.target.value)} className={`badge pr-6 ${STYLES[q.status]}`}>
                            <option value="open">Open</option>
                            <option value="accepted">Accepted</option>
                            <option value="declined">Declined</option>
                          </select>
                        )}
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          {!converted && (
                            <button onClick={() => convert(q)} disabled={busy === q._id} className="btn-primary btn-sm">Convert</button>
                          )}
                          <button onClick={() => download(q)} disabled={busy === q._id} title="Download PDF" aria-label={`Download ${q.invoiceNumber}`} className="btn-secondary btn-sm">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {link && (
                            <a href={link} target="_blank" rel="noreferrer" title="Send on WhatsApp" aria-label="Send on WhatsApp" className="btn-secondary btn-sm">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {!converted && (
                            <Link to={`/quotations/${q._id}/edit`} title="Edit" aria-label={`Edit ${q.invoiceNumber}`} className="btn btn-sm text-slate-600 hover:bg-slate-100">
                              <Pencil className="w-3.5 h-3.5" />
                            </Link>
                          )}
                          <button onClick={() => remove(q)} title="Delete" aria-label={`Delete ${q.invoiceNumber}`} className="btn btn-sm text-slate-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {limit && <UpgradePrompt message={limit} onClose={() => setLimit("")} />}
    </div>
  );
}
