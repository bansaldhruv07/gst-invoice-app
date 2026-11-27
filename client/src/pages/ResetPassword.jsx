// Opened from the link in the reset email.
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [form, setForm] = useState({ password: "", repeat: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.repeat) return toast.error("The passwords do not match");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/reset-password", { token, password: form.password });
      toast.success(data.message);
      logout();
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not change the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={
        <Link to="/forgot-password" className="text-brand-700 font-medium hover:underline">
          Ask for a new link
        </Link>
      }
    >
      {!token ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          This address is missing its reset code. Open the link from your email again.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {[["password", "New password"], ["repeat", "Repeat new password"]].map(([key, label]) => (
            <div key={key}>
              <label htmlFor={key} className="label">{label}</label>
              <input id={key} type="password" autoComplete="new-password" required minLength={8} maxLength={72}
                value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="input h-10" />
            </div>
          ))}
          <p className="text-xs text-slate-500">At least 8 characters.</p>
          <button type="submit" disabled={busy} className="btn-primary w-full h-10">
            {busy ? "Saving…" : "Save new password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
