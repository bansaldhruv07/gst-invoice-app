// Logins for the people who work in the business, and what they did.
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { UserPlus, ReceiptText, BookOpenCheck, KeyRound, Trash2, Pause, Play, Lock } from "lucide-react";
import api from "../api/axios";
import Modal, { Field } from "../components/Modal";
import { Spinner, EmptyState } from "../components/ui";

const ROLES = {
  staff: {
    label: "Billing staff",
    icon: ReceiptText,
    can: "Make invoices and quotations, add buyers and products, take payments.",
    cannot: "Cannot edit, cancel or delete bills, see costs, purchases or profit, or change settings.",
  },
  accountant: {
    label: "Accountant",
    icon: BookOpenCheck,
    can: "See every record and report, and download exports.",
    cannot: "Cannot add, change or delete anything.",
  },
};

const message = (err, fallback) => err.response?.data?.message || fallback;

function MemberForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" });
  const [saving, setSaving] = useState(false);
  const bind = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    className: "input",
  });

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/team", form);
      toast.success("Login added. Give them the email and password.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(message(err, "Could not add the login"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add a team login" onClose={onClose} onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Adding…" : "Add login"}</button>
        </>
      }>
      <div className="space-y-4">
        <Field label="Name"><input required autoFocus {...bind("name")} /></Field>
        <Field label="Email" note="They sign in with this."><input required type="email" autoComplete="off" {...bind("email")} /></Field>
        <Field label="Password" note="At least 8 characters. They can change it in Settings.">
          <input required minLength={8} maxLength={72} type="text" autoComplete="off" {...bind("password")} />
        </Field>
        <Field label="Role" note={ROLES[form.role].cannot}>
          <select {...bind("role")}>
            {Object.entries(ROLES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function PasswordForm({ member, onClose }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/team/${member.id}`, { password });
      toast.success("Password changed. Their other devices are signed out.");
      onClose();
    } catch (err) {
      toast.error(message(err, "Could not change the password"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`New password for ${member.name}`} onClose={onClose} onSubmit={save}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
        </>
      }>
      <Field label="New password">
        <input required autoFocus minLength={8} maxLength={72} type="text" autoComplete="off" className="input"
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
    </Modal>
  );
}

function Members() {
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(null);

  const load = useCallback(
    () => api.get("/team")
      .then((res) => setData(res.data))
      .catch((err) => {
        setData({ members: [], allowed: false });
        toast.error(message(err, "Could not load the team"));
      }),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const change = async (member, body, done) => {
    try {
      await api.put(`/team/${member.id}`, body);
      toast.success(done);
      load();
    } catch (err) {
      toast.error(message(err, "Could not save the change"));
    }
  };

  const remove = async (member) => {
    if (!window.confirm(`Remove ${member.name}'s login? Their past entries stay in the activity log.`)) return;
    try {
      await api.delete(`/team/${member.id}`);
      toast.success("Login removed");
      load();
    } catch (err) {
      toast.error(message(err, "Could not remove the login"));
    }
  };

  if (!data) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
        {Object.values(ROLES).map((r) => (
          <div key={r.label} className="card card-lift flex gap-3.5 p-5">
            <span className="grid place-items-center w-11 h-11 flex-shrink-0 rounded-xl bg-brand-50 text-brand-600">
              <r.icon className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold">{r.label}</h2>
              <p className="mt-1 text-sm text-slate-600">{r.can}</p>
              <p className="mt-1 text-xs text-slate-500">{r.cannot}</p>
            </div>
          </div>
        ))}
      </div>

      {!data.allowed && (
        <div className="card flex flex-wrap items-center gap-3 p-5">
          <Lock className="w-5 h-5 text-saffron-700" />
          <p className="flex-1 min-w-[14rem] text-sm text-slate-600">
            Team logins come with the Pro plan{data.members.length > 0 && ". Existing logins are paused until you renew"}.
          </p>
          <Link to="/pricing" className="btn-primary">See plans</Link>
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="card-head">
          <h2 className="card-title">Logins</h2>
          {data.allowed && data.members.length < data.limit && (
            <button onClick={() => setAdding(true)} className="btn-primary btn-sm">
              <UserPlus className="w-3.5 h-3.5" /> Add login
            </button>
          )}
        </div>
        {data.members.length === 0 ? (
          <EmptyState title="Only you can sign in" hint="Add a login so staff can bill without seeing your profit." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {m.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-[10rem]">
                  <p className="text-sm font-bold">
                    {m.name}
                    {m.disabled && <span className="ml-2 badge bg-slate-100 text-slate-500 border-slate-200">Paused</span>}
                  </p>
                  <p className="text-xs text-slate-500 break-all">{m.email}</p>
                </div>
                <select aria-label={`Role of ${m.name}`} value={m.role} className="input w-auto"
                  onChange={(e) => change(m, { role: e.target.value }, "Role changed")}>
                  {Object.entries(ROLES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
                </select>
                <div className="flex gap-1">
                  <button onClick={() => change(m, { disabled: !m.disabled }, m.disabled ? "Login resumed" : "Login paused")}
                    title={m.disabled ? "Resume" : "Pause"} aria-label={`${m.disabled ? "Resume" : "Pause"} ${m.name}`}
                    className="btn btn-sm text-slate-600 hover:bg-slate-100">
                    {m.disabled ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setResetting(m)} title="New password" aria-label={`New password for ${m.name}`}
                    className="btn btn-sm text-slate-600 hover:bg-slate-100">
                    <KeyRound className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(m)} title="Remove" aria-label={`Remove ${m.name}`}
                    className="btn btn-sm text-slate-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {adding && <MemberForm onClose={() => setAdding(false)} onSaved={load} />}
      {resetting && <PasswordForm member={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

const when = (value) =>
  new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });

function ActivityLog() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    let current = true;
    api.get("/activity", { params: { page } })
      .then((res) => current && setData(res.data))
      .catch((err) => {
        if (!current) return;
        setData({ entries: [], totalPages: 1 });
        toast.error(message(err, "Could not load the activity log"));
      });
    return () => {
      current = false;
    };
  }, [page]);

  if (!data) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <section className="card overflow-hidden">
      {data.entries.length === 0 ? (
        <EmptyState title="Nothing yet" hint="Changes made by you and your team will be listed here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">When</th>
                <th className="th">Who</th>
                <th className="th">What they did</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e._id}>
                  <td className="td whitespace-nowrap text-slate-500">{when(e.createdAt)}</td>
                  <td className="td whitespace-nowrap">
                    <span className="font-bold">{e.actorName}</span>
                    <span className="block text-xs text-slate-500">{ROLES[e.role]?.label || "Owner"}</span>
                  </td>
                  <td className="td">
                    {e.action}
                    {e.label && <span className="block text-xs text-slate-500">{e.label}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
          <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="btn-secondary btn-sm">Newer</button>
          <span className="text-slate-500">Page {page} of {data.totalPages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.totalPages} className="btn-secondary btn-sm">Older</button>
        </div>
      )}
    </section>
  );
}

export default function Team() {
  const [tab, setTab] = useState("members");
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div role="tablist" className="flex gap-2">
        {[["members", "Team"], ["activity", "Activity log"]].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={tab === key ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
            {label}
          </button>
        ))}
      </div>
      {tab === "members" ? <Members /> : <ActivityLog />}
    </div>
  );
}
