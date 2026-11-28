// Makes, edits and duplicates invoices (?from=id) and quotations. One column of
// titled sections; each opens a small screen of its own where needed.
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useParams, useSearchParams, useLocation } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Pencil, Trash2, X, UserPlus, ListPlus, Upload } from "lucide-react";
import UpgradePrompt from "../components/UpgradePrompt";
import Sheet from "../components/mobile/Sheet";
import PageBar from "../components/mobile/PageBar";
import { Section, AddRow, RoundButton, Cells, Cell } from "../components/mobile/Rows";
import LineForm from "../components/forms/LineForm";
import BuyerPicker from "../components/pickers/BuyerPicker";
import ProductPicker from "../components/pickers/ProductPicker";
import { Spinner } from "../components/ui";
import { money, shortDate } from "../lib/format";
import { computeTotals, taxTypeFor } from "../lib/gst";
import { defaultTerms } from "../lib/terms";
import { STATE_OPTIONS, GST_STATES } from "../lib/states";
import { readImage } from "../lib/image";
import { todayISO } from "../lib/period";
import { useCan } from "../context/AuthContext";

const day = (value) => (value ? String(value).slice(0, 10) : "");
let lineKey = 0;
const nextKey = () => (lineKey += 1);

const CONSIGNEE_MODES = [
  ["same", "Show Consignee (Same as above)"],
  ["none", "Consignee Not Required"],
  ["other", "Add Consignee (If different from above)"],
];

// [key, label, input type, placeholder]
const SUPPLIER_FIELDS = [
  ["name", "Business Name"], ["gstin", "GSTIN"], ["phone", "Phone"], ["address", "Address"],
  ["city", "City"], ["state", "State"], ["pincode", "Pincode"], ["stateCode", "State Code"],
];
const TRANSPORT_FIELDS = [
  ["vehicleNumber", "Vehicle Number", "text", "Enter Vehicle Number"],
  ["lrNumber", "LR Number", "text", "Enter LR Number"],
  ["lrDate", "LR Date", "date"],
  ["transporterName", "Transporter Name", "text", "Enter Transporter Name"],
  ["transporterId", "Transporter ID", "text", "Enter Transporter ID"],
  ["ewayBillNumber", "E-Way Bill No.", "text", "12 digits"],
];
const OTHER_FIELDS = [
  ["challanNumber", "Challan Number", "text", "Printed on the bill"],
  ["dateOfSupply", "Date of Supply", "date"],
  ["placeOfSupply", "Place Of Supply", "text", "Place Of Supply"],
  ["dueDate", "Due Date (optional)", "date"],
  ["optionalField1", "Optional Field 1", "text"],
  ["optionalValue1", "Optional Value 1", "text"],
  ["optionalField2", "Optional Field 2", "text"],
  ["optionalValue2", "Optional Value 2", "text"],
  ["notes", "Note", "text", "Kept with the invoice"],
];
const BANK_FIELDS = [
  ["bankHolderName", "Account Holder Name"], ["bankAccount", "Bank Account Number"], ["bankIfsc", "Bank IFSC"],
  ["bankBranch", "Branch Name"], ["bankName", "Bank Name"],
];
const TRANSPORT_MODES = [["none", "None"], ["road", "Road"], ["rail", "Rail"], ["air", "Air"], ["ship", "Ship"]];

const EMPTY_DETAILS = {
  transportMode: "none", vehicleNumber: "", lrNumber: "", lrDate: "", transporterName: "", transporterId: "",
  ewayBillNumber: "", challanNumber: "", dateOfSupply: "", placeOfSupply: "", dueDate: "", optionalField1: "",
  optionalValue1: "", optionalField2: "", optionalValue2: "", notes: "", reverseCharge: false,
};

export default function CreateInvoice() {
  const { pathname } = useLocation();
  const { id } = useParams();
  const [params] = useSearchParams();
  // A fresh form whenever the record being worked on changes
  return <InvoiceForm key={`${pathname}?${params}`} editId={id} />;
}

// A small screen that edits some fields together
function FieldsSheet({ title, fields, values, onSave, onClose, children }) {
  const [form, setForm] = useState(values);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <Sheet title={title} onClose={onClose} onSubmit={() => onSave(form)}
      action={<button type="submit" className="sm:hidden px-3 py-2 font-bold text-brand-700">Save</button>}
      footer={<button type="submit" className="btn-primary h-12 sm:h-10">Save</button>}>
      {children?.(form, set)}
      <Cells>
        {fields.map(([key, label, type = "text", placeholder]) => (
          <Cell key={key} label={label} wide>
            <input type={type} placeholder={placeholder} className="cell-input" value={form[key] ?? ""}
              onChange={(e) => set(key, e.target.value)} />
          </Cell>
        ))}
      </Cells>
    </Sheet>
  );
}

// The filled-in values of a section, or its "Add" row
function Details({ rows, add, onEdit }) {
  const filled = rows.filter(([, value]) => value);
  if (!filled.length) return <AddRow icon={ListPlus} label={add} onClick={onEdit} />;
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <dl className="flex-1 min-w-0 space-y-1 text-sm">
        {filled.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-slate-500">{label}</dt>
            <dd className="min-w-0 text-right break-words font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <RoundButton icon={Pencil} label={add.replace("Add", "Edit")} onClick={onEdit} />
    </div>
  );
}

function InvoiceForm({ editId }) {
  const can = useCan();
  const canEditBusiness = can("settings");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const isQuote = pathname.startsWith("/quotations");
  const copyId = params.get("from");
  const sourceId = editId || copyId;
  const buyerParam = params.get("buyer");
  const noun = isQuote ? "quotation" : "invoice";
  const listPath = isQuote ? "/quotations" : "/invoices";

  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const [panel, setPanel] = useState(null); // which small screen is open
  const [original, setOriginal] = useState(null);
  const [profile, setProfile] = useState(null);

  const [invoiceType, setInvoiceType] = useState("tax_invoice");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [validUntil, setValidUntil] = useState("");
  const [numbering, setNumbering] = useState({ prefix: "", number: "", typed: false });
  const [supplier, setSupplier] = useState({});
  const [buyer, setBuyer] = useState(null);
  const [consigneeMode, setConsigneeMode] = useState("same");
  const [consignee, setConsignee] = useState({ name: "", gstin: "", address: "", city: "", state: "", pincode: "" });
  const [lines, setLines] = useState([]);
  const [taxMode, setTaxMode] = useState("exclusive");
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [bank, setBank] = useState({});
  const [showBank, setShowBank] = useState(true);
  const [terms, setTerms] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [printCopies, setPrintCopies] = useState(["recipient", "transporter", "supplier"]);
  const [buyerContext, setBuyerContext] = useState(null);

  // ── Load the business details, and the record being edited or copied ───────
  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        const [info, record] = await Promise.all([
          api.get("/auth/supplier-info"),
          sourceId ? api.get(`${listPath}/${sourceId}`) : null,
        ]);
        const chosen = !sourceId && buyerParam ? (await api.get(`/buyers/${buyerParam}`)).data.buyer : null;
        if (!current) return;
        const S = info.data.supplier;
        const doc = record && (record.data.invoice || record.data.quotation);
        // Details saved on the record win over the current profile
        const pick = (override, key) => doc?.[override] || S[key] || "";
        setProfile(S);
        setSupplier({
          name: pick("supplierName", "name"), gstin: pick("supplierGstin", "gstin"),
          address: pick("supplierAddress", "address"), city: pick("supplierCity", "city"),
          state: pick("supplierState", "state"), pincode: pick("supplierPincode", "pincode"),
          phone: pick("supplierPhone", "phone"), email: pick("supplierEmail", "email"),
          stateCode: pick("supplierStateCode", "stateCode") || "07",
        });
        const override = doc?.bankDetailsOverride;
        const custom = override && Object.values(override).some(Boolean);
        setBank({
          bankName: (custom ? override.bankName : S.bankName) || "",
          bankAccount: (custom ? override.bankAccount : S.bankAccount) || "",
          bankHolderName: (custom ? override.bankHolderName : S.name) || "",
          bankIfsc: (custom ? override.bankIfsc : S.bankIfsc) || "",
          bankBranch: (custom ? override.bankBranch : S.bankBranch) || "",
        });
        setTerms(doc ? doc.terms || "" : S.defaultTerms || defaultTerms(S.city));
        if (chosen) setBuyer(chosen);

        if (doc) {
          setBuyer(doc.buyer);
          setInvoiceType(doc.invoiceType);
          setTaxMode(doc.taxMode);
          setLines(doc.items.map((l) => ({
            key: nextKey(), item: l.item || null, name: l.name, description: l.description || "", hsn: l.hsn || "",
            unit: l.unit, quantity: l.quantity, rate: l.rate, gstPercent: l.gstPercent,
            taxMode: l.taxMode || doc.taxMode, discountType: l.discountType || "percent",
            discountValue: l.discountValue || "", cessType: l.cessType || "percent", cessValue: l.cessValue || "",
          })));
          setDiscountType(doc.discountType || "amount");
          setDiscountValue(doc.discountValue || "");
          setSignatureUrl(doc.signatureUrl || "");
          setShowBank(doc.showBankDetails !== false);
          setPrintCopies(doc.printCopies?.length ? doc.printCopies : ["recipient"]);
          setConsigneeMode(doc.consigneeMode || "same");
          if (doc.consignee?.name) setConsignee(doc.consignee);
          // A copy is a new supply: dates and consignment numbers start blank
          const carried = {
            transportMode: doc.transportMode || "none", transporterName: doc.transporterName || "",
            transporterId: doc.transporterId || "", notes: doc.notes || "",
            reverseCharge: Boolean(doc.reverseCharge),
            optionalField1: doc.optionalField1 || "", optionalValue1: doc.optionalValue1 || "",
            optionalField2: doc.optionalField2 || "", optionalValue2: doc.optionalValue2 || "",
          };
          if (!editId) setDetails({ ...EMPTY_DETAILS, ...carried });
          else {
            setOriginal(doc);
            setInvoiceDate(day(doc.invoiceDate));
            setValidUntil(day(doc.validUntil));
            setDetails({
              ...EMPTY_DETAILS, ...carried,
              dueDate: day(doc.dueDate), challanNumber: doc.challanNumber || "", vehicleNumber: doc.vehicleNumber || "",
              lrNumber: doc.lrNumber || "", lrDate: day(doc.lrDate), dateOfSupply: day(doc.dateOfSupply),
              placeOfSupply: doc.placeOfSupply || "", ewayBillNumber: doc.ewayBillNumber || "",
            });
          }
        }
        setReady(true);
      } catch (err) {
        if (!current) return;
        toast.error(err.response?.data?.message || "Could not load the form");
        if (sourceId) navigate(listPath);
        else setReady(true);
      }
    };
    load();
    return () => {
      current = false;
    };
  }, [editId, sourceId, buyerParam, listPath, navigate]);

  // The next number in the series, unless one has been typed
  const asking = !isQuote && !editId;
  useEffect(() => {
    if (!asking || !invoiceDate) return;
    let current = true;
    api.get("/invoices/next-number", { params: { date: invoiceDate } })
      .then(({ data }) => {
        if (current) setNumbering((n) => (n.typed ? n : { prefix: data.prefix, number: data.number, typed: false }));
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [asking, invoiceDate]);

  // Dues, credit limit and past prices of the chosen buyer
  const buyerId = buyer?._id;
  useEffect(() => {
    if (!buyerId) return;
    let current = true;
    api.get(`/ledger/buyer/${buyerId}/context`)
      .then(({ data }) => current && setBuyerContext({ ...data, buyerId }))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [buyerId]);
  const context = buyerContext && buyerContext.buyerId === buyerId ? buyerContext : null;

  // ── Totals ─────────────────────────────────────────────────────────────────
  const taxType = buyer ? taxTypeFor(supplier.stateCode, buyer.stateCode, buyer.gstTreatment) : "cgst_sgst";
  const billOfSupply = invoiceType === "bill_of_supply";
  const totals = computeTotals(lines, { taxType, taxMode, billOfSupply, discountType, discountValue });

  const alreadyCounted = original && original.buyer?._id === buyerId ? original.balanceAmount || 0 : 0;
  const duesAfter = context ? context.outstanding - alreadyCounted + totals.grandTotal : 0;
  const overLimit = !isQuote && context?.creditLimit > 0 && duesAfter > context.creditLimit;

  const setDetail = (values) => {
    setDetails((d) => ({ ...d, ...values }));
    setPanel(null);
  };

  // ── Lines ──────────────────────────────────────────────────────────────────
  const blank = {
    item: null, name: "", description: "", hsn: "", unit: "pcs", quantity: 1, rate: "", gstPercent: 18,
    taxMode, discountType: "percent", discountValue: "", cessType: "percent", cessValue: "",
  };

  const pickProduct = (product) => {
    setPanel({
      kind: "line",
      isNew: true,
      line: {
        ...blank,
        key: nextKey(),
        item: product._id || null,
        name: product.name || "",
        description: product.description || "",
        hsn: product.hsn || "",
        unit: product.unit || "pcs",
        quantity: product.defaultQuantity || 1,
        rate: product.price ?? "",
        gstPercent: product.gstPercent ?? 18,
        taxMode: product._id ? product.taxMode || "exclusive" : taxMode,
        discountType: product.discountType || "percent",
        discountValue: product.discountValue || "",
        cessType: product.cessType || "percent",
        cessValue: product.cessValue || "",
      },
    });
  };

  const saveLine = (line) => {
    setLines((list) =>
      list.some((l) => l.key === line.key) ? list.map((l) => (l.key === line.key ? line : l)) : [...list, line],
    );
    setPanel(null);
  };
  const removeLine = (key) => {
    setLines((list) => list.filter((l) => l.key !== key));
    setPanel(null);
  };

  // Changing the switch applies to every line, and to lines added later
  const changeTaxMode = (mode) => {
    setTaxMode(mode);
    setLines((list) => list.map((l) => ({ ...l, taxMode: mode })));
  };

  const uploadSignature = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      setSignatureUrl(await readImage(file));
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const busy = useRef(false);
  const save = async () => {
    if (busy.current) return;
    if (!buyer) return toast.error("Please select a buyer");
    if (!lines.length) return toast.error("Add at least one product");
    if (consigneeMode === "other" && !consignee.name.trim()) return toast.error("Enter the consignee's name");

    const text = (v) => (v === "" || v === undefined ? null : v);
    const payload = {
      ...details,
      lrDate: text(details.lrDate),
      dueDate: text(details.dueDate),
      dateOfSupply: text(details.dateOfSupply),
      buyerId: buyer._id,
      validUntil: validUntil || null,
      invoiceDate,
      invoiceType,
      taxMode,
      items: lines.map((l) => ({
        ...l,
        key: undefined, // only the screen needs it
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        gstPercent: Number(l.gstPercent),
        discountValue: Number(l.discountValue) || 0,
        cessValue: Number(l.cessValue) || 0,
      })),
      discountType,
      discountValue: Number(discountValue) || 0,
      terms,
      consigneeMode,
      consignee,
      bankDetailsOverride: bank,
      showBankDetails: showBank,
      signatureUrl,
      printCopies,
      supplierName: supplier.name,
      supplierGstin: supplier.gstin,
      supplierAddress: supplier.address,
      supplierCity: supplier.city,
      supplierState: supplier.state,
      supplierPincode: supplier.pincode,
      supplierPhone: supplier.phone,
      supplierEmail: supplier.email,
      supplierStateCode: supplier.stateCode,
      // Sent only when typed, so two people saving at once never clash
      ...(asking && numbering.typed && { invoiceNumber: `${numbering.prefix}${numbering.number}` }),
    };

    busy.current = true;
    setSaving(true);
    try {
      const { data } = editId
        ? await api.put(`${listPath}/${editId}`, payload)
        : await api.post(listPath, payload);
      const saved = data.invoice || data.quotation;
      toast.success(`${saved.invoiceNumber} ${editId ? "updated" : "saved"}`);
      navigate(isQuote ? "/quotations" : `/invoices/${saved._id}`);
    } catch (err) {
      if (err.response?.data?.upgrade) setUpgradePrompt(err.response.data.message);
      else toast.error(err.response?.data?.message || `Could not save the ${noun}`);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  if (!ready) return <div className="flex justify-center py-20"><Spinner /></div>;

  const title = editId ? `Edit ${noun}` : `New ${noun}`;
  const saveText = saving ? "Saving…" : `Save ${noun}`;
  const address = [supplier.address, supplier.city, supplier.state, supplier.pincode].filter(Boolean).join(", ");
  const mayType = asking && canEditBusiness;
  const summaryRows = [
    ["Taxable Amount", totals.subTotal],
    ...(taxType === "igst"
      ? [["Add: IGST", totals.totalIgst]]
      : [["Add: CGST", totals.totalCgst], ["Add: SGST", totals.totalSgst]]),
    ...(totals.totalCess ? [["Add: CESS", totals.totalCess]] : []),
    ["Tax Amount: GST", totals.totalTax],
  ];

  return (
    <div className="-m-4 lg:m-0">
      {/* The app opens here, so phones get the main menu rather than a back arrow */}
      <PageBar title={title} back={listPath} menu={!editId && !isQuote}>
        <button type="button" onClick={save} disabled={saving} className="px-3 py-2 font-bold text-brand-700">Save</button>
      </PageBar>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-5 lg:items-start">
        <div className="bg-white lg:card lg:overflow-hidden">
          {original && (
            <p className="px-4 py-2.5 text-sm text-slate-600 bg-brand-50 border-b border-slate-200">
              Editing <strong className="font-semibold">{original.invoiceNumber}</strong>. The number stays the same.
            </p>
          )}
          {profile && !(profile.name && profile.gstin) && canEditBusiness && (
            <p className="px-4 py-2.5 text-sm text-amber-900 bg-amber-50 border-b border-amber-200">
              Your business name or GSTIN is missing, so it will be blank on the bill.{" "}
              <Link to="/settings" className="font-semibold underline">Add it in Settings</Link>.
            </p>
          )}

          {/* Type, date and number */}
          <div role="radiogroup" aria-label="Invoice Type" className="flex flex-wrap gap-x-8 gap-y-2 px-4 pt-4 pb-2">
            {[["tax_invoice", "Tax Invoice"], ["bill_of_supply", "Bill of Supply"]].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2.5 py-1 text-sm font-bold cursor-pointer">
                <input type="radio" name="invoiceType" className="w-5 h-5" checked={invoiceType === value} onChange={() => setInvoiceType(value)} />
                {label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 px-4 pb-4 border-b border-slate-200">
            <label className="min-w-0">
              <span className="label">{isQuote ? "Quotation Date" : "Invoice Date"}</span>
              <input type="date" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="line-input" />
            </label>
            {isQuote ? (
              <>
                <label className="min-w-0">
                  <span className="label">Valid Until</span>
                  <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="line-input" />
                </label>
                <div className="min-w-0">
                  <span className="label">Quotation No.</span>
                  <p className="line-input text-slate-500">{original?.invoiceNumber || "Auto"}</p>
                </div>
              </>
            ) : (
              <>
                <label className="min-w-0">
                  <span className="label">Invoice Prefix</span>
                  <input value={original ? original.invoiceNumber.replace(/\d+$/, "") : numbering.prefix} readOnly={!mayType} maxLength={14}
                    onChange={(e) => setNumbering((n) => ({ ...n, prefix: e.target.value.replace(/[^A-Za-z0-9/-]/g, ""), typed: true }))}
                    className="line-input" />
                </label>
                <label className="min-w-0">
                  <span className="label">Invoice No.</span>
                  <input value={original ? original.invoiceNumber.match(/\d+$/)?.[0] || "" : numbering.number} readOnly={!mayType} inputMode="numeric" maxLength={14}
                    onChange={(e) => setNumbering((n) => ({ ...n, number: e.target.value.replace(/[^A-Za-z0-9/-]/g, ""), typed: true }))}
                    className="line-input text-center" />
                </label>
              </>
            )}
          </div>

          <Section title="Supplier Details">
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0 text-sm text-slate-600">
                <p className="font-bold text-slate-900">{supplier.name || "—"}</p>
                <p>{address || "—"}</p>
                <p>GSTIN: {supplier.gstin || "Unregistered"} · State Code: {supplier.stateCode || "—"}</p>
                {supplier.phone && <p>Phone: {supplier.phone}</p>}
              </div>
              {canEditBusiness && <RoundButton icon={Pencil} label="Edit supplier details" onClick={() => setPanel({ kind: "supplier" })} />}
            </div>
          </Section>

          <Section title="Buyer Details">
            {buyer ? (
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0 text-sm text-slate-600">
                  <p className="font-bold text-slate-900">{buyer.name}</p>
                  <p>{[buyer.address, buyer.city, buyer.state, buyer.pincode].filter(Boolean).join(", ")}</p>
                  <p>{buyer.gstin ? `GSTIN: ${buyer.gstin}` : "Unregistered Buyer"}</p>
                </div>
                <RoundButton icon={Pencil} label="Change buyer" onClick={() => setPanel({ kind: "buyer" })} />
                <RoundButton icon={X} label="Remove buyer" tone="plain" onClick={() => setBuyer(null)} />
              </div>
            ) : (
              <AddRow icon={UserPlus} label="Add Buyer" onClick={() => setPanel({ kind: "buyer" })}>
                {can("addBuyer") && <RoundButton icon={ListPlus} label="New buyer" onClick={() => setPanel({ kind: "buyer", startNew: true })} />}
              </AddRow>
            )}
            {context && (context.outstanding > 0 || overLimit) && (
              <p className={`px-4 py-2 text-sm border-t border-slate-100 ${overLimit ? "bg-red-50 text-red-800" : "bg-brand-50 text-slate-700"}`}>
                Currently owes {money(context.outstanding)}.
                {overLimit && ` With this bill it becomes ${money(duesAfter)}, over the credit limit of ${money(context.creditLimit)}.`}
              </p>
            )}
          </Section>

          <Section title="Consignee Details">
            <div className="px-4 py-2">
              {CONSIGNEE_MODES.map(([value, label]) => (
                <label key={value} className="flex items-center gap-3 py-2.5 text-sm cursor-pointer">
                  <input type="radio" name="consignee" className="w-5 h-5" checked={consigneeMode === value} onChange={() => setConsigneeMode(value)} />
                  {label}
                </label>
              ))}
            </div>
            {consigneeMode === "other" && (
              <div className="form-lines grid grid-cols-2 gap-3 px-4 pb-4 animate-rise">
                {[["name", "Consignee Name", true], ["gstin", "Consignee GSTIN"], ["address", "Consignee Address", true], ["city", "Consignee City"], ["pincode", "Consignee Pincode"]].map(([key, label, wide]) => (
                  <label key={key} className={wide ? "col-span-2" : ""}>
                    <span className="label">{label}</span>
                    <input className="input" value={consignee[key] || ""} maxLength={key === "gstin" ? 15 : 200}
                      onChange={(e) => {
                        const value = key === "gstin" ? e.target.value.toUpperCase() : e.target.value;
                        const state = key === "gstin" && GST_STATES[value.slice(0, 2)];
                        setConsignee((c) => ({ ...c, [key]: value, ...(state ? { state } : {}) }));
                      }} />
                  </label>
                ))}
                <label className="col-span-2">
                  <span className="label">Consignee State</span>
                  <select className="input" value={consignee.state || ""} onChange={(e) => setConsignee((c) => ({ ...c, state: e.target.value }))}>
                    <option value="">Select a state</option>
                    {STATE_OPTIONS.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
                  </select>
                </label>
              </div>
            )}
          </Section>

          <Section
            title="Product Details"
            extra={
              <div role="group" aria-label="Tax Mode" className="flex rounded-lg border border-slate-200 bg-white overflow-hidden">
                {[["exclusive", "Excl. GST"], ["inclusive", "Incl. GST"]].map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={taxMode === value} onClick={() => changeTaxMode(value)}
                    className={`px-3 py-1 text-xs font-bold transition ${taxMode === value ? "bg-brand-600 text-white" : "text-slate-500"}`}>
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            {lines.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {totals.items.map((l) => (
                  <li key={l.key} className="flex items-center gap-2 pr-2 animate-rise">
                    <button type="button" onClick={() => setPanel({ kind: "line", line: lines.find((x) => x.key === l.key) })}
                      aria-label={`Edit line ${l.name}`} className="flex flex-1 min-w-0 items-start justify-between gap-3 px-4 py-3 text-left hover:bg-brand-50">
                      <span className="min-w-0">
                        <span className="block font-bold text-slate-800 break-words">{l.name}</span>
                        <span className="block text-xs text-slate-500">
                          {l.quantity} {l.unit} × {money(l.rate)}{l.taxMode === "inclusive" ? " incl." : ""}
                          {l.discountAmount > 0 && ` · Discount ${money(l.discountAmount)}`}
                          {!billOfSupply && ` · GST ${l.gstPercent}%`}
                          {l.cessAmount > 0 && ` · CESS ${money(l.cessAmount)}`}
                        </span>
                      </span>
                      <span className="font-bold tabular whitespace-nowrap">{money(l.totalAmount)}</span>
                    </button>
                    <button type="button" onClick={() => removeLine(l.key)} aria-label={`Remove ${l.name}`} className="p-2 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <AddRow icon={ListPlus} label="Add Product" onClick={() => setPanel({ kind: "products" })} />
          </Section>

          <Section title="Transportation Details (Optional)">
            <Details add="Add Transportation details" onEdit={() => setPanel({ kind: "transport" })}
              rows={[
                ["Mode", details.transportMode !== "none" && TRANSPORT_MODES.find(([v]) => v === details.transportMode)?.[1]],
                ...TRANSPORT_FIELDS.map(([key, label, type]) => [label, type === "date" ? details[key] && shortDate(details[key]) : details[key]]),
              ]} />
          </Section>

          <Section title="Other Details (Optional)">
            <Details add="Add Other Details" onEdit={() => setPanel({ kind: "other" })}
              rows={[
                ...OTHER_FIELDS.map(([key, label, type]) => [label, type === "date" ? details[key] && shortDate(details[key]) : details[key]]),
                ["Reverse Charge", details.reverseCharge && "Yes"],
              ]} />
          </Section>

          <Section title="Bank Details (Optional)">
            {showBank ? (
              <div className="flex items-start gap-3 px-4 py-3">
                <dl className="flex-1 min-w-0 space-y-2">
                  {BANK_FIELDS.map(([key, label]) => (
                    <div key={key}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="text-sm font-semibold break-words">{bank[key] || "—"}</dd>
                    </div>
                  ))}
                </dl>
                {canEditBusiness && (
                  <>
                    <RoundButton icon={X} label="Leave bank details off this bill" tone="plain" onClick={() => setShowBank(false)} />
                    <RoundButton icon={ListPlus} label="Edit Bank Details" onClick={() => setPanel({ kind: "bank" })} />
                  </>
                )}
              </div>
            ) : (
              <AddRow icon={ListPlus} label="Add Bank Details" onClick={() => setShowBank(true)} />
            )}
          </Section>

          <Section title="Terms and Conditions">
            <div className="px-4 py-3">
              <textarea aria-label="Terms and Conditions" rows={4} value={terms} onChange={(e) => setTerms(e.target.value)}
                placeholder="Payment terms, delivery terms..." className="line-input h-auto resize-y" />
            </div>
          </Section>

          {canEditBusiness && (
            <Section title="Add Signature (Optional)">
              <div className="flex flex-wrap items-center gap-3 px-4 py-4">
                {signatureUrl && <img src={signatureUrl} alt="Signature Preview" className="h-16 max-w-[12rem] object-contain rounded-lg border border-slate-200 p-1" />}
                <label className="flex items-center gap-3 text-[15px] font-semibold text-brand-700 cursor-pointer focus-within:ring-2 focus-within:ring-brand-500 rounded">
                  <Upload className="w-5 h-5" /> {signatureUrl ? "Replace signature" : "Upload Signature"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadSignature} className="sr-only" />
                </label>
                {signatureUrl && (
                  <button type="button" onClick={() => setSignatureUrl("")} className="btn btn-sm text-red-700 hover:bg-red-50">Remove</button>
                )}
                {!signatureUrl && <p className="w-full text-xs text-slate-500">The signature saved in Settings is used if you add none.</p>}
              </div>
            </Section>
          )}
        </div>

        {/* Totals; beside the form on wide screens */}
        <aside className="lg:sticky lg:top-0 bg-white lg:card border-t border-slate-200 lg:border-t">
          <div className="card-head"><h2 className="card-title">Amount Summary</h2></div>
          <dl className="px-4 py-3 space-y-1.5 text-sm">
            {summaryRows.map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-slate-500">{label}</dt>
                <dd className="tabular">{money(value)}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 py-1.5">
              <dt className="text-slate-500">Discount</dt>
              <dd className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {[["amount", "₹"], ["percent", "%"]].map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={discountType === value} onClick={() => setDiscountType(value)}
                      className={`px-2.5 py-1 text-xs font-bold ${discountType === value ? "bg-brand-600 text-white" : "text-slate-500"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <input type="number" min="0" step="0.01" placeholder="0" aria-label="Discount on the bill" value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)} className="input h-8 w-24 text-right" />
              </dd>
            </div>
            {totals.roundOff !== 0 && (
              <div className="flex justify-between"><dt className="text-slate-500">Round Off</dt><dd className="tabular">{money(totals.roundOff)}</dd></div>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-200 text-lg font-bold">
              <dt>Total</dt>
              <dd className="tabular">{money(totals.grandTotal)}</dd>
            </div>
          </dl>
          <div className="hidden lg:flex gap-2 p-4 border-t border-slate-200">
            <button type="button" onClick={() => navigate(listPath)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="btn-primary flex-1">{saveText}</button>
          </div>
        </aside>
      </div>

      {/* Phones: the total and Save stay in reach */}
      <div className="lg:hidden sticky -bottom-4 z-20 flex items-center gap-3 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
        <p className="leading-tight">
          <span className="block text-xs text-slate-500">Total</span>
          <span className="block text-lg font-bold tabular">{money(totals.grandTotal)}</span>
        </p>
        <button type="button" onClick={save} disabled={saving} className="btn-primary h-12 flex-1 text-base">{saveText}</button>
      </div>

      {panel?.kind === "buyer" && (
        <BuyerPicker startNew={panel.startNew} onClose={() => setPanel(null)} onLimit={setUpgradePrompt}
          onSelect={(b) => {
            setBuyer(b);
            setPanel(null);
          }} />
      )}
      {panel?.kind === "products" && <ProductPicker onClose={() => setPanel(null)} onSelect={pickProduct} onLimit={setUpgradePrompt} />}
      {panel?.kind === "line" && (
        <LineForm line={panel.line} isNew={panel.isNew} billOfSupply={billOfSupply}
          lastPrice={context?.prices[String(panel.line.name).trim().toLowerCase()]}
          onClose={() => setPanel(null)} onSave={saveLine}
          onRemove={panel.isNew ? undefined : () => removeLine(panel.line.key)} />
      )}
      {panel?.kind === "supplier" && (
        <FieldsSheet title="Supplier details for this bill" fields={SUPPLIER_FIELDS} values={supplier}
          onClose={() => setPanel(null)}
          onSave={(values) => {
            setSupplier(values);
            setPanel(null);
          }} />
      )}
      {panel?.kind === "transport" && (
        <FieldsSheet title="Transportation Details" fields={TRANSPORT_FIELDS} values={details} onClose={() => setPanel(null)} onSave={setDetail}>
          {(form, set) => (
            <Cells>
              <Cell label="Transport Mode" wide>
                <select className="cell-input" value={form.transportMode} onChange={(e) => set("transportMode", e.target.value)}>
                  {TRANSPORT_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Cell>
            </Cells>
          )}
        </FieldsSheet>
      )}
      {panel?.kind === "other" && (
        <FieldsSheet title="Other Details" fields={OTHER_FIELDS} values={details} onClose={() => setPanel(null)} onSave={setDetail}>
          {(form, set) => (
            <label className="flex items-center justify-between gap-3 px-4 py-4 bg-slate-100 border-b border-slate-200 text-sm font-bold cursor-pointer">
              Reverse Charge
              <input type="checkbox" role="switch" className="switch" checked={form.reverseCharge} onChange={(e) => set("reverseCharge", e.target.checked)} />
            </label>
          )}
        </FieldsSheet>
      )}
      {panel?.kind === "bank" && (
        <FieldsSheet title="Bank details for this bill" fields={BANK_FIELDS} values={bank} onClose={() => setPanel(null)}
          onSave={(values) => {
            setBank(values);
            setPanel(null);
          }}>
          {(_form, set) => (
            <button type="button" className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-brand-700 bg-brand-50 border-b border-slate-200"
              onClick={() => {
                set("bankName", profile.bankName || "");
                set("bankAccount", profile.bankAccount || "");
                set("bankHolderName", profile.name || "");
                set("bankIfsc", profile.bankIfsc || "");
                set("bankBranch", profile.bankBranch || "");
              }}>
              Use Default Bank
            </button>
          )}
        </FieldsSheet>
      )}
      {upgradePrompt && <UpgradePrompt message={upgradePrompt} onClose={() => setUpgradePrompt(null)} />}
    </div>
  );
}
