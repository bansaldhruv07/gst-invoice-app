import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  FileText,
  LayoutDashboard,
  Users,
  Package,
  PlusCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Receipt,
} from "lucide-react";

// ─── Navigation items ─────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    label: "Dashboard",
    icon:  LayoutDashboard,
    to:    "/dashboard",
  },
  {
    label: "Invoices",
    icon:  Receipt,
    to:    "/dashboard", // goes to dashboard which shows invoice list
    exact: true,
  },
  {
    label: "Create Invoice",
    icon:  PlusCircle,
    to:    "/invoices/create",
  },
  {
    label: "Buyers",
    icon:  Users,
    to:    "/buyers",
  },
  {
    label: "Items / Products",
    icon:  Package,
    to:    "/items",
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  // Collapsible sidebar state — collapsed shows only icons
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  // ── Get initials from user name for avatar ────────────────────────────────
  const getInitials = (name = "") => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside
      className={`
        relative flex flex-col h-screen bg-slate-900 text-white
        transition-all duration-300 ease-in-out flex-shrink-0
        ${collapsed ? "w-16" : "w-60"}
      `}
    >
      {/* ── Toggle collapse button ──────────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 z-10 w-6 h-6 bg-slate-700 hover:bg-indigo-600 rounded-full flex items-center justify-center shadow-lg transition-colors duration-200"
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3 text-white" />
          : <ChevronLeft  className="w-3 h-3 text-white" />
        }
      </button>

      {/* ── Brand / Logo ────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-700 ${collapsed ? "justify-center px-2" : ""}`}>
        <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm text-white leading-tight truncate">
              GST Invoice
            </p>
            <p className="text-xs text-slate-400 leading-tight">
              Invoice Manager
            </p>
          </div>
        )}
      </div>

      {/* ── Business name badge ──────────────────────────────────────────────── */}
      {!collapsed && user && (
        <div className="mx-3 mt-3 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700">
          <p className="text-xs text-slate-400 leading-tight">Logged in as</p>
          <p className="text-sm font-semibold text-white truncate">{user.name}</p>
        </div>
      )}

      {/* ── Navigation links ─────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">

        {/* Section label */}
        {!collapsed && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Sales
          </p>
        )}

        {NAV_ITEMS.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to + label}
            to={to}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-150 group
              ${collapsed ? "justify-center" : ""}
              ${isActive
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }
            `}
            title={collapsed ? label : undefined}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}

        {/* Divider */}
        <div className="border-t border-slate-700 my-3" />

        {/* Section label */}
        {!collapsed && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Masters
          </p>
        )}

        <NavLink
          to="/buyers"
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            transition-all duration-150
            ${collapsed ? "justify-center" : ""}
            ${isActive
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }
          `}
          title={collapsed ? "Buyers" : undefined}
        >
          <Users className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Buyers / Customers</span>}
        </NavLink>

        <NavLink
          to="/items"
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            transition-all duration-150
            ${collapsed ? "justify-center" : ""}
            ${isActive
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }
          `}
          title={collapsed ? "Items" : undefined}
        >
          <Package className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Items / Products</span>}
        </NavLink>
      </nav>

      {/* ── User profile + Logout ────────────────────────────────────────────── */}
      <div className="border-t border-slate-700 p-3">
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>

          {/* Avatar circle with initials */}
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">
              {getInitials(user?.name)}
            </span>
          </div>

          {/* Name + email */}
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {user?.email}
              </p>
            </div>
          )}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors duration-150"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}