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
      // ── Fetch supplier info from backend .env ──────────────────────────
      const { data: supplierData } = await api.get("/auth/supplier-info");
      const supplier = supplierData.supplier;

      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const inv = invoice;
      const buyer = inv.buyer;
      const W = 210;
      const m = 10;

      const DARK = [15, 23, 42];
      const INDIGO = [79, 70, 229];
      const LIGHT = [248, 250, 252];
      const GRAY = [100, 116, 139];
      const WHITE = [255, 255, 255];

      // ── Header band ──────────────────────────────────────────────────────
      doc.setFillColor(...DARK);
      doc.rect(0, 0, W, 38, "F");

      doc.setTextColor(...WHITE);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(supplier.name, m, 14);

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(
        inv.invoiceType === "tax_invoice" ? "TAX INVOICE" : "BILL OF SUPPLY",
        W - m,
        14,
        { align: "right" },
      );

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 210, 230);
      const supplierLine = [
        [supplier.address, supplier.city, supplier.state, supplier.pincode]
          .filter(Boolean)
          .join(", "),
        supplier.gstin ? `GSTIN: ${supplier.gstin}` : null,
        supplier.phone ? `Ph: ${supplier.phone}` : null,
      ]
        .filter(Boolean)
        .join("   |   ");
      doc.text(supplierLine, m, 22);

      doc.setTextColor(...WHITE);
      doc.setFontSize(8);
      doc.text(`Invoice No: ${inv.invoiceNumber}`, W - m, 22, {
        align: "right",
      });
      doc.text(`Date: ${fmtDate(inv.invoiceDate)}`, W - m, 27, {
        align: "right",
      });
      if (inv.dueDate) {
        doc.text(`Due: ${fmtDate(inv.dueDate)}`, W - m, 32, { align: "right" });
      }

      const statusColors = {
        unpaid: [239, 68, 68],
        partial: [234, 179, 8],
        paid: [34, 197, 94],
        cancelled: [148, 163, 184],
      };
      doc.setFillColor(...(statusColors[inv.status] || statusColors.unpaid));
      doc.roundedRect(m, 27, 22, 7, 2, 2, "F");
      doc.setTextColor(...WHITE);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(inv.status.toUpperCase(), m + 11, 31.8, { align: "center" });

      // ── Buyer boxes ──────────────────────────────────────────────────────
      let y = 44;
      doc.setFillColor(...LIGHT);
      doc.rect(m, y, (W - m * 2) / 2 - 2, 38, "F");
      doc.rect(W / 2 + 1, y, (W - m * 2) / 2 - 1, 38, "F");

      doc.setTextColor(...INDIGO);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text("BILLED TO", m + 3, y + 6);

      doc.setTextColor(...DARK);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(buyer?.name || "—", m + 3, y + 13);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      const buyerLines = [
        buyer?.address,
        [buyer?.city, buyer?.state, buyer?.pincode].filter(Boolean).join(", "),
        buyer?.gstin ? `GSTIN: ${buyer.gstin}` : "Unregistered",
        buyer?.mobile ? `Ph: ${buyer.mobile}` : null,
      ].filter(Boolean);
      buyerLines.forEach((line, i) => {
        doc.text(line, m + 3, y + 19 + i * 5);
      });

      doc.setTextColor(...INDIGO);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text("SHIP TO (CONSIGNEE)", W / 2 + 4, y + 6);
      doc.setTextColor(...DARK);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(buyer?.name || "—", W / 2 + 4, y + 13);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      buyerLines.forEach((line, i) => {
        doc.text(line, W / 2 + 4, y + 19 + i * 5);
      });

      // ── Items table ──────────────────────────────────────────────────────
      y += 43;
      const isCgstSgst = inv.taxType === "cgst_sgst";

      const tableColumns = isCgstSgst
        ? [
            { header: "Sr.", dataKey: "sr" },
            { header: "Item", dataKey: "name" },
            { header: "HSN", dataKey: "hsn" },
            { header: "Qty", dataKey: "qty" },
            { header: "Unit", dataKey: "unit" },
            { header: "Rate", dataKey: "rate" },
            { header: "Taxable", dataKey: "taxable" },
            { header: "CGST%", dataKey: "cgstP" },
            { header: "CGST", dataKey: "cgst" },
            { header: "SGST%", dataKey: "sgstP" },
            { header: "SGST", dataKey: "sgst" },
            { header: "Total", dataKey: "total" },
          ]
        : [
            { header: "Sr.", dataKey: "sr" },
            { header: "Item", dataKey: "name" },
            { header: "HSN", dataKey: "hsn" },
            { header: "Qty", dataKey: "qty" },
            { header: "Unit", dataKey: "unit" },
            { header: "Rate", dataKey: "rate" },
            { header: "Taxable", dataKey: "taxable" },
            { header: "IGST%", dataKey: "igstP" },
            { header: "IGST", dataKey: "igst" },
            { header: "Total", dataKey: "total" },
          ];

      const tableRows = inv.items.map((item, i) =>
        isCgstSgst
          ? {
              sr: i + 1,
              name: item.name,
              hsn: item.hsn || "—",
              qty: item.quantity,
              unit: item.unit?.toUpperCase(),
              rate: `${fmt(item.rate)}`,
              taxable: `${fmt(item.taxableAmount)}`,
              cgstP: `${item.cgstPercent}%`,
              cgst: `${fmt(item.cgstAmount)}`,
              sgstP: `${item.sgstPercent}%`,
              sgst: `${fmt(item.sgstAmount)}`,
              total: `${fmt(item.totalAmount)}`,
            }
          : {
              sr: i + 1,
              name: item.name,
              hsn: item.hsn || "—",
              qty: item.quantity,
              unit: item.unit?.toUpperCase(),
              rate: `${fmt(item.rate)}`,
              taxable: `${fmt(item.taxableAmount)}`,
              igstP: `${item.igstPercent}%`,
              igst: `${fmt(item.igstAmount)}`,
              total: `${fmt(item.totalAmount)}`,
            },
      );

      autoTable(doc, {
        startY: y,
        columns: tableColumns,
        body: tableRows,
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 2.5, textColor: DARK },
        headStyles: {
          fillColor: INDIGO,
          textColor: WHITE,
          fontStyle: "bold",
          fontSize: 7.5,
          halign: "center",
        },
        columnStyles: {
          sr: { halign: "center", cellWidth: 8 },
          name: { cellWidth: 32 },
          hsn: { halign: "center" },
          qty: { halign: "right" },
          rate: { halign: "right" },
          taxable: { halign: "right" },
          cgstP: { halign: "center" },
          cgst: { halign: "right" },
          sgstP: { halign: "center" },
          sgst: { halign: "right" },
          igstP: { halign: "center" },
          igst: { halign: "right" },
          total: { halign: "right", fontStyle: "bold" },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      // ── Totals section ───────────────────────────────────────────────────
      y = doc.lastAutoTable.finalY + 4;

      // Amount in words
      doc.setFillColor(...LIGHT);
      doc.rect(m, y, 110, 18, "F");
      doc.setTextColor(...GRAY);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL INVOICE AMOUNT IN WORDS", m + 3, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      const wordLines = doc.splitTextToSize(
        inv.amountInWords || `Rupees ${fmt(inv.grandTotal)} Only`,
        104,
      );
      doc.text(wordLines, m + 3, y + 11);

      // Tax summary (right side)
      const rx = 130;
      const rw = W - rx - m;
      let ry = y;

      const summaryRows = [
        ["Total Taxable Amount", `${fmt(inv.subTotal)}`],
        ...(isCgstSgst
          ? [
              ["Add: CGST", `${fmt(inv.totalCgst)}`],
              ["Add: SGST", `${fmt(inv.totalSgst)}`],
            ]
          : [["Add: IGST", `${fmt(inv.totalIgst)}`]]),
        ["Tax Amount: GST", `${fmt(inv.totalTax)}`],
        ...(inv.discountAmount > 0
          ? [["Less: Discount", `-${fmt(inv.discountAmount)}`]]
          : []),
        ...(inv.roundOff !== 0 ? [["Round Off", `${fmt(inv.roundOff)}`]] : []),
      ];

      summaryRows.forEach(([label, value]) => {
        doc.setFillColor(...LIGHT);
        doc.rect(rx, ry, rw, 6, "F");
        doc.setTextColor(...GRAY);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text(label, rx + 2, ry + 4.2);
        doc.setTextColor(...DARK);
        doc.text(value, rx + rw - 2, ry + 4.2, { align: "right" });
        ry += 6;
      });

      // Grand total
      doc.setFillColor(...INDIGO);
      doc.rect(rx, ry, rw, 9, "F");
      doc.setTextColor(...WHITE);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("GRAND TOTAL", rx + 2, ry + 6);
      doc.text(`Rs.${fmt(inv.grandTotal)}`, rx + rw - 2, ry + 6, {
        align: "right",
      });
      ry += 9;

      if (inv.paidAmount > 0) {
        doc.setFillColor(220, 252, 231);
        doc.rect(rx, ry, rw, 6, "F");
        doc.setTextColor(21, 128, 61);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text("Amount Paid", rx + 2, ry + 4.2);
        doc.text(`Rs.${fmt(inv.paidAmount)}`, rx + rw - 2, ry + 4.2, {
          align: "right",
        });
        ry += 6;

        doc.setFillColor(254, 226, 226);
        doc.rect(rx, ry, rw, 6, "F");
        doc.setTextColor(185, 28, 28);
        doc.text("Balance Due", rx + 2, ry + 4.2);
        doc.text(`Rs.${fmt(inv.balanceAmount)}`, rx + rw - 2, ry + 4.2, {
          align: "right",
        });
        ry += 6;
      }

      // ── Bank details ─────────────────────────────────────────────────────
      y = Math.max(y + 22, ry) + 5;
      doc.setFillColor(...LIGHT);
      doc.rect(m, y, 90, 30, "F");
      doc.setTextColor(...INDIGO);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text("BANK DETAILS", m + 3, y + 6);

      const bankLines = [
        ["Account Holder", supplier.name],
        ["Bank Name", supplier.bankName],
        ["Account No.", supplier.bankAccount],
        ["IFSC Code", supplier.bankIfsc],
        ["Branch", supplier.bankBranch],
      ].filter(([, v]) => v);

      doc.setFont("helvetica", "normal");
      bankLines.forEach(([key, val], i) => {
        doc.setTextColor(...GRAY);
        doc.text(`${key}:`, m + 3, y + 13 + i * 4.5);
        doc.setTextColor(...DARK);
        doc.text(val, m + 35, y + 13 + i * 4.5);
      });

      // ── Terms & signature ────────────────────────────────────────────────
      doc.setFillColor(...LIGHT);
      doc.rect(110, y, W - 110 - m, 30, "F");
      doc.setTextColor(...INDIGO);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text("TERMS & CONDITIONS", 113, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      const termLines = doc.splitTextToSize(
        inv.terms || "Payment due within 30 days.",
        W - 116 - m,
      );
      termLines.slice(0, 4).forEach((line, i) => {
        doc.text(line, 113, y + 13 + i * 4);
      });

      // Signature
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`For, ${supplier.name}`, W - m, y + 22, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text("Authorised Signatory", W - m, y + 28, { align: "right" });

      // ── Footer ───────────────────────────────────────────────────────────
      y += 34;
      doc.setFillColor(...DARK);
      doc.rect(0, y, W, 8, "F");
      doc.setTextColor(...WHITE);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Original for Recipient", m, y + 5);
      doc.text("This is a computer generated invoice", W / 2, y + 5, {
        align: "center",
      });
      doc.text(`Generated: ${fmtDate(new Date())}`, W - m, y + 5, {
        align: "right",
      });

      doc.save(`${inv.invoiceNumber}.pdf`);
      toast.success("PDF downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("PDF generation failed");
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
