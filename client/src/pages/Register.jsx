import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import AuthShell from "../components/AuthShell";

const FIELDS = [
  { name: "name", label: "Your name", type: "text", autoComplete: "name" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
];

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.password) {
      toast.error("Fill in all the fields");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success("Account created");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not create the account");
    } finally {
      setLoading(false);
    }
  };

  const passwordType = showPassword ? "text" : "password";

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        <>
          Already registered?{" "}
          <Link to="/login" className="text-brand-700 font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.name}>
            <label htmlFor={f.name} className="label">{f.label}</label>
            <input id={f.name} {...f} required value={form[f.name]} onChange={handleChange} className="input h-10" />
          </div>
        ))}
        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="relative">
            <input id="password" name="password" type={passwordType} autoComplete="new-password"
              required minLength={8} value={form.password} onChange={handleChange} className="input h-10 pr-10" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="confirmPassword" className="label">Confirm password</label>
          <input id="confirmPassword" name="confirmPassword" type={passwordType} autoComplete="new-password"
            required value={form.confirmPassword} onChange={handleChange} className="input h-10" />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full h-10">
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
