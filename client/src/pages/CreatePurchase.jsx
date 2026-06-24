import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Plus, Trash2, X, Search, ChevronDown,
  IndianRupee, FileText, Building2,
  Package, Calendar, AlertCircle, User,
} from "lucide-react";

const GST_RATES  = [0, 5, 12, 18, 28];
const UNITS      = ["pcs","kg","ltr","mtr","box","hrs","nos","set","pair","dozen","other"];
const EMPTY_ITEM = {
  name:"", hsn:"", unit:"pcs", quantity:1, rate:"", gstPercent:18,
  taxableAmount:0, cgstPercent:0, cgstAmount:0,
  sgstPercent:0, sgstAmount:0, igstPercent:0, igstAmount:0, totalAmount:0,
};

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli", "Daman and Diu", "Lakshadweep",
  "Delhi", "Puducherry"
];

const fmt = (n) => Number(n||0).toLocaleString("en-IN",{
  minimumFractionDigits:2, maximumFractionDigits:2,
});

// ─── GST Calculation ──────────────────────────────────────────────────────────
function calcItem(item, taxType, taxMode) {
  const qty=parseFloat(item.quantity)||0, rate=parseFloat(item.rate)||0, gst=parseFloat(item.gstPercent)||0;
  let taxable, gstAmt;
  if (taxMode==="inclusive") {
    const gross=qty*rate; taxable=gross/(1+gst/100); gstAmt=gross-taxable;
  } else { taxable=qty*rate; gstAmt=(taxable*gst)/100; }
  taxable=Math.round(taxable*100)/100; gstAmt=Math.round(gstAmt*100)/100;
  let cP=0,cA=0,sP=0,sA=0,iP=0,iA=0;
  if (taxType==="cgst_sgst") {
    cP=gst/2; sP=gst/2;
    cA=Math.round((gstAmt/2)*100)/100;
    sA=Math.round((gstAmt/2)*100)/100;
  } else { iP=gst; iA=gstAmt; }
  return {...item, taxableAmount:taxable,
    cgstPercent:cP,cgstAmount:cA,
    sgstPercent:sP,sgstAmount:sA,
    igstPercent:iP,igstAmount:iA,
    totalAmount:Math.round((taxable+gstAmt)*100)/100,
  };
}

// ─── Quick Add Seller Modal Component ──────────────────────────────────────────
function QuickAddSellerModal({ onClose, onSave }) {
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
      toast.error("Seller name is required");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/sellers", {
        name,
        gstin,
        mobile,
        email,
        state,
        city,
        address,
        pincode,
      });
      toast.success("Seller added successfully");
      onSave(data.seller);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add seller");
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
            <h3 className="font-bold text-slate-800 text-base font-sans">Quick Add Seller</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 font-sans">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Seller Name *</label>
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
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. email@seller.com" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">{loading ? "Saving..." : "Save Seller"}</button>
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
            <h3 className="font-bold text-slate-800 text-base font-sans">Quick Add Item</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 font-sans">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Item Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 12mm Steel Rod" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Rate / Price (Excl. GST) *</label>
              <input type="number" required min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">GST Rate (%)</label>
              <select value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white uppercase">
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">HSN Code</label>
              <input type="text" value={hsn} onChange={(e) => setHsn(e.target.value)} placeholder="e.g. 7214" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
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

// ─── Seller Selector ──────────────────────────────────────────────────────────
function SellerSelector({ selected, onSelect }) {
  const [query,  setQuery]  = useState("");
  const [sellers,setSellers]= useState([]);
  const [open,   setOpen]   = useState(false);
  const [loading,setLoading]= useState(false);

  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const { data } = await api.get("/sellers", { params: q ? { search: q } : {} });
      setSellers(data.sellers);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) search(query); }, [open, query, search]);

  return (
    <div className="relative font-sans">
      {selected ? (
        <div className="p-3 border border-indigo-200 bg-indigo-50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {selected.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{selected.name}</p>
              <p className="text-xs text-slate-500">
                {selected.gstin ? `GSTIN: ${selected.gstin}` : "Unregistered"}
                {selected.city && ` · ${selected.city}`}
                {selected.state && `, ${selected.state}`}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => onSelect(null)}
            className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 p-3 border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-lg text-slate-400 hover:text-indigo-600 transition-all group"
        >
          <Building2 className="w-5 h-5" />
          <span className="text-sm">Click to select a seller...</span>
          <ChevronDown className="w-4 h-4 ml-auto" />
        </button>
      )}

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                autoFocus type="text" placeholder="Search seller..."
                value={query} onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <p className="text-center text-sm text-slate-400 p-4">Loading...</p>
            ) : sellers.length === 0 ? (
              <p className="text-center text-sm text-slate-400 p-4">No sellers found.</p>
            ) : sellers.map((s) => (
              <button key={s._id} type="button"
                onClick={() => { onSelect(s); setOpen(false); setQuery(""); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-indigo-600">
                    {s.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.gstin || "Unregistered"}{s.state && ` · ${s.state}`}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-slate-100 bg-slate-50">
            <button type="button" onClick={() => setOpen(false)}
              className="w-full text-xs text-slate-400 hover:text-slate-650 py-1 transition-colors"
            >Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Item row selector dropdown ───────────────────────────────────────────────
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

// ─── Main CreatePurchase Page ─────────────────────────────────────────────────
export default function CreatePurchase() {
  const navigate = useNavigate();

  const [seller,          setSeller]          = useState(null);
  const [purchaseDate,    setPurchaseDate]    = useState(new Date().toISOString().split("T")[0]);
  const [dueDate,         setDueDate]         = useState("");
  const [purchaseType,    setPurchaseType]    = useState("tax_invoice");
  const [taxMode,         setTaxMode]         = useState("exclusive");
  const [items,           setItems]           = useState([{...EMPTY_ITEM}]);
  const [discountType,    setDiscountType]    = useState("amount");
  const [discountValue,   setDiscountValue]   = useState(0);
  const [sellerInvoiceNo, setSellerInvoiceNo] = useState("");
  const [notes,           setNotes]           = useState("");
  const [terms,           setTerms]           = useState("");
  const [loading,         setLoading]         = useState(false);
  const [showSellerModal, setShowSellerModal] = useState(false);
  const [showItemModal,   setShowItemModal]   = useState(false);

  const [supplierStateCode, setSupplierStateCode] = useState("07");

  useEffect(() => {
    const fetchSupplierInfo = async () => {
      try {
        const { data } = await api.get("/auth/supplier-info");
        if (data && data.supplier && data.supplier.stateCode) {
          setSupplierStateCode(data.supplier.stateCode);
        }
      } catch (err) {
        console.error("Failed to load supplier state code in CreatePurchase:", err);
      }
    };
    fetchSupplierInfo();
  }, []);

  // Derive tax type from seller state
  const taxType = seller?.stateCode && seller.stateCode !== supplierStateCode
    ? "igst" : "cgst_sgst";

  const calcItems = items.map(i => calcItem(i, taxType, taxMode));

  const subTotal      = calcItems.reduce((s,i) => s+i.taxableAmount, 0);
  const totalCgst     = calcItems.reduce((s,i) => s+i.cgstAmount,    0);
  const totalSgst     = calcItems.reduce((s,i) => s+i.sgstAmount,    0);
  const totalIgst     = calcItems.reduce((s,i) => s+i.igstAmount,    0);
  const totalTax      = totalCgst+totalSgst+totalIgst;
  const discountAmt   = discountType==="percent"
    ? (subTotal*parseFloat(discountValue||0))/100
    : parseFloat(discountValue||0);
  const totalAmount   = subTotal - discountAmt + totalTax;
  const grandTotal    = Math.round(totalAmount);
  const roundOff      = Math.round((grandTotal-totalAmount)*100)/100;

  const addRow    = () => setItems([...items, {...EMPTY_ITEM}]);
  const removeRow = (i) => {
    if (items.length === 1) {
      setItems([{ ...EMPTY_ITEM }]);
      return;
    }
    setItems(items.filter((_, idx) => idx !== i));
  };
  const updateItem = (idx, field, val) => {
    const u=[...items]; u[idx]={...u[idx],[field]:val}; setItems(u);
  };

  const handleSubmit = async () => {
    if (!seller) { toast.error("Please select a seller"); return; }
    const valid = items.filter(i => i.name && parseFloat(i.rate)>0 && parseFloat(i.quantity)>0);
    if (!valid.length) { toast.error("Add at least one item with name, quantity and rate"); return; }

    setLoading(true);
    try {
      const { data } = await api.post("/purchases", {
        sellerId:            seller._id,
        purchaseDate, dueDate: dueDate||null,
        purchaseType, taxMode,
        sellerInvoiceNumber: sellerInvoiceNo,
        items: valid.map(i => ({
          name:       i.name,
          hsn:        i.hsn||"",
          unit:       i.unit||"pcs",
          quantity:   parseFloat(i.quantity),
          rate:       parseFloat(i.rate),
          gstPercent: parseFloat(i.gstPercent),
        })),
        discountType,
        discountValue: parseFloat(discountValue||0),
        notes, terms,
      });
      toast.success(`Purchase ${data.purchase.purchaseNumber} created!`);
      navigate("/purchases");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create purchase");
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-[1360px] mx-auto space-y-6 pb-10 px-4">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center gap-3">
        <button onClick={() => navigate("/purchases")}
          className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
        >Cancel</button>
        <button onClick={handleSubmit} disabled={loading}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold shadow-sm"
        >
          {loading ? "Creating..." : "Submit"}
        </button>
      </div>

      {/* ── Purchase Type + Dates ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          {/* Invoice type */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Invoice Type
            </label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {[
                {value:"tax_invoice",    label:"Tax Invoice"},
                {value:"bill_of_supply", label:"Bill of Supply"},
              ].map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => setPurchaseType(opt.value)}
                  className={`flex-1 py-2 text-xs font-medium transition-all ${
                    purchaseType===opt.value ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tax mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Tax Mode
            </label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {[
                {value:"exclusive", label:"Excl. GST"},
                {value:"inclusive", label:"Incl. GST"},
              ].map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => setTaxMode(opt.value)}
                  className={`flex-1 py-2 text-xs font-medium transition-all ${
                    taxMode===opt.value ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Purchase date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Purchase Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="date" value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Seller's invoice number */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Seller's Invoice No.
            </label>
            <input type="text" value={sellerInvoiceNo}
              onChange={(e) => setSellerInvoiceNo(e.target.value)}
              placeholder="e.g. INV-952"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* ── Seller Details ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            Seller Details
          </h2>
          <div className="flex items-center gap-3">
            {seller && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                taxType==="igst"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-blue-100 text-blue-700"
              }`}>
                {taxType==="igst" ? "IGST (inter-state)" : "CGST+SGST (intra-state)"}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowSellerModal(true)}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Quick Add Seller
            </button>
          </div>
        </div>
        <SellerSelector selected={seller} onSelect={setSeller} />

        {/* Add new seller link */}
        <p className="text-xs text-slate-400 mt-2">
          Don't see your seller?{" "}
          <a href="/sellers" className="text-indigo-600 hover:underline font-medium">
            Add seller in Masters
          </a>
        </p>
      </div>

      {/* ── Products ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            Products
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

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-center text-xs font-semibold text-slate-500 px-2 py-3 w-8">#</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-2 py-3 min-w-[150px]">Item Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1.5 py-3 w-20">HSN</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1.5 py-3 w-20">Unit</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1.5 py-3 w-24">Qty</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1.5 py-3 w-24">Rate (₹)</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-1.5 py-3 w-14">GST%</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-2 py-3 w-24">Taxable</th>
                {taxType==="cgst_sgst" ? (
                  <>
                    <th className="text-right text-xs font-semibold text-slate-500 px-1.5 py-3 w-20">CGST</th>
                    <th className="text-right text-xs font-semibold text-slate-500 px-1.5 py-3 w-20">SGST</th>
                  </>
                ) : (
                  <th className="text-right text-xs font-semibold text-slate-500 px-1.5 py-3 w-20">IGST</th>
                )}
                <th className="text-right text-xs font-semibold text-slate-500 px-2 py-3 w-28">Total</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item, idx) => {
                const calc = calcItems[idx];
                return (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-2 py-3 text-sm text-slate-400 text-center">{idx+1}</td>

                    {/* Name */}
                    <td className="px-2 py-3">
                      <ItemNameCell
                        value={item.name}
                        onSelect={(catalogueItem) => {
                          const updated = [...items];
                          updated[idx] = {
                            ...updated[idx],
                            name: catalogueItem.name || updated[idx].name,
                            hsn: catalogueItem.hsn || updated[idx].hsn || "",
                            unit: catalogueItem.unit || updated[idx].unit || "pcs",
                            gstPercent: catalogueItem.gstPercent !== undefined ? catalogueItem.gstPercent : updated[idx].gstPercent,
                            rate: catalogueItem.price !== undefined ? catalogueItem.price : updated[idx].rate,
                          };
                          setItems(updated);
                        }}
                      />
                    </td>

                    {/* HSN */}
                    <td className="px-1.5 py-3">
                      <input type="text" value={item.hsn}
                        onChange={(e) => updateItem(idx,"hsn",e.target.value)}
                        placeholder="HSN"
                        className="w-full px-1.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </td>

                    {/* Unit */}
                    <td className="px-1.5 py-3">
                      <select value={item.unit}
                        onChange={(e) => updateItem(idx,"unit",e.target.value)}
                        className="w-full pl-1.5 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white uppercase font-medium"
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
                      </select>
                    </td>

                    {/* Qty */}
                    <td className="px-1.5 py-3">
                      <input type="number" value={item.quantity} min="0"
                        onChange={(e) => updateItem(idx,"quantity",e.target.value)}
                        className="w-full px-1.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                      />
                    </td>

                    {/* Rate */}
                    <td className="px-1.5 py-3">
                      <div className="relative">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                        <input type="number" value={item.rate} min="0" step="0.01" placeholder="0.00"
                          onChange={(e) => updateItem(idx,"rate",e.target.value)}
                          className="w-full pl-4 pr-1 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                        />
                      </div>
                    </td>

                    {/* GST % */}
                    <td className="px-1.5 py-3">
                      <select value={item.gstPercent}
                        onChange={(e) => updateItem(idx,"gstPercent",Number(e.target.value))}
                        className="w-full pl-1 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                      >
                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>

                    {/* Taxable */}
                    <td className="px-2 py-3 text-right">
                      <span className="text-sm font-medium text-slate-700">
                        ₹{fmt(calc.taxableAmount)}
                      </span>
                    </td>

                    {/* CGST+SGST or IGST */}
                    {taxType==="cgst_sgst" ? (
                      <>
                        <td className="px-1.5 py-3 text-right">
                          <p className="text-xs text-slate-400">{calc.cgstPercent}%</p>
                          <p className="text-sm font-medium text-slate-700">₹{fmt(calc.cgstAmount)}</p>
                        </td>
                        <td className="px-1.5 py-3 text-right">
                          <p className="text-xs text-slate-400">{calc.sgstPercent}%</p>
                          <p className="text-sm font-medium text-slate-700">₹{fmt(calc.sgstAmount)}</p>
                        </td>
                      </>
                    ) : (
                      <td className="px-1.5 py-3 text-right">
                        <p className="text-xs text-slate-400">{calc.igstPercent}%</p>
                        <p className="text-sm font-medium text-slate-700">₹{fmt(calc.igstAmount)}</p>
                      </td>
                    )}

                    {/* Total */}
                    <td className="px-2 py-3 text-right">
                      <span className="text-sm font-semibold text-indigo-700">
                        ₹{fmt(calc.totalAmount)}
                      </span>
                    </td>

                    {/* Remove */}
                    <td className="px-1 py-3">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
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

        <div className="px-5 py-3 border-t border-dashed border-slate-200">
          <button type="button" onClick={addRow}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add another item
          </button>
        </div>
      </div>

      {/* ── Summary ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Notes + Terms */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            Notes & Terms
          </h2>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} placeholder="Internal notes..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Terms & Conditions</label>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)}
              rows={2} placeholder="Payment terms..."
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
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Taxable Amount</span>
              <span className="font-medium text-slate-700">₹{fmt(subTotal)}</span>
            </div>
            {taxType==="cgst_sgst" ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Add: CGST</span>
                  <span className="font-medium text-slate-700">₹{fmt(totalCgst)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Add: SGST</span>
                  <span className="font-medium text-slate-700">₹{fmt(totalSgst)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Add: IGST</span>
                <span className="font-medium text-slate-700">₹{fmt(totalIgst)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tax Amount: GST</span>
              <span className="font-medium text-slate-700">₹{fmt(totalTax)}</span>
            </div>

            {/* Discount */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Discount</p>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {[{value:"amount",label:"₹"},{value:"percent",label:"%"}].map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => setDiscountType(opt.value)}
                      className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                        discountType===opt.value ? "bg-indigo-600 text-white" : "bg-white text-slate-500"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <input type="number" value={discountValue} min="0" step="0.01" placeholder="0"
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                />
              </div>
              {discountAmt > 0 && (
                <p className="text-xs text-green-600 mt-1 text-right">Discount: −₹{fmt(discountAmt)}</p>
              )}
            </div>

            {roundOff !== 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Round Off</span>
                <span className="font-medium text-slate-500">{roundOff>0?"+":""}₹{fmt(roundOff)}</span>
              </div>
            )}

            <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-center">
              <span className="text-base font-bold text-slate-800">Grand Total</span>
              <span className="text-xl font-bold text-indigo-700">₹{fmt(grandTotal)}</span>
            </div>
          </div>

          {!seller && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700">Select a seller to determine CGST/SGST vs IGST</p>
            </div>
          )}

          <button type="button" onClick={handleSubmit} disabled={loading}
            className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg text-sm shadow-sm"
          >
            {loading ? "Creating..." : "✓ Create Purchase"}
          </button>
        </div>
      </div>
      {showSellerModal && (
        <QuickAddSellerModal
          onClose={() => setShowSellerModal(false)}
          onSave={(newSeller) => {
            setSeller(newSeller);
            setShowSellerModal(false);
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