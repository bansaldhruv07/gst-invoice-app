import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Plus, Search, Filter, Trash2, Edit2,
  ShoppingCart, TrendingDown, Clock,
  CheckCircle, ChevronLeft, ChevronRight,
  IndianRupee, RefreshCw, X,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
});
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", {
  day: "2-digit", month: "2-digit", year: "numeric",
}) : "—";

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    unpaid:    "bg-red-100 text-red-700 border border-red-200",
    partial:   "bg-yellow-100 text-yellow-700 border border-yellow-200",
    paid:      "bg-green-100 text-green-700 border border-green-200",
    cancelled: "bg-gray-100 text-gray-500 border border-gray-200",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}

// ─── Pay Modal ────────────────────────────────────────────────────────────────
function PayModal({ purchase, onClose, onSuccess }) {
  const [form, setForm] = useState({
    amount: purchase.balanceAmount || "",
    date:   new Date().toISOString().split("T")[0],
    mode:   "upi",
    note:   "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error("Enter valid amount"); return;
    }
    setLoading(true);
    try {
      await api.post(`/purchases/${purchase._id}/payment`, {
        amount: parseFloat(form.amount),
        date:   form.date,
        mode:   form.mode,
        note:   form.note,
      });
      toast.success("Payment recorded!");
      onSuccess(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed");
    } finally { setLoading(false); }
  };

  const MODES = ["cash","upi","bank_transfer","cheque","card","other"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Record Payment</h2>
            <p className="text-xs text-slate-500">Balance: {fmt(purchase.balanceAmount)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
              <input
                type="number" value={form.amount} min="0" step="0.01"
                onChange={(e) => setForm({...form, amount: e.target.value})}
                className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button"
                onClick={() => setForm({...form, amount: purchase.balanceAmount})}
                className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md"
              >
                Full ({fmt(purchase.balanceAmount)})
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input type="date" value={form.date}
              onChange={(e) => setForm({...form, date: e.target.value})}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Payment Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button key={m} type="button"
                  onClick={() => setForm({...form, mode: m})}
                  className={`py-2 text-xs font-semibold rounded-lg border capitalize transition-all ${
                    form.mode === m
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-green-300"
                  }`}
                >
                  {m.replace("_"," ")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
            <input type="text" value={form.note}
              onChange={(e) => setForm({...form, note: e.target.value})}
              placeholder="e.g. Cheque no. 123456"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
            >Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-semibold"
            >
              {loading ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Purchases Page ──────────────────────────────────────────────────────
export default function Purchases() {
  const navigate = useNavigate();

  const [purchases,   setPurchases]   = useState([]);
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [statsLoading,setStatsLoading]= useState(true);
  const [search,      setSearch]      = useState("");
  const [status,      setStatus]      = useState("all");
  const [startDate,   setStartDate]   = useState("");
  const [endDate,     setEndDate]     = useState("");
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [total,       setTotal]       = useState(0);
  const [payModal,    setPayModal]    = useState(null); // purchase object
  const [activeTab,   setActiveTab]   = useState("all"); // "all" | "purchase_bill"

  // ── Fetch stats ────────────────────────────────────────────────────────────
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const { data } = await api.get("/purchases/stats");
      setStats(data.stats);
    } catch { } finally { setStatsLoading(false); }
  };

  // ── Fetch purchases ────────────────────────────────────────────────────────
  const fetchPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (search)             params.search    = search;
      if (status !== "all")   params.status    = status;
      if (startDate)          params.startDate = startDate;
      if (endDate)            params.endDate   = endDate;
      const { data } = await api.get("/purchases", { params });
      setPurchases(data.purchases);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch { toast.error("Failed to load purchases"); }
    finally { setLoading(false); }
  }, [page, search, status, startDate, endDate]);

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);
  useEffect(() => { setPage(1); }, [search, status, startDate, endDate]);

  // ── Delete purchase ────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this purchase? This cannot be undone.")) return;
    try {
      await api.delete(`/purchases/${id}`);
      toast.success("Purchase deleted");
      fetchPurchases(); fetchStats();
    } catch { toast.error("Failed to delete"); }
  };

  // ── Status change ──────────────────────────────────────────────────────────
  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/purchases/${id}/status`, { status: newStatus });
      toast.success(`Marked as ${newStatus}`);
      fetchPurchases(); fetchStats();
    } catch { toast.error("Failed to update status"); }
  };

  // ── Stat cards ─────────────────────────────────────────────────────────────
  const statCards = stats ? [
    {
      label: "Total Purchases", value: fmt(stats.totalAmount),
      sub: `${stats.totalPurchases} purchases`,
      icon: ShoppingCart, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100",
    },
    {
      label: "Unpaid", value: fmt(stats.totalBalance),
      sub: `${stats.unpaidCount} pending`,
      icon: Clock, color: "text-red-600", bg: "bg-red-50", border: "border-red-100",
    },
    {
      label: "Paid", value: fmt(stats.totalPaid),
      sub: `${stats.paidCount} cleared`,
      icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", border: "border-green-100",
    },
    {
      label: "Partially Paid", value: `${stats.partialCount}`,
      sub: "purchases",
      icon: TrendingDown, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-100",
    },
  ] : [];

  return (
    <div className="space-y-6">

      {/* ── Stats cards ─────────────────────────────────────────────────────── */}
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
              <div key={card.label} className={`bg-white rounded-xl border ${card.border} p-4 hover:shadow-md transition-shadow`}>
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

      {/* ── Tabs (like GimBooks: All | Purchase Bill) ────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="flex border-b border-slate-100">
          {["all", "purchase_bill"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-semibold capitalize transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "all" ? "All" : "Purchase Bill"}
            </button>
          ))}
        </div>

        {/* ── Filters ────────────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search seller or purchase no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {["all","unpaid","partial","paid","cancelled"].map((s) => (
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
              <input type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-slate-400 text-sm">→</span>
              <input type="date" value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => { fetchPurchases(); fetchStats(); }}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Create Purchase button aligned to the right */}
            <button
              onClick={() => navigate("/purchases/create")}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm md:ml-auto"
            >
              <Plus className="w-4 h-4" />
              Create Purchase
            </button>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {[
                  "Purchase Invoice No",
                  "Purchase Type",
                  "Purchase Date",
                  "Seller Name",
                  "Amount (₹)",
                  "Status",
                  "Action",
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
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array(7).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No purchases found</p>
                    <p className="text-slate-300 text-sm mt-1">
                      {search || status !== "all"
                        ? "Try different filters"
                        : "Add your first purchase"}
                    </p>
                    {!search && status === "all" && (
                      <button
                        onClick={() => navigate("/purchases/create")}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                      >
                        + Create New
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                purchases.map((pur) => (
                  <tr
                    key={pur._id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    {/* Purchase No */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-indigo-600">
                        {pur.purchaseNumber}
                      </p>
                      {pur.sellerInvoiceNumber && (
                        <p className="text-xs text-slate-400">
                          Seller: {pur.sellerInvoiceNumber}
                        </p>
                      )}
                    </td>

                    {/* Purchase type */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded capitalize">
                        Created
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {fmtDate(pur.purchaseDate)}
                    </td>

                    {/* Seller */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">
                        {pur.seller?.name || "—"}
                      </p>
                      {pur.seller?.gstin && (
                        <p className="text-xs text-slate-400">{pur.seller.gstin}</p>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">
                        {pur.grandTotal?.toLocaleString("en-IN")}
                      </p>
                      {pur.balanceAmount > 0 && pur.status !== "paid" && (
                        <p className="text-xs text-red-500">
                          Due: ₹{pur.balanceAmount?.toLocaleString("en-IN")}
                        </p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <StatusBadge status={pur.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {/* Pay button */}
                        {(pur.status === "unpaid" || pur.status === "partial") && (
                          <button
                            onClick={() => setPayModal(pur)}
                            className="px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                          >
                            Pay
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          onClick={() => navigate(`/purchases/create?edit=${pur._id}`)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(pur._id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
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
            <p className="text-xs text-slate-500">Page {page} of {totalPages} · {total} total</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p-1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const num = Math.max(1, Math.min(page-2, totalPages-4)) + i;
                return (
                  <button key={num} onClick={() => setPage(num)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      num === page ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p+1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Pay Modal ───────────────────────────────────────────────────────── */}
      {payModal && (
        <PayModal
          purchase={payModal}
          onClose={() => setPayModal(null)}
          onSuccess={() => { fetchPurchases(); fetchStats(); }}
        />
      )}
    </div>
  );
}