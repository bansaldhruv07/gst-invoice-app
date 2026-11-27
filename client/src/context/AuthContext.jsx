import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

// ─── Create the context ───────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ─── AuthProvider: wraps entire app, holds auth state ────────────────────────
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true); // true while checking localStorage

  // ── On app load: restore user from localStorage ───────────────────────────
  // This prevents flash-to-login on page refresh
  useEffect(() => {
    const savedUser  = localStorage.getItem("user");
    const savedToken = localStorage.getItem("token");

    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // Corrupted data — clear it
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }
    setLoading(false);

    // Roles can change while someone is signed in, so ask the server again
    if (savedToken) {
      api.get("/auth/me")
        .then(({ data }) => {
          localStorage.setItem("user", JSON.stringify(data.user));
          setUser(data.user);
        })
        .catch((err) => {
          if (err.response?.status !== 403) return;
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setUser(null);
        });
    }
  }, []);

  // ── Register ──────────────────────────────────────────────────────────────
  const register = async (name, email, password) => {
    const { data } = await api.post("/auth/register", {
      name,
      email,
      password,
    });

    // Save token and user to localStorage for persistence
    localStorage.setItem("token", data.token);
    localStorage.setItem("user",  JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });

    localStorage.setItem("token", data.token);
    localStorage.setItem("user",  JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Custom hook: use this in any component to access auth ────────────────────
// Usage: const { user, login, logout } = useAuth();
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
// What this login may do. The server enforces it; this only hides what would be refused.
// Usage: const can = useCan(); can("editInvoice")
export function useCan() {
  const { user } = useAuth();
  return (ability) => (user?.can ? Boolean(user.can[ability]) : true);
}
