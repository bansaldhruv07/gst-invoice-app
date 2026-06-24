import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Download,
  IndianRupee,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Building2,
  MapPin,
  FileText,
  Plus,
  X,
} from "lucide-react";

// ─── Format INR ───────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── Format date ──────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  unpaid: {
    label: "Unpaid",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: AlertCircle,
  },
  partial: {
    label: "Partial",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    icon: Clock,
  },
  paid: {
    label: "Paid",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-gray-100 text-gray-500 border-gray-200",
    icon: XCircle,
  },
};

// ─── Record Payment Modal ─────────────────────────────────────────────────────
function PaymentModal({ invoice, onClose, onSuccess }) {
  const [form, setForm] = useState({
    amount: invoice.balanceAmount || "",
    date: new Date().toISOString().split("T")[0],
    mode: "upi",
    note: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    if (parseFloat(form.amount) > invoice.balanceAmount) {
      toast.error(
        `Amount cannot exceed balance ₹${fmt(invoice.balanceAmount)}`,
      );
      return;
    }
    setLoading(true);
    try {
      await api.post(`/invoices/${invoice._id}/payment`, {
        amount: parseFloat(form.amount),
        date: form.date,
        mode: form.mode,
        note: form.note,
      });
      toast.success("Payment recorded successfully");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  const PAYMENT_MODES = [
    { value: "upi", label: "UPI" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "cash", label: "Cash" },
    { value: "cheque", label: "Cheque" },
    { value: "card", label: "Card" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Record Payment
              </h2>
              <p className="text-xs text-slate-500">
                Balance due: ₹{fmt(invoice.balanceAmount)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount Received <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                ₹
              </span>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {/* Quick fill buttons */}
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, amount: invoice.balanceAmount })
                }
                className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
              >
                Full amount (₹{fmt(invoice.balanceAmount)})
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    amount: (invoice.balanceAmount / 2).toFixed(2),
                  })
                }
                className="text-xs px-2 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
              >
                Half
              </button>
            </div>
          </div>

          {/* Payment date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payment Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Payment mode */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Payment Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setForm({ ...form, mode: mode.value })}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                    form.mode === mode.value
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-green-300"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Note{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="e.g. UPI ref: 123456789"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {loading ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main InvoiceDetail Page ──────────────────────────────────────────────────
export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // ── Fetch invoice ──────────────────────────────────────────────────────────
  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/invoices/${id}`);
      setInvoice(data.invoice);
    } catch {
      toast.error("Invoice not found");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  // ── Update status ──────────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    try {
      await api.put(`/invoices/${id}/status`, { status: newStatus });
      toast.success(`Marked as ${newStatus}`);
      fetchInvoice();
    } catch {
      toast.error("Failed to update status");
    }
  };

  // ── PDF Generation ─────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const { data: supplierData } = await api.get("/auth/supplier-info");
      const S = supplierData.supplier; // supplier shorthand

      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const inv = invoice;
      const B = inv.buyer; // buyer shorthand
      const W = 210; // page width
      const m = 8; // margin

      // ── Colors ──────────────────────────────────────────────────────────────
      const BLACK = [0, 0, 0];
      const WHITE = [255, 255, 255];
      const LGRAY = [240, 240, 240];
      const MGRAY = [200, 200, 200];
      const DGRAY = [80, 80, 80];

      // ── Helpers ──────────────────────────────────────────────────────────────
      const r2 = (n) => Math.round((n || 0) * 100) / 100;
      const fmtN = (n) =>
        r2(n).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

      // ─────────────────────────────────────────────────────────────────────────
      // SECTION 1: HEADER
      // ─────────────────────────────────────────────────────────────────────────
      let y = m;

      // Outer border for entire page
      doc.setDrawColor(...MGRAY);
      doc.setLineWidth(0.3);
      doc.rect(m, m, W - m * 2, 277);

      // ── Logo placeholder (top left) ──────────────────────────────────────────
      doc.setFillColor(...LGRAY);
      doc.rect(m + 1, y + 1, 28, 28, "F");
      doc.setTextColor(...DGRAY);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text("LOGO", m + 1 + 14, y + 1 + 15, { align: "center" });

      // ── e-Invoice label (top right) ──────────────────────────────────────────
      doc.setTextColor(...BLACK);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("e-Invoice", W - m - 22, y + 5);

      // ── QR code placeholder (top right) ─────────────────────────────────────
      doc.setFillColor(...LGRAY);
      doc.rect(W - m - 22, y + 6, 21, 21, "F");
      doc.setFontSize(5);
      doc.setTextColor(...DGRAY);
      doc.text("QR CODE", W - m - 22 + 10.5, y + 17, { align: "center" });

      // ── Supplier details (center) ────────────────────────────────────────────
      const cx = W / 2; // center x
      doc.setTextColor(...BLACK);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(S.name || "AGGARWAL TRADERS", cx, y + 8, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const addr = [S.address, S.city, S.state, S.pincode]
        .filter(Boolean)
        .join(", ");
      doc.text(addr, cx, y + 14, { align: "center" });

      if (S.phone) {
        doc.text(S.phone, cx, y + 19, { align: "center" });
      }

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text(`GSTIN : ${S.gstin || ""}`, cx, y + 25, { align: "center" });

      y += 31;

      // ── TAX INVOICE title ────────────────────────────────────────────────────
      doc.setFillColor(...LGRAY);
      doc.rect(m, y, W - m * 2, 7, "F");
      doc.setTextColor(...BLACK);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(
        inv.invoiceType === "bill_of_supply" ? "BILL OF SUPPLY" : "TAX INVOICE",
        cx,
        y + 5,
        { align: "center" },
      );

      // ── Original / Duplicate / Triplicate checkboxes (right side) ────────────
      const checkLabels = [
        "Original for Recipient",
        "Duplicate for Transporter",
        "Triplicate for Supplier",
      ];
      checkLabels.forEach((lbl, i) => {
        const bx = W - m - 52;
        const by = y + i * 2.8;
        // tiny checkbox
        doc.setDrawColor(...DGRAY);
        doc.setLineWidth(0.2);
        doc.rect(bx, by + 0.3, 2.5, 2.5);
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DGRAY);
        doc.text(lbl, bx + 3.5, by + 2.3);
      });

      y += 8;

      // ─────────────────────────────────────────────────────────────────────────
      // SECTION 2: INVOICE META (two columns)
      // ─────────────────────────────────────────────────────────────────────────
      doc.setDrawColor(...MGRAY);
      doc.setLineWidth(0.2);

      const metaH = 28;
      const halfW = (W - m * 2) / 2;
      const leftX = m;
      const rightX = m + halfW;

      // left box
      doc.rect(leftX, y, halfW, metaH);
      // right box
      doc.rect(rightX, y, halfW, metaH);

      const metaLeft = [
        ["Reverse Charge", "No"],
        ["Invoice No.", inv.invoiceNumber],
        ["Invoice Date", fmtDate(inv.invoiceDate)],
        ["E-Way Bill No", ""],
        ["State", S.state || "Delhi"],
      ];

      const metaRight = [
        ["Challan No.", ""],
        ["Transportation Mode", "Road"],
        ["Vehicle No.", ""],
        ["Date of Supply", fmtDate(inv.invoiceDate)],
        ["Place of Supply", ""],
      ];

      doc.setFontSize(7.5);
      metaLeft.forEach(([key, val], i) => {
        const ly = y + 4 + i * 4.8;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DGRAY);
        doc.text(key, leftX + 2, ly);
        doc.setTextColor(...BLACK);
        doc.text(`:  ${val}`, leftX + 32, ly);
      });

      // State Code box inside left meta
      doc.setFillColor(...LGRAY);
      doc.rect(leftX + halfW - 18, y + metaH - 8, 16, 6, "F");
      doc.setFontSize(6.5);
      doc.setTextColor(...DGRAY);
      doc.text("State", leftX + halfW - 17, y + metaH - 5);
      doc.text("Code", leftX + halfW - 17, y + metaH - 2.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLACK);
      doc.text(S.stateCode || "07", leftX + halfW - 7, y + metaH - 3);

      metaRight.forEach(([key, val], i) => {
        const ly = y + 4 + i * 4.8;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DGRAY);
        doc.text(key, rightX + 2, ly);
        doc.setTextColor(...BLACK);
        doc.text(`:  ${val}`, rightX + 36, ly);
      });

      y += metaH;

      // ─────────────────────────────────────────────────────────────────────────
      // SECTION 3: BUYER + CONSIGNEE boxes
      // ─────────────────────────────────────────────────────────────────────────
      const buyerBoxH = 36;

      // Header row for boxes
      doc.setFillColor(...LGRAY);
      doc.rect(leftX, y, halfW, 5, "F");
      doc.rect(rightX, y, halfW, 5, "F");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLACK);
      doc.text("Details of Receiver | Billed to:", leftX + 2, y + 3.5);
      doc.text("Details of Consignee | Shipped to:", rightX + 2, y + 3.5);

      // Boxes
      doc.setDrawColor(...MGRAY);
      doc.rect(leftX, y + 5, halfW, buyerBoxH);
      doc.rect(rightX, y + 5, halfW, buyerBoxH);

      const buyerLines = [
        ["Name", B?.name || ""],
        [
          "Address",
          [B?.address, B?.city, B?.state, B?.pincode]
            .filter(Boolean)
            .join(", "),
        ],
        ["GSTIN", B?.gstin || "Unregistered"],
        ["State", B?.state || ""],
      ];

      doc.setFontSize(7.5);
      let by2 = y + 9;
      buyerLines.forEach(([key, val]) => {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DGRAY);
        doc.text(key, leftX + 2, by2);
        doc.text(":", leftX + 16, by2);
        doc.setTextColor(...BLACK);
        doc.setFont(
          key === "Name" ? "helvetica" : "helvetica",
          key === "Name" ? "bold" : "normal",
        );
        // wrap long address
        const wrapped = doc.splitTextToSize(val, halfW - 22);
        doc.text(wrapped, leftX + 18, by2);
        by2 += wrapped.length > 1 ? wrapped.length * 3.5 : 5;
      });

      // Consignee (same as buyer)
      let cy2 = y + 9;
      buyerLines.forEach(([key, val]) => {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DGRAY);
        doc.text(key, rightX + 2, cy2);
        doc.text(":", rightX + 16, cy2);
        doc.setTextColor(...BLACK);
        doc.setFont(
          key === "Name" ? "helvetica" : "helvetica",
          key === "Name" ? "bold" : "normal",
        );
        const wrapped = doc.splitTextToSize(val, halfW - 22);
        doc.text(wrapped, rightX + 18, cy2);
        cy2 += wrapped.length > 1 ? wrapped.length * 3.5 : 5;
      });

      // State code boxes inside buyer boxes
      doc.setFillColor(...LGRAY);
      doc.rect(leftX + halfW - 18, y + 5 + buyerBoxH - 7, 16, 5, "F");
      doc.rect(rightX + halfW - 18, y + 5 + buyerBoxH - 7, 16, 5, "F");
      doc.setFontSize(6.5);
      doc.setTextColor(...DGRAY);
      ["State Code", "State Code"].forEach((txt, i) => {
        const bx = (i === 0 ? leftX : rightX) + halfW - 18;
        doc.text("State", bx + 1, y + 5 + buyerBoxH - 5);
        doc.text("Code", bx + 1, y + 5 + buyerBoxH - 2.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BLACK);
        doc.text(
          B?.stateCode || S.stateCode || "07",
          bx + 10,
          y + 5 + buyerBoxH - 3,
        );
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DGRAY);
      });

      y += buyerBoxH + 5;

      // ─────────────────────────────────────────────────────────────────────────
      // SECTION 4: IRN row
      // ─────────────────────────────────────────────────────────────────────────
      doc.setFillColor(...LGRAY);
      doc.rect(leftX, y, W - m * 2, 6, "F");
      doc.setDrawColor(...MGRAY);
      doc.rect(leftX, y, W - m * 2, 6);
      doc.setFontSize(6.8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DGRAY);
      doc.text("IRN :", leftX + 2, y + 4);
      doc.setTextColor(...BLACK);
      doc.text("(e-Invoice IRN will appear here)", leftX + 12, y + 4);

      // Ack No + Date
      doc.setTextColor(...DGRAY);
      doc.text("Ack. No :", W / 2 - 10, y + 4);
      doc.text("Ack. Date :", W / 2 + 20, y + 4);

      y += 7;

      // ─────────────────────────────────────────────────────────────────────────
      // SECTION 5: ITEMS TABLE
      // ─────────────────────────────────────────────────────────────────────────
      const isCgstSgst = inv.taxType === "cgst_sgst";

      // Build body rows
      const tableBody = inv.items.map((item, i) => {
        if (isCgstSgst) {
          return [
            i + 1,
            item.name,
            item.hsn || "—",
            item.quantity,
            (item.unit || "pcs").toUpperCase(),
            fmtN(item.rate),
            fmtN(item.taxableAmount),
            `${item.cgstPercent}%`,
            fmtN(item.cgstAmount),
            `${item.sgstPercent}%`,
            fmtN(item.sgstAmount),
            fmtN(item.totalAmount),
          ];
        } else {
          return [
            i + 1,
            item.name,
            item.hsn || "—",
            item.quantity,
            (item.unit || "pcs").toUpperCase(),
            fmtN(item.rate),
            fmtN(item.taxableAmount),
            `${item.igstPercent}%`,
            fmtN(item.igstAmount),
            fmtN(item.totalAmount),
          ];
        }
      });

      // Total row
      const totalQty = inv.items.reduce((s, i) => s + (i.quantity || 0), 0);
      if (isCgstSgst) {
        tableBody.push([
          {
            content: "Total Quantity",
            colSpan: 3,
            styles: { fontStyle: "bold", halign: "left" },
          },
          { content: totalQty, styles: { fontStyle: "bold", halign: "right" } },
          "",
          "",
          {
            content: `₹${fmtN(inv.subTotal)}`,
            styles: { fontStyle: "bold", halign: "right" },
          },
          "",
          {
            content: `₹${fmtN(inv.totalCgst)}`,
            styles: { fontStyle: "bold", halign: "right" },
          },
          "",
          {
            content: `₹${fmtN(inv.totalSgst)}`,
            styles: { fontStyle: "bold", halign: "right" },
          },
          {
            content: `₹${fmtN(inv.grandTotal)}`,
            styles: { fontStyle: "bold", halign: "right" },
          },
        ]);
      } else {
        tableBody.push([
          {
            content: "Total Quantity",
            colSpan: 3,
            styles: { fontStyle: "bold", halign: "left" },
          },
          { content: totalQty, styles: { fontStyle: "bold", halign: "right" } },
          "",
          "",
          {
            content: `₹${fmtN(inv.subTotal)}`,
            styles: { fontStyle: "bold", halign: "right" },
          },
          "",
          {
            content: `₹${fmtN(inv.totalIgst)}`,
            styles: { fontStyle: "bold", halign: "right" },
          },
          {
            content: `₹${fmtN(inv.grandTotal)}`,
            styles: { fontStyle: "bold", halign: "right" },
          },
        ]);
      }

      // ── Column config ─────────────────────────────────────────────────────────
      const cgstSgstCols = [
        { header: "Sr.\nNo.", dataKey: "sr" },
        { header: "Name of product", dataKey: "name" },
        { header: "HSN/SAC", dataKey: "hsn" },
        { header: "QTY", dataKey: "qty" },
        { header: "Unit", dataKey: "unit" },
        { header: "Rate", dataKey: "rate" },
        { header: "Taxable\nValue", dataKey: "taxable" },
        { header: "Rate", dataKey: "cgstR" },
        { header: "Amount", dataKey: "cgstA" },
        { header: "Rate", dataKey: "sgstR" },
        { header: "Amount", dataKey: "sgstA" },
        { header: "Total", dataKey: "total" },
      ];

      const igstCols = [
        { header: "Sr.\nNo.", dataKey: "sr" },
        { header: "Name of product", dataKey: "name" },
        { header: "HSN/SAC", dataKey: "hsn" },
        { header: "QTY", dataKey: "qty" },
        { header: "Unit", dataKey: "unit" },
        { header: "Rate", dataKey: "rate" },
        { header: "Taxable\nValue", dataKey: "taxable" },
        { header: "Rate", dataKey: "igstR" },
        { header: "Amount", dataKey: "igstA" },
        { header: "Total", dataKey: "total" },
      ];

      autoTable(doc, {
        startY: y,
        columns: isCgstSgst ? cgstSgstCols : igstCols,
        body: tableBody,
        theme: "grid",
        margin: { left: m, right: m },

        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          textColor: BLACK,
          lineColor: MGRAY,
          lineWidth: 0.2,
        },

        headStyles: {
          fillColor: LGRAY,
          textColor: BLACK,
          fontStyle: "bold",
          fontSize: 7,
          halign: "center",
          valign: "middle",
          minCellHeight: 10,
        },

        columnStyles: {
          // sr
          0: { halign: "center", cellWidth: 8 },
          // name
          1: { halign: "left", cellWidth: isCgstSgst ? 36 : 44 },
          // hsn
          2: { halign: "center", cellWidth: 16 },
          // qty
          3: { halign: "right", cellWidth: 10 },
          // unit
          4: { halign: "center", cellWidth: 10 },
          // rate
          5: { halign: "right", cellWidth: isCgstSgst ? 16 : 18 },
          // taxable
          6: { halign: "right", cellWidth: isCgstSgst ? 20 : 22 },
          // cgst rate or igst rate
          7: { halign: "center", cellWidth: isCgstSgst ? 11 : 12 },
          // cgst amt or igst amt
          8: { halign: "right", cellWidth: isCgstSgst ? 16 : 18 },
          // sgst rate
          9: isCgstSgst ? { halign: "center", cellWidth: 11 } : undefined,
          // sgst amt
          10: isCgstSgst ? { halign: "right", cellWidth: 16 } : undefined,
          // total
          [isCgstSgst ? 11 : 9]: {
            halign: "right",
            cellWidth: isCgstSgst ? 21 : 22,
            fontStyle: "bold",
          },
        },

        // ── CGST / SGST / IGST merged header ──────────────────────────────────
        didDrawPage: (hookData) => {
          // Draw CGST + SGST merged headers over two sub-columns
          const tbl = hookData.table;
          const head = tbl.head[0];
          if (!head) return;

          // Find CGST Rate column x position (col index 7)
          const col7 = head.cells[7];
          const col8 = head.cells[8];

          if (isCgstSgst && col7 && col8) {
            const col9 = head.cells[9];
            const col10 = head.cells[10];

            // Draw CGST label spanning cols 7+8
            const cgstX = col7.x;
            const cgstW = col7.width + col8.width;
            const headerY = col7.y;
            const halfH = head.height / 2;

            doc.setFillColor(...LGRAY);
            doc.rect(cgstX, headerY, cgstW, halfH, "F");
            doc.setDrawColor(...MGRAY);
            doc.setLineWidth(0.2);
            doc.rect(cgstX, headerY, cgstW, halfH);
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...BLACK);
            doc.text("CGST", cgstX + cgstW / 2, headerY + halfH / 2 + 1, {
              align: "center",
            });

            // Draw SGST label spanning cols 9+10
            if (col9 && col10) {
              const sgstX = col9.x;
              const sgstW = col9.width + col10.width;
              doc.setFillColor(...LGRAY);
              doc.rect(sgstX, headerY, sgstW, halfH, "F");
              doc.rect(sgstX, headerY, sgstW, halfH);
              doc.text("SGST", sgstX + sgstW / 2, headerY + halfH / 2 + 1, {
                align: "center",
              });
            }

            // Sub-labels "Rate" and "Amount" in bottom half
            [col7, col8, col9, col10].forEach((cell, ci) => {
              if (!cell) return;
              doc.setFillColor(...LGRAY);
              doc.rect(cell.x, headerY + halfH, cell.width, halfH, "F");
              doc.rect(cell.x, headerY + halfH, cell.width, halfH);
              const sub = ci % 2 === 0 ? "Rate" : "Amount";
              doc.text(
                sub,
                cell.x + cell.width / 2,
                headerY + halfH + halfH / 2 + 1,
                { align: "center" },
              );
            });
          } else if (!isCgstSgst && col7 && col8) {
            // IGST merged header
            const igstX = col7.x;
            const igstW = col7.width + col8.width;
            const headerY = col7.y;
            const halfH = head.height / 2;

            doc.setFillColor(...LGRAY);
            doc.rect(igstX, headerY, igstW, halfH, "F");
            doc.rect(igstX, headerY, igstW, halfH);
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...BLACK);
            doc.text("IGST", igstX + igstW / 2, headerY + halfH / 2 + 1, {
              align: "center",
            });

            [col7, col8].forEach((cell, ci) => {
              doc.setFillColor(...LGRAY);
              doc.rect(cell.x, headerY + halfH, cell.width, halfH, "F");
              doc.rect(cell.x, headerY + halfH, cell.width, halfH);
              doc.text(
                ci === 0 ? "Rate" : "Amount",
                cell.x + cell.width / 2,
                headerY + halfH + halfH / 2 + 1,
                { align: "center" },
              );
            });
          }
        },

        alternateRowStyles: { fillColor: WHITE },
      });

      y = doc.lastAutoTable.finalY;

      // ─────────────────────────────────────────────────────────────────────────
      // SECTION 6: AMOUNT IN WORDS + BANK DETAILS + TAX SUMMARY
      // ─────────────────────────────────────────────────────────────────────────
      const leftColW = halfW - 2;
      const rightColW = halfW;
      const rightColX = m + leftColW + 2;

      // ── Left col: Amount in words ─────────────────────────────────────────────
      const wordsBoxH = 14;
      doc.setDrawColor(...MGRAY);
      doc.setLineWidth(0.2);
      doc.rect(leftX, y, leftColW, wordsBoxH);
      doc.setFillColor(...LGRAY);
      doc.rect(leftX, y, leftColW, 4, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLACK);
      doc.text("Total Invoice Amount in words", leftX + 2, y + 3);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      const wordsTxt =
        inv.amountInWords || `Rupees ${fmtN(inv.grandTotal)} Only`;
      const wordLines = doc.splitTextToSize(wordsTxt, leftColW - 4);
      wordLines.forEach((line, i) => {
        doc.text(line, leftX + leftColW / 2, y + 7 + i * 4, {
          align: "center",
        });
      });

      // ── Right col: Tax summary ────────────────────────────────────────────────
      const taxRows = [
        ["Total Amount Before Tax", `₹${fmtN(inv.subTotal)}`],
        ...(isCgstSgst
          ? [
              ["Add : CGST", `₹${fmtN(inv.totalCgst)}`],
              ["Add : SGST", `₹${fmtN(inv.totalSgst)}`],
            ]
          : [["Add : IGST", `₹${fmtN(inv.totalIgst)}`]]),
        ["Tax Amount : GST", `₹${fmtN(inv.totalTax)}`],
        ...(inv.roundOff !== 0
          ? [
              [
                "Round Off Value:",
                `${inv.roundOff > 0 ? "+" : ""}${fmtN(inv.roundOff)}`,
              ],
            ]
          : []),
        ["Amount With Tax", `₹${fmtN(inv.grandTotal)}`],
        ["Paid Amount", `₹${fmtN(inv.paidAmount)}`],
        ["Balance Due", `₹${fmtN(inv.balanceAmount)}`],
      ];

      const rowH = wordsBoxH / taxRows.length;
      taxRows.forEach(([label, val], i) => {
        const ry = y + i * rowH;
        doc.setDrawColor(...MGRAY);
        doc.rect(rightColX, ry, rightColW, rowH);

        const isBold = label === "Amount With Tax" || label === "Balance Due";
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setFontSize(7);
        doc.setTextColor(...BLACK);
        doc.text(label, rightColX + 2, ry + rowH / 2 + 1.5);
        doc.text(":", rightColX + rightColW * 0.55, ry + rowH / 2 + 1.5);
        doc.text(val, rightColX + rightColW - 2, ry + rowH / 2 + 1.5, {
          align: "right",
        });
      });

      y += wordsBoxH;

      // ─────────────────────────────────────────────────────────────────────────
      // SECTION 7: BANK DETAILS (left) + SIGNATURE (right)
      // ─────────────────────────────────────────────────────────────────────────
      const bankH = 26;
      doc.setDrawColor(...MGRAY);
      doc.rect(leftX, y, leftColW, bankH);
      doc.rect(rightColX, y, rightColW, bankH);

      // Bank details header
      doc.setFillColor(...LGRAY);
      doc.rect(leftX, y, leftColW, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...BLACK);
      doc.text("Bank Details", leftX + 2, y + 3);

      const bankInfo = [
        ["Account Holder Name", S.name || "Aggarwal traders"],
        ["Bank Account Number", S.bankAccount || ""],
        ["Bank IFSC Code", S.bankIfsc || ""],
        ["Bank Name", S.bankName || ""],
        ["Bank Branch Name", S.bankBranch || ""],
      ];

      doc.setFontSize(7);
      bankInfo.forEach(([key, val], i) => {
        const bly = y + 6 + i * 3.8;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DGRAY);
        doc.text(key + " :", leftX + 2, bly);
        doc.setTextColor(...BLACK);
        doc.text(val, leftX + 40, bly);
      });

      // Signature box (right)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...BLACK);
      doc.text(
        "Certified that the particular given above are true",
        rightColX + rightColW / 2,
        y + 6,
        { align: "center" },
      );
      doc.text("and correct", rightColX + rightColW / 2, y + 10, {
        align: "center",
      });

      doc.setFontSize(9);
      doc.text(
        `For, ${S.name || "AGGARWAL TRADERS"}`,
        rightColX + rightColW / 2,
        y + 16,
        { align: "center" },
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...DGRAY);
      doc.text(
        "Authorised Signatory",
        rightColX + rightColW / 2,
        y + bankH - 2,
        { align: "center" },
      );

      y += bankH;

      // ─────────────────────────────────────────────────────────────────────────
      // SECTION 8: TERMS & CONDITIONS
      // ─────────────────────────────────────────────────────────────────────────
      const termsH = 20;
      doc.setDrawColor(...MGRAY);
      doc.rect(leftX, y, leftColW, termsH);
      doc.rect(rightColX, y, rightColW, termsH);

      doc.setFillColor(...LGRAY);
      doc.rect(leftX, y, leftColW, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...BLACK);
      doc.text("Terms And Conditions", leftX + 2, y + 3);

      const defaultTerms = [
        "1. This is an electronically generated invoice.",
        "2. All disputes are subject to DELHI jurisdiction.",
        "3. Interest will charge 24 per annum after 15 days",
      ];
      const termsLines = (inv.terms || "").split("\n").filter(Boolean);
      const allTerms = termsLines.length > 0 ? termsLines : defaultTerms;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(...DGRAY);
      allTerms.slice(0, 4).forEach((line, i) => {
        doc.text(line, leftX + 2, y + 8 + i * 3.5);
      });

      y += termsH;

      // ─────────────────────────────────────────────────────────────────────────
      // DONE — Save
      // ─────────────────────────────────────────────────────────────────────────
      doc.save(`${inv.invoiceNumber}.pdf`);
      toast.success("PDF downloaded!");
    } catch (err) {
      console.error("PDF error:", err);
      toast.error("PDF generation failed: " + err.message);
    } finally {
      setPdfLoading(false);
    }
  };
  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-10 bg-slate-100 rounded-lg w-48" />
        <div className="bg-white rounded-xl border border-slate-100 h-40" />
        <div className="bg-white rounded-xl border border-slate-100 h-64" />
      </div>
    );
  }

  if (!invoice) return null;

  const statusCfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.unpaid;
  const StatusIcon = statusCfg.icon;
  const isCgstSgst = invoice.taxType === "cgst_sgst";
  const canPay = invoice.status === "unpaid" || invoice.status === "partial";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {invoice.invoiceNumber}
            </h1>
            <p className="text-slate-500 text-sm capitalize">
              {invoice.invoiceType?.replace("_", " ")} ·{" "}
              {fmtDate(invoice.invoiceDate)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status dropdown */}
          <select
            value={invoice.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${statusCfg.color}`}
          >
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Record payment */}
          {canPay && (
            <button
              onClick={() => setShowPayment(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <IndianRupee className="w-4 h-4" />
              Record Payment
            </button>
          )}

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <Download className="w-4 h-4" />
            {pdfLoading ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </div>

      {/* ── Status + amount cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Grand Total",
            value: `₹${fmt(invoice.grandTotal)}`,
            color: "text-slate-800",
            bg: "bg-white",
          },
          {
            label: "Amount Paid",
            value: `₹${fmt(invoice.paidAmount)}`,
            color: "text-green-700",
            bg: "bg-green-50",
          },
          {
            label: "Balance Due",
            value: `₹${fmt(invoice.balanceAmount)}`,
            color: "text-red-700",
            bg: "bg-red-50",
          },
          {
            label: "Status",
            value: statusCfg.label,
            color: statusCfg.color.split(" ")[1],
            bg: statusCfg.color.split(" ")[0],
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`${card.bg} rounded-xl border border-slate-100 p-4`}
          >
            <p className="text-xs text-slate-500 mb-1">{card.label}</p>
            <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Buyer + Invoice info ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Buyer details */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" />
            Buyer Details
          </h2>
          <p className="text-base font-bold text-slate-800 mb-1">
            {invoice.buyer?.name}
          </p>
          {invoice.buyer?.gstin && (
            <p className="text-xs font-mono bg-slate-100 text-slate-700 inline-block px-2 py-0.5 rounded mb-2">
              GSTIN: {invoice.buyer.gstin}
            </p>
          )}
          {invoice.buyer?.address && (
            <p className="text-sm text-slate-500 flex items-start gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              {[
                invoice.buyer.address,
                invoice.buyer.city,
                invoice.buyer.state,
                invoice.buyer.pincode,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
          {invoice.buyer?.mobile && (
            <p className="text-sm text-slate-500 mt-1">
              📞 {invoice.buyer.mobile}
            </p>
          )}
        </div>

        {/* Invoice meta */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Invoice Details
          </h2>
          {[
            ["Invoice No.", invoice.invoiceNumber],
            ["Invoice Date", fmtDate(invoice.invoiceDate)],
            ["Due Date", fmtDate(invoice.dueDate)],
            ["Invoice Type", invoice.invoiceType?.replace("_", " ")],
            [
              "Tax Type",
              invoice.taxType === "igst"
                ? "IGST (Inter-state)"
                : "CGST + SGST (Intra-state)",
            ],
            [
              "Tax Mode",
              invoice.taxMode === "inclusive"
                ? "GST Inclusive"
                : "GST Exclusive",
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between py-1.5 border-b border-slate-50 last:border-0"
            >
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-xs font-semibold text-slate-700 capitalize">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Items table ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700">Items / Products</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {[
                  "#",
                  "Item Name",
                  "HSN",
                  "Qty",
                  "Unit",
                  "Rate",
                  "Taxable Amt",
                  ...(isCgstSgst
                    ? ["CGST %", "CGST", "SGST %", "SGST"]
                    : ["IGST %", "IGST"]),
                  "Total",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoice.items.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {item.hsn || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase text-slate-500">
                    {item.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    ₹{fmt(item.rate)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    ₹{fmt(item.taxableAmount)}
                  </td>
                  {isCgstSgst ? (
                    <>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">
                        {item.cgstPercent}%
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        ₹{fmt(item.cgstAmount)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">
                        {item.sgstPercent}%
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        ₹{fmt(item.sgstAmount)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">
                        {item.igstPercent}%
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        ₹{fmt(item.igstAmount)}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-right font-semibold text-indigo-700">
                    ₹{fmt(item.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Totals footer */}
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td
                  colSpan={6}
                  className="px-4 py-3 text-xs font-bold text-slate-600 uppercase"
                >
                  Totals
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">
                  ₹{fmt(invoice.subTotal)}
                </td>
                {isCgstSgst ? (
                  <>
                    <td />
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      ₹{fmt(invoice.totalCgst)}
                    </td>
                    <td />
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      ₹{fmt(invoice.totalSgst)}
                    </td>
                  </>
                ) : (
                  <>
                    <td />
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      ₹{fmt(invoice.totalIgst)}
                    </td>
                  </>
                )}
                <td className="px-4 py-3 text-right font-bold text-indigo-700">
                  ₹{fmt(invoice.grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Amount summary ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Notes + Terms */}
        {(invoice.notes || invoice.terms) && (
          <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-3">
            {invoice.notes && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Notes
                </p>
                <p className="text-sm text-slate-600">{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Terms & Conditions
                </p>
                <p className="text-sm text-slate-600">{invoice.terms}</p>
              </div>
            )}
          </div>
        )}

        {/* Tax summary */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Amount Summary
          </h2>
          <div className="space-y-2">
            {[
              ["Taxable Amount", `₹${fmt(invoice.subTotal)}`],
              ...(isCgstSgst
                ? [
                    ["Add: CGST", `₹${fmt(invoice.totalCgst)}`],
                    ["Add: SGST", `₹${fmt(invoice.totalSgst)}`],
                  ]
                : [["Add: IGST", `₹${fmt(invoice.totalIgst)}`]]),
              ["Tax Amount: GST", `₹${fmt(invoice.totalTax)}`],
              ...(invoice.discountAmount > 0
                ? [["Less: Discount", `-₹${fmt(invoice.discountAmount)}`]]
                : []),
              ...(invoice.roundOff !== 0
                ? [["Round Off", `₹${fmt(invoice.roundOff)}`]]
                : []),
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between text-sm py-1 border-b border-slate-50"
              >
                <span className="text-slate-500">{label}</span>
                <span className="font-medium text-slate-700">{value}</span>
              </div>
            ))}

            {/* Grand total */}
            <div className="flex justify-between items-center pt-2 border-t-2 border-slate-200">
              <span className="font-bold text-slate-800">Grand Total</span>
              <span className="text-xl font-bold text-indigo-700">
                ₹{fmt(invoice.grandTotal)}
              </span>
            </div>

            {invoice.paidAmount > 0 && (
              <>
                <div className="flex justify-between text-sm text-green-700">
                  <span>Amount Paid</span>
                  <span className="font-semibold">
                    ₹{fmt(invoice.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-red-700">
                  <span>Balance Due</span>
                  <span className="font-semibold">
                    ₹{fmt(invoice.balanceAmount)}
                  </span>
                </div>
              </>
            )}

            {/* Amount in words */}
            {invoice.amountInWords && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-400 mb-1">Amount in words</p>
                <p className="text-xs font-medium text-slate-700 italic">
                  {invoice.amountInWords}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Payment history ───────────────────────────────────────────────────── */}
      {invoice.paymentHistory?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Payment History
            </h2>
            <span className="text-xs text-green-700 font-semibold bg-green-50 px-2 py-1 rounded-full">
              {invoice.paymentHistory.length} payment
              {invoice.paymentHistory.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {invoice.paymentHistory.map((payment, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 capitalize">
                      {payment.mode?.replace("_", " ")}
                    </p>
                    <p className="text-xs text-slate-400">
                      {fmtDate(payment.date)}
                      {payment.note && ` · ${payment.note}`}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-green-700">
                  +₹{fmt(payment.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Payment modal ─────────────────────────────────────────────────────── */}
      {showPayment && (
        <PaymentModal
          invoice={invoice}
          onClose={() => setShowPayment(false)}
          onSuccess={fetchInvoice}
        />
      )}
    </div>
  );
}
