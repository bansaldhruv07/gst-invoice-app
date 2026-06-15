import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Plus, Search, Filter, Download, MoreVertical,
  TrendingUp, FileText, Clock, CheckCircle,
  ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";

// ─── Status badge component ───────────────────────────────────────────────────
// Matches GimBooks: red=unpaid, green=paid, yellow=partial, grey=cancelled
function StatusBadge({ status }) {
  const styles = {
    unpaid:    "bg-red-100 text-red-700 border border-red-200",
    partial:   "bg-yellow-100 text-yellow-700 border border-yellow-200",
    paid:      "bg-green-100 text-green-700 border border-green-200",
    cancelled: "bg-gray-100 text-gray-500 border border-gray-200",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${styles[status] || styles.unpaid}`}>
      {status}
    </span>
  );
}

// ─── Format currency in Indian style ─────────────────────────────────────────
function formatINR(amount) {
  return new Intl.NumberFormat("en-IN", {
    style:    "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

// ─── Format date ──────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
  });
}

export default function Dashboard() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [invoices,    setInvoices]    = useState([]);
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters
  const [search,    setSearch]    = useState("");
  const [status,    setStatus]    = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");

  // Pagination
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);

  // ── Fetch stats ────────────────────────────────────────────────────────────
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const { data } = await api.get("/invoices/stats");
      setStats(data.stats);
    } catch (err) {
      toast.error("Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  };

  // ── Fetch invoices with filters ────────────────────────────────────────────
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (search)    params.search    = search;
      if (status !== "all") params.status = status;
      if (startDate) params.startDate = startDate;
      if (endDate)   params.endDate   = endDate;

      const { data } = await api.get("/invoices", { params });
      setInvoices(data.invoices);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, startDate, endDate]);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, status, startDate, endDate]);

  // ── Quick status update from dropdown ─────────────────────────────────────
  const handleStatusChange = async (invoiceId, newStatus) => {
    try {
      await api.put(`/invoices/${invoiceId}/status`, { status: newStatus });
      toast.success(`Marked as ${newStatus}`);
      fetchInvoices();
      fetchStats();
    } catch {
      toast.error("Failed to update status");
    }
  };

  // ── Stats cards config ─────────────────────────────────────────────────────
  const statCards = stats
    ? [
        {
          label:   "Total Sales",
          value:   formatINR(stats.totalAmount),
          sub:     `${stats.totalInvoices} invoices`,
          icon:    TrendingUp,
          color:   "text-indigo-600",
          bg:      "bg-indigo-50",
          border:  "border-indigo-100",
        },
        {
          label:   "Unpaid",
          value:   formatINR(stats.totalBalance),
          sub:     `${stats.unpaidCount} invoices`,
          icon:    Clock,
          color:   "text-red-600",
          bg:      "bg-red-50",
          border:  "border-red-100",
        },
        {
          label:   "Paid",
          value:   formatINR(stats.totalPaid),
          sub:     `${stats.paidCount} invoices`,
          icon:    CheckCircle,
          color:   "text-green-600",
          bg:      "bg-green-50",
          border:  "border-green-100",
        },
        {
          label:   "Partially Paid",
          value:   `${stats.partialCount}`,
          sub:     "invoices pending",
          icon:    FileText,
          color:   "text-yellow-600",
          bg:      "bg-yellow-50",
          border:  "border-yellow-100",
        },
      ]
    : [];

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Invoice</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage all your GST invoices
          </p>
        </div>
        <button
          onClick={() => navigate("/invoices/create")}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Invoice
        </button>
      </div>

      {/* ── Stats cards — exactly like GimBooks top bar ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-24 mb-3" />
                <div className="h-7 bg-slate-100 rounded w-32 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-20" />
              </div>
            ))
          : statCards.map((card) => (
              <div
                key={card.label}
                className={`bg-white rounded-xl border ${card.border} p-4 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-slate-500">{card.label}</p>
                  <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
              </div>
            ))
        }
      </div>

      {/* ── Filters row ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex flex-wrap gap-3 items-center">

          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search buyer or invoice no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {["all", "unpaid", "partial", "paid", "cancelled"].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                  status === s
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-slate-400 text-sm">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => { fetchInvoices(); fetchStats(); }}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Invoice table ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">

        {/* Table header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            {total} Invoice{total !== 1 ? "s" : ""}
            {status !== "all" && ` · ${status}`}
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Invoice No.
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Date
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Buyer Name
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Due In
                </th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Amount
                </th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50">
              {loading ? (
                // Skeleton rows
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array(7).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                // Empty state
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No invoices found</p>
                    <p className="text-slate-300 text-sm mt-1">
                      {search || status !== "all"
                        ? "Try changing your filters"
                        : "Create your first invoice to get started"}
                    </p>
                    {!search && status === "all" && (
                      <button
                        onClick={() => navigate("/invoices/create")}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        + Create Invoice
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv._id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/invoices/${inv._id}`)}
                  >
                    {/* Invoice number */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-indigo-600">
                        {inv.invoiceNumber}
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {inv.invoiceType?.replace("_", " ")}
                      </p>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(inv.invoiceDate)}
                    </td>

                    {/* Buyer name */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">
                        {inv.buyer?.name || "—"}
                      </p>
                      {inv.buyer?.gstin && (
                        <p className="text-xs text-slate-400">
                          {inv.buyer.gstin}
                        </p>
                      )}
                    </td>

                    {/* Due in */}
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatINR(inv.grandTotal)}
                      </p>
                      {inv.balanceAmount > 0 && inv.status !== "paid" && (
                        <p className="text-xs text-red-500">
                          Due: {formatINR(inv.balanceAmount)}
                        </p>
                      )}
                    </td>

                    {/* Status badge with dropdown */}
                    <td
                      className="px-4 py-3 text-center"
                      onClick={(e) => e.stopPropagation()} // prevent row click
                    >
                      <div className="relative inline-block">
                        <select
                          value={inv.status}
                          onChange={(e) => handleStatusChange(inv._id, e.target.value)}
                          className="appearance-none cursor-pointer bg-transparent border-none outline-none text-xs font-semibold"
                          style={{ WebkitAppearance: "none" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="partial">Partial</option>
                          <option value="paid">Paid</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <StatusBadge status={inv.status} />
                      </div>
                    </td>

                    {/* Actions */}
                    <td
                      className="px-4 py-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1">

                        {/* Record Payment button — only for unpaid/partial */}
                        {(inv.status === "unpaid" || inv.status === "partial") && (
                          <button
                            onClick={() => navigate(`/invoices/${inv._id}`)}
                            className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors whitespace-nowrap"
                          >
                            Record Payment
                          </button>
                        )}

                        {/* Download — goes to detail page */}
                        <button
                          onClick={() => navigate(`/invoices/${inv._id}`)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View & Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* More options */}
                        <button
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="More options"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ──────────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page number buttons */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      pageNum === page
                        ? "bg-indigo-600 text-white"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}