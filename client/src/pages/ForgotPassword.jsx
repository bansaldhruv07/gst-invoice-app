import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { MailCheck, KeyRound } from "lucide-react";
import api from "../api/axios";
import AuthShell from "../components/AuthShell";

export default function ForgotPassword() {
  const [login, setLogin] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);
  // Whether the server can send email; unknown until it answers
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    api.get("/auth/options")
      .then(({ data }) => setAvailable(data.passwordReset))
      .catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { login });
      setSent(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not send the link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle={
        <>
          Remembered it?{" "}
          <Link to="/login" className="text-brand-700 font-medium hover:underline">Sign in</Link>
        </>
      }
    >
      {available === false ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 animate-pop">
          <KeyRound className="w-5 h-5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="font-bold">Reset by email is not switched on yet.</p>
            <p>Staff login: ask the business owner to set a new password for you on the Team page.</p>
            <p>Business owner: please contact the person who set up this app for you.</p>
          </div>
        </div>
      ) : sent ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 animate-pop">
          <MailCheck className="w-5 h-5 flex-shrink-0" />
          <p>{sent} It works for 30 minutes. Look in spam too.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">Email or mobile number</label>
            <input id="email" type="text" autoComplete="username" autoCapitalize="none" spellCheck="false" required value={login}
              onChange={(e) => setLogin(e.target.value)} className="input h-10" />
            <p className="mt-1 text-xs text-slate-500">The link is sent to the email address of your account.</p>
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full h-10">
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
