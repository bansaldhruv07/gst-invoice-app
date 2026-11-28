// "Make a free bill": one invoice without an account, to download or share.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowRight, Download, Send, Plus, Trash2, Upload, ShieldCheck, Eraser } from "lucide-react";
import { Logo } from "../components/Logo";
import PdfPreview from "../components/invoice/PdfPreview";
import BillDesignPicker from "../components/BillDesignPicker";
import { Section, Cells, Cell } from "../components/mobile/Rows";
import { blankForm, sampleForm, emptyLine, missingFrom, buildGuestBill, makeGuestPdf, MAX_LINES } from "../lib/guestBill";
import { STATE_OPTIONS, GST_STATES } from "../lib/states";
import { UNIT_LABELS, GST_RATES } from "../lib/units";
import { readImage } from "../lib/image";
import { canSharePdf, sharePdf } from "../lib/invoicePdf";
import { todayISO } from "../lib/period";
import { money } from "../lib/format";

// The logo with its size, which the bill needs to place it
function useLogo(src) {
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => setLoaded({ data: src, width: img.naturalWidth, height: img.naturalHeight });
    img.src = src;
  }, [src]);
  return loaded?.data === src ? loaded : null;
}

function PartyFields({ party, onChange, seller }) {
  const bind = (key, transform = (v) => v) => ({
    value: party[key],
    onChange: (e) => onChange({ [key]: transform(e.target.value) }),
    className: "cell-input",
  });
  // The first two digits of a GSTIN are the state code
  const gstin = (value) => {
    const next = value.toUpperCase();
    onChange({ gstin: next, ...(GST_STATES[next.slice(0, 2)] && { state: GST_STATES[next.slice(0, 2)] }) });
  };
  return (
    <Cells>
      <Cell label={seller ? "Business name" : "Buyer name"} wide><input maxLength={90} {...bind("name")} /></Cell>
      <Cell label="GSTIN (optional)"><input maxLength={15} value={party.gstin} onChange={(e) => gstin(e.target.value)} className="cell-input" /></Cell>
      <Cell label="State">
        <select {...bind("state")}>
          {STATE_OPTIONS.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
        </select>
      </Cell>
      <Cell label="Address" wide={!seller}><input maxLength={200} {...bind("address")} /></Cell>
      {seller && <Cell label="Phone"><input type="tel" maxLength={20} {...bind("phone")} /></Cell>}
    </Cells>
  );
}

export default function TryInvoice() {
  const [form, setForm] = useState(() => sampleForm(todayISO()));
  const [design, setDesign] = useState({ template: "modern", color: "blue" });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const logo = useLogo(form.logo);
  const { invoice } = buildGuestBill(form);
  const shareable = canSharePdf();

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setParty = (key) => (patch) => setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));
  const setLine = (index, patch) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }));

  useEffect(() => {
    const before = document.title;
    document.title = "Free GST bill maker — GST Invoice";
    return () => {
      document.title = before;
    };
  }, []);

  // Redrawn a moment after typing stops
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      makeGuestPdf(form, design, logo)
        .then(({ doc }) => current && setPreview(doc.output("blob")))
        .catch((err) => {
          console.error("Preview:", err);
          if (current) toast.error("Could not draw the bill");
        });
    }, 500);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [form, design, logo]);

  const withBill = (work) => async () => {
    const missing = missingFrom(form);
    if (missing) return toast.error(missing);
    setBusy(true);
    try {
      await work(await makeGuestPdf(form, design, logo));
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
        toast.error("Could not make the PDF");
      }
    } finally {
      setBusy(false);
    }
  };
  const download = withBill(({ doc, fileName }) => doc.save(fileName));
  const share = withBill(async ({ doc, fileName }) => {
    if (shareable && (await sharePdf(doc, fileName, fileName))) return;
    if (!shareable) doc.save(fileName);
    toast("The PDF was downloaded. Attach it where you want to send it.");
  });

  const pickLogo = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      set({ logo: await readImage(file) });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const actions = (
    <>
      <button type="button" onClick={download} disabled={busy} className="btn-primary h-12 flex-1 text-base">
        <Download className="w-5 h-5" /> Download PDF
      </button>
      <button type="button" onClick={share} disabled={busy} className="btn-secondary h-12 flex-1 text-base">
        <Send className="w-5 h-5" /> Share
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center gap-3 h-16 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="w-9 h-9" />
            <span className="text-lg font-bold text-slate-900">GST Invoice</span>
          </Link>
          <Link to="/login" className="ml-auto px-3 py-2 text-sm font-bold text-slate-700 hover:text-brand-700">Log in</Link>
          <Link to="/register" className="btn-primary">Sign up free</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto">
            <h1 className="text-3xl font-bold text-slate-900">Make a free GST bill</h1>
            <p className="mt-1 text-slate-600">Change the sample details to your own, then download or share the PDF. No sign-up needed.</p>
          </div>
          <button type="button" onClick={() => setForm(blankForm(todayISO()))} className="btn-secondary">
            <Eraser className="w-4 h-4" /> Clear sample
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> What you type stays on this device. It is not sent to us or saved.
        </p>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="card overflow-hidden">
            <Section title="Your business">
              <PartyFields seller party={form.seller} onChange={setParty("seller")} />
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-200">
                {form.logo && <img src={form.logo} alt="Your logo" className="h-10 max-w-[6rem] object-contain" />}
                <label className="btn-secondary btn-sm cursor-pointer focus-within:ring-2 focus-within:ring-brand-500">
                  <Upload className="w-3.5 h-3.5" /> {form.logo ? "Replace logo" : "Add your logo"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} className="sr-only" />
                </label>
                {form.logo && <button type="button" onClick={() => set({ logo: "" })} className="btn btn-sm text-red-700 hover:bg-red-50">Remove</button>}
              </div>
              <details>
                <summary className="px-4 py-3 text-sm font-bold text-brand-700 cursor-pointer">Bank details (optional)</summary>
                <Cells className="border-t">
                  {[["bankName", "Bank name"], ["bankAccount", "Account number"], ["bankIfsc", "IFSC code"]].map(([key, label]) => (
                    <Cell key={key} label={label} wide={key === "bankName"}>
                      <input maxLength={40} className="cell-input" value={form.seller[key]}
                        onChange={(e) => setParty("seller")({ [key]: key === "bankIfsc" ? e.target.value.toUpperCase() : e.target.value })} />
                    </Cell>
                  ))}
                </Cells>
              </details>
            </Section>

            <Section title="Buyer">
              <PartyFields party={form.buyer} onChange={setParty("buyer")} />
            </Section>

            <Section title="Bill">
              <Cells>
                <Cell label="Invoice No."><input maxLength={16} className="cell-input" value={form.number} onChange={(e) => set({ number: e.target.value })} /></Cell>
                <Cell label="Date"><input type="date" className="cell-input" value={form.date} onChange={(e) => e.target.value && set({ date: e.target.value })} /></Cell>
                <Cell label="Type">
                  <select className="cell-input" value={form.billOfSupply ? "supply" : "tax"} onChange={(e) => set({ billOfSupply: e.target.value === "supply" })}>
                    <option value="tax">Tax Invoice</option>
                    <option value="supply">Bill Of Supply</option>
                  </select>
                </Cell>
                <Cell label="Rates">
                  <select className="cell-input" disabled={form.billOfSupply} value={form.inclusive ? "in" : "ex"} onChange={(e) => set({ inclusive: e.target.value === "in" })}>
                    <option value="ex">Before GST</option>
                    <option value="in">Include GST</option>
                  </select>
                </Cell>
              </Cells>
            </Section>

            <Section title="Products">
              {form.lines.map((line, i) => {
                const bind = (key) => ({
                  value: line[key],
                  onChange: (e) => setLine(i, { [key]: e.target.value }),
                  className: "cell-input",
                });
                return (
                  <fieldset key={i} className="border-b-4 border-slate-100">
                    <legend className="sr-only">Product {i + 1}</legend>
                    <Cells>
                      <Cell label={`Product ${i + 1}`} wide><input maxLength={90} placeholder="Name of product" {...bind("name")} /></Cell>
                      <Cell label="Quantity"><input type="number" inputMode="decimal" min="0" step="any" {...bind("quantity")} /></Cell>
                      <Cell label="Unit">
                        <select {...bind("unit")}>
                          {Object.entries(UNIT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      </Cell>
                      <Cell label="Rate (₹)"><input type="number" inputMode="decimal" min="0" step="any" {...bind("rate")} /></Cell>
                      <Cell label="GST %">
                        <select disabled={form.billOfSupply} {...bind("gstPercent")}>
                          {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </Cell>
                      <Cell label="HSN/SAC (optional)" wide={form.lines.length === 1}><input maxLength={8} inputMode="numeric" {...bind("hsn")} /></Cell>
                      {form.lines.length > 1 && (
                        <div className="flex items-center justify-end bg-white px-3">
                          <button type="button" onClick={() => set({ lines: form.lines.filter((_, n) => n !== i) })}
                            aria-label={`Remove product ${i + 1}`} className="btn btn-sm text-red-700 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      )}
                    </Cells>
                  </fieldset>
                );
              })}
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                {form.lines.length < MAX_LINES ? (
                  <button type="button" onClick={() => set({ lines: [...form.lines, emptyLine()] })} className="flex items-center gap-2 text-sm font-bold text-brand-700">
                    <Plus className="w-4 h-4" /> Add Product
                  </button>
                ) : <span className="text-sm text-slate-500">Sign up to make longer bills.</span>}
                <p className="text-sm font-bold">Total <span className="ml-2 text-lg tabular">{money(invoice.grandTotal)}</span></p>
              </div>
            </Section>
          </div>

          <div className="space-y-4 lg:sticky lg:top-20">
            <div className="card p-4"><BillDesignPicker {...design} onChange={setDesign} /></div>
            <div className="hidden sm:flex gap-3">{actions}</div>
            <PdfPreview blob={preview} label="Your bill" />
            <div className="card flex flex-wrap items-center gap-3 p-5">
              <p className="mr-auto min-w-[14rem] flex-1 text-sm text-slate-600">
                <b className="block text-base text-slate-900">Keep your bills and buyers</b>
                With a free account the bill number, tax and totals fill themselves in, and payments and stock are tracked.
              </p>
              <Link to="/register" className="btn-primary">Create free account <ArrowRight className="w-4 h-4" /></Link>
            </div>
          </div>
        </div>
      </main>

      {/* Phones: the two actions stay within reach */}
      <div className="sm:hidden sticky bottom-0 z-30 flex gap-3 border-t border-slate-200 bg-white p-3">{actions}</div>
    </div>
  );
}
