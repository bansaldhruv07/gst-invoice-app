// One invoice, shown as the bill itself, with everything that can be done to it.
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  ArrowLeft, Download, Printer, MoreVertical, Pencil, FileInput, Truck, IndianRupee, Send,
} from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { makeInvoicePdf } from "../lib/invoicePdf";
import { downloadBill, printBill, shareBill } from "../lib/invoiceSend";
import { money, shortDate } from "../lib/format";
import PaymentModal from "../components/PaymentModal";
import { Spinner, statusStyle } from "../components/ui";
import UpiPay from "../components/UpiPay";
import PageBar from "../components/mobile/PageBar";
import PdfPreview from "../components/invoice/PdfPreview";
import InvoiceMenu from "../components/invoice/InvoiceMenu";
import ComplianceSheet from "../components/invoice/ComplianceSheet";
import PaymentHistory from "../components/invoice/PaymentHistory";
import { useCan } from "../context/AuthContext";
import DesignBar from "../components/invoice/DesignBar";

const COPIES = [
  ["recipient", "Original"],
  ["transporter", "Duplicate"],
  ["supplier", "Triplicate"],
];

// A round button with its name under it, for the bar at the bottom of a phone
function BarButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex flex-1 flex-col items-center gap-1.5 py-1 text-xs font-semibold text-slate-700 transition active:scale-95 disabled:opacity-40">
      <span className="grid place-items-center w-12 h-12 rounded-full bg-brand-50 text-brand-700">
        <Icon className="w-5 h-5" />
      </span>
      {label}
    </button>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { business, setBusiness } = useBusiness();
  const can = useCan();

  const [record, setRecord] = useState(null);
  const [copies, setCopies] = useState(["recipient"]);
  const [preview, setPreview] = useState(null);
  const [panel, setPanel] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/invoices/${id}`);
      setRecord({ invoice: data.invoice, creditNotes: data.creditNotes || [] });
    } catch {
      toast.error("Invoice not found");
      navigate("/invoices");
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const invoice = record?.invoice;

  // Redrawn when the bill, the chosen copies or the business details change
  useEffect(() => {
    if (!invoice) return;
    let current = true;
    makeInvoicePdf(invoice, copies)
      .then(({ doc }) => current && setPreview({ id: invoice._id, blob: doc.output("blob") }))
      .catch((err) => {
        console.error("PDF error:", err);
        if (current) toast.error("Could not create the PDF");
      });
    return () => {
      current = false;
    };
  }, [invoice, copies, business]);

  if (!invoice || invoice._id !== id) {
    return <div className="flex justify-center py-20"><Spinner /></div>;
  }

  const { creditNotes } = record;
  const cancelled = invoice.status === "cancelled";
  const canPay = !cancelled && invoice.balanceAmount > 0;
  const editable = can("editInvoice") && !cancelled && creditNotes.length === 0;

  // At least one copy stays ticked
  const toggle = (key) =>
    setCopies((list) => {
      const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
      return next.length ? COPIES.map(([k]) => k).filter((k) => next.includes(k)) : list;
    });

  const attempt = (work, failure) => async () => {
    try {
      await work();
    } catch (err) {
      console.error(err);
      toast.error(failure);
    }
  };
  const download = attempt(() => downloadBill(invoice, copies, toast), "Could not create the PDF");
  const print = attempt(() => printBill(invoice, copies), "Could not print");
  const share = attempt(() => shareBill(invoice, copies, toast), "Could not share the PDF");

  const changeStatus = async (status) => {
    try {
      const { data } = await api.put(`/invoices/${id}/status`, { status });
      toast.success(`Marked as ${data.invoice.status}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update the status");
    }
  };

  const actions = [
    can("compliance") && !cancelled && ["einvoice", "E-Invoice", FileInput, () => setPanel("einvoice")],
    can("compliance") && !cancelled && ["eway", "E-way Bill", Truck, () => setPanel("eway")],
    can("recordPayment") && ["pay", "Record Payment", IndianRupee, () => setPanel("pay"), !canPay],
    ["share", "Share", Send, share],
  ].filter(Boolean);

  const copyBoxes = (
    <fieldset className="flex items-center justify-between sm:justify-start gap-4 sm:gap-8">
      <legend className="sr-only">Print copies</legend>
      {COPIES.map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 py-1 text-sm font-semibold cursor-pointer">
          <input type="checkbox" className="w-5 h-5" checked={copies.includes(key)} onChange={() => toggle(key)} />
          {label}
        </label>
      ))}
    </fieldset>
  );

  const status = (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-slate-500">
        {canPay ? <>Balance due <strong className="font-bold text-red-700 tabular">{money(invoice.balanceAmount)}</strong></>
          : cancelled ? "Cancelled" : "Nothing is due"}
      </p>
      <select aria-label="Status" value={invoice.status} disabled={!can("editInvoice")}
        onChange={(e) => changeStatus(e.target.value)} className={`badge h-9 px-3 pr-8 text-sm ${statusStyle(invoice.status)}`}>
        <option value="unpaid">Unpaid</option>
        <option value="partial">Partial</option>
        <option value="paid">Paid</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>
  );

  return (
    <div className="-m-4 lg:m-0">
      <PageBar title={invoice.invoiceNumber} back="/invoices">
        <button type="button" onClick={print} aria-label="Print" className="p-2 rounded-lg text-slate-700 hover:bg-slate-100"><Printer className="w-5 h-5" /></button>
        <button type="button" onClick={download} aria-label="Download PDF" className="p-2 rounded-lg text-slate-700 hover:bg-slate-100"><Download className="w-5 h-5" /></button>
        <button type="button" onClick={() => setPanel("menu")} aria-label="More actions" className="p-2 -mr-2 rounded-lg text-slate-700 hover:bg-slate-100"><MoreVertical className="w-5 h-5" /></button>
      </PageBar>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-5 lg:items-start">
        <div className="min-w-0">
          {/* Wide screens: number and the main actions */}
          <div className="hidden lg:flex items-center gap-3 mb-4">
            <button onClick={() => navigate("/invoices")} aria-label="Back to invoices" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="mr-auto">
              <h2 className="text-xl font-semibold">{invoice.invoiceNumber}</h2>
              <p className="text-sm text-slate-500">
                {invoice.invoiceType === "bill_of_supply" ? "Bill of supply" : "Tax invoice"} · {shortDate(invoice.invoiceDate)} · {invoice.buyer?.name}
              </p>
            </div>
            <button onClick={print} className="btn-secondary"><Printer className="w-4 h-4" /> Print</button>
            <button onClick={download} className="btn-primary"><Download className="w-4 h-4" /> Download PDF</button>
            <button onClick={() => setPanel("menu")} aria-label="More actions" className="btn-secondary px-3"><MoreVertical className="w-4 h-4" /></button>
          </div>

          <div className="bg-white lg:card px-4 py-3 border-b border-slate-200 lg:mb-4">{copyBoxes}</div>
          {can("settings") && business && <DesignBar business={business} onSaved={setBusiness} />}
          <div className="px-4 pt-3 lg:hidden">{status}</div>

          <div className="relative p-3 lg:p-0">
            <PdfPreview blob={preview?.id === invoice._id ? preview.blob : null} label={`Invoice ${invoice.invoiceNumber}`} />
          </div>

        </div>

        <aside className="hidden lg:block space-y-4 lg:sticky lg:top-0">
          <section className="card p-4 space-y-3">
            {status}
            <div className="grid grid-cols-2 gap-2">
              {actions.map(([key, label, Icon, run, disabled]) => (
                <button key={key} type="button" onClick={run} disabled={disabled} className="btn-secondary h-auto flex-col py-3">
                  <Icon className="w-5 h-5 text-brand-600" /> {label}
                </button>
              ))}
            </div>
            {editable && (
              <Link to={`/invoices/${invoice._id}/edit`} className="btn-primary w-full">
                <Pencil className="w-4 h-4" /> Edit Invoice
              </Link>
            )}
          </section>
          {!cancelled && <UpiPay invoice={invoice} business={business} />}
          <section className="card overflow-hidden">
            <PaymentHistory invoice={invoice} creditNotes={creditNotes} onChanged={load} />
          </section>
        </aside>
      </div>

      {/* Phones: the main actions stay at the bottom, Edit floating above them */}
      <div className="lg:hidden sticky -bottom-4 z-20 pointer-events-none">
        {editable && (
          <div className="flex justify-end px-4 pb-3">
            <Link to={`/invoices/${invoice._id}/edit`} className="btn-secondary h-12 px-5 text-base shadow-xl pointer-events-auto">
              <Pencil className="w-4 h-4" /> Edit Invoice
            </Link>
          </div>
        )}
        <nav aria-label="Invoice actions" className="flex border-t border-slate-200 bg-white px-2 py-2 shadow-[0_-6px_20px_-12px_rgb(14_20_49_/_0.25)] pointer-events-auto">
          {actions.map(([key, label, Icon, run, disabled]) => (
            <BarButton key={key} icon={Icon} label={label} onClick={run} disabled={disabled} />
          ))}
        </nav>
      </div>

      {panel === "menu" && (
        <InvoiceMenu invoice={invoice} creditNotes={creditNotes} copies={copies} onClose={() => setPanel("")}
          onChanged={load} onDeleted={() => navigate("/invoices")} />
      )}
      {(panel === "einvoice" || panel === "eway") && (
        <ComplianceSheet kind={panel} invoice={invoice} business={business} onClose={() => setPanel("")} onSaved={load} />
      )}
      {panel === "pay" && (
        <PaymentModal title="Record payment" endpoint={`/invoices/${invoice._id}/payment`} balance={invoice.balanceAmount}
          onClose={() => setPanel("")} onSuccess={load} />
      )}
    </div>
  );
}
