// Buyers and sellers share one screen: cards on phones, a table on wider screens.
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Plus, Search, Pencil, Trash2, Upload } from "lucide-react";
import ContactForm from "../components/forms/ContactForm";
import BuyerCard from "../components/BuyerCard";
import PageBar from "../components/mobile/PageBar";
import UpgradePrompt from "../components/UpgradePrompt";
import { Spinner, EmptyState } from "../components/ui";
import { money } from "../lib/format";
import { useCan } from "../context/AuthContext";

export default function Contacts({ kind }) {
  const can = useCan();
  const isBuyer = kind === "buyers";
  const noun = isBuyer ? "buyer" : "seller";
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ state: "", registration: "" });
  const [editing, setEditing] = useState(null);
  const [limit, setLimit] = useState("");

  const load = useCallback(
    () =>
      api.get(`/${kind}`, { params: search ? { search } : {} })
        .then(({ data }) => setList(data[kind]))
        .catch(() => {
          setList([]);
          toast.error(`Could not load ${kind}`);
        }),
    [kind, search],
  );

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/${kind}/${c._id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete");
    }
  };

  const states = [...new Set((list || []).map((c) => c.state).filter(Boolean))].sort();
  const shown = (list || []).filter(
    (c) =>
      (!filters.state || c.state === filters.state) &&
      (!filters.registration || (filters.registration === "registered") === Boolean(c.gstin)),
  );
  const filtering = filters.state || filters.registration;

  const canAdd = can(isBuyer ? "addBuyer" : "editSellers");
  const canEdit = can(isBuyer ? "editBuyer" : "editSellers");
  const canDelete = can(isBuyer ? "deleteBuyer" : "editSellers");

  return (
    <div className="max-w-6xl mx-auto">
      <PageBar title={isBuyer ? "Buyers" : "Sellers"} back="/dashboard">
        {canAdd && (
          <button onClick={() => setEditing({})} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add {noun}</button>
        )}
      </PageBar>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${kind} by name`} aria-label={`Search ${kind}`} className="input h-11 pl-10 pr-20 rounded-full" />
          <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-sm font-bold text-brand-700">
            Filters{filtering ? " •" : ""}
          </button>
        </div>
        {isBuyer && can("import") && (
          <Link to="/settings#import" className="btn-secondary hidden md:inline-flex h-11"><Upload className="w-4 h-4" /> Import</Link>
        )}
        {canAdd && (
          <button onClick={() => setEditing({})} className="btn-primary h-11 hidden lg:inline-flex"><Plus className="w-4 h-4" /> Add {noun}</button>
        )}
      </div>

      {showFilters && (
        <div className="card flex flex-wrap gap-2 p-3 mb-3 animate-rise">
          <select aria-label="State" value={filters.state} onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))} className="input w-auto">
            <option value="">All states</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select aria-label="GST registration" value={filters.registration} onChange={(e) => setFilters((f) => ({ ...f, registration: e.target.value }))} className="input w-auto">
            <option value="">Registered and unregistered</option>
            <option value="registered">With GSTIN</option>
            <option value="unregistered">Without GSTIN</option>
          </select>
          {filtering && (
            <button type="button" className="btn btn-sm text-brand-700" onClick={() => setFilters({ state: "", registration: "" })}>Clear</button>
          )}
        </div>
      )}

      {list === null ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : shown.length === 0 ? (
        <div className="card">
          <EmptyState title={search || filtering ? "No match" : `No ${kind} yet`}
            hint={search || filtering ? "Try another name or filter." : `Add your first ${noun} to start billing.`} />
        </div>
      ) : (
        <>
          <ul className="md:hidden space-y-3 stagger">
            {shown.map((c) => (
              <li key={c._id}>
                <BuyerCard party={c} onOpen={() => navigate(`/${kind}/${c._id}`)}
                  onEdit={canEdit ? () => setEditing(c) : undefined}
                  onDelete={canDelete ? () => remove(c) : undefined} />
              </li>
            ))}
          </ul>

          <section className="card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">GSTIN</th>
                    <th className="th">Address</th>
                    <th className="th">State</th>
                    <th className="th hidden lg:table-cell">Mobile</th>
                    <th className="th text-right hidden lg:table-cell">Opening balance</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c._id} onClick={() => navigate(`/${kind}/${c._id}`)} className="hover:bg-slate-50 cursor-pointer">
                      <td className="td">
                        <Link to={`/${kind}/${c._id}`} className="font-medium text-brand-700 hover:underline">{c.name}</Link>
                      </td>
                      <td className="td font-mono text-xs">{c.gstin || <span className="font-sans text-slate-500">Unregistered</span>}</td>
                      <td className="td max-w-[16rem]">{[c.address, c.city, c.pincode].filter(Boolean).join(", ") || "—"}</td>
                      <td className="td">{c.state || "—"}</td>
                      <td className="td hidden lg:table-cell">{c.mobile || "—"}</td>
                      <td className="td text-right whitespace-nowrap hidden lg:table-cell">{c.openingBalance ? money(c.openingBalance) : "—"}</td>
                      <td className="td" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <button onClick={() => setEditing(c)} title="Edit" aria-label={`Edit ${c.name}`} className="btn btn-sm text-slate-600 hover:bg-slate-100">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => remove(c)} title="Delete" aria-label={`Delete ${c.name}`} className="btn btn-sm text-slate-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
      {shown.length > 0 && (
        <p className="px-1 py-2.5 text-sm text-slate-500">{shown.length} {shown.length === 1 ? noun : kind}</p>
      )}

      {editing && (
        <ContactForm kind={kind} contact={editing} onClose={() => setEditing(null)} onSaved={load} onLimit={setLimit} />
      )}
      {limit && <UpgradePrompt message={limit} onClose={() => setLimit("")} />}
    </div>
  );
}
