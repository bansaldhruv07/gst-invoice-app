import { useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Upload } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { STATE_OPTIONS, GST_STATES, stateCodeFor } from "../lib/states";
import { defaultTerms } from "../lib/terms";
import { Spinner, EmptyState } from "../components/ui";
import AccountSettings from "../components/AccountSettings";
import BillDesignPicker from "../components/BillDesignPicker";
import { useCan } from "../context/AuthContext";

// Scales an uploaded image down so it stays small enough to store with the profile
function readImage(file, maxSide = 480) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not an image"));
    };
    img.src = url;
  });
}

function Section({ title, hint, children }) {
  return (
    <section className="grid lg:grid-cols-[15rem_1fr] gap-x-8 gap-y-3 py-6">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{hint}</p>
      </div>
      <div className="card p-5 grid sm:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function Field({ label, wide, children, note }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="label">{label}</span>
      {children}
      {note && <span className="block mt-1 text-xs text-slate-500">{note}</span>}
    </label>
  );
}

function ImageField({ label, value, onChange, note }) {
  const pick = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = await readImage(file);
      if (data.length > 900_000) throw new Error("That image is too detailed. Use a smaller one.");
      onChange(data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <span className="label">{label}</span>
      <div className="h-24 flex items-center justify-center border border-dashed border-slate-300 rounded-lg bg-white">
        {value ? (
          <img src={value} alt={label} className="max-h-20 max-w-[90%] object-contain" />
        ) : (
          <span className="text-sm text-slate-400">None uploaded</span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <label className="btn-secondary btn-sm cursor-pointer focus-within:ring-2 focus-within:ring-brand-500">
          <Upload className="w-3.5 h-3.5" /> {value ? "Replace" : "Upload"}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} className="sr-only" />
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")} className="btn btn-sm text-red-700 hover:bg-red-50">
            Remove
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function nextNumberExample(prefix, start) {
  const now = new Date();
  if (!prefix) return `INV-${now.getFullYear()}-0001`;
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${prefix}${year}-${String((year + 1) % 100).padStart(2, "0")}/${start || 1}`;
}

function SettingsForm({ business, onSaved }) {
  const [form, setForm] = useState(business);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(business);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Binds a text input to one profile field
  const bind = (key, transform = (v) => v) => ({
    value: form[key] ?? "",
    onChange: (e) => set(key, transform(e.target.value)),
    className: "input",
  });

  // The first two digits of a GSTIN are the state code
  const setGstin = (value) => {
    const gstin = value.toUpperCase();
    const code = gstin.slice(0, 2);
    setForm((f) => ({
      ...f,
      gstin,
      ...(GST_STATES[code] ? { stateCode: code, state: GST_STATES[code] } : {}),
    }));
  };

  const setState = (name) =>
    setForm((f) => ({ ...f, state: name, stateCode: stateCodeFor(name) || f.stateCode }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/auth/supplier-info", {
        ...form,
        invoiceStartNumber: Number(form.invoiceStartNumber) || 1,
      });
      setForm(data.supplier);
      onSaved(data.supplier);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save your settings");
    } finally {
      setSaving(false);
    }
  };

  const knownState = STATE_OPTIONS.some((s) => s.name === form.state);

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto -mt-6 divide-y divide-slate-200">
      <Section title="Business" hint="Printed at the top of every invoice.">
        <Field label="Business name" wide>
          <input required {...bind("name")} />
        </Field>
        <Field label="GSTIN">
          <input maxLength={15} value={form.gstin ?? ""} onChange={(e) => setGstin(e.target.value)} className="input font-mono" />
        </Field>
        <Field label="PAN" note="Kept on your profile; not printed on the invoice.">
          <input maxLength={10} {...bind("pan", (v) => v.toUpperCase())} />
        </Field>
        <Field label="Phone">
          <input required type="tel" {...bind("phone")} />
        </Field>
        <Field label="Email">
          <input type="email" {...bind("email")} />
        </Field>
        <Field label="Address" wide>
          <input {...bind("address")} />
        </Field>
        <Field label="City">
          <input {...bind("city")} />
        </Field>
        <Field label="Pincode">
          <input inputMode="numeric" maxLength={6} {...bind("pincode")} />
        </Field>
        <Field label="State">
          <select value={form.state ?? ""} onChange={(e) => setState(e.target.value)} className="input">
            <option value="">Select a state</option>
            {!knownState && form.state && <option value={form.state}>{form.state}</option>}
            {STATE_OPTIONS.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="GST state code" note="Decides between CGST + SGST and IGST.">
          <input maxLength={2} inputMode="numeric" {...bind("stateCode")} />
        </Field>
      </Section>

      <Section title="Logo and signature" hint="PNG or JPG. A signature on a plain white or transparent background prints best.">
        <ImageField label="Logo" value={form.logoUrl} onChange={(v) => set("logoUrl", v)}
          note="Top left of the invoice." />
        <ImageField label="Signature" value={form.signatureUrl} onChange={(v) => set("signatureUrl", v)}
          note="Used unless an invoice has its own." />
      </Section>

      <Section title="Bank account" hint="Where buyers should pay. Printed on the invoice.">
        <Field label="Bank name"><input {...bind("bankName")} /></Field>
        <Field label="Account number"><input inputMode="numeric" {...bind("bankAccount")} /></Field>
        <Field label="IFSC code"><input maxLength={11} {...bind("bankIfsc", (v) => v.toUpperCase())} /></Field>
        <Field label="Branch"><input {...bind("bankBranch")} /></Field>
        <Field label="UPI ID" wide note="Shows a payment QR on every unpaid invoice screen. It is not printed on the bill.">
          <input placeholder="shopname@bank" maxLength={100} {...bind("upiId", (v) => v.trim())} />
        </Field>
      </Section>

      <Section title="Bill design" hint="How your invoices, quotations and credit notes look when printed.">
        <div className="sm:col-span-2">
          <BillDesignPicker template={form.template || "classic"} color={form.color || "blue"}
            onChange={(next) => setForm((f) => ({ ...f, ...next }))} />
        </div>
      </Section>

      <Section title="Invoice preferences" hint="Numbering and the terms printed at the foot of the bill.">
        <Field label="Number prefix" note="Up to 5 characters, such as SBP. Numbers restart each April.">
          <input maxLength={5} {...bind("invoicePrefix", (v) => v.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} />
        </Field>
        <Field label="First number" note="To continue from your old bill book. Applies once, to the first invoice with this prefix.">
          <input type="number" min={1} max={99999} disabled={!form.invoicePrefix} {...bind("invoiceStartNumber")} />
        </Field>
        <p className="sm:col-span-2 text-sm text-slate-600">
          A new series looks like <span className="font-mono">{nextNumberExample(form.invoicePrefix, form.invoiceStartNumber)}</span>
        </p>
        <Field label="Default terms and conditions" wide note="Leave blank to use the standard two lines shown.">
          <textarea rows={4} placeholder={defaultTerms(form.city)} {...bind("defaultTerms")} />
        </Field>
      </Section>

      <div className={`flex items-center justify-end gap-3 py-4 bg-slate-50 ${dirty ? "sticky -bottom-6" : ""}`}>
        {dirty && <span className="text-sm text-slate-500">You have unsaved changes</span>}
        <button type="submit" disabled={saving || !dirty} className="btn-primary">
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}

export default function Settings() {
  const { business, setBusiness, refresh, error } = useBusiness();
  const can = useCan();

  // Team logins manage only their own password
  if (!can("settings")) return <AccountSettings />;

  if (error) {
    return (
      <EmptyState
        title="Could not load your business details"
        action={<button onClick={refresh} className="btn-secondary">Try again</button>}
      />
    );
  }
  if (!business) return <div className="flex justify-center py-20"><Spinner /></div>;
  return (
    <>
      <SettingsForm business={business} onSaved={setBusiness} />
      <AccountSettings />
    </>
  );
}
