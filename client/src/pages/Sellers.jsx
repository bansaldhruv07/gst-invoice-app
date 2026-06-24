import { useState, useEffect } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Plus, Search, Edit2, Trash2, X, Building2, MapPin, Phone, Mail, FileText } from "lucide-react";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Jammu and Kashmir","Ladakh","Chandigarh","Puducherry",
];

const EMPTY_FORM = { name:"", gstin:"", address:"", city:"", state:"", pincode:"", mobile:"", email:"" };

function SellerModal({ seller, onClose, onSave }) {
  const [form,    setForm]    = useState(seller || EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const isEdit = !!seller?._id;

  const handleChange = (e) => setForm({...form, [e.target.name]: e.target.value});

  const handleGstinChange = (e) => {
    const val = e.target.value.toUpperCase();
    setForm(p => ({...p, gstin: val}));
    if (val.length >= 2) {
      const STATE_CODES = {
        "07":"Delhi","09":"Uttar Pradesh","27":"Maharashtra","29":"Karnataka",
        "33":"Tamil Nadu","36":"Telangana","24":"Gujarat","06":"Haryana",
        "19":"West Bengal","08":"Rajasthan","23":"Madhya Pradesh","03":"Punjab",
      };
      const state = STATE_CODES[val.substring(0,2)];
      if (state) setForm(p => ({...p, gstin: val, state}));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Seller name required"); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/sellers/${seller._id}`, form);
        toast.success("Seller updated");
      } else {
        await api.post("/sellers", form);
        toast.success("Seller added");
      }
      onSave(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Seller" : "Add New Seller"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              GSTIN <span className="text-slate-400 font-normal">(auto-fills state)</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" name="gstin" value={form.gstin}
                onChange={handleGstinChange}
                placeholder="e.g. 07AABCU9603R1ZX"
                maxLength={15}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Business Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" name="name" value={form.name}
                onChange={handleChange} placeholder="e.g. R.K. Traders"
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <textarea name="address" value={form.address}
                onChange={handleChange} rows={2} placeholder="Street address..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <input type="text" name="city" value={form.city}
                onChange={handleChange} placeholder="e.g. Delhi"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label>
              <input type="text" name="pincode" value={form.pincode}
                onChange={handleChange} placeholder="110001" maxLength={6}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              State {form.gstin?.length>=2 && form.state && (
                <span className="text-xs text-indigo-600 ml-1">← auto from GSTIN</span>
              )}
            </label>
            <select name="state" value={form.state} onChange={handleChange}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Select state...</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="tel" name="mobile" value={form.mobile}
                  onChange={handleChange} placeholder="9876543210" maxLength={10}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="email" name="email" value={form.email}
                  onChange={handleChange} placeholder="seller@email.com"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
            >Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold"
            >
              {loading ? "Saving..." : isEdit ? "Update Seller" : "Add Seller"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Sellers() {
  const [sellers,       setSellers]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [showModal,     setShowModal]     = useState(false);
  const [editSeller,    setEditSeller]    = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchSellers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/sellers", { params: search ? { search } : {} });
      setSellers(data.sellers);
    } catch { toast.error("Failed to load sellers"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSellers(); }, [search]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this seller?")) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/sellers/${id}`);
      toast.success("Seller deleted");
      fetchSellers();
    } catch { toast.error("Failed to delete"); }
    finally { setDeleteLoading(false); }
  };

  return (
    <div className="space-y-6">

      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search sellers..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button onClick={() => { setEditSeller(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Seller
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">{sellers.length} Seller{sellers.length!==1?"s":""}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Seller Name","GSTIN","City / State","Mobile","Email","Actions"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? Array(4).fill(0).map((_,i) => (
                <tr key={i} className="animate-pulse">
                  {Array(6).fill(0).map((_,j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-full"/></td>
                  ))}
                </tr>
              )) : sellers.length===0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No sellers found</p>
                    <button onClick={() => { setEditSeller(null); setShowModal(true); }}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                    >+ Add Seller</button>
                  </td>
                </tr>
              ) : sellers.map((s) => (
                <tr key={s._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-indigo-600">{s.name?.charAt(0).toUpperCase()}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.gstin
                      ? <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded">{s.gstin}</span>
                      : <span className="text-xs text-slate-400">Unregistered</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-700">
                      {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{s.mobile || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{s.email || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditSeller(s); setShowModal(true); }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      ><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(s._id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      ><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <SellerModal
          seller={editSeller}
          onClose={() => { setShowModal(false); setEditSeller(null); }}
          onSave={fetchSellers}
        />
      )}
    </div>
  );
}