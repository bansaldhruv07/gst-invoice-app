import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Search, Download, FileSpreadsheet, ChevronLeft, ChevronRight, FileText, ArrowDownLeft, Clock } from "lucide-react";
import { money, rupees, shortDate } from "../lib/format";
import { downloadCsv } from "../lib/csv";
import { downloadInvoicePdf } from "../lib/invoicePdf";
import { Spinner, EmptyState, Stats, statusStyle } from "../components/ui";

const STATUSES = ["all", "unpaid", "partial", "paid", "cancelled"];
const PAGE_SIZE = 15;

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", status: "all", startDate: "", endDate: "" });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [downloading, setDownloading] = useState("");
  const [exporting, setExporting] = useState(false);

  const filtered = filters.search || filters.status !== "all" || filters.startDate || filters.endDate;

  const params = useCallback(
    (extra) => {
      const result = { ...extra };
      if (filters.search) result.search = filters.search;
      if (filters.status !== "all") result.status = filters.status;
      if (filters.startDate) result.startDate = filters.startDate;
      if (filters.endDate) result.endDate = filters.endDate;
      return result;
    },
    [filters],
  );

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const fetchStats = useCallback(() => {
    api.get("/invoices/stats")
      .then(({ data }) => setStats(data.stats))
      .catch(() => toast.error("Could not load totals"));
  }, []);

  const fetchInvoices = useCallback(
    async (signal) => {
      setLoading(true);
      try {
        const { data } = await api.get("/invoices", {
          params: params({ page, limit: PAGE_SIZE }),
          signal,
        });
        setInvoices(data.invoices);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        setLoading(false);
      } catch {
        if (signal?.aborted) return;
        toast.error("Could not load invoices");
        setLoading(false);
      }
    },
    [params, page],
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Waits for typing to pause, and drops replies that are out of date
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchInvoices(controller.signal), 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fetchInvoices]);

  const changeStatus = async (id, status) => {
    try {
      const { data } = await api.put(`/invoices/${id}/status`, { status });
      toast.success(`Marked as ${data.invoice.status}`);
      fetchInvoices();
      fetchStats();
    } catch {
      toast.error("Could not update the status");
    }
  };

  const download = async (id) => {
    setDownloading(id);
    try {
      const { logoMissing } = await downloadInvoicePdf(id);
      if (logoMissing) toast.error("Your logo could not be loaded. Upload it again in Settings.");
    } catch (err) {
      console.error(err);
      toast.error("Could not create the PDF");
    } finally {
      setDownloading("");
    }
  };

  // Sales register for the accountant, using the current filters
  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await api.get("/invoices", { params: params({ page: 1, limit: 5000 }) });
      if (!data.invoices.length) {
        toast.error("There are no invoices to export");
        return;
      }
      downloadCsv(`sales-register-${new Date().toISOString().slice(0, 10)}.csv`, [
        ["Invoice No", "Invoice Date", "Type", "Buyer", "Buyer GSTIN", "Buyer State", "Taxable Value",
          "Discount", "CGST", "SGST", "IGST", "Total Tax", "Invoice Value", "Paid", "Balance", "Status"],
        ...data.invoices.map((i) => [
          i.invoiceNumber, i.invoiceDate?.slice(0, 10), i.invoiceType?.replace(/_/g, " "),
          i.buyer?.name, i.buyer?.gstin, i.buyer?.state, i.subTotal, i.discountAmount,
          i.totalCgst, i.totalSgst, i.totalIgst, i.totalTax, i.grandTotal, i.paidAmount,
          i.balanceAmount, i.status,
        ]),
      ]);
      if (data.total > data.invoices.length) {
        toast.error("Only the latest 5,000 invoices were exported. Narrow the dates for the rest.");
      }
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {stats && (
        <Stats
          items={[
            { label: "Billed", value: rupees(stats.totalAmount), icon: FileText },
            { label: "Received", value: rupees(stats.totalPaid), icon: ArrowDownLeft, tone: "green" },
            { label: "Outstanding", value: rupees(stats.totalBalance), icon: Clock, tone: "amber" },
          ]}
        />
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 items-center p-3 border-b border-slate-200">
          <div className="relative flex-1 min-w-[14rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Buyer or invoice number"
              aria-label="Search invoices"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              className="input pl-9"
            />
          </div>
          <select
            aria-label="Status"
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className="input w-auto capitalize"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>
            ))}
          </select>
          <input type="date" aria-label="From date" value={filters.startDate}
            onChange={(e) => setFilter("startDate", e.target.value)} className="input w-auto" />
          <span className="text-sm text-slate-500">to</span>
          <input type="date" aria-label="To date" value={filters.endDate}
            onChange={(e) => setFilter("endDate", e.target.value)} className="input w-auto" />
          <button onClick={exportCsv} disabled={exporting} className="btn-secondary md:ml-auto">
            <FileSpreadsheet className="w-4 h-4" strokeWidth={1.75} />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : invoices.length === 0 ? (
          <EmptyState
            title={filtered ? "No invoices match these filters" : "No invoices yet"}
            hint={filtered ? "Change the search, status or dates." : "Your invoices will be listed here."}
            action={!filtered && <Link to="/invoices/create" className="btn-primary">Create your first invoice</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Invoice</th>
                  <th className="th hidden md:table-cell">Date</th>
                  <th className="th">Buyer</th>
                  <th className="th hidden md:table-cell">Due</th>
                  <th className="th text-right">Amount</th>
                  <th className="th">Status</th>
                  <th className="th text-right">PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv._id}
                    onClick={() => navigate(`/invoices/${inv._id}`)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="td whitespace-nowrap">
                      <Link to={`/invoices/${inv._id}`} className="font-medium text-brand-700 hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="td whitespace-nowrap hidden md:table-cell">{shortDate(inv.invoiceDate)}</td>
                    <td className="td">
                      <span className="block font-medium">{inv.buyer?.name || "—"}</span>
                      {inv.buyer?.gstin && <span className="hidden sm:block text-xs text-slate-500">{inv.buyer.gstin}</span>}
                    </td>
                    <td className="td whitespace-nowrap hidden md:table-cell">{inv.dueDate ? shortDate(inv.dueDate) : "—"}</td>
                    <td className="td text-right whitespace-nowrap">
                      <span className="block font-medium">{money(inv.grandTotal)}</span>
                      {inv.balanceAmount > 0 && inv.status !== "cancelled" && (
                        <span className="block text-xs text-red-700">{money(inv.balanceAmount)} due</span>
                      )}
                    </td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <select
                        aria-label={`Status of ${inv.invoiceNumber}`}
                        value={inv.status}
                        onChange={(e) => changeStatus(inv._id, e.target.value)}
                        className={`badge pr-6 ${statusStyle(inv.status)}`}
                      >
                        {STATUSES.slice(1).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="td text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => download(inv._id)}
                        disabled={downloading === inv._id}
                        title="Download PDF"
                        aria-label={`Download ${inv.invoiceNumber} as PDF`}
                        className="btn-secondary btn-sm"
                      >
                        {downloading === inv._id ? <Spinner className="h-3.5 w-3.5" /> : <Download className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-500">
            <span>{total} invoice{total === 1 ? "" : "s"}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button aria-label="Previous page" disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)} className="btn-secondary btn-sm">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>Page {page} of {totalPages}</span>
                <button aria-label="Next page" disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)} className="btn-secondary btn-sm">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
