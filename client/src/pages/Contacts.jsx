// Buyers and sellers share one screen; only the money fields differ.
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Plus, Search, Pencil, Trash2, Upload } from "lucide-react";
import Modal, { Field } from "../components/Modal";
import UpgradePrompt from "../components/UpgradePrompt";
import { Spinner, EmptyState } from "../components/ui";
import { STATE_OPTIONS, GST_STATES } from "../lib/states";
import { money } from "../lib/format";
import { useCan } from "../context/AuthContext";

const EMPTY = {
  name: "", gstin: "", address: "", city: "", state: "", pincode: "", mobile: "", email: "",
  openingBalance: "", creditLimit: "",
};

function ContactForm({ kind, contact, onClose, onSaved, onLimit }) {
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
    setForm((f) => ({ ...f, gstin, ...(state ? { state } : {}) }));
  };

  const save = async () => {
    setSaving(true);
    const body = { ...form, openingBalance: Number(form.openingBalance) || 0, creditLimit: Number(form.creditLimit) || 0 };
    try {
      if (contact?._id) await api.put(`/${kind}/${contact._id}`, body);
      else await api.post(`/${kind}`, body);
      toast.success(`${isBuyer ? "Buyer" : "Seller"} saved`);
      onSaved();
      onClose();
    } catch (err) {
      if (err.response?.data?.upgrade) onLimit(err.response.data.message);
      else toast.error(err.response?.data?.message || `Could not save the ${noun}`);
    } finally {
      setSaving(false);
    }
  };

  const knownState = STATE_OPTIONS.some((s) => s.name === form.state);

  return (
    <Modal
      wide
      title={contact?._id ? `Edit ${noun}` : `New ${noun}`}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name" wide><input required autoFocus {...bind("name")} /></Field>
        <Field label="GSTIN" note="Leave blank if unregistered.">
          <input maxLength={15} value={form.gstin} onChange={(e) => setGstin(e.target.value)} className="input font-mono" />
        </Field>
        <Field label="State">
          <select {...bind("state")}>
            <option value="">Select a state</option>
            {!knownState && form.state && <option value={form.state}>{form.state}</option>}
            {STATE_OPTIONS.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Mobile" note="Used for WhatsApp reminders."><input type="tel" {...bind("mobile")} /></Field>
        <Field label="Email"><input type="email" {...bind("email")} /></Field>
        <Field label="Address" wide><input {...bind("address")} /></Field>
        <Field label="City"><input {...bind("city")} /></Field>
        <Field label="Pincode"><input inputMode="numeric" maxLength={6} {...bind("pincode")} /></Field>
        <Field
          label="Opening balance (₹)"
          note={isBuyer ? "Money they already owed you." : "Money you already owed them."}
        >
          <input type="number" min="0" step="0.01" {...bind("openingBalance")} />
        </Field>
        {isBuyer && (
          <Field label="Credit limit (₹)" note="You are warned when a bill goes over it. Blank means no limit.">
            <input type="number" min="0" step="1" {...bind("creditLimit")} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

export default function Contacts({ kind }) {
  const can = useCan();
  const isBuyer = kind === "buyers";
  const noun = isBuyer ? "buyer" : "seller";
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [limit, setLimit] = useState("");

  const load = useCallback(
    () =>
      api.get(`/${kind}`, { params: search ? { search } : {} })
        .then(({ data }) => setList(data[kind]))
        .catch(() => {
          setList([]);
          toast.error(`Could not load ${kind}`);
        }),
    [kind, search],
  );

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/${kind}/${c._id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <section className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 items-center p-3 border-b border-slate-200">
          <div className="relative flex-1 min-w-[14rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${kind} by name`} aria-label={`Search ${kind}`} className="input pl-9" />
          </div>
          {isBuyer && can("import") && (
            <Link to="/settings#import" className="btn-secondary"><Upload className="w-4 h-4" /> Import</Link>
          )}
          {can(kind === "buyers" ? "addBuyer" : "editSellers") && (
            <button onClick={() => setEditing({})} className="btn-primary"><Plus className="w-4 h-4" /> Add {noun}</button>
          )}
        </div>

        {list === null ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState title={search ? "No match" : `No ${kind} yet`}
            hint={search ? "Try another name." : `Add your first ${noun} to start billing.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Name</th>
                  <th className="th">GSTIN</th>
                  <th className="th hidden md:table-cell">Place</th>
                  <th className="th hidden md:table-cell">Mobile</th>
                  <th className="th text-right">Opening balance</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c._id} onClick={() => navigate(`/${kind}/${c._id}`)} className="hover:bg-slate-50 cursor-pointer">
                    <td className="td">
                      <Link to={`/${kind}/${c._id}`} className="font-medium text-brand-700 hover:underline">{c.name}</Link>
                    </td>
                    <td className="td font-mono text-xs">{c.gstin || <span className="font-sans text-slate-500">Unregistered</span>}</td>
                    <td className="td hidden md:table-cell">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="td hidden md:table-cell">{c.mobile || "—"}</td>
                    <td className="td text-right whitespace-nowrap">{c.openingBalance ? money(c.openingBalance) : "—"}</td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {can(kind === "buyers" ? "editBuyer" : "editSellers") && (
                          <button onClick={() => setEditing(c)} title="Edit" aria-label={`Edit ${c.name}`} className="btn btn-sm text-slate-600 hover:bg-slate-100">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {can(kind === "buyers" ? "deleteBuyer" : "editSellers") && (
                          <button onClick={() => remove(c)} title="Delete" aria-label={`Delete ${c.name}`} className="btn btn-sm text-slate-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list?.length > 0 && (
          <p className="px-4 py-2.5 text-sm text-slate-500">{list.length} {list.length === 1 ? noun : kind}</p>
        )}
      </section>

      {editing && (
        <ContactForm kind={kind} contact={editing} onClose={() => setEditing(null)} onSaved={load} onLimit={setLimit} />
      )}
      {limit && <UpgradePrompt message={limit} onClose={() => setLimit("")} />}
    </div>
  );
}
