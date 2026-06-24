import { useState, useEffect } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  User,
  MapPin,
  Phone,
  Mail,
  FileText,
  Building2,
} from "lucide-react";

// ─── Indian states list for dropdown ─────────────────────────────────────────
const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Chandigarh",
  "Puducherry",
];

// ─── Empty form template ──────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: "",
  gstin: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  mobile: "",
  email: "",
};

// ─── Modal: Add / Edit Buyer ──────────────────────────────────────────────────
function BuyerModal({ buyer, onClose, onSave }) {
  const [form, setForm] = useState(buyer || EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const isEdit = !!buyer?._id;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Buyer name is required");
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/buyers/${buyer._id}`, form);
        toast.success("Buyer updated successfully");
      } else {
        await api.post("/buyers", form);
        toast.success("Buyer added successfully");
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save buyer");
    } finally {
      setLoading(false);
    }
  };

  return (
    // ── Backdrop ──────────────────────────────────────────────────────────────
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Buyer" : "Add New Buyer"}
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
          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Business / Buyer Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Jyoti Steel"
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* GSTIN */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              GSTIN
              <span className="text-slate-400 font-normal ml-1">
                (leave blank for unregistered)
              </span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="gstin"
                value={form.gstin}
                onChange={(e) =>
                  setForm({ ...form, gstin: e.target.value.toUpperCase() })
                }
                placeholder="e.g. 07AABCU9603R1ZX"
                maxLength={15}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {form.gstin && form.gstin.length === 15 && (
              <p className="text-xs text-green-600 mt-1">
                ✓ State code: {form.gstin.substring(0, 2)}
              </p>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Street address, building, area..."
                rows={2}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* City + Pincode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                City
              </label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="e.g. New Delhi"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Pincode
              </label>
              <input
                type="text"
                name="pincode"
                value={form.pincode}
                onChange={handleChange}
                placeholder="e.g. 110019"
                maxLength={6}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              State
            </label>
            <select
              name="state"
              value={form.state}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Select state...</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Mobile + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mobile
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  name="mobile"
                  value={form.mobile}
                  onChange={handleChange}
                  placeholder="9876543210"
                  maxLength={10}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="buyer@email.com"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
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
              {loading ? "Saving..." : isEdit ? "Update Buyer" : "Add Buyer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete confirmation modal ────────────────────────────────────────────────
function DeleteModal({ buyer, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 text-center mb-2">
          Delete Buyer?
        </h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-700">{buyer?.name}</span>?
          This action cannot be undone.
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

// ─── Main Buyers Page ─────────────────────────────────────────────────────────
export default function Buyers() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editBuyer, setEditBuyer] = useState(null);
  const [deleteBuyer, setDeleteBuyer] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch buyers ───────────────────────────────────────────────────────────
  const fetchBuyers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      const { data } = await api.get("/buyers", { params });
      setBuyers(data.buyers);
    } catch {
      toast.error("Failed to load buyers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyers();
  }, [search]);

  // ── Delete buyer ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/buyers/${deleteBuyer._id}`);
      toast.success("Buyer deleted");
      setDeleteBuyer(null);
      fetchBuyers();
    } catch {
      toast.error("Failed to delete buyer");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Open add modal ─────────────────────────────────────────────────────────
  const handleAdd = () => {
    setEditBuyer(null);
    setShowModal(true);
  };

  // ── Open edit modal ────────────────────────────────────────────────────────
  const handleEdit = (buyer) => {
    setEditBuyer(buyer);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">

      {/* ── Search bar ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by buyer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Buyer
          </button>
        </div>
      </div>

      {/* ── Buyers table ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">
            {buyers.length} Buyer{buyers.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {[
                  "Buyer Name",
                  "GSTIN",
                  "City / State",
                  "Mobile",
                  "Email",
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
                      {Array(6)
                        .fill(0)
                        .map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-slate-100 rounded w-full" />
                          </td>
                        ))}
                    </tr>
                  ))
              ) : buyers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <User className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">
                      No buyers found
                    </p>
                    <p className="text-slate-300 text-sm mt-1">
                      {search
                        ? "Try a different search"
                        : "Add your first buyer"}
                    </p>
                    {!search && (
                      <button
                        onClick={handleAdd}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        + Add Buyer
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                buyers.map((buyer) => (
                  <tr
                    key={buyer._id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    {/* Name + initials avatar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-indigo-600">
                            {buyer.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800">
                          {buyer.name}
                        </p>
                      </div>
                    </td>

                    {/* GSTIN */}
                    <td className="px-4 py-3">
                      {buyer.gstin ? (
                        <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded">
                          {buyer.gstin}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Unregistered
                        </span>
                      )}
                    </td>

                    {/* City / State */}
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">
                        {[buyer.city, buyer.state].filter(Boolean).join(", ") ||
                          "—"}
                      </p>
                      {buyer.pincode && (
                        <p className="text-xs text-slate-400">
                          {buyer.pincode}
                        </p>
                      )}
                    </td>

                    {/* Mobile */}
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {buyer.mobile || "—"}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {buyer.email || "—"}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(buyer)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteBuyer(buyer)}
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
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {showModal && (
        <BuyerModal
          buyer={editBuyer}
          onClose={() => {
            setShowModal(false);
            setEditBuyer(null);
          }}
          onSave={fetchBuyers}
        />
      )}

      {deleteBuyer && (
        <DeleteModal
          buyer={deleteBuyer}
          onClose={() => setDeleteBuyer(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
