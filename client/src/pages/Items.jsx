import { useState, useEffect } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Package,
  Tag,
  Layers,
  IndianRupee,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const GST_RATES = [0, 5, 12, 18, 28];

const UNITS = [
  { value: "pcs", label: "PCS — Pieces" },
  { value: "kg", label: "KG — Kilogram" },
  { value: "ltr", label: "LTR — Litre" },
  { value: "mtr", label: "MTR — Metre" },
  { value: "box", label: "BOX — Box" },
  { value: "hrs", label: "HRS — Hours" },
  { value: "nos", label: "NOS — Numbers" },
  { value: "set", label: "SET — Set" },
  { value: "pair", label: "PAIR — Pair" },
  { value: "dozen", label: "DOZEN — Dozen" },
  { value: "other", label: "OTHER" },
];

const EMPTY_FORM = {
  name: "",
  hsn: "",
  unit: "pcs",
  price: "",
  gstPercent: 18,
  description: "",
};

// ─── GST rate badge ───────────────────────────────────────────────────────────
function GstBadge({ rate }) {
  const colors = {
    0: "bg-gray-100 text-gray-600",
    5: "bg-blue-100 text-blue-700",
    12: "bg-purple-100 text-purple-700",
    18: "bg-indigo-100 text-indigo-700",
    28: "bg-orange-100 text-orange-700",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[rate] || colors[18]}`}
    >
      {rate}% GST
    </span>
  );
}

// ─── Add / Edit Item Modal ────────────────────────────────────────────────────
function ItemModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const isEdit = !!item?._id;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  // Live preview: GST amount on entered price
  const price = parseFloat(form.price) || 0;
  const gstAmt = (price * form.gstPercent) / 100;
  const totalPrice = price + gstAmt;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (!form.price || parseFloat(form.price) < 0) {
      toast.error("Please enter a valid price");
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/items/${item._id}`, {
          ...form,
          price: parseFloat(form.price),
          gstPercent: parseInt(form.gstPercent),
        });
        toast.success("Item updated successfully");
      } else {
        await api.post("/items", {
          ...form,
          price: parseFloat(form.price),
          gstPercent: parseInt(form.gstPercent),
        });
        toast.success("Item added successfully");
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Item" : "Add New Item"}
            </h2>
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
          {/* Item Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Item / Service Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Web Development Service"
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* HSN Code */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              HSN / SAC Code
              <span className="text-slate-400 font-normal ml-1">
                (Harmonized System Nomenclature)
              </span>
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="hsn"
                value={form.hsn}
                onChange={handleChange}
                placeholder="e.g. 998314 for IT services"
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Unit + GST Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Unit
              </label>
              <div className="relative">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  name="unit"
                  value={form.unit}
                  onChange={handleChange}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                GST Rate
              </label>
              <div className="flex gap-1 flex-wrap">
                {GST_RATES.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setForm({ ...form, gstPercent: rate })}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      parseInt(form.gstPercent) === rate
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Base Price <span className="text-red-500">*</span>
              <span className="text-slate-400 font-normal ml-1">
                (excluding GST)
              </span>
            </label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Live GST preview */}
            {price > 0 && (
              <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <p className="text-slate-400">Base Price</p>
                    <p className="font-semibold text-slate-700">
                      ₹{price.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400">GST ({form.gstPercent}%)</p>
                    <p className="font-semibold text-indigo-600">
                      ₹{gstAmt.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400">Total</p>
                    <p className="font-semibold text-green-600">
                      ₹{totalPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
              <span className="text-slate-400 font-normal ml-1">
                (optional)
              </span>
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Brief description of this item or service..."
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Footer buttons */}
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
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {loading ? "Saving..." : isEdit ? "Update Item" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete confirmation modal ────────────────────────────────────────────────
function DeleteModal({ item, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 text-center mb-2">
          Delete Item?
        </h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-700">{item?.name}</span>?
          This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Items Page ──────────────────────────────────────────────────────────
export default function Items() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterGst, setFilterGst] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch items ────────────────────────────────────────────────────────────
  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (filterGst !== "all") params.gstPercent = filterGst;
      const { data } = await api.get("/items", { params });
      setItems(data.items);
    } catch {
      toast.error("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [search, filterGst]);

  // ── Delete item ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/items/${deleteItem._id}`);
      toast.success("Item deleted");
      setDeleteItem(null);
      fetchItems();
    } catch {
      toast.error("Failed to delete item");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAdd = () => {
    setEditItem(null);
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* GST rate filter pills */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setFilterGst("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterGst === "all"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              All GST
            </button>
            {GST_RATES.map((rate) => (
              <button
                key={rate}
                onClick={() => setFilterGst(String(rate))}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  filterGst === String(rate)
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {rate}%
              </button>
            ))}
          </div>

          {/* Add Item button aligned to the right */}
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm md:ml-auto"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* ── Items table ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">
            {items.length} Item{items.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {[
                  "Item Name",
                  "HSN / SAC",
                  "Unit",
                  "Base Price",
                  "GST Rate",
                  "Price + GST",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array(7)
                        .fill(0)
                        .map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-slate-100 rounded w-full" />
                          </td>
                        ))}
                    </tr>
                  ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No items found</p>
                    <p className="text-slate-300 text-sm mt-1">
                      {search || filterGst !== "all"
                        ? "Try different filters"
                        : "Add your first product or service"}
                    </p>
                    {!search && filterGst === "all" && (
                      <button
                        onClick={handleAdd}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        + Add Item
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const gstAmt = (item.price * item.gstPercent) / 100;
                  const totalPrice = item.price + gstAmt;

                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Name + description */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="text-xs text-slate-400 truncate max-w-40">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* HSN */}
                      <td className="px-4 py-3">
                        {item.hsn ? (
                          <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded">
                            {item.hsn}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold uppercase text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {item.unit}
                        </span>
                      </td>

                      {/* Base price */}
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                        ₹{item.price.toLocaleString("en-IN")}
                      </td>

                      {/* GST rate badge */}
                      <td className="px-4 py-3">
                        <GstBadge rate={item.gstPercent} />
                      </td>

                      {/* Price + GST */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-green-700">
                          ₹
                          {totalPrice.toLocaleString("en-IN", {
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-xs text-slate-400">
                          +₹{gstAmt.toFixed(2)} GST
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteItem(item)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {showModal && (
        <ItemModal
          item={editItem}
          onClose={() => {
            setShowModal(false);
            setEditItem(null);
          }}
          onSave={fetchItems}
        />
      )}

      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
