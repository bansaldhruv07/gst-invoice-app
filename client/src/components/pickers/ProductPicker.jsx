// Choose what goes on the next line of a bill, or add a new product.
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Plus, Search, Pencil } from "lucide-react";
import api from "../../api/axios";
import Sheet from "../mobile/Sheet";
import ProductForm from "../forms/ProductForm";
import { Spinner } from "../ui";
import { money } from "../../lib/format";
import { useCan } from "../../context/AuthContext";

export default function ProductPicker({ onSelect, onClose, onLimit }) {
  const can = useCan();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(
    () =>
      api.get("/items", { params: query ? { search: query } : {} })
        .then(({ data }) => setItems(data.items))
        .catch(() => {
          setItems([]);
          toast.error("Could not load products");
        }),
    [query],
  );
  useEffect(() => {
    const timer = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const custom = query.trim();

  return (
    <>
      <Sheet
        wide
        title="Select Product / Service"
        onClose={onClose}
        action={can("addItem") && (
          <button type="button" onClick={() => setEditing({ name: custom })} className="btn-secondary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add New
          </button>
        )}
      >
        <div className="sticky top-0 z-10 bg-white p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, HSN code..." aria-label="Search products" className="input h-11 pl-10 rounded-full" />
          </div>
        </div>
        {custom && (
          <button type="button" onClick={() => onSelect({ name: custom })}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50">
            Use custom text name: &quot;{custom}&quot; <Plus className="w-4 h-4" />
          </button>
        )}
        {items === null ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No matching items found in your catalogue.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item._id} className="flex items-center gap-1 pr-2 hover:bg-brand-50 transition-colors">
                <button type="button" onClick={() => onSelect(item)} className="flex flex-1 min-w-0 items-center justify-between gap-3 px-4 py-3.5 text-left">
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-800 truncate">{item.name}</span>
                    <span className="block text-xs text-slate-500">HSN: {item.hsn || "—"} · Unit: {item.unit}</span>
                  </span>
                  <span className="text-right whitespace-nowrap">
                    <span className="block text-sm font-bold">{money(item.price)}</span>
                    <span className="block text-xs text-brand-700">{item.gstPercent}% GST{item.taxMode === "inclusive" ? " incl." : ""}</span>
                  </span>
                </button>
                {can("editItem") && (
                  <button type="button" onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`} className="p-2 rounded-lg text-slate-500 hover:bg-white">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      {editing && (
        <ProductForm product={editing} onClose={() => setEditing(null)} onLimit={onLimit}
          // A new product goes straight onto the bill; an edited one just refreshes
          onSaved={(item) => (editing._id ? load() : onSelect(item))} />
      )}
    </>
  );
}
