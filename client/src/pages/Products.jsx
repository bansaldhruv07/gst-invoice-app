// The product list: simple rows on phones, a table on wider screens.
import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Plus, Search, Pencil, Trash2, Upload } from "lucide-react";
import ProductForm from "../components/forms/ProductForm";
import PageBar from "../components/mobile/PageBar";
import UpgradePrompt from "../components/UpgradePrompt";
import { Spinner, EmptyState } from "../components/ui";
import { money } from "../lib/format";
import { useCan } from "../context/AuthContext";

export default function Products() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [limit, setLimit] = useState("");

  const load = useCallback(
    () =>
      api.get("/items", { params: search ? { search } : {} })
        .then(({ data }) => setItems(data.items))
        .catch(() => {
          setItems([]);
          toast.error("Could not load products");
        }),
    [search],
  );

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.name}? Past invoices keep their lines.`)) return;
    try {
      await api.delete(`/items/${item._id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete");
    }
  };

  const editButton = (i) =>
    can("editItem") && (
      <button onClick={() => setEditing(i)} title="Edit" aria-label={`Edit ${i.name}`} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100">
        <Pencil className="w-4 h-4" />
      </button>
    );
  const deleteButton = (i) =>
    can("editItem") && (
      <button onClick={() => remove(i)} title="Delete" aria-label={`Delete ${i.name}`} className="p-2 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50">
        <Trash2 className="w-4 h-4" />
      </button>
    );

  return (
    <div className="max-w-6xl mx-auto">
      <PageBar title="Products" back="/dashboard">
        {can("addItem") && (
          <button onClick={() => setEditing({})} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add product</button>
        )}
      </PageBar>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="search" value={search} placeholder="Search products by name" aria-label="Search products"
            onChange={(e) => setParams(e.target.value ? { search: e.target.value } : {}, { replace: true })}
            className="input h-11 pl-10 rounded-full" />
        </div>
        {can("import") && (
          <Link to="/settings#import" className="btn-secondary hidden md:inline-flex h-11"><Upload className="w-4 h-4" /> Import</Link>
        )}
        {can("addItem") && (
          <button onClick={() => setEditing({})} className="btn-primary h-11 hidden lg:inline-flex"><Plus className="w-4 h-4" /> Add product</button>
        )}
      </div>

      {items === null ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState title={search ? "No match" : "No products yet"}
            hint={search ? "Try another name." : "Add what you sell to bill faster."} />
        </div>
      ) : (
        <>
          <ul className="md:hidden card divide-y divide-slate-100 overflow-hidden">
            {items.map((i) => (
              <li key={i._id} className="flex items-center gap-1 pl-4 pr-2">
                <button type="button" onClick={() => can("editItem") && setEditing(i)} className="flex-1 min-w-0 py-3.5 text-left">
                  <span className="block truncate text-[15px] text-slate-900">{i.name}</span>
                  <span className="block text-xs text-slate-500">
                    {money(i.price)} per {i.unit} · GST {i.gstPercent}%{i.category && ` · ${i.category}`}
                  </span>
                </button>
                {editButton(i)}
                {deleteButton(i)}
              </li>
            ))}
          </ul>

          <section className="card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Product</th>
                    <th className="th hidden lg:table-cell">Category</th>
                    <th className="th">HSN/SAC</th>
                    <th className="th">Unit</th>
                    <th className="th text-right hidden xl:table-cell">MRP</th>
                    <th className="th text-right">Selling price</th>
                    {can("stock") && <th className="th text-right hidden lg:table-cell">Purchase price</th>}
                    <th className="th text-right">GST</th>
                    <th className="th hidden lg:table-cell">Stock</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i._id} className="hover:bg-slate-50">
                      <td className="td font-medium">
                        {i.name}
                        {i.description && <span className="block text-xs font-normal text-slate-500">{i.description}</span>}
                      </td>
                      <td className="td hidden lg:table-cell">{i.category || "—"}</td>
                      <td className="td">{i.hsn || <span className="text-amber-700">Missing</span>}</td>
                      <td className="td uppercase text-xs">{i.unit}</td>
                      <td className="td text-right whitespace-nowrap hidden xl:table-cell">{i.mrp ? money(i.mrp) : "—"}</td>
                      <td className="td text-right whitespace-nowrap">
                        {money(i.price)}
                        {i.taxMode === "inclusive" && <span className="block text-xs text-slate-500">with GST</span>}
                      </td>
                      {can("stock") && (
                        <td className="td text-right whitespace-nowrap hidden lg:table-cell">{i.purchasePrice ? money(i.purchasePrice) : "—"}</td>
                      )}
                      <td className="td text-right">{i.gstPercent}%</td>
                      <td className="td hidden lg:table-cell">
                        {!i.trackStock ? <span className="text-slate-500">Off</span>
                          : can("stock") ? <Link to="/stock" className="text-brand-700 hover:underline">Tracked</Link> : "Tracked"}
                      </td>
                      <td className="td">
                        <div className="flex justify-end">{editButton(i)}{deleteButton(i)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {items?.length > 0 && (
        <p className="px-1 py-2.5 text-sm text-slate-500">{items.length} product{items.length === 1 ? "" : "s"}</p>
      )}

      {editing && <ProductForm product={editing} onClose={() => setEditing(null)} onSaved={load} onLimit={setLimit} />}
      {limit && <UpgradePrompt message={limit} onClose={() => setLimit("")} />}
    </div>
  );
}
