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
  IndianRupee,
  FileText,
  User,
  Package,
  Calendar,
  Tag,
  AlertCircle,
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
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-400">
                Loading...
              </div>
            ) : buyers.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">
                No buyers found. Add buyers in the Buyers page first.
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

          {/* Close */}
          <div className="p-2 border-t border-slate-100">
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

// ─── Item row selector dropdown ───────────────────────────────────────────────
function ItemNameCell({ value, onSelect }) {
  const [query, setQuery] = useState(value || "");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const { data } = await api.get("/items", {
        params: q ? { search: q } : {},
      });
      setItems(data.items);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) search(query);
  }, [open, query, search]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onSelect({ name: e.target.value });
        }}
        onFocus={() => setOpen(true)}
        placeholder="Type item name..."
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {open && (
        <div className="absolute top-full left-0 w-72 mt-1 z-50 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <p className="text-xs text-slate-400 px-2">
              Select from catalogue or type custom name
            </p>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-center text-slate-400 p-3">
                Loading...
              </p>
            ) : items.length === 0 ? (
              <p className="text-xs text-center text-slate-400 p-3">
                No items — use custom name above
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onMouseDown={() => {
                    // onMouseDown fires before onBlur so dropdown stays open
                    setQuery(item.name);
                    onSelect(item);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-indigo-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      HSN: {item.hsn || "—"} · {item.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-indigo-600">
                      ₹{item.price}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.gstPercent}% GST
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="p-2 border-t border-slate-100">
            <button
              type="button"
              onMouseDown={() => setOpen(false)}
              className="w-full text-xs text-slate-400 hover:text-slate-600 py-1"
            >
              Close
            </button>
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

  // ── Derive tax type from buyer state vs supplier state ─────────────────────
  // Supplier state code from env isn't available in frontend,
  // so we default to Delhi (07) — user can override in .env
  const SUPPLIER_STATE_CODE = "07"; // change this if your state is different
  const taxType =
    buyer?.stateCode && buyer.stateCode !== SUPPLIER_STATE_CODE
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
    if (items.length === 1) return; // keep at least 1 row
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
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Create Invoice</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Fill details below — GST calculates automatically
          </p>
        </div>
        <div className="flex items-center gap-3">
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
      </div>

      {/* ── Invoice settings row ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* ── Buyer Details ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            Buyer Details
          </h2>

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
            onClick={addItemRow}
            className="flex items-center gap-1.5 text-sm text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        {/* ── Items table ───────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 w-8">
                  #
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 min-w-48">
                  Item Name
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3 w-28">
                  HSN/SAC
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3 w-24">
                  Unit
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3 w-20">
                  Qty
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3 w-28">
                  Rate (₹)
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3 w-20">
                  GST %
                </th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3 w-32">
                  Taxable Amt
                </th>
                {taxType === "cgst_sgst" ? (
                  <>
                    <th className="text-right text-xs font-semibold text-slate-500 px-3 py-3 w-24">
                      CGST
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-500 px-3 py-3 w-24">
                      SGST
                    </th>
                  </>
                ) : (
                  <th className="text-right text-xs font-semibold text-slate-500 px-3 py-3 w-24">
                    IGST
                  </th>
                )}
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3 w-32">
                  Total
                </th>
                <th className="w-10" />
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
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Item name with catalogue selector */}
                    <td className="px-4 py-3">
                      <ItemNameCell
                        value={item.name}
                        onSelect={(selected) =>
                          selectItemFromCatalogue(idx, selected)
                        }
                      />
                    </td>

                    {/* HSN */}
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={item.hsn}
                        onChange={(e) => updateItem(idx, "hsn", e.target.value)}
                        placeholder="HSN"
                        className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </td>

                    {/* Unit */}
                    <td className="px-3 py-3">
                      <select
                        value={item.unit}
                        onChange={(e) =>
                          updateItem(idx, "unit", e.target.value)
                        }
                        className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white uppercase"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Quantity */}
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(idx, "quantity", e.target.value)
                        }
                        min="0"
                        step="1"
                        className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                      />
                    </td>

                    {/* Rate */}
                    <td className="px-3 py-3">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
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
                          className="w-full pl-5 pr-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                        />
                      </div>
                    </td>

                    {/* GST % — clickable buttons */}
                    <td className="px-3 py-3">
                      <select
                        value={item.gstPercent}
                        onChange={(e) =>
                          updateItem(idx, "gstPercent", Number(e.target.value))
                        }
                        className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        {GST_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Taxable amount — auto calculated */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-slate-700">
                        ₹{fmt(calc.taxableAmount)}
                      </span>
                    </td>

                    {/* CGST + SGST OR IGST */}
                    {taxType === "cgst_sgst" ? (
                      <>
                        <td className="px-3 py-3 text-right">
                          <p className="text-xs text-slate-500">
                            {calc.cgstPercent}%
                          </p>
                          <p className="text-sm font-medium text-slate-700">
                            ₹{fmt(calc.cgstAmount)}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="text-xs text-slate-500">
                            {calc.sgstPercent}%
                          </p>
                          <p className="text-sm font-medium text-slate-700">
                            ₹{fmt(calc.sgstAmount)}
                          </p>
                        </td>
                      </>
                    ) : (
                      <td className="px-3 py-3 text-right">
                        <p className="text-xs text-slate-500">
                          {calc.igstPercent}%
                        </p>
                        <p className="text-sm font-medium text-slate-700">
                          ₹{fmt(calc.igstAmount)}
                        </p>
                      </td>
                    )}

                    {/* Total */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-indigo-700">
                        ₹{fmt(calc.totalAmount)}
                      </span>
                    </td>

                    {/* Remove row */}
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length === 1}
                        className="p-1.5 text-slate-300 hover:text-red-500 disabled:cursor-not-allowed transition-colors"
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
    </div>
  );
}
