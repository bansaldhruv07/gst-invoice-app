// Add or edit a buyer or a seller.
import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/axios";
import Sheet from "../mobile/Sheet";
import { Field } from "../Modal";
import { STATE_OPTIONS, GST_STATES } from "../../lib/states";
import { useCan } from "../../context/AuthContext";

const EMPTY = {
  name: "", gstin: "", address: "", city: "", state: "", pincode: "", mobile: "", email: "",
  gstTreatment: "", optionalField1: "", optionalValue1: "", alsoSeller: false,
  openingBalance: "", creditLimit: "",
};

const TREATMENTS = [
  ["", "Not set"],
  ["registered", "Registered business"],
  ["composition", "Composition scheme"],
  ["unregistered", "Unregistered business"],
  ["consumer", "Consumer"],
  ["overseas", "Overseas"],
  ["sez", "SEZ unit or developer"],
];

export default function ContactForm({ kind, contact = {}, onClose, onSaved, onLimit }) {
  const can = useCan();
  const isBuyer = kind === "buyers";
  const noun = isBuyer ? "buyer" : "seller";
  const [form, setForm] = useState({ ...EMPTY, ...contact });
  const [saving, setSaving] = useState(false);
  const bind = (key) => ({
    value: form[key] ?? "",
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    className: "input",
  });

  // The first two digits of a GSTIN give the state
  const setGstin = (value) => {
    const gstin = value.toUpperCase();
    const state = GST_STATES[gstin.slice(0, 2)];
    setForm((f) => ({
      ...f,
      gstin,
      ...(state ? { state } : {}),
      ...(gstin.length === 15 && !f.gstTreatment ? { gstTreatment: "registered" } : {}),
    }));
  };

  const save = async () => {
    setSaving(true);
    const body = { ...form, openingBalance: Number(form.openingBalance) || 0, creditLimit: Number(form.creditLimit) || 0 };
    try {
      const { data } = contact._id
        ? await api.put(`/${kind}/${contact._id}`, body)
        : await api.post(`/${kind}`, body);
      toast.success(`${isBuyer ? "Buyer" : "Seller"} saved`);
      onSaved?.(data[noun]);
      onClose();
    } catch (err) {
      if (err.response?.data?.upgrade && onLimit) onLimit(err.response.data.message);
      else toast.error(err.response?.data?.message || `Could not save the ${noun}`);
    } finally {
      setSaving(false);
    }
  };

  const knownState = STATE_OPTIONS.some((s) => s.name === form.state);

  return (
    <Sheet
      wide
      title={contact._id ? `Edit ${noun}` : `New ${noun}`}
      onClose={onClose}
      onSubmit={save}
      action={<button type="submit" disabled={saving} className="sm:hidden px-3 py-2 font-bold text-brand-700">Save</button>}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary !hidden sm:!inline-flex">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary h-12 sm:h-10">{saving ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <div className="form-lines grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:p-5">
        <Field label="GSTIN" wide note="Leave blank if unregistered.">
          <input autoFocus maxLength={15} value={form.gstin} onChange={(e) => setGstin(e.target.value)} className="input font-mono" />
        </Field>
        <Field label="Name" wide><input required {...bind("name")} /></Field>
        <Field label="Email" wide><input type="email" {...bind("email")} /></Field>
        <Field label="Mobile" wide note="Used for WhatsApp reminders."><input type="tel" {...bind("mobile")} /></Field>
        <Field label="Address" wide><input {...bind("address")} /></Field>
        <Field label="City"><input {...bind("city")} /></Field>
        <Field label="Pincode"><input inputMode="numeric" maxLength={6} {...bind("pincode")} /></Field>
        <Field label="State" wide>
          <select {...bind("state")}>
            <option value="">Select a state</option>
            {!knownState && form.state && <option value={form.state}>{form.state}</option>}
            {STATE_OPTIONS.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
          </select>
        </Field>
        {isBuyer && (
          <Field label="GST Treatment Type" wide>
            <select {...bind("gstTreatment")}>
              {TREATMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
        )}
      </div>

      <h3 className="px-4 sm:px-5 py-2.5 bg-slate-100 border-y border-slate-200 text-sm font-bold text-slate-700">Optional Details</h3>
      <div className="form-lines grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:p-5">
        {isBuyer && (
          <>
            <Field label="Optional Field 1"><input placeholder="e.g. PAN" maxLength={60} {...bind("optionalField1")} /></Field>
            <Field label="Optional Value 1"><input maxLength={200} {...bind("optionalValue1")} /></Field>
          </>
        )}
        <Field
          label="Opening balance (₹)"
          wide={!isBuyer}
          note={isBuyer ? "Money they already owed you." : "Money you already owed them."}
        >
          <input type="number" min="0" step="0.01" {...bind("openingBalance")} />
        </Field>
        {isBuyer && (
          <Field label="Credit limit (₹)" note="You are warned when a bill goes over it.">
            <input type="number" min="0" step="1" {...bind("creditLimit")} />
          </Field>
        )}
        {isBuyer && can("editSellers") && (
          <label className="col-span-2 flex items-center gap-3 py-1 text-sm font-semibold cursor-pointer">
            <input type="checkbox" className="w-5 h-5 rounded-full" checked={Boolean(form.alsoSeller)}
              onChange={(e) => setForm((f) => ({ ...f, alsoSeller: e.target.checked }))} />
            Do you also purchase items from this buyer?
          </label>
        )}
      </div>
    </Sheet>
  );
}
