import { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { Menu, Plus, Search } from "lucide-react";
import CommandPalette from "./CommandPalette";
import Sidebar from "./Sidebar";
import Assistant from "./Assistant";
import { Spark } from "./Logo";
import { BusinessProvider, useBusiness } from "../context/BusinessContext";
import { AssistantProvider, useAssistant } from "../context/AssistantContext";
import { useSubscription } from "../context/SubscriptionContext";
import { ASSISTANT_NAME } from "../lib/assistant";
import { useCan } from "../context/AuthContext";

const TITLES = [
  [/^\/team/, "Team"],
  [/^\/dashboard$/, "Overview"],
  [/^\/assistant$/, ASSISTANT_NAME],
  [/^\/invoices$/, "Invoices"],
  [/^\/invoices\/create$/, "New invoice"],
  [/^\/invoices\/[^/]+\/edit$/, "Edit invoice"],
  [/^\/quotations$/, "Quotations"],
  [/^\/quotations\/create$/, "New quotation"],
  [/^\/quotations\/[^/]+\/edit$/, "Edit quotation"],
  [/^\/buyers\/./, "Buyer statement"],
  [/^\/sellers\/./, "Seller statement"],
  [/^\/stock$/, "Stock"],
  [/^\/expenses$/, "Expenses"],
  [/^\/reports$/, "Reports"],
  [/^\/invoices\/./, "Invoice"],
  [/^\/purchases$/, "Purchases"],
  [/^\/purchases\/create$/, "New purchase"],
  [/^\/buyers$/, "Buyers"],
  [/^\/sellers$/, "Sellers"],
  [/^\/items$/, "Products"],
  [/^\/settings$/, "Settings"],
  [/^\/pricing$/, "Plans"],
];

function Shell() {
  const { pathname } = useLocation();
  const { business } = useBusiness();
  const subscription = useSubscription();
  const { open: assistantOpen, setOpen: setAssistantOpen } = useAssistant();
  const can = useCan();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title = TITLES.find(([pattern]) => pattern.test(pathname))?.[1] || "";
  const planName = subscription?.plan?.displayName;
  const writing = /\/(create|edit)$/.test(pathname);
  const onAssistant = pathname === "/assistant";

  return (
    <div className="flex h-screen overflow-clip">
      <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[2px] animate-fade lg:hidden"
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex-shrink-0 flex items-center gap-3 px-4 lg:px-6 bg-white/80 backdrop-blur border-b border-slate-200">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="lg:hidden p-1.5 -ml-1.5 text-slate-600"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 key={title} className="text-lg font-bold truncate animate-fade">{title}</h1>

          <div className="ml-auto flex items-center gap-2">
            {business && (
              <Link
                to="/settings"
                className="hidden md:flex items-center gap-2.5 mr-2 pr-4 border-r border-slate-200 transition hover:opacity-70"
              >
                {business.logoUrl && (
                  <img src={business.logoUrl} alt="" className="w-9 h-9 object-contain" />
                )}
                <span className="text-right leading-tight">
                  <span className="block text-sm font-bold max-w-[16rem] truncate">
                    {business.name || "Set up your business"}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {[business.gstin, planName && `${planName} plan`].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            )}
            <button onClick={() => setSearchOpen(true)} className="btn-secondary" title="Search (Ctrl+K)" aria-label="Search">
              <Search className="w-4 h-4" strokeWidth={2} />
              <span className="hidden xl:inline text-slate-400 font-medium">Ctrl K</span>
            </button>
            {!writing && can("createInvoice") && (
              <Link to="/invoices/create" className="btn-primary">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New invoice</span>
              </Link>
            )}
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto p-4 lg:p-6">
          {/* Room at the bottom so the floating button never covers content */}
          <div key={pathname} className={`animate-rise ${onAssistant ? "h-full" : "pb-20"}`}>
            <Outlet />
          </div>
        </main>
      </div>

      {!onAssistant && !assistantOpen && !writing && (
        <button
          onClick={() => setAssistantOpen(true)}
          aria-label="Assistant"
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 h-14 pl-4 pr-5 rounded-full text-sm font-bold text-white bg-gradient-to-br from-brand-500 to-brand-700 shadow-xl animate-halo transition hover:-translate-y-1"
        >
          <Spark className="w-5 h-5" />
          Ask {ASSISTANT_NAME}
        </button>
      )}
      <Assistant />
      {searchOpen && <CommandPalette onClose={closeSearch} />}
    </div>
  );
}

export default function Layout() {
  return (
    <BusinessProvider>
      <AssistantProvider>
        <Shell />
      </AssistantProvider>
    </BusinessProvider>
  );
}
