// Sign-in and sign-up screens: the form beside an animated tour of the app.
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Logo } from "./Logo";
import PanelShowcase from "./showcase/PanelShowcase";
import { FEATURES } from "./showcase/features";

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen lg:h-screen grid grid-cols-1 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:grid-rows-1">
      <aside className="relative hidden lg:flex flex-col gap-4 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-700 to-brand-950 px-8 py-6 xl:px-10 xl:py-8 text-white">
        <div aria-hidden="true" className="absolute inset-0 dot-grid" />
        <div aria-hidden="true" className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-float" />
        <div aria-hidden="true" className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-brand-300/30 blur-3xl animate-float [animation-delay:2s]" />
        <div className="relative flex flex-shrink-0 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-bold">GST Invoice</span>
          </Link>
          <Link to="/" className="group flex items-center gap-1.5 h-9 px-4 rounded-full border border-white/25 bg-white/10 text-xs font-bold transition hover:bg-white hover:text-brand-700">
            See everything it does
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <PanelShowcase />
        <p className="relative flex-shrink-0 text-center text-xs text-brand-200">Sample data shown</p>
      </aside>

      <main className="relative bg-white overflow-x-hidden lg:overflow-y-auto">
        <div aria-hidden="true" className="absolute inset-0 ledger-lines" />
        <div className="relative flex min-h-screen lg:min-h-full items-center justify-center p-6">
          <div className="w-full max-w-sm stagger">
            <Link to="/" className="flex items-center gap-2.5 mb-8 lg:hidden">
              <Logo />
              <span className="text-lg font-bold">GST Invoice</span>
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            <p className="mt-2 mb-7 text-slate-500">{subtitle}</p>
            {children}

            <div className="mt-8 border-t border-slate-200 pt-5 lg:hidden">
              <ul className="flex flex-wrap gap-2">
                {FEATURES.map((f) => (
                  <li key={f.id} className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
                    <f.icon className="w-3.5 h-3.5" /> {f.tab}
                  </li>
                ))}
              </ul>
              <Link to="/" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700">
                See everything it does <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
