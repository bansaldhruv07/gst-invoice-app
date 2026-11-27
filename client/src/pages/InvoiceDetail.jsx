import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { ArrowLeft, Download, IndianRupee, MessageCircle, Pencil, Copy, Undo2, Share2, Trash2 } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { downloadInvoicePdf, downloadCreditNotePdf, shareInvoicePdf, canSharePdf } from "../lib/invoicePdf";
import ReturnModal from "../components/ReturnModal";
import { amountInWords } from "../lib/amountInWords";
import { money, shortDate, whatsappReminder } from "../lib/format";
import PaymentModal from "../components/PaymentModal";
import { Spinner, statusStyle } from "../components/ui";

const MODE_LABELS = {
  upi: "UPI",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  cheque: "Cheque",
  card: "Card",
  other: "Other",
};

function Facts({ title, rows }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{title}</h2>
      </div>
      <dl className="px-5 py-3 space-y-1.5 text-sm">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex gap-4">
              <dt className="w-28 flex-shrink-0 text-slate-500">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { business } = useBusiness();

  const [invoice, setInvoice] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [creditNotes, setCreditNotes] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchInvoice = useCallback(async () => {
    try {
      const { data } = await api.get(`/invoices/${id}`);
      setInvoice(data.invoice);
      setCreditNotes(data.creditNotes || []);
    } catch {
      toast.error("Invoice not found");
      navigate("/invoices");
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const changeStatus = async (status) => {
    try {
      const { data } = await api.put(`/invoices/${id}/status`, { status });
      toast.success(`Marked as ${data.invoice.status}`);
      fetchInvoice();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update the status");
    }
  };

  const download = async () => {
    setPdfLoading(true);
    try {
      const { logoMissing } = await downloadInvoicePdf(invoice);
      if (logoMissing) {
        toast.error("Your logo could not be loaded. Upload it again in Settings.");
      }
    } catch (err) {
      console.error("PDF error:", err);
      toast.error("Could not create the PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const share = async () => {
    try {
      await shareInvoicePdf(invoice);
    } catch (err) {
      console.error("Share error:", err);
      toast.error("Could not share the PDF");
    }
  };

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
      fetchInvoice();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete it");
    }
  };

  if (!invoice || invoice._id !== id) {
    return <div className="flex justify-center py-20"><Spinner /></div>;
  }

  const igst = invoice.taxType === "igst";
  const canPay = invoice.status === "unpaid" || invoice.status === "partial";
  const buyer = invoice.buyer || {};
  const reminder =
    canPay &&
    whatsappReminder({
      mobile: buyer.mobile,
      buyer: buyer.name,
      invoiceNumber: invoice.invoiceNumber,
      balance: invoice.balanceAmount,
      dueDate: invoice.dueDate,
      business: business?.name,
    });

  const cancelled = invoice.status === "cancelled";
  const returnedQuantity = creditNotes.reduce((t, n) => t + n.items.reduce((s, l) => s + l.quantity, 0), 0);
  const canReturn = !cancelled && returnedQuantity < invoice.items.reduce((s, l) => s + l.quantity, 0) - 0.0005;

  const summary = [
    ["Taxable amount", invoice.subTotal],
    ...(invoice.discountAmount > 0 ? [["Discount", -invoice.discountAmount]] : []),
    ...(igst
      ? [["IGST", invoice.totalIgst]]
      : [["CGST", invoice.totalCgst], ["SGST", invoice.totalSgst]]),
    ...(invoice.roundOff ? [["Round off", invoice.roundOff]] : []),
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate("/invoices")}
          aria-label="Back to invoices"
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="mr-auto">
          <h2 className="text-xl font-semibold">{invoice.invoiceNumber}</h2>
          <p className="text-sm text-slate-500">
            {invoice.invoiceType === "bill_of_supply" ? "Bill of supply" : "Tax invoice"} ·{" "}
            {shortDate(invoice.invoiceDate)}
          </p>
        </div>
        <select
          aria-label="Status"
          value={invoice.status}
          onChange={(e) => changeStatus(e.target.value)}
          className={`badge h-9 px-3 pr-8 text-sm ${statusStyle(invoice.status)}`}
        >
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {reminder && (
          <a href={reminder} target="_blank" rel="noreferrer" className="btn-secondary">
            <MessageCircle className="w-4 h-4" /> Send reminder
          </a>
        )}
        {canPay && (
          <button onClick={() => setShowPayment(true)} className="btn-secondary">
            <IndianRupee className="w-4 h-4" /> Record payment
          </button>
        )}
        <button onClick={download} disabled={pdfLoading} className="btn-primary">
          <Download className="w-4 h-4" /> {pdfLoading ? "Preparing…" : "Download PDF"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {!cancelled && creditNotes.length === 0 && (
          <Link to={`/invoices/${invoice._id}/edit`} className="btn-secondary btn-sm">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
        )}
        <Link to={`/invoices/create?from=${invoice._id}`} className="btn-secondary btn-sm">
          <Copy className="w-3.5 h-3.5" /> Duplicate
        </Link>
        {canReturn && (
          <button onClick={() => setShowReturn(true)} className="btn-secondary btn-sm">
            <Undo2 className="w-3.5 h-3.5" /> Sales return
          </button>
        )}
        {canSharePdf() && (
          <button onClick={share} className="btn-secondary btn-sm">
            <Share2 className="w-3.5 h-3.5" /> Share PDF
          </button>
        )}
        {buyer._id && (
          <Link to={`/buyers/${buyer._id}`} className="btn btn-sm text-brand-700 hover:underline">
            Buyer statement
          </Link>
        )}
      </div>

      <section
        className={`card grid divide-x divide-slate-200 ${invoice.creditedAmount > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}
      >
        {[
          ["Invoice amount", invoice.grandTotal, ""],
          ["Received", invoice.paidAmount, ""],
          ...(invoice.creditedAmount > 0 ? [["Returned", invoice.creditedAmount, ""]] : []),
          ["Balance due", invoice.balanceAmount, canPay ? "text-red-700" : ""],
        ].map(([label, value, tone]) => (
          <div key={label} className="px-4 py-4 sm:px-5">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`mt-1 text-base sm:text-2xl font-semibold tabular ${tone}`}>{money(value)}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Facts
          title="Billed to"
          rows={[
            ["Name", <span key="n" className="font-medium">{buyer.name}</span>],
            ["GSTIN", buyer.gstin || "Unregistered"],
            ["Address", [buyer.address, buyer.city, buyer.state, buyer.pincode].filter(Boolean).join(", ")],
            ["Mobile", buyer.mobile],
          ]}
        />
        <Facts
          title="Details"
          rows={[
            ["Due date", invoice.dueDate && shortDate(invoice.dueDate)],
            ["Tax", igst ? "IGST (another state)" : "CGST + SGST (same state)"],
            ["Rates", invoice.taxMode === "inclusive" ? "Include GST" : "Exclude GST"],
            ["Challan no.", invoice.challanNumber],
            ["Vehicle no.", invoice.vehicleNumber],
            ["Place of supply", invoice.placeOfSupply],
            ["Note", invoice.notes],
          ]}
        />
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Item</th>
                <th className="th">HSN/SAC</th>
                <th className="th text-right">Quantity</th>
                <th className="th text-right">Rate</th>
                <th className="th text-right">Taxable</th>
                <th className="th text-right">GST</th>
                <th className="th text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item._id}>
                  <td className="td font-medium min-w-[12rem]">{item.name}</td>
                  <td className="td">{item.hsn || "—"}</td>
                  <td className="td text-right whitespace-nowrap">
                    {item.quantity} <span className="text-xs text-slate-500 uppercase">{item.unit}</span>
                  </td>
                  <td className="td text-right whitespace-nowrap">{money(item.rate)}</td>
                  <td className="td text-right whitespace-nowrap">{money(item.taxableAmount)}</td>
                  <td className="td text-right whitespace-nowrap">
                    {money(item.totalAmount - item.taxableAmount)}
                    <span className="block text-xs text-slate-500">{item.gstPercent}%</span>
                  </td>
                  <td className="td text-right whitespace-nowrap font-medium">{money(item.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-6 px-5 py-4">
          <div className="text-sm sm:max-w-sm">
            <p className="text-slate-500">Amount in words</p>
            <p>{amountInWords(invoice.grandTotal)}</p>
            {invoice.terms && (
              <>
                <p className="mt-3 text-slate-500">Terms and conditions</p>
                <p className="whitespace-pre-line">{invoice.terms}</p>
              </>
            )}
          </div>
          <dl className="text-sm sm:w-72">
            {summary.map(([label, value]) => (
              <div key={label} className="flex justify-between py-1">
                <dt className="text-slate-500">{label}</dt>
                <dd className="tabular">{money(value)}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-2 mt-1 border-t border-slate-300 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{money(invoice.grandTotal)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {invoice.paymentHistory?.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Payments</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {invoice.paymentHistory.map((p) => (
              <li key={p._id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span>
                  <span className="block font-medium">{MODE_LABELS[p.mode] || p.mode}</span>
                  <span className="block text-slate-500">
                    {shortDate(p.date)}
                    {p.note && ` · ${p.note}`}
                  </span>
                </span>
                <span className="tabular font-medium">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {creditNotes.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Credit notes</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {creditNotes.map((n) => (
              <li key={n._id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="mr-auto min-w-0">
                  <span className="block font-medium">{n.number}</span>
                  <span className="block text-slate-500">
                    {shortDate(n.date)} · {n.items.map((l) => `${l.quantity} ${l.unit} ${l.name}`).join(", ")}
                    {n.reason && ` · ${n.reason}`}
                  </span>
                </span>
                <span className="tabular font-medium whitespace-nowrap">{money(n.grandTotal)}</span>
                <button onClick={() => downloadNote(n)} aria-label={`Download ${n.number}`} className="btn-secondary btn-sm">
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteNote(n)} aria-label={`Delete ${n.number}`} className="btn btn-sm text-slate-500 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showReturn && (
        <ReturnModal invoice={invoice} creditNotes={creditNotes}
          onClose={() => setShowReturn(false)} onSaved={fetchInvoice} />
      )}

      {showPayment && (
        <PaymentModal
          title="Record payment"
          endpoint={`/invoices/${invoice._id}/payment`}
          balance={invoice.balanceAmount}
          onClose={() => setShowPayment(false)}
          onSuccess={fetchInvoice}
        />
      )}
    </div>
  );
}
