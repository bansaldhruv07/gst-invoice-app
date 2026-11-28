import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Search, Download, FileSpreadsheet, ChevronLeft, ChevronRight, FileText, ArrowDownLeft, Clock,
  SlidersHorizontal, MoreVertical, IndianRupee, Plus,
} from "lucide-react";
import { money, rupees, shortDate } from "../lib/format";
import { downloadCsv } from "../lib/csv";
import { downloadInvoicePdf } from "../lib/invoicePdf";
import { Spinner, EmptyState, Stats, StatusBadge, statusStyle } from "../components/ui";
import PageBar from "../components/mobile/PageBar";
import PaymentModal from "../components/PaymentModal";
import InvoiceMenu from "../components/invoice/InvoiceMenu";
import { useCan } from "../context/AuthContext";

const STATUSES = ["all", "unpaid", "partial", "paid", "cancelled"];
const PAGE_SIZE = 15;

// The quick filters above the list: [key, label, query]
const CHIPS = [
  ["all", "All", {}],
  ["unpaid", "Unpaid", { status: "unpaid" }],
  ["partial", "Partial", { status: "partial" }],
  ["paid", "Paid", { status: "paid" }],
  ["bill_of_supply", "Bill Of Supply", { type: "bill_of_supply" }],
  ["einvoice", "E-Invoices", { einvoice: "1" }],
  ["cancelled", "Cancelled", { status: "cancelled" }],
];

export default function Invoices() {
  const can = useCan();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", chip: "all", startDate: "", endDate: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [downloading, setDownloading] = useState("");
  const [exporting, setExporting] = useState(false);
  const [paying, setPaying] = useState(null);
  const [menu, setMenu] = useState(null);

  const filtered = filters.search || filters.chip !== "all" || filters.startDate || filters.endDate;

  const params = useCallback(
    (extra) => {
      const result = { ...extra, ...CHIPS.find(([key]) => key === filters.chip)[2] };
      if (filters.search) result.search = filters.search;
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

  const refresh = () => {
    fetchInvoices();
    fetchStats();
  };

  const changeStatus = async (id, status) => {
    try {
      const { data } = await api.put(`/invoices/${id}/status`, { status });
      toast.success(`Marked as ${data.invoice.status}`);
      refresh();
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

  // The menu needs the whole invoice and its credit notes
  const openMenu = async (id) => {
    try {
      const { data } = await api.get(`/invoices/${id}`);
      setMenu({ invoice: data.invoice, creditNotes: data.creditNotes || [] });
    } catch {
      toast.error("Could not open the invoice");
    }
  };
  // Brings an open menu up to date without reopening one that has been closed
  const refreshMenu = async () => {
    refresh();
    if (!menu) return;
    try {
      const { data } = await api.get(`/invoices/${menu.invoice._id}`);
      setMenu((open) => open && { invoice: data.invoice, creditNotes: data.creditNotes || [] });
    } catch {
      setMenu(null);
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
          "Discount", "CGST", "SGST", "IGST", "Total Tax", "CESS", "Invoice Value", "Paid", "Balance", "Status",
          "IRN", "E-Way Bill No"],
        ...data.invoices.map((i) => [
          i.invoiceNumber, i.invoiceDate?.slice(0, 10), i.invoiceType?.replace(/_/g, " "),
          i.buyer?.name, i.buyer?.gstin, i.buyer?.state, i.subTotal, i.discountAmount,
          i.totalCgst, i.totalSgst, i.totalIgst, i.totalTax, i.totalCess || 0, i.grandTotal, i.paidAmount,
          i.balanceAmount, i.status, i.irn || "", i.ewayBillNumber || "",
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

  const payable = (inv) => can("recordPayment") && inv.status !== "cancelled" && inv.balanceAmount > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* The app opens here, so phones get the main menu rather than a back arrow */}
      <PageBar title="Invoices" menu>
        {can("createInvoice") && (
          <Link to="/invoices/create" className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New invoice</Link>
        )}
      </PageBar>

      {stats && (
        <div className="hidden md:block">
          <Stats
            items={[
              { label: "Billed", value: rupees(stats.totalAmount), icon: FileText },
              { label: "Received", value: rupees(stats.totalPaid), icon: ArrowDownLeft, tone: "green" },
              { label: "Outstanding", value: rupees(stats.totalBalance), icon: Clock, tone: "amber" },
            ]}
          />
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="search" placeholder="Buyer or invoice number" aria-label="Search invoices" value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)} className="input h-11 pl-10" />
        </div>
        <button type="button" onClick={() => setShowFilters((v) => !v)} aria-label="Filters" aria-expanded={showFilters}
          className={`btn-secondary h-11 w-11 px-0 ${filters.startDate || filters.endDate ? "border-brand-400 text-brand-700" : ""}`}>
          <SlidersHorizontal className="w-4 h-4" />
        </button>
        <button onClick={exportCsv} disabled={exporting} className="btn-secondary h-11 hidden sm:inline-flex">
          <FileSpreadsheet className="w-4 h-4" strokeWidth={1.75} /> {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {showFilters && (
        <div className="card flex flex-wrap items-center gap-2 p-3 animate-rise">
          <input type="date" aria-label="From date" value={filters.startDate}
            onChange={(e) => setFilter("startDate", e.target.value)} className="input w-auto" />
          <span className="text-sm text-slate-500">to</span>
          <input type="date" aria-label="To date" value={filters.endDate}
            onChange={(e) => setFilter("endDate", e.target.value)} className="input w-auto" />
          {(filters.startDate || filters.endDate) && (
            <button type="button" className="btn btn-sm text-brand-700" onClick={() => setFilters((f) => ({ ...f, startDate: "", endDate: "" }))}>
              Clear dates
            </button>
          )}
          <button onClick={exportCsv} disabled={exporting} className="btn-secondary sm:hidden">
            <FileSpreadsheet className="w-4 h-4" /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      )}

      <div role="tablist" aria-label="Show" className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0 pb-1">
        {CHIPS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={filters.chip === key} onClick={() => setFilter("chip", key)}
            className={`flex-shrink-0 h-9 px-4 rounded-full text-sm font-bold transition ${
              filters.chip === key ? "bg-brand-600 text-white shadow-glow" : "bg-white text-slate-600 border border-slate-200 hover:border-brand-300"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : invoices.length === 0 ? (
        <div className="card">
          <EmptyState
            title={filtered ? "No invoices match these filters" : "No invoices yet"}
            hint={filtered ? "Change the search, status or dates." : "Your invoices will be listed here."}
            action={!filtered && can("createInvoice") && <Link to="/invoices/create" className="btn-primary">Create your first invoice</Link>}
          />
        </div>
      ) : (
        <>
          {/* Phones: one card for each invoice */}
          <ul className="md:hidden space-y-3 stagger">
            {invoices.map((inv) => (
              <li key={inv._id} className="card px-4 pt-3.5 pb-1">
                <button type="button" onClick={() => navigate(`/invoices/${inv._id}`)} className="block w-full text-left" aria-label={`Open ${inv.invoiceNumber}`}>
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-bold text-slate-900 min-w-0 break-words">{inv.buyer?.name || "—"}</span>
                    <span className="font-bold tabular whitespace-nowrap">{money(inv.grandTotal)}</span>
                  </span>
                  <span className="mt-2 flex items-end justify-between gap-3">
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{inv.invoiceNumber}</span>
                      <span className="block text-xs text-slate-500">{shortDate(inv.invoiceDate)}</span>
                    </span>
                    <StatusBadge status={inv.status} />
                  </span>
                </button>
                <div className="mt-3 flex items-center justify-between border-t border-slate-150 py-1">
                  {payable(inv) ? (
                    <button type="button" onClick={() => setPaying(inv)} className="flex items-center gap-2 py-2 text-sm font-bold text-brand-700">
                      <IndianRupee className="w-4 h-4" /> Record Payment
                    </button>
                  ) : (
                    <span className="py-2 text-sm text-slate-400">{inv.status === "cancelled" ? "Cancelled" : inv.balanceAmount > 0 ? `${money(inv.balanceAmount)} due` : "Settled"}</span>
                  )}
                  <button type="button" onClick={() => openMenu(inv._id)} aria-label={`More for ${inv.invoiceNumber}`} className="p-2 -mr-2 rounded-lg text-slate-600 hover:bg-slate-100">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <section className="card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Invoice</th>
                    <th className="th">Date</th>
                    <th className="th">Buyer</th>
                    <th className="th hidden lg:table-cell">Due</th>
                    <th className="th text-right">Amount</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv._id} onClick={() => navigate(`/invoices/${inv._id}`)} className="hover:bg-slate-50 cursor-pointer">
                      <td className="td whitespace-nowrap">
                        <Link to={`/invoices/${inv._id}`} className="font-medium text-brand-700 hover:underline">{inv.invoiceNumber}</Link>
                      </td>
                      <td className="td whitespace-nowrap">{shortDate(inv.invoiceDate)}</td>
                      <td className="td">
                        <span className="block font-medium">{inv.buyer?.name || "—"}</span>
                        {inv.buyer?.gstin && <span className="block text-xs text-slate-500">{inv.buyer.gstin}</span>}
                      </td>
                      <td className="td whitespace-nowrap hidden lg:table-cell">{inv.dueDate ? shortDate(inv.dueDate) : "—"}</td>
                      <td className="td text-right whitespace-nowrap">
                        <span className="block font-medium">{money(inv.grandTotal)}</span>
                        {inv.balanceAmount > 0 && inv.status !== "cancelled" && (
                          <span className="block text-xs text-red-700">{money(inv.balanceAmount)} due</span>
                        )}
                      </td>
                      <td className="td" onClick={(e) => e.stopPropagation()}>
                        <select aria-label={`Status of ${inv.invoiceNumber}`} value={inv.status}
                          onChange={(e) => changeStatus(inv._id, e.target.value)} disabled={!can("editInvoice")}
                          className={`badge pr-6 ${statusStyle(inv.status)}`}>
                          {STATUSES.slice(1).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="td" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {payable(inv) && (
                            <button onClick={() => setPaying(inv)} title="Record Payment" aria-label={`Record payment for ${inv.invoiceNumber}`} className="btn-secondary btn-sm">
                              <IndianRupee className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => download(inv._id)} disabled={downloading === inv._id} title="Download PDF"
                            aria-label={`Download ${inv.invoiceNumber} as PDF`} className="btn-secondary btn-sm">
                            {downloading === inv._id ? <Spinner className="h-3.5 w-3.5" /> : <Download className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => openMenu(inv._id)} title="More" aria-label={`More for ${inv.invoiceNumber}`} className="btn btn-sm text-slate-600 hover:bg-slate-100">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between px-1 text-sm text-slate-500">
          <span>{total} invoice{total === 1 ? "" : "s"}</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button aria-label="Previous page" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary btn-sm">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>Page {page} of {totalPages}</span>
              <button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary btn-sm">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {paying && (
        <PaymentModal title="Record payment" endpoint={`/invoices/${paying._id}/payment`} balance={paying.balanceAmount}
          onClose={() => setPaying(null)} onSuccess={refresh} />
      )}
      {menu && (
        <InvoiceMenu invoice={menu.invoice} creditNotes={menu.creditNotes} copies={["recipient"]}
          onClose={() => setMenu(null)} onChanged={refreshMenu}
          onDeleted={() => {
            setMenu(null);
            refresh();
          }} />
      )}
    </div>
  );
}
