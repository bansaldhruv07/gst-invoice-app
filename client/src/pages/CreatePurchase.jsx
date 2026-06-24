import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Plus, Trash2, X, Search, ChevronDown,
  IndianRupee, FileText, Building2,
  Package, Calendar, AlertCircle,
} from "lucide-react";

const GST_RATES  = [0, 5, 12, 18, 28];
const UNITS      = ["pcs","kg","ltr","mtr","box","hrs","nos","set","pair","dozen","other"];
const EMPTY_ITEM = {
  name:"", hsn:"", unit:"pcs", quantity:1, rate:"", gstPercent:18,
  taxableAmount:0, cgstPercent:0, cgstAmount:0,
  sgstPercent:0, sgstAmount:0, igstPercent:0, igstAmount:0, totalAmount:0,
};

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

  useEffect(() => { if (open) search(query); }, [open, query]);

  return (
    <div className="relative">
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
            className="p-1 text-slate-400 hover:text-red-500 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 p-3 border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
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
              <div className="p-4 text-center">
                <p className="text-sm text-slate-400">No sellers found.</p>
                <p className="text-xs text-slate-300 mt-1">Add sellers from Masters → Sellers</p>
              </div>
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
          <div className="p-2 border-t border-slate-100">
            <button type="button" onClick={() => setOpen(false)}
              className="w-full text-xs text-slate-400 hover:text-slate-600 py-1"
            >Close</button>
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

  // Derive tax type from seller state
  const SUPPLIER_STATE_CODE = "07";
  const taxType = seller?.stateCode && seller.stateCode !== SUPPLIER_STATE_CODE
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
  const removeRow = (i) => { if(items.length===1) return; setItems(items.filter((_,idx)=>idx!==i)); };
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
    <div className="max-w-5xl mx-auto space-y-6 pb-10">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Create Purchase</h1>
          <p className="text-slate-500 text-sm mt-0.5">Record a purchase from a seller</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/purchases")}
            className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
          >Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold shadow-sm"
          >
            {loading ? "Creating..." : "Submit"}
          </button>
        </div>
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
          {seller && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              taxType==="igst"
                ? "bg-orange-100 text-orange-700"
                : "bg-blue-100 text-blue-700"
            }`}>
              {taxType==="igst" ? "IGST (inter-state)" : "CGST+SGST (intra-state)"}
            </span>
          )}
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
          <button type="button" onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-indigo-600 font-semibold hover:text-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Add New Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 w-8">#</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 min-w-44">Item Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3 w-24">HSN</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3 w-20">Unit</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3 w-16">Qty</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3 w-28">Rate (₹)</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3 w-20">GST%</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3 w-28">Taxable</th>
                {taxType==="cgst_sgst" ? (
                  <>
                    <th className="text-right text-xs font-semibold text-slate-500 px-3 py-3 w-20">CGST</th>
                    <th className="text-right text-xs font-semibold text-slate-500 px-3 py-3 w-20">SGST</th>
                  </>
                ) : (
                  <th className="text-right text-xs font-semibold text-slate-500 px-3 py-3 w-20">IGST</th>
                )}
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3 w-28">Total</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item, idx) => {
                const calc = calcItems[idx];
                return (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm text-slate-400">{idx+1}</td>

                    {/* Name */}
                    <td className="px-4 py-3">
                      <input type="text" value={item.name}
                        onChange={(e) => updateItem(idx,"name",e.target.value)}
                        placeholder="Item name..."
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </td>

                    {/* HSN */}
                    <td className="px-3 py-3">
                      <input type="text" value={item.hsn}
                        onChange={(e) => updateItem(idx,"hsn",e.target.value)}
                        placeholder="HSN"
                        className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </td>

                    {/* Unit */}
                    <td className="px-3 py-3">
                      <select value={item.unit}
                        onChange={(e) => updateItem(idx,"unit",e.target.value)}
                        className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white uppercase"
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
                      </select>
                    </td>

                    {/* Qty */}
                    <td className="px-3 py-3">
                      <input type="number" value={item.quantity} min="0"
                        onChange={(e) => updateItem(idx,"quantity",e.target.value)}
                        className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                      />
                    </td>

                    {/* Rate */}
                    <td className="px-3 py-3">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                        <input type="number" value={item.rate} min="0" step="0.01" placeholder="0.00"
                          onChange={(e) => updateItem(idx,"rate",e.target.value)}
                          className="w-full pl-5 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                        />
                      </div>
                    </td>

                    {/* GST % */}
                    <td className="px-3 py-3">
                      <select value={item.gstPercent}
                        onChange={(e) => updateItem(idx,"gstPercent",Number(e.target.value))}
                        className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>

                    {/* Taxable */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-slate-700">
                        ₹{fmt(calc.taxableAmount)}
                      </span>
                    </td>

                    {/* CGST+SGST or IGST */}
                    {taxType==="cgst_sgst" ? (
                      <>
                        <td className="px-3 py-3 text-right">
                          <p className="text-xs text-slate-400">{calc.cgstPercent}%</p>
                          <p className="text-sm font-medium text-slate-700">₹{fmt(calc.cgstAmount)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="text-xs text-slate-400">{calc.sgstPercent}%</p>
                          <p className="text-sm font-medium text-slate-700">₹{fmt(calc.sgstAmount)}</p>
                        </td>
                      </>
                    ) : (
                      <td className="px-3 py-3 text-right">
                        <p className="text-xs text-slate-400">{calc.igstPercent}%</p>
                        <p className="text-sm font-medium text-slate-700">₹{fmt(calc.igstAmount)}</p>
                      </td>
                    )}

                    {/* Total */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-indigo-700">
                        ₹{fmt(calc.totalAmount)}
                      </span>
                    </td>

                    {/* Remove */}
                    <td className="px-2 py-3">
                      <button type="button" onClick={() => removeRow(idx)}
                        disabled={items.length===1}
                        className="p-1.5 text-slate-300 hover:text-red-500 disabled:cursor-not-allowed"
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
    </div>
  );
}