import { NavLink, useNavigate } from "react-router-dom";
import { useAuth, useCan } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  LayoutGrid,
  FileText,
  Users,
  Package,
  ShoppingCart,
  Truck,
  Settings,
  CreditCard,
  LogOut,
  ClipboardList,
  Wallet,
  Boxes,
  BarChart3,
  UserCog,
  CalendarCheck,
  Plus,
} from "lucide-react";
import { Logo, Spark } from "./Logo";
import { ASSISTANT_NAME } from "../lib/assistant";
import { SHOW_ASSISTANT } from "../lib/flags";

const NAV = [
  { items: [{ label: "Overview", icon: LayoutGrid, to: "/dashboard" }] },
  {
    heading: "Sales",
    items: [
      { label: "Invoices", icon: FileText, to: "/invoices" },
      { label: "Quotations", icon: ClipboardList, to: "/quotations" },
      { label: "Buyers", icon: Users, to: "/buyers" },
    ],
  },
  {
    heading: "Purchases",
    items: [
      { label: "Purchases", icon: ShoppingCart, to: "/purchases", need: "purchases" },
      { label: "Sellers", icon: Truck, to: "/sellers", need: "sellers" },
      { label: "Expenses", icon: Wallet, to: "/expenses", need: "expenses" },
    ],
  },
  {
    heading: "Inventory",
    items: [
      { label: "Products", icon: Package, to: "/items" },
      { label: "Stock", icon: Boxes, to: "/stock", need: "stock" },
    ],
  },
  {
    heading: "Business",
    items: [
      { label: "Attendance", icon: CalendarCheck, to: "/attendance", need: "workers" },
      { label: "Reports", icon: BarChart3, to: "/reports", need: "reports" },
      { label: "Team", icon: UserCog, to: "/team", need: "team" },
      { label: "Settings", icon: Settings, to: "/settings" },
      { label: "Plans", icon: CreditCard, to: "/pricing", need: "plans" },
    ],
  },
];

export default function Sidebar({ open, onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const can = useCan();
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.need || can(i.need)) })).filter(
    (g) => g.items.length,
  );

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
    navigate("/login");
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-60 flex flex-col bg-white border-r border-slate-200
        transition-transform duration-300 lg:static lg:translate-x-0 ${open ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
    >
      <div className="flex items-center gap-2.5 h-16 px-5">
        <Logo />
        <span className="text-lg font-bold text-slate-900 tracking-tight">GST Invoice</span>
      </div>

      {(SHOW_ASSISTANT || can("createInvoice")) && (
      <div className="px-3 pb-2">
        <NavLink
          to={SHOW_ASSISTANT ? "/assistant" : "/invoices/create"}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-2.5 h-11 px-3 rounded-xl text-sm font-bold text-white transition hover:-translate-y-px
             bg-gradient-to-r from-brand-600 to-brand-500 shadow-glow ${isActive ? "ring-4 ring-brand-100" : ""}`
          }
        >
          {SHOW_ASSISTANT ? (
            <><Spark className="w-4 h-4 transition-transform duration-500 group-hover:rotate-90" /> Ask {ASSISTANT_NAME}</>
          ) : (
            <><Plus className="w-4 h-4 transition-transform duration-500 group-hover:rotate-90" /> New invoice</>
          )}
        </NavLink>
      </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {groups.map((group, i) => (
          <div key={group.heading || i} className="mb-3">
            {group.heading && (
              <p className="px-3 mb-1 text-xs font-semibold text-slate-400">{group.heading}</p>
            )}
            {group.items.map(({ label, icon: Icon, to }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 h-9 px-3 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-700 font-bold before:absolute before:-left-3 before:inset-y-2 before:w-1 before:rounded-r-full before:bg-brand-600"
                      : "text-slate-600 font-medium hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0 transition-transform group-hover:scale-110" strokeWidth={1.8} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-slate-150 px-4 py-3">
        <span className="w-9 h-9 flex-shrink-0 grid place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
          {(user?.name || "?").charAt(0).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{user?.name}</p>
          <p className="text-xs text-slate-400 truncate">
            {user?.role === "staff" ? "Billing staff" : user?.role === "accountant" ? "Accountant" : user?.email}
          </p>
        </div>
        <button
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
