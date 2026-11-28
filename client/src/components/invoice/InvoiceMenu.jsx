// Everything that can be done with an invoice. Used by the preview screen and by
// the three-dot button in the list.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FilePenLine, Mail, BellRing, Signature, XCircle, Trash2, Printer, CopyPlus, FileInput, History, ReceiptText,
  QrCode, RotateCcw,
} from "lucide-react";
import api from "../../api/axios";
import Sheet from "../mobile/Sheet";
import ReturnModal from "../ReturnModal";
import UpiPay from "../UpiPay";
import HistorySheet from "./HistorySheet";
import { printBill, emailBill, remindBuyer } from "../../lib/invoiceSend";
import { readImage } from "../../lib/image";
import { useBusiness } from "../../context/BusinessContext";
import { useCan } from "../../context/AuthContext";

function SignatureSheet({ invoice, onSaved, onClose }) {
  const [image, setImage] = useState(invoice.signatureUrl || "");
  const [saving, setSaving] = useState(false);

  const pick = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImage(await readImage(file));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/invoices/${invoice._id}/signature`, { signatureUrl: image });
      toast.success("Signature saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save the signature");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet variant="bottom" title="Add Signature" onClose={onClose} onSubmit={save}
      footer={<button type="submit" disabled={saving} className="btn-primary h-12 sm:h-10">{saving ? "Saving…" : "Save"}</button>}>
      <div className="p-4 space-y-3">
        <div className="grid place-items-center h-28 rounded-xl border-2 border-dashed border-slate-200">
          {image ? <img src={image} alt="Signature Preview" className="max-h-24 max-w-[90%] object-contain" />
            : <span className="text-sm text-slate-400">The signature from Settings is used</span>}
        </div>
        <div className="flex gap-2">
          <label className="btn-secondary cursor-pointer focus-within:ring-2 focus-within:ring-brand-500">
            Choose image
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} className="sr-only" />
          </label>
          {image && <button type="button" onClick={() => setImage("")} className="btn text-red-700 hover:bg-red-50">Remove</button>}
        </div>
        <p className="text-xs text-slate-500">This places a picture of your signature on the bill. It is not a legal digital signature certificate.</p>
      </div>
    </Sheet>
  );
}

function Action({ icon: Icon, label, onClick, danger }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-4 px-5 py-3 text-left transition hover:bg-slate-50">
        <span className={`grid place-items-center w-10 h-10 rounded-full ${danger ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-700"}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <span className={`text-[15px] font-semibold ${danger ? "text-red-600" : "text-slate-800"}`}>{label}</span>
      </button>
    </li>
  );
}

// onChanged: something was saved. onDeleted: the invoice no longer exists.
export default function InvoiceMenu({ invoice, creditNotes, copies, onClose, onChanged, onDeleted }) {
  const navigate = useNavigate();
  const can = useCan();
  const { business } = useBusiness();
  const [open, setOpen] = useState("");

  const cancelled = invoice.status === "cancelled";
  const due = !cancelled && invoice.balanceAmount > 0;
  const returned = creditNotes.reduce((t, n) => t + n.items.reduce((s, l) => s + l.quantity, 0), 0);
  const canReturn = !cancelled && returned < invoice.items.reduce((s, l) => s + l.quantity, 0) - 0.0005;

  // Closes the menu, then does the work
  const run = (work, failure) => async () => {
    onClose();
    try {
      await work();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || failure);
    }
  };
  const go = (to) => () => {
    onClose();
    navigate(to);
  };

  const setStatus = (status) => async () => {
    if (status === "cancelled" && !window.confirm(`Cancel invoice ${invoice.invoiceNumber}? Its number stays used.`)) return;
    await run(async () => {
      await api.put(`/invoices/${invoice._id}/status`, { status });
      toast.success(status === "cancelled" ? "Invoice cancelled" : "Invoice restored");
      onChanged();
    }, "Could not change the invoice")();
  };

  const remove = async () => {
    if (!window.confirm(`Delete invoice ${invoice.invoiceNumber} for good? Cancel it instead if you want to keep its number.`)) return;
    await run(async () => {
      await api.delete(`/invoices/${invoice._id}`);
      toast.success("Invoice deleted");
      onDeleted();
    }, "Could not delete the invoice")();
  };

  // The follow-on screens replace the menu
  if (open === "signature") return <SignatureSheet invoice={invoice} onClose={onClose} onSaved={onChanged} />;
  if (open === "history") return <HistorySheet invoice={invoice} creditNotes={creditNotes} onChanged={onChanged} onClose={onClose} />;
  if (open === "return") return <ReturnModal invoice={invoice} creditNotes={creditNotes} onClose={onClose} onSaved={onChanged} />;
  if (open === "qr") {
    return (
      <Sheet variant="bottom" title="Payment QR" onClose={onClose}>
        <div className="p-4"><UpiPay invoice={invoice} business={business} /></div>
      </Sheet>
    );
  }

  return (
    <Sheet variant="bottom" title={invoice.invoiceNumber} onClose={onClose}>
      <ul className="py-1">
        {can("editInvoice") && !cancelled && creditNotes.length === 0 && (
          <Action icon={FilePenLine} label="Edit Invoice" onClick={go(`/invoices/${invoice._id}/edit`)} />
        )}
        <Action icon={Mail} label="Send Email" onClick={run(() => emailBill(invoice, business?.name, toast), "Could not prepare the email")} />
        {due && (
          <Action icon={BellRing} label="Send Payment Reminder" onClick={run(() => remindBuyer(invoice, business?.name, toast), "Could not open the reminder")} />
        )}
        {due && <Action icon={QrCode} label="Payment QR" onClick={() => setOpen("qr")} />}
        {can("settings") && !cancelled && <Action icon={Signature} label="Add Signature" onClick={() => setOpen("signature")} />}
        {can("editInvoice") && !cancelled && <Action icon={XCircle} label="Cancel Invoice" danger onClick={setStatus("cancelled")} />}
        {can("editInvoice") && cancelled && <Action icon={RotateCcw} label="Restore Invoice" onClick={setStatus("unpaid")} />}
        {can("deleteInvoice") && invoice.paidAmount === 0 && creditNotes.length === 0 && (
          <Action icon={Trash2} label="Delete Invoice" danger onClick={remove} />
        )}
        <Action icon={Printer} label="Print" onClick={run(() => printBill(invoice, copies), "Could not print")} />
        {can("createInvoice") && <Action icon={CopyPlus} label="Duplicate Invoice" onClick={go(`/invoices/create?from=${invoice._id}`)} />}
        {can("returns") && canReturn && <Action icon={FileInput} label="Convert To Credit Note" onClick={() => setOpen("return")} />}
        <Action icon={History} label="View History (Logs)" onClick={() => setOpen("history")} />
        {invoice.buyer?._id && <Action icon={ReceiptText} label="Buyer statement" onClick={go(`/buyers/${invoice.buyer._id}`)} />}
      </ul>
    </Sheet>
  );
}
