import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import AuthShell from "../components/AuthShell";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.password) {
      toast.error("Enter your email or mobile number, and your password");
      return;
    }

    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || (err.response ? "Could not sign in" : "Could not reach the server. Check your internet and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle={
        <>
          New here?{" "}
          <Link to="/register" className="text-brand-700 font-medium hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">Email or mobile number</label>
          <input id="email" type="text" name="email" autoComplete="username" autoCapitalize="none" spellCheck="false" required
            placeholder="name@example.com or 98765 43210" value={form.email} onChange={handleChange} className="input h-10" />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="password" className="label">Password</label>
            <Link to="/forgot-password" className="mb-1 text-sm font-medium text-brand-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input id="password" type={showPassword ? "text" : "password"} name="password"
              autoComplete="current-password" required value={form.password}
              onChange={handleChange} className="input h-10 pr-10" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full h-10">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
