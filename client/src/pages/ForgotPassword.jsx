import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { MailCheck } from "lucide-react";
import api from "../api/axios";
import AuthShell from "../components/AuthShell";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
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
      {sent ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 animate-pop">
          <MailCheck className="w-5 h-5 flex-shrink-0" />
          <p>{sent} It works for 30 minutes. Look in spam too.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className="input h-10" />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full h-10">
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
