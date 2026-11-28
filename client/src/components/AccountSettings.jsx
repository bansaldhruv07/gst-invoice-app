// Import from a spreadsheet, download a backup and change the password.
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import api from "../api/axios";
import { downloadCsv, parseCsv } from "../lib/csv";
import { todayISO } from "../lib/period";
import { useAuth, useCan } from "../context/AuthContext";

const TEMPLATES = {
  buyers: {
    label: "Buyers",
    columns: ["name", "gstin", "mobile", "email", "address", "city", "state", "pincode", "opening balance", "credit limit"],
    example: ["Sharma Traders", "", "9876543210", "", "Main Bazaar", "Rohtak", "Haryana", "124001", "5000", ""],
  },
  items: {
    label: "Products",
    columns: ["name", "hsn", "unit", "price", "purchase price", "gst", "opening stock", "low stock at"],
    example: ["Wall putty 20 kg", "32141000", "bag", "400", "320", "18", "50", "10"],
  },
};

function Importer({ type }) {
  const { label, columns, example } = TEMPLATES[type];
  const [rows, setRows] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const read = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);
    const parsed = parseCsv(await file.text());
    if (!parsed.length) return toast.error("The file has no rows");
    if (!("name" in parsed[0])) return toast.error("The first line must contain a “name” heading");
    setRows(parsed);
  };

  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/data/import/${type}`, { rows });
      setResult(data);
      setRows(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-medium">{label}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => downloadCsv(`${type}-template.csv`, [columns, example])} className="btn-secondary btn-sm">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Template
        </button>
        <label className="btn-secondary btn-sm cursor-pointer focus-within:ring-2 focus-within:ring-brand-500">
          <Upload className="w-3.5 h-3.5" /> Choose CSV
          <input type="file" accept=".csv,text/csv" onChange={read} className="sr-only" aria-label={`Choose ${label} CSV`} />
        </label>
        {rows && (
          <button type="button" onClick={run} disabled={busy} className="btn-primary btn-sm">
            {busy ? "Importing…" : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
      {result && (
        <div className="mt-2 text-sm">
          <p className="text-emerald-800">Added {result.created}. Skipped {result.skipped.length}.</p>
          {result.skipped.length > 0 && (
            <ul className="mt-1 max-h-32 overflow-y-auto text-slate-600">
              {result.skipped.map((s) => (
                <li key={s.line}>Line {s.line}{s.name && ` (${s.name})`}: {s.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Backup() {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const { data } = await api.get("/data/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-${todayISO()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not create the backup");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={download} disabled={busy} className="btn-secondary">
      <Download className="w-4 h-4" /> {busy ? "Preparing…" : "Download backup"}
    </button>
  );
}

function Password() {
  const EMPTY = { currentPassword: "", newPassword: "", repeat: "" };
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.repeat) return toast.error("The new passwords do not match");
    setBusy(true);
    try {
      const { data } = await api.put("/auth/password", form);
      // Other sessions are signed out; this one carries on with the new token
      if (data.token) localStorage.setItem("token", data.token);
      setForm(EMPTY);
      toast.success("Password changed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not change the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid sm:grid-cols-3 gap-4">
      {[
        ["currentPassword", "Current password", "current-password"],
        ["newPassword", "New password", "new-password"],
        ["repeat", "Repeat new password", "new-password"],
      ].map(([key, label, autoComplete]) => (
        <label key={key}>
          <span className="label">{label}</span>
          <input type="password" required minLength={key === "currentPassword" ? undefined : 8} autoComplete={autoComplete}
            value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="input" />
        </label>
      ))}
      <div className="sm:col-span-3">
        <button type="submit" disabled={busy} className="btn-secondary">{busy ? "Changing…" : "Change password"}</button>
      </div>
    </form>
  );
}

function Mobile() {
  const { user, updateUser } = useAuth();
  const [mobile, setMobile] = useState(user?.mobile || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put("/auth/mobile", { mobile, currentPassword: password });
      updateUser(data.user);
      setMobile(data.user.mobile);
      setPassword("");
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save the number");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid sm:grid-cols-3 gap-4">
      <label>
        <span className="label">Mobile number</span>
        <input type="tel" inputMode="tel" autoComplete="tel-national" maxLength={15} placeholder="98765 43210"
          value={mobile} onChange={(e) => setMobile(e.target.value)} className="input" />
      </label>
      <label>
        <span className="label">Your password</span>
        <input type="password" required autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} className="input" />
      </label>
      <div className="flex items-end">
        <button type="submit" disabled={busy || mobile === (user?.mobile || "")} className="btn-secondary">
          {busy ? "Saving…" : "Save number"}
        </button>
      </div>
    </form>
  );
}

function Block({ id, title, hint, children }) {
  return (
    <section id={id} className="grid lg:grid-cols-[15rem_1fr] gap-x-8 gap-y-3 py-6">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{hint}</p>
      </div>
      <div className="card p-5">{children}</div>
    </section>
  );
}

export default function AccountSettings() {
  const { hash } = useLocation();
  const can = useCan();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="max-w-5xl mx-auto mt-6 border-t border-slate-200 divide-y divide-slate-200">
      {can("import") && (
      <Block id="import" title="Import" hint="Bring buyers and products from Excel or your old software. Save the sheet as CSV. Names that already exist are skipped.">
        <div className="grid sm:grid-cols-2 gap-6">
          <Importer type="buyers" />
          <Importer type="items" />
        </div>
      </Block>
      )}
      {can("export") && (
      <Block id="backup" title="Backup" hint="A copy of all your records in one file. Keep it somewhere safe.">
        <Backup />
      </Block>
      )}
      <Block id="mobile" title="Mobile sign-in" hint="Sign in with your mobile number and password, as well as with your email.">
        <Mobile />
      </Block>
      <Block id="password" title="Password" hint="At least 8 characters. Changing it signs out your other devices.">
        <Password />
      </Block>
    </div>
  );
}
