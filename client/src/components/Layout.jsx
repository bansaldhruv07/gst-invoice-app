import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import Sidebar from "./Sidebar";
import { ChevronDown, LogOut, Star, Settings } from "lucide-react";
import toast from "react-hot-toast";

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [supplier, setSupplier] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const { data } = await api.get("/auth/supplier-info");
        if (data && data.supplier) {
          setSupplier(data.supplier);
        }
      } catch (err) {
        console.error("Failed to fetch supplier info in layout:", err);
      }
    };
    fetchSupplier();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const getPageTitle = (pathname) => {
    if (pathname === "/dashboard") return "Invoices";
    if (pathname === "/purchases") return "Purchases";
    if (pathname === "/buyers") return "Buyers";
    if (pathname === "/sellers") return "Sellers";
    if (pathname === "/items") return "Items";
    if (pathname === "/pricing") return "Pricing";
    if (pathname === "/invoices/create") return "Create Invoice";
    if (pathname.startsWith("/invoices/")) return "Invoice Detail";
    if (pathname === "/purchases/create") return "Create Purchase";
    return "Dashboard";
  };

  const businessName = supplier?.name || "AGGARWAL TRADERS";
  const businessPhone = supplier?.phone || "9015220297";
  const businessGstin = supplier?.gstin || "";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Fixed left sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Fixed Permanent Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-30 flex-shrink-0 relative">
          {/* Left Side: Page Title */}
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              {getPageTitle(location.pathname)}
            </h1>
          </div>

          {/* Right Side: Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-3 px-3 py-1.5 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100"
            >
              {/* Profile Avatar logo */}
              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                {supplier?.logoUrl ? (
                  <img
                    src={supplier.logoUrl}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                    {businessName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Business Profile Name */}
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-slate-700 leading-tight">
                  {businessName}
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  {businessPhone || "No Phone"}
                </p>
              </div>

              {/* Arrow */}
              <ChevronDown
                className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <div className="absolute right-0 mt-2 w-82 bg-white rounded-xl border border-slate-200 shadow-xl z-50 p-4 transform origin-top-right transition-all duration-150">
                {/* Header Section */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                      {supplier?.logoUrl ? (
                        <img
                          src={supplier.logoUrl}
                          alt="Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-base shadow-sm flex-shrink-0">
                          {businessName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 leading-snug truncate">
                        {businessName}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium truncate">
                        {businessPhone}
                      </p>
                      {businessGstin && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          GST: {businessGstin}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="flex-shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    Active
                  </span>
                </div>

                <div className="border-t border-slate-100 my-3" />

                {/* Plan Details Card - Gold highlighted */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 my-3 shadow-inner relative overflow-hidden group">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                          Plan - E-Plan
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-700 font-medium mt-1 leading-snug">
                        Premium invoicing & reports package.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-200/50 px-2 py-0.5 rounded-md border border-amber-200">
                      Expires: 25 May 2029
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-amber-250/60 pt-2 text-[11px]">
                    <span className="text-amber-750 font-semibold">
                      Basic Plan Details
                    </span>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate("/pricing");
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                    >
                      View Plan Details
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 my-3" />

                {/* Business Settings Link */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate("/settings");
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors font-semibold mb-2 text-left"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  Business Settings
                </button>

                {/* Actions */}
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-600 font-semibold text-sm rounded-lg border border-slate-200 hover:border-red-200 transition-colors duration-150 shadow-sm"
                >
                  <LogOut className="w-4.5 h-4.5" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
