import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Plus, Search, Trash2, ChevronLeft, ChevronRight, ShoppingCart, Check, ArrowUpRight } from "lucide-react";
import { money, rupees, shortDate } from "../lib/format";
import PaymentModal from "../components/PaymentModal";
import { Spinner, EmptyState, StatusBadge, Stats } from "../components/ui";

const STATUSES = ["all", "unpaid", "partial", "paid", "cancelled"];
const PAGE_SIZE = 15;

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", status: "all", startDate: "", endDate: "" });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [paying, setPaying] = useState(null);

  const filtered = filters.search || filters.status !== "all" || filters.startDate || filters.endDate;

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const fetchStats = useCallback(() => {
    api.get("/purchases/stats")
      .then(({ data }) => setStats(data.stats))
      .catch(() => toast.error("Could not load totals"));
  }, []);

  const fetchPurchases = useCallback(
    async (signal) => {
      setLoading(true);
      const params = { page, limit: PAGE_SIZE };
      if (filters.search) params.search = filters.search;
      if (filters.status !== "all") params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      try {
        const { data } = await api.get("/purchases", { params, signal });
        setPurchases(data.purchases);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        setLoading(false);
      } catch {
        if (signal?.aborted) return;
        toast.error("Could not load purchases");
        setLoading(false);
      }
    },
    [filters, page],
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchPurchases(controller.signal), 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fetchPurchases]);

  const reload = () => {
    fetchPurchases();
    fetchStats();
  };

  const remove = async (purchase) => {
    if (!window.confirm(`Delete purchase ${purchase.purchaseNumber}? This cannot be undone.`)) return;
    try {
      await api.delete(`/purchases/${purchase._id}`);
      toast.success("Purchase deleted");
      reload();
    } catch {
      toast.error("Could not delete the purchase");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {stats && (
        <Stats
          items={[
            { label: "Purchased", value: rupees(stats.totalAmount), icon: ShoppingCart },
            { label: "Paid", value: rupees(stats.totalPaid), icon: Check, tone: "green" },
            { label: "To pay", value: rupees(stats.totalBalance), icon: ArrowUpRight, tone: "amber" },
          ]}
        />
      )}

      <div className="flex justify-end">
        <Link to="/purchases/create" className="btn-primary">
          <Plus className="w-4 h-4" /> New purchase
        </Link>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 items-center p-3 border-b border-slate-200">
          <div className="relative flex-1 min-w-[14rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="search" placeholder="Seller or purchase number" aria-label="Search purchases"
              value={filters.search} onChange={(e) => setFilter("search", e.target.value)} className="input pl-9" />
          </div>
          <select aria-label="Status" value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)} className="input w-auto capitalize">
            {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>)}
          </select>
          <input type="date" aria-label="From date" value={filters.startDate}
            onChange={(e) => setFilter("startDate", e.target.value)} className="input w-auto" />
          <span className="text-sm text-slate-500">to</span>
          <input type="date" aria-label="To date" value={filters.endDate}
            onChange={(e) => setFilter("endDate", e.target.value)} className="input w-auto" />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : purchases.length === 0 ? (
          <EmptyState
            title={filtered ? "No purchases match these filters" : "No purchases yet"}
            hint={filtered ? "Change the search, status or dates." : "Record supplier bills to track what you owe and the GST you paid."}
            action={!filtered && <Link to="/purchases/create" className="btn-primary">Record a purchase</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Purchase</th>
                  <th className="th">Date</th>
                  <th className="th">Seller</th>
                  <th className="th text-right">Amount</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="td whitespace-nowrap">
                      <span className="block font-medium">{p.purchaseNumber}</span>
                      {p.sellerInvoiceNumber && (
                        <span className="block text-xs text-slate-500">Seller bill {p.sellerInvoiceNumber}</span>
                      )}
                    </td>
                    <td className="td whitespace-nowrap">{shortDate(p.purchaseDate)}</td>
                    <td className="td">
                      <span className="block font-medium">{p.seller?.name || "—"}</span>
                      {p.seller?.gstin && <span className="block text-xs text-slate-500">{p.seller.gstin}</span>}
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      <span className="block font-medium">{money(p.grandTotal)}</span>
                      {p.balanceAmount > 0 && p.status !== "cancelled" && (
                        <span className="block text-xs text-red-700">{money(p.balanceAmount)} due</span>
                      )}
                    </td>
                    <td className="td"><StatusBadge status={p.status} /></td>
                    <td className="td">
                      <div className="flex justify-end gap-2">
                        {(p.status === "unpaid" || p.status === "partial") && (
                          <button onClick={() => setPaying(p)} className="btn-secondary btn-sm">Pay</button>
                        )}
                        <button onClick={() => remove(p)} title="Delete" aria-label={`Delete ${p.purchaseNumber}`}
                          className="btn btn-sm text-slate-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-500">
            <span>{total} purchase{total === 1 ? "" : "s"}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button aria-label="Previous page" disabled={page === 1}
                  onClick={() => setPage((n) => n - 1)} className="btn-secondary btn-sm">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>Page {page} of {totalPages}</span>
                <button aria-label="Next page" disabled={page >= totalPages}
                  onClick={() => setPage((n) => n + 1)} className="btn-secondary btn-sm">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {paying && (
        <PaymentModal
          title={`Pay ${paying.seller?.name || "seller"}`}
          endpoint={`/purchases/${paying._id}/payment`}
          balance={paying.balanceAmount}
          onClose={() => setPaying(null)}
          onSuccess={reload}
        />
      )}
    </div>
  );
}
