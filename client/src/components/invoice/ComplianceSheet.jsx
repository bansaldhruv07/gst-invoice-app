// E-invoice and e-way bill: the figures to type into the government portal, and
// the numbers it gives back. This app is not connected to those portals.
import { useState } from "react";
import toast from "react-hot-toast";
import { Copy, ExternalLink } from "lucide-react";
import api from "../../api/axios";
import Sheet from "../mobile/Sheet";
import { Cells, Cell } from "../mobile/Rows";
import { money, shortDate } from "../../lib/format";

const KINDS = {
  einvoice: {
    title: "E-Invoice",
    portal: "https://einvoice1.gst.gov.in",
    portalName: "e-invoice portal",
    intro: "Create the e-invoice on the government portal, then save its IRN here. The IRN is printed on your bill.",
    fields: [["irn", "IRN", "text"], ["ackNumber", "Ack No.", "text"], ["ackDate", "Ack Date", "date"]],
  },
  eway: {
    title: "E-way Bill",
    portal: "https://ewaybillgst.gov.in",
    portalName: "e-way bill portal",
    intro: "Create the e-way bill on the government portal, then save its number here. The number is printed on your bill.",
    fields: [["ewayBillNumber", "E-Way Bill No.", "text"], ["ewayBillDate", "E-Way Bill Date", "date"]],
  },
};

export default function ComplianceSheet({ kind, invoice, business, onClose, onSaved }) {
  const { title, portal, portalName, intro, fields } = KINDS[kind];
  const [form, setForm] = useState(() =>
    Object.fromEntries(fields.map(([key, , type]) => [key, type === "date" ? (invoice[key] || "").slice(0, 10) : invoice[key] || ""])),
  );
  const [saving, setSaving] = useState(false);
  const buyer = invoice.buyer || {};

  const facts = [
    ["Your GSTIN", invoice.supplierGstin || business?.gstin],
    ["Buyer", buyer.name],
    ["Buyer GSTIN", buyer.gstin || "Unregistered"],
    ["Pincode", buyer.pincode],
    ["Invoice No.", invoice.invoiceNumber],
    ["Invoice Date", shortDate(invoice.invoiceDate)],
    ["Taxable value", money(invoice.subTotal)],
    ["GST", money(invoice.totalTax)],
    ["Invoice value", money(invoice.grandTotal)],
    ["HSN codes", [...new Set(invoice.items.map((l) => l.hsn).filter(Boolean))].join(", ")],
    ...(kind === "eway" ? [["Vehicle No.", invoice.vehicleNumber], ["Transporter ID", invoice.transporterId]] : []),
  ].filter(([, value]) => value);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(facts.map(([k, v]) => `${k}: ${v}`).join("\n"));
      toast.success("Copied");
    } catch {
      toast.error("Could not copy on this device");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/invoices/${invoice._id}/compliance`, form);
      toast.success("Saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={title} onClose={onClose} onSubmit={save}
      footer={<button type="submit" disabled={saving} className="btn-primary h-12 sm:h-10">{saving ? "Saving…" : "Save"}</button>}>
      <p className="px-4 py-3 text-sm text-slate-600">{intro}</p>
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        <a href={portal} target="_blank" rel="noreferrer" className="btn-primary btn-sm">
          <ExternalLink className="w-3.5 h-3.5" /> Open the {portalName}
        </a>
        <button type="button" onClick={copy} className="btn-secondary btn-sm"><Copy className="w-3.5 h-3.5" /> Copy details</button>
      </div>
      <dl className="mx-4 mb-4 rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-3 py-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-semibold break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <Cells className="border-t">
        {fields.map(([key, label, type]) => (
          <Cell key={key} label={label} wide>
            <input type={type} className="cell-input" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
          </Cell>
        ))}
      </Cells>
    </Sheet>
  );
}
