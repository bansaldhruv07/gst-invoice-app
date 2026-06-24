import { useState, useEffect, useCallback } from "react";

import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Plus,
  Trash2,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Minus,
  CreditCard,
  PenTool,
  IndianRupee,
  FileText,
  User,
  Package,
  Calendar,
  Tag,
  AlertCircle,
  Truck,
} from "lucide-react";
import UpgradePrompt from "../components/UpgradePrompt";

// ─── Constants ────────────────────────────────────────────────────────────────
const GST_RATES = [0, 5, 12, 18, 28];
const UNITS = [
  "pcs",
  "kg",
  "ltr",
  "mtr",
  "box",
  "hrs",
  "nos",
  "set",
  "pair",
  "dozen",
  "other",
];
const EMPTY_ITEM = {
  name: "",
  hsn: "",
  unit: "pcs",
  quantity: 1,
  rate: "",
  gstPercent: 18,
  // calculated fields (computed live, not user-entered)
  taxableAmount: 0,
  cgstPercent: 0,
  cgstAmount: 0,
  sgstPercent: 0,
  sgstAmount: 0,
  igstPercent: 0,
  igstAmount: 0,
  totalAmount: 0,
};

// ─── Helper: format INR ───────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── GST calculation for a single line item ───────────────────────────────────
function calcItem(item, taxType, taxMode) {
  const qty = parseFloat(item.quantity) || 0;
  const rate = parseFloat(item.rate) || 0;
  const gstPercent = parseFloat(item.gstPercent) || 0;

  let taxableAmount, gstAmount;

  if (taxMode === "inclusive") {
    const gross = qty * rate;
    taxableAmount = gross / (1 + gstPercent / 100);
    gstAmount = gross - taxableAmount;
  } else {
    taxableAmount = qty * rate;
    gstAmount = (taxableAmount * gstPercent) / 100;
  }

  taxableAmount = Math.round(taxableAmount * 100) / 100;
  gstAmount = Math.round(gstAmount * 100) / 100;

  let cgstPercent = 0,
    cgstAmount = 0;
  let sgstPercent = 0,
    sgstAmount = 0;
  let igstPercent = 0,
    igstAmount = 0;

  if (taxType === "cgst_sgst") {
    cgstPercent = gstPercent / 2;
    sgstPercent = gstPercent / 2;
    cgstAmount = Math.round((gstAmount / 2) * 100) / 100;
    sgstAmount = Math.round((gstAmount / 2) * 100) / 100;
  } else {
    igstPercent = gstPercent;
    igstAmount = gstAmount;
  }

  return {
    ...item,
    taxableAmount,
    cgstPercent,
    cgstAmount,
    sgstPercent,
    sgstAmount,
    igstPercent,
    igstAmount,
    totalAmount: Math.round((taxableAmount + gstAmount) * 100) / 100,
  };
}

// ─── Indian States List for Quick Add ─────────────────────────────────────────
const STATES = [
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

// ─── Quick Add Buyer Modal Component ──────────────────────────────────────────
function QuickAddBuyerModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [gstin, setGstin] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Buyer name is required");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/buyers", {
        name,
        gstin,
        mobile,
        email,
        state,
        city,
        address,
        pincode,
      });
      toast.success("Buyer added successfully");
      onSave(data.buyer);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add buyer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <User className="w-4.5 h-4.5 text-indigo-600" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Quick Add Buyer</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Buyer Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bansal Steels" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">GSTIN</label>
              <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="e.g. 07AAAAA0000A1Z1" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Mobile / Phone</label>
              <input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="e.g. 9876543210" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">State</label>
              <select value={state} onChange={(e) => setState(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select State</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Delhi" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street Address" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Pincode</label>
              <input type="text" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="e.g. 110001" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. email@buyer.com" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">{loading ? "Saving..." : "Save Buyer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Quick Add Item Modal Component ───────────────────────────────────────────
function QuickAddItemModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [gstPercent, setGstPercent] = useState("18");
  const [unit, setUnit] = useState("pcs");
  const [hsn, setHsn] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (!price || parseFloat(price) <= 0) {
      toast.error("Valid item price is required");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/items", {
        name,
        price: parseFloat(price),
        gstPercent: parseInt(gstPercent),
        unit,
        hsn,
      });
      toast.success("Item added successfully");
      onSave(data.item);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Package className="w-4.5 h-4.5 text-indigo-600" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Quick Add Item</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Item Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. putty" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Base Price (INR) *</label>
              <input type="number" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize">
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">GST Rate (%)</label>
              <select value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">HSN / SAC Code</label>
              <input type="text" value={hsn} onChange={(e) => setHsn(e.target.value)} placeholder="e.g. 3214" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">{loading ? "Saving..." : "Save Item"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Buyer search dropdown ────────────────────────────────────────────────────
function BuyerSelector({ selected, onSelect }) {
  const [query, setQuery] = useState("");
  const [buyers, setBuyers] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const { data } = await api.get("/buyers", {
        params: q ? { search: q } : {},
      });
      setBuyers(data.buyers);
    } catch {
      toast.error("Failed to load buyers");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load buyers when dropdown opens
  useEffect(() => {
    if (open) search(query);
  }, [open, query, search]);

  const handleSelect = (buyer) => {
    onSelect(buyer);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative">
      {/* Selected buyer display */}
      {selected ? (
        <div className="flex items-center justify-between p-3 border border-indigo-200 bg-indigo-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {selected.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {selected.name}
              </p>
              <p className="text-xs text-slate-500">
                {selected.gstin
                  ? `GSTIN: ${selected.gstin}`
                  : "Unregistered Buyer"}
                {selected.city && ` · ${selected.city}`}
                {selected.state && `, ${selected.state}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Trigger button */
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 p-3 border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-lg text-slate-400 hover:text-indigo-600 transition-all group"
        >
          <User className="w-5 h-5" />
          <span className="text-sm">Click to select a buyer...</span>
          <ChevronDown className="w-4 h-4 ml-auto" />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden">
          {/* Search input */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search buyer by name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Buyer list */}
          <div className="max-h-52 overflow-y-auto font-sans">
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-400">
                Loading...
              </div>
            ) : buyers.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">
                No buyers found.
              </div>
            ) : (
              buyers.map((b) => (
                <button
                  key={b._id}
                  type="button"
                  onClick={() => handleSelect(b)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-indigo-600">
                      {b.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {b.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {b.gstin || "Unregistered"}
                      {b.state && ` · ${b.state}`}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Close Button */}
          <div className="p-2 border-t border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Item row selector pop-up modal ───────────────────────────────────────────
function ItemNameCell({ value, onSelect }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const { data } = await api.get("/items", {
        params: q ? { search: q } : {},
      });
      setItems(data.items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      search(query);
    }
  }, [open, query, search]);

  const handleSelect = (item) => {
    onSelect(item);
    setOpen(false);
    setQuery("");
  };

  const handleUseCustom = () => {
    if (query.trim()) {
      onSelect({ name: query.trim() });
    }
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="font-sans">
      <div className="relative flex items-center">
        <input
          type="text"
          value={value || ""}
          readOnly
          onClick={() => {
            setQuery(value || "");
            setOpen(true);
          }}
          placeholder="Click to select product..."
          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all font-medium text-slate-800 pr-7"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <Search className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-150 overflow-hidden flex flex-col max-h-[85vh] animate-scaleIn">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-600" />
                Select Product / Service
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-150 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input inside Popup */}
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, HSN code..."
                  autoFocus
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50 bg-white min-h-[200px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-8 text-slate-400 text-xs gap-2">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p>Searching catalogue...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <p className="mb-4">No matching items found in your catalogue.</p>
                  {query.trim() && (
                    <button
                      type="button"
                      onClick={handleUseCustom}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg transition-colors cursor-pointer border border-indigo-150"
                    >
                      Use Custom Name: &quot;{query}&quot;
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {query.trim() && (
                    <button
                      type="button"
                      onClick={handleUseCustom}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-indigo-50/50 transition-colors text-left border-b border-slate-100"
                    >
                      <span className="text-xs text-indigo-600 font-semibold italic">
                        Use custom text name: &quot;{query}&quot;
                      </span>
                      <Plus className="w-4 h-4 text-indigo-600" />
                    </button>
                  )}
                  {items.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          HSN: {item.hsn || "—"} · Unit: {item.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-800">
                          ₹{item.price}
                        </p>
                        <p className="text-xs text-indigo-600 font-medium mt-0.5">
                          {item.gstPercent}% GST
                        </p>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main CreateInvoice Page ──────────────────────────────────────────────────
export default function CreateInvoice() {
  const navigate = useNavigate();
  const [upgradePrompt, setUpgradePrompt] = useState(null);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [buyer, setBuyer] = useState(null);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [dueDate, setDueDate] = useState("");
  const [invoiceType, setInvoiceType] = useState("tax_invoice");
  const [taxMode, setTaxMode] = useState("exclusive");
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Payment due within 30 days.");
  const [loading, setLoading] = useState(false);
  const [supplierStateCode, setSupplierStateCode] = useState("07");
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);

  // ── Optional Details States ──
  const [transportMode, setTransportMode] = useState("none");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [lrNumber, setLrNumber] = useState("");
  const [lrDate, setLrDate] = useState("");
  const [dateOfSupply, setDateOfSupply] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [transporterId, setTransporterId] = useState("");
  const [supplyType, setSupplyType] = useState("inter_state");

  const [showTransportDetails, setShowTransportDetails] = useState(false);
  const [showTransporterFields, setShowTransporterFields] = useState(false);

  const [printCopies, setPrintCopies] = useState(["recipient", "transporter", "supplier"]);

  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankHolderName, setBankHolderName] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankBranch, setBankBranch] = useState("");

  const [signatureUrl, setSignatureUrl] = useState("");
  const [supplier, setSupplier] = useState(null);

  // Supplier details override states (editable for the bill only)
  const [supplierName, setSupplierName] = useState("");
  const [supplierGstin, setSupplierGstin] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierCity, setSupplierCity] = useState("");
  const [supplierState, setSupplierState] = useState("");
  const [supplierPincode, setSupplierPincode] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [editSupplier, setEditSupplier] = useState(false);

  useEffect(() => {
    const fetchSupplierInfo = async () => {
      try {
        const { data } = await api.get("/auth/supplier-info");
        if (data && data.supplier) {
          const S = data.supplier;
          setSupplier(S);
          setSupplierStateCode(S.stateCode || "07");
          setBankName(S.bankName || "");
          setBankAccount(S.bankAccount || "");
          setBankHolderName(S.name || "");
          setBankIfsc(S.bankIfsc || "");
          setBankBranch(S.bankBranch || "");
          
          setSupplierName(S.name || "");
          setSupplierGstin(S.gstin || "");
          setSupplierAddress(S.address || "");
          setSupplierCity(S.city || "");
          setSupplierState(S.state || "");
          setSupplierPincode(S.pincode || "");
          setSupplierPhone(S.phone || "");
          setSupplierEmail(S.email || "");
        }
      } catch (err) {
        console.error("Failed to load supplier state code:", err);
      }
    };
    fetchSupplierInfo();
  }, []);

  // ── Derive tax type from buyer state vs supplier state ─────────────────────
  const taxType =
    buyer?.stateCode && buyer.stateCode !== supplierStateCode
      ? "igst"
      : "cgst_sgst";

  // ── Recalculate all items whenever inputs change ───────────────────────────
  const calcItems = items.map((item) => calcItem(item, taxType, taxMode));

  // ── Totals ─────────────────────────────────────────────────────────────────
  const subTotal = calcItems.reduce((s, i) => s + i.taxableAmount, 0);
  const totalCgst = calcItems.reduce((s, i) => s + i.cgstAmount, 0);
  const totalSgst = calcItems.reduce((s, i) => s + i.sgstAmount, 0);
  const totalIgst = calcItems.reduce((s, i) => s + i.igstAmount, 0);
  const totalTax = totalCgst + totalSgst + totalIgst;

  const discountAmount =
    discountType === "percent"
      ? (subTotal * parseFloat(discountValue || 0)) / 100
      : parseFloat(discountValue || 0);

  const totalAmount = subTotal - discountAmount + totalTax;
  const grandTotal = Math.round(totalAmount);
  const roundOff = Math.round((grandTotal - totalAmount) * 100) / 100;

  // ── Item row handlers ──────────────────────────────────────────────────────
  const addItemRow = () => setItems([...items, { ...EMPTY_ITEM }]);

  const removeItemRow = (idx) => {
    if (items.length === 1) {
      setItems([{ ...EMPTY_ITEM }]);
      return;
    }
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, value) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  // When user selects item from catalogue, fill all fields
  const selectItemFromCatalogue = (idx, catalogueItem) => {
    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      name: catalogueItem.name || updated[idx].name,
      hsn: catalogueItem.hsn || updated[idx].hsn || "",
      unit: catalogueItem.unit || updated[idx].unit || "pcs",
      rate: catalogueItem.price || updated[idx].rate || "",
      gstPercent:
        catalogueItem.gstPercent !== undefined
          ? catalogueItem.gstPercent
          : updated[idx].gstPercent,
    };
    setItems(updated);
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureUrl(reader.result); // Base64 Data URL
      };
      reader.readAsDataURL(file);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!buyer) {
      toast.error("Please select a buyer");
      return;
    }
    const validItems = items.filter(
      (i) => i.name && parseFloat(i.rate) > 0 && parseFloat(i.quantity) > 0,
    );
    if (validItems.length === 0) {
      toast.error("Add at least one item with name, quantity and rate");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/invoices", {
        buyerId: buyer._id,
        invoiceDate,
        dueDate: dueDate || null,
        invoiceType,
        taxMode,
        items: validItems.map((i) => ({
          name: i.name,
          hsn: i.hsn || "",
          unit: i.unit || "pcs",
          quantity: parseFloat(i.quantity),
          rate: parseFloat(i.rate),
          gstPercent: parseFloat(i.gstPercent),
        })),
        discountType,
        discountValue: parseFloat(discountValue || 0),
        notes,
        terms,
        transportMode,
        vehicleNumber,
        lrNumber,
        lrDate: lrDate || null,
        dateOfSupply: dateOfSupply || null,
        placeOfSupply,
        transporterName,
        transporterId,
        bankDetailsOverride: {
          bankName,
          bankAccount,
          bankIfsc,
          bankBranch,
          bankHolderName,
        },
        signatureUrl,
        printCopies,
        supplierName,
        supplierGstin,
        supplierAddress,
        supplierCity,
        supplierState,
        supplierPincode,
        supplierPhone,
        supplierEmail,
        supplierStateCode,
      });

      toast.success(`Invoice ${data.invoice.invoiceNumber} created!`);
      navigate(`/invoices/${data.invoice._id}`);
    } catch (err) {
      if (err.response?.data?.upgrade) {
        setUpgradePrompt(err.response.data.message);
      } else {
        toast.error(err.response?.data?.message || "Failed to create invoice");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Tax type label ─────────────────────────────────────────────────────────
  const taxLabel = taxType === "igst" ? "IGST" : "CGST + SGST";

  return (
    <div className="max-w-[1360px] mx-auto space-y-6 pb-10 px-4">
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          {loading ? "Creating..." : "Submit Invoice"}
        </button>
      </div>

      {/* ── Invoice settings row ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Invoice Config (Invoice Type & Tax Mode, Invoice Date & Due Date) */}
          <div className="space-y-4">
            {/* Row 1: Invoice Type & Tax Mode */}
            <div className="grid grid-cols-2 gap-4">
              {/* Invoice type toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Invoice Type
                </label>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {[
                    { value: "tax_invoice", label: "Tax Invoice" },
                    { value: "bill_of_supply", label: "Bill of Supply" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setInvoiceType(opt.value)}
                      className={`flex-1 py-2 text-xs font-medium transition-all ${
                        invoiceType === opt.value
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tax mode toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Tax Mode
                </label>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {[
                    { value: "exclusive", label: "Excl. GST" },
                    { value: "inclusive", label: "Incl. GST" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTaxMode(opt.value)}
                      className={`flex-1 py-2 text-xs font-medium transition-all ${
                        taxMode === opt.value
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Invoice Date & Due Date */}
            <div className="grid grid-cols-2 gap-4">
              {/* Invoice date */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Invoice Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Due date */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Due Date{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Editable Supplier Details (for this bill only) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Seller Details (Bill Only)
              </label>
              <button
                type="button"
                onClick={() => setEditSupplier(!editSupplier)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                {editSupplier ? "Done" : "Edit Details"}
              </button>
            </div>

            {editSupplier ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-400">Business Name</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400">GSTIN</label>
                  <input
                    type="text"
                    value={supplierGstin}
                    onChange={(e) => setSupplierGstin(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400">Phone</label>
                  <input
                    type="text"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-400">Address</label>
                  <input
                    type="text"
                    value={supplierAddress}
                    onChange={(e) => setSupplierAddress(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400">City</label>
                  <input
                    type="text"
                    value={supplierCity}
                    onChange={(e) => setSupplierCity(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400">State</label>
                  <input
                    type="text"
                    value={supplierState}
                    onChange={(e) => setSupplierState(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400">Pincode</label>
                  <input
                    type="text"
                    value={supplierPincode}
                    onChange={(e) => setSupplierPincode(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400">State Code</label>
                  <input
                    type="text"
                    value={supplierStateCode}
                    onChange={(e) => {
                      setSupplierStateCode(e.target.value);
                    }}
                    className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">{supplierName || "—"}</p>
                <p>{supplierAddress || "—"}, {supplierCity || "—"}, {supplierState || "—"} - {supplierPincode || "—"}</p>
                <p>
                  <span className="font-semibold text-slate-400">GSTIN:</span> {supplierGstin || "Unregistered"} |{" "}
                  <span className="font-semibold text-slate-400">State Code:</span> {supplierStateCode || "—"}
                </p>
                {supplierPhone && (
                  <p>
                    <span className="font-semibold text-slate-400">Phone:</span> {supplierPhone}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Buyer Details ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            Buyer Details
          </h2>

          <div className="flex items-center gap-3">
            {/* Tax type indicator */}
            {buyer && (
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  taxType === "igst"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {taxLabel} applies
                {taxType === "igst" ? " (inter-state)" : " (intra-state)"}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowBuyerModal(true)}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Quick Add Buyer
            </button>
          </div>
        </div>
        <BuyerSelector selected={buyer} onSelect={setBuyer} />
      </div>

      {/* ── Products Section ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            Products / Services
          </h2>
          <button
            type="button"
            onClick={() => setShowItemModal(true)}
            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Quick Add Item
          </button>
        </div>

        {/* ── Items table ───────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-center text-xs font-semibold text-slate-500 px-2 py-3 w-8">
                  #
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 px-2 py-3 min-w-[150px]">
                  Item Name
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1.5 py-3 w-20">
                  HSN/SAC
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1.5 py-3 w-20">
                  Unit
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1.5 py-3 w-24">
                  Qty
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1.5 py-3 w-24">
                  Rate (₹)
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1.5 py-3 w-14">
                  GST %
                </th>
                <th className="text-right text-xs font-semibold text-slate-500 px-2 py-3 w-24">
                  Taxable Amt
                </th>
                {taxType === "cgst_sgst" ? (
                  <>
                    <th className="text-right text-xs font-semibold text-slate-500 px-1.5 py-3 w-20">
                      CGST
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 px-1.5 py-3 w-20">
                      SGST
                    </th>
                  </>
                ) : (
                  <th className="text-right text-xs font-semibold text-slate-500 px-1.5 py-3 w-20">
                    IGST
                  </th>
                )}
                <th className="text-right text-xs font-semibold text-slate-500 px-2 py-3 w-28">
                  Total
                </th>
                <th className="w-8" />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50">
              {items.map((item, idx) => {
                const calc = calcItems[idx];
                return (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    {/* # */}
                    <td className="px-2 py-3 text-sm text-slate-400 text-center">
                      {idx + 1}
                    </td>

                    {/* Item name with catalogue selector */}
                    <td className="px-2 py-3">
                      <ItemNameCell
                        value={item.name}
                        onSelect={(selected) =>
                          selectItemFromCatalogue(idx, selected)
                        }
                      />
                    </td>

                    {/* HSN */}
                    <td className="px-1.5 py-3">
                      <input
                        type="text"
                        value={item.hsn}
                        onChange={(e) => updateItem(idx, "hsn", e.target.value)}
                        placeholder="HSN"
                        className="w-full px-1.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </td>

                    {/* Unit */}
                    <td className="px-1.5 py-3">
                      <select
                        value={item.unit}
                        onChange={(e) =>
                          updateItem(idx, "unit", e.target.value)
                        }
                        className="w-full pl-1.5 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white uppercase font-medium"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Quantity */}
                    <td className="px-1.5 py-3">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(idx, "quantity", e.target.value)
                        }
                        min="0"
                        step="1"
                        className="w-full px-1.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                      />
                    </td>

                    {/* Rate */}
                    <td className="px-1.5 py-3">
                      <div className="relative">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                          ₹
                        </span>
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) =>
                            updateItem(idx, "rate", e.target.value)
                          }
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="w-full pl-4 pr-1 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                        />
                      </div>
                    </td>

                    {/* GST % — clickable buttons */}
                    <td className="px-1.5 py-3">
                      <select
                        value={item.gstPercent}
                        onChange={(e) =>
                          updateItem(idx, "gstPercent", Number(e.target.value))
                        }
                        className="w-full pl-1 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                      >
                        {GST_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Taxable amount — auto calculated */}
                    <td className="px-2 py-3 text-right">
                      <span className="text-sm font-medium text-slate-700">
                        ₹{fmt(calc.taxableAmount)}
                      </span>
                    </td>

                    {/* CGST + SGST OR IGST */}
                    {taxType === "cgst_sgst" ? (
                      <>
                        <td className="px-1.5 py-3 text-right">
                          <p className="text-xs text-slate-500">
                            {calc.cgstPercent}%
                          </p>
                          <p className="text-sm font-medium text-slate-700">
                            ₹{fmt(calc.cgstAmount)}
                          </p>
                        </td>
                        <td className="px-1.5 py-3 text-right">
                          <p className="text-xs text-slate-500">
                            {calc.sgstPercent}%
                          </p>
                          <p className="text-sm font-medium text-slate-700">
                            ₹{fmt(calc.sgstAmount)}
                          </p>
                        </td>
                      </>
                    ) : (
                      <td className="px-1.5 py-3 text-right">
                        <p className="text-xs text-slate-500">
                          {calc.igstPercent}%
                        </p>
                        <p className="text-sm font-medium text-slate-700">
                          ₹{fmt(calc.igstAmount)}
                        </p>
                      </td>
                    )}

                    {/* Total */}
                    <td className="px-2 py-3 text-right">
                      <span className="text-sm font-semibold text-indigo-700">
                        ₹{fmt(calc.totalAmount)}
                      </span>
                    </td>

                    {/* Remove row */}
                    <td className="px-1 py-3">
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add item row button */}
        <div className="px-5 py-3 border-t border-dashed border-slate-200">
          <button
            type="button"
            onClick={addItemRow}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add another item
          </button>
        </div>
      </div>

      {/* ── OPTIONAL FIELDS Header Divider ────────────────────────────────────── */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl py-3 px-5 font-bold text-slate-700 text-xs tracking-widest uppercase text-center my-6 shadow-sm">
        Optional Fields
      </div>

      {/* ── Transportation Details Card ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTransportDetails(!showTransportDetails)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left focus:outline-none"
        >
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-600" />
            Transportation Details
          </h2>
          {showTransportDetails ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showTransportDetails && (
          <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-4 animate-fadeIn">
            {/* Transport Mode radios */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Transportation Mode
              </label>
              <div className="flex flex-wrap gap-4 items-center">
                {[
                  { value: "none", label: "None" },
                  { value: "road", label: "Road" },
                  { value: "rail", label: "Rail" },
                  { value: "air", label: "Air" },
                  { value: "ship", label: "Ship/Road cum Ship" },
                ].map((mode) => (
                  <label key={mode.value} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="transportMode"
                      checked={transportMode === mode.value}
                      onChange={() => setTransportMode(mode.value)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    {mode.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Transportation inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  LR Date
                </label>
                <input
                  type="date"
                  value={lrDate}
                  onChange={(e) => setLrDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  LR Number
                </label>
                <input
                  type="text"
                  value={lrNumber}
                  onChange={(e) => setLrNumber(e.target.value)}
                  placeholder="Enter LR Number"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Date of Supply
                </label>
                <input
                  type="date"
                  value={dateOfSupply}
                  onChange={(e) => setDateOfSupply(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Place of Supply
                </label>
                <input
                  type="text"
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  placeholder="Place Of Supply"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Select Supply Type
                </label>
                <select
                  value={supplyType}
                  onChange={(e) => setSupplyType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="intra_state">Intra State</option>
                  <option value="inter_state">Inter State</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="Enter Vehicle Number"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Sub-collapsible Transporter details */}
            <div className="border border-slate-150 rounded-lg overflow-hidden mt-4">
              <button
                type="button"
                onClick={() => setShowTransporterFields(!showTransporterFields)}
                className="w-full flex items-center justify-between bg-slate-50 px-4 py-2 hover:bg-slate-100 transition-colors text-left focus:outline-none"
              >
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  Transporter (Optional Field)
                </span>
                {showTransporterFields ? (
                  <Minus className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>

              {showTransporterFields && (
                <div className="p-4 bg-white border-t border-slate-150 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                      Transporter Name
                    </label>
                    <input
                      type="text"
                      value={transporterName}
                      onChange={(e) => setTransporterName(e.target.value)}
                      placeholder="Enter Transporter Name"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                      Transporter ID
                    </label>
                    <input
                      type="text"
                      value={transporterId}
                      onChange={(e) => setTransporterId(e.target.value)}
                      placeholder="Enter Transporter ID"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Print Copies Card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
          <FileText className="w-4 h-4 text-indigo-600" />
          Print Copies
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { value: "recipient", label: "Original for Recipient" },
            { value: "transporter", label: "Duplicate for Transporter" },
            { value: "supplier", label: "Triplicate for Supplier" },
          ].map((copy) => {
            const checked = printCopies.includes(copy.value);
            return (
              <label key={copy.value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    if (checked) {
                      setPrintCopies(printCopies.filter(c => c !== copy.value));
                    } else {
                      setPrintCopies([...printCopies, copy.value]);
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                {copy.label}
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Bank Details Card ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            Bank Details (Optional Field)
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (supplier) {
                  setBankName(supplier.bankName || "");
                  setBankAccount(supplier.bankAccount || "");
                  setBankHolderName(supplier.name || "");
                  setBankIfsc(supplier.bankIfsc || "");
                  setBankBranch(supplier.bankBranch || "");
                  toast.success("Reset to default bank details");
                }
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              Use Default Bank
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setIsEditingBank(!isEditingBank)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              {isEditingBank ? "Done" : "Edit Bank Details"}
            </button>
          </div>
        </div>

        {isEditingBank ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC Bank"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Account Number</label>
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="e.g. 502000..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Account Holder Name</label>
              <input
                type="text"
                value={bankHolderName}
                onChange={(e) => setBankHolderName(e.target.value)}
                placeholder="Holder Name"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">IFSC Code</label>
              <input
                type="text"
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value)}
                placeholder="IFSC Code"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Branch Name</label>
              <input
                type="text"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                placeholder="Branch Name"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
            <p className="font-bold text-slate-800 text-sm">{bankName || "—"}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <p><span className="font-semibold text-slate-400 uppercase text-[9px] mr-1">Account Number:</span> {bankAccount || "—"}</p>
              <p><span className="font-semibold text-slate-400 uppercase text-[9px] mr-1">Account Holder Name:</span> {bankHolderName || "—"}</p>
              <p><span className="font-semibold text-slate-400 uppercase text-[9px] mr-1">IFSC Code:</span> {bankIfsc || "—"}</p>
              <p><span className="font-semibold text-slate-400 uppercase text-[9px] mr-1">Branch Name:</span> {bankBranch || "—"}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Signature Upload Card ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
          <PenTool className="w-4 h-4 text-indigo-600" />
          Upload Signature (Optional)
        </h2>
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full md:w-64 h-24 border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center relative group">
            {signatureUrl ? (
              <img src={signatureUrl} alt="Signature Preview" className="max-w-full max-h-full object-contain p-2" />
            ) : (
              <div className="text-center text-slate-400 text-xs">
                <p>No signature uploaded</p>
                <p className="text-[10px] text-slate-300 mt-1">Accepts PNG / JPG / JPEG</p>
              </div>
            )}
          </div>
          <div className="flex flex-row md:flex-col gap-2">
            <label className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-indigo-150">
              Upload Image
              <input
                type="file"
                accept="image/*"
                onChange={handleSignatureUpload}
                className="hidden"
              />
            </label>
            {signatureUrl && (
              <button
                type="button"
                onClick={() => setSignatureUrl("")}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-colors border border-red-150 cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Totals + Discount ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Notes + Terms */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            Notes & Terms
          </h2>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Notes (visible on invoice)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any note for the buyer..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Terms & Conditions
            </label>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={3}
              placeholder="Payment terms, delivery terms..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* Amount summary */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-indigo-600" />
            Amount Summary
          </h2>

          <div className="space-y-2.5">
            {/* Sub total */}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Taxable Amount</span>
              <span className="font-medium text-slate-700">
                ₹{fmt(subTotal)}
              </span>
            </div>

            {/* CGST + SGST or IGST */}
            {taxType === "cgst_sgst" ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Add: CGST</span>
                  <span className="font-medium text-slate-700">
                    ₹{fmt(totalCgst)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Add: SGST</span>
                  <span className="font-medium text-slate-700">
                    ₹{fmt(totalSgst)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Add: IGST</span>
                <span className="font-medium text-slate-700">
                  ₹{fmt(totalIgst)}
                </span>
              </div>
            )}

            {/* Tax amount total */}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tax Amount: GST</span>
              <span className="font-medium text-slate-700">
                ₹{fmt(totalTax)}
              </span>
            </div>

            {/* Discount */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Discount
              </p>
              <div className="flex items-center gap-2">
                {/* Discount type toggle */}
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {[
                    { value: "amount", label: "₹" },
                    { value: "percent", label: "%" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDiscountType(opt.value)}
                      className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                        discountType === opt.value
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                />
              </div>
              {discountAmount > 0 && (
                <p className="text-xs text-green-600 mt-1 text-right">
                  Discount: −₹{fmt(discountAmount)}
                </p>
              )}
            </div>

            {/* Round off */}
            {roundOff !== 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Round Off</span>
                <span className="font-medium text-slate-500">
                  {roundOff > 0 ? "+" : ""}₹{fmt(roundOff)}
                </span>
              </div>
            )}

            {/* Grand Total */}
            <div className="pt-3 border-t-2 border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-slate-800">
                  Grand Total
                </span>
                <span className="text-xl font-bold text-indigo-700">
                  ₹{fmt(grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Warning if no buyer selected */}
          {!buyer && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Select a buyer above to determine CGST/SGST vs IGST
              </p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg transition-colors text-sm shadow-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                Creating Invoice...
              </span>
            ) : (
              "✓ Create Invoice"
            )}
          </button>
        </div>
      </div>
      {upgradePrompt && (
        <UpgradePrompt
          message={upgradePrompt}
          onClose={() => setUpgradePrompt(null)}
        />
      )}
      {showBuyerModal && (
        <QuickAddBuyerModal
          onClose={() => setShowBuyerModal(false)}
          onSave={(newBuyer) => {
            setBuyer(newBuyer);
            setShowBuyerModal(false);
          }}
        />
      )}
      {showItemModal && (
        <QuickAddItemModal
          onClose={() => setShowItemModal(false)}
          onSave={(newItem) => {
            const lastEmptyIdx = items.findIndex(item => !item.name && !item.rate);
            if (lastEmptyIdx !== -1) {
              const updated = [...items];
              updated[lastEmptyIdx] = {
                ...updated[lastEmptyIdx],
                name: newItem.name,
                hsn: newItem.hsn || "",
                unit: newItem.unit || "pcs",
                rate: newItem.price || 0,
                gstPercent: newItem.gstPercent || 18,
              };
              setItems(updated);
            } else {
              setItems([
                ...items,
                {
                  name: newItem.name,
                  hsn: newItem.hsn || "",
                  unit: newItem.unit || "pcs",
                  quantity: 1,
                  rate: newItem.price || 0,
                  gstPercent: newItem.gstPercent || 18,
                  taxableAmount: 0,
                  cgstPercent: 0,
                  cgstAmount: 0,
                  sgstPercent: 0,
                  sgstAmount: 0,
                  igstPercent: 0,
                  igstAmount: 0,
                  totalAmount: 0,
                }
              ]);
            }
            setShowItemModal(false);
          }}
        />
      )}
    </div>
  );
}
