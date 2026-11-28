// Public home page. Say only what the app does.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Check, Plus, Menu, X, Settings2, FilePlus2, Send, FileText, ShoppingCart, ClipboardList,
  Users, Upload, Undo2,
} from "lucide-react";
import api from "../api/axios";
import PhoneDemo from "../components/showcase/PhoneDemo";
import DesignGallery from "../components/showcase/DesignGallery";
import ProductTour from "../components/showcase/ProductTour";
import PlanCards, { PeriodSwitch } from "../components/PlanCards";
import { INCLUDED } from "../lib/pricing";
import { Logo } from "../components/Logo";
import { useReveal } from "../hooks/motion";

const LINKS = [
  ["#how", "How it works"],
  ["#designs", "Bill designs"],
  ["#features", "Features"],
  ["#pricing", "Pricing"],
  ["#faq", "Questions"],
];

const STEPS = [
  [Settings2, "Add your business once", "Name, GSTIN, logo and bank details. They appear on every bill from then on."],
  [FilePlus2, "Make the bill", "Pick the buyer and the products. GST, totals and the bill number are filled in for you."],
  [Send, "Send it and get paid", "Download, print or share the PDF, then record the payment when it arrives."],
];

const MORE = [
  [FileText, "Tax invoice and bill of supply", "CGST and SGST, or IGST, chosen from the buyer's state."],
  [ClipboardList, "Quotations", "Send a price offer and turn it into an invoice in one tap."],
  [Undo2, "Returns and credit notes", "Take goods back and the dues and stock adjust."],
  [ShoppingCart, "Purchases and expenses", "Record what you buy and spend, and what you owe."],
  [Users, "Staff logins", "Let staff make bills without seeing your costs or profit."],
  [Upload, "Easy to move in and out", "Import buyers and products from CSV, and download a full backup."],
];

const FOR = ["Retail shops", "Hardware and building material", "Wholesalers and distributors", "Manufacturers", "Contractors and suppliers"];

const FAQ = [
  ["Can I make a bill without signing up?", "Yes. The free bill maker lets you fill in one bill and download or share it. Nothing you type there is saved."],
  ["Does it work on a phone?", "Yes. It works in the browser on any phone or computer, and you can add it to your home screen."],
  ["Can I use my own logo and bill design?", "Yes. Add your logo and signature, pick one of four designs and choose a colour."],
  ["Can I continue my old bill numbers?", "Yes. Set your prefix and next number in Settings. Numbering continues from there each financial year."],
  ["Can I bring my data from other software?", "Buyers and products can be imported from a CSV file saved out of Excel. Old dues can be entered as opening balances."],
  ["Does it file my GST returns?", "No. It prepares GSTR-1 and GSTR-3B working sheets from your records, which you or your accountant use to file."],
];

function Heading({ eyebrow, title, text }) {
  return (
    <div className="reveal max-w-2xl mx-auto mb-10 text-center">
      <p className="font-bold text-brand-600">{eyebrow}</p>
      <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900">{title}</h2>
      {text && <p className="mt-3 text-slate-600">{text}</p>}
    </div>
  );
}

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled || open ? "bg-white/85 backdrop-blur-lg border-b border-slate-200 shadow-sm" : "border-b border-transparent"}`}>
      <div className="max-w-6xl mx-auto flex items-center gap-4 h-[72px] px-5">
        <a href="#top" className="flex items-center gap-2.5">
          <Logo className="w-9 h-9" />
          <span className="text-xl font-bold text-slate-900">GST Invoice</span>
        </a>
        <nav className="hidden lg:flex mx-auto gap-8">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="relative font-medium text-slate-600 hover:text-brand-700 transition-colors after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-brand-600 after:transition-transform hover:after:scale-x-100">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto lg:ml-0 flex items-center gap-1 sm:gap-3">
          <Link to="/login" className="px-3 py-2 font-bold text-slate-700 hover:text-brand-700">Log in</Link>
          <Link to="/register" className="btn-primary hidden sm:inline-flex">Sign up free</Link>
          <button onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open} className="lg:hidden p-2 text-slate-700">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="lg:hidden px-5 pb-4 space-y-1 animate-rise">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block py-2 font-semibold text-slate-700">{label}</a>
          ))}
          <Link to="/try" className="block py-2 font-semibold text-brand-700">Make a free bill</Link>
          <Link to="/register" className="btn-primary w-full">Sign up free</Link>
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 ledger-lines" />
      <div aria-hidden="true" className="absolute -top-40 -right-32 w-[38rem] h-[38rem] rounded-full bg-brand-300/35 blur-3xl" />
      <div aria-hidden="true" className="absolute top-72 -left-40 w-[26rem] h-[26rem] rounded-full bg-saffron-400/20 blur-3xl" />

      <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-12 items-center px-5 pt-10 pb-16 lg:pt-12">
        <div className="stagger">
          <p className="inline-flex items-center h-8 px-3.5 rounded-full bg-white border border-brand-200 text-xs font-bold text-brand-700 shadow-sm">
            GST billing software for Indian businesses
          </p>
          <h1 className="mt-5 text-[2.5rem] leading-[1.1] sm:text-6xl sm:leading-[1.07] font-bold text-slate-900 tracking-tight">
            Your GST bill, ready before the{" "}
            <span className="relative inline-block text-brand-600">
              customer leaves.
              <svg aria-hidden="true" viewBox="0 0 220 18" preserveAspectRatio="none" className="absolute -bottom-2 left-0 w-full h-3 text-saffron-400">
                <path d="M3 13C48 5 108 2 217 9" pathLength="1" strokeDasharray="1" className="animate-draw" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-600 leading-relaxed">
            Make professional GST invoices on your phone or computer and share them in a few taps. Payments, stock,
            purchases and staff attendance stay in the same app.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="btn-primary h-14 px-7 text-base rounded-xl group">
              Start free <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/try" className="btn-secondary h-14 px-7 text-base rounded-xl">
              <FilePlus2 className="w-5 h-5" /> Make a bill without signing up
            </Link>
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
            {["Free plan, no card needed", "Works on phone and computer", "Four bill designs"].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" strokeWidth={3} /> {t}</li>
            ))}
          </ul>
        </div>

        <PhoneDemo className="h-[640px] animate-rise [animation-delay:250ms]" />
      </div>
    </section>
  );
}

function How() {
  return (
    <section id="how" className="relative scroll-mt-16 bg-slate-900 text-white overflow-hidden">
      <div aria-hidden="true" className="absolute -top-24 left-1/2 w-[40rem] h-[20rem] -translate-x-1/2 rounded-full bg-brand-600/40 blur-3xl" />
      <div className="relative max-w-6xl mx-auto px-5 py-16">
        <h2 className="reveal text-3xl sm:text-4xl font-bold text-center">Three steps from sale to payment</h2>
        <ol className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map(([Icon, title, text], i) => (
            <li key={title} className="reveal rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur" style={{ transitionDelay: `${i * 120}ms` }}>
              <span className="flex items-center justify-between">
                <span className="grid place-items-center w-12 h-12 rounded-2xl bg-brand-600"><Icon className="w-6 h-6" /></span>
                <span className="text-4xl font-bold text-white/15">{i + 1}</span>
              </span>
              <h3 className="mt-4 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-slate-300 leading-relaxed">{text}</p>
            </li>
          ))}
        </ol>
        <div className="reveal mt-10 text-center">
          <Link to="/try" className="btn h-12 px-6 text-base rounded-xl bg-white text-brand-700 hover:bg-brand-50 hover:-translate-y-0.5">
            Try it now, no sign-up <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-16 max-w-6xl mx-auto px-5 py-20">
      <Heading eyebrow="More than billing" title="Run the business from one place"
        text="Pick one to see it, or sit back and watch." />
      <div className="reveal"><ProductTour /></div>
      <ul className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {MORE.map(([Icon, title, text], i) => (
          <li key={title} style={{ transitionDelay: `${(i % 3) * 80}ms` }}
            className="reveal group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-xl hover:border-brand-200">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-50 text-brand-600 transition duration-300 group-hover:bg-brand-600 group-hover:text-white group-hover:-rotate-6">
              <Icon className="w-5 h-5" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
            <p className="mt-1.5 text-slate-600 leading-relaxed">{text}</p>
          </li>
        ))}
      </ul>
      <div className="reveal mt-12 text-center">
        <p className="text-sm font-bold text-slate-500">Made for</p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2.5">
          {FOR.map((name) => <li key={name} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">{name}</li>)}
        </ul>
      </div>
    </section>
  );
}

function Pricing() {
  const [plans, setPlans] = useState([]);
  const [period, setPeriod] = useState("monthly");
  const ref = useReveal(plans.length);

  useEffect(() => {
    api.get("/subscriptions/plans")
      .then(({ data }) => setPlans(data.plans))
      .catch(() => {});
  }, []);

  return (
    <section id="pricing" ref={ref} className="scroll-mt-16 bg-white border-y border-slate-200">
      <div className="max-w-5xl mx-auto px-5 py-20 text-center">
        <h2 className="reveal text-3xl sm:text-4xl font-bold text-slate-900">Start free. Upgrade when you grow.</h2>
        <p className="reveal mt-3 text-slate-600">Plans differ in how much you can bill. Pay monthly, or yearly and save.</p>
        {plans.length === 0 ? (
          <Link to="/register" className="btn-primary mt-8">Create a free account</Link>
        ) : (
          <>
            <div className="mt-7 mb-8"><PeriodSwitch period={period} onChange={setPeriod} plans={plans} /></div>
            <PlanCards plans={plans} period={period}
              action={(plan, featured) => (
                <Link to="/register" className={`w-full h-11 ${featured ? "btn-primary" : "btn-secondary"}`}>
                  {plan.price === 0 ? "Start free" : `Choose ${plan.displayName}`}
                </Link>
              )} />
          </>
        )}
        <div className="mt-10 rounded-3xl bg-slate-50 border border-slate-200 p-6 text-left">
          <h3 className="font-bold text-slate-900">Every plan includes</h3>
          <ul className="mt-4 grid sm:grid-cols-2 gap-2.5 text-sm text-slate-700">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-2"><Check className="w-4 h-4 flex-shrink-0 text-emerald-600" strokeWidth={3} /> {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const ref = useReveal();

  return (
    <div id="top" ref={ref} className="bg-slate-50 text-slate-800">
      <Nav />
      <main>
        <Hero />
        <How />

        <section id="designs" className="scroll-mt-16 max-w-6xl mx-auto px-5 pt-20">
          <Heading eyebrow="Bill designs" title="A bill that looks like your business"
            text="Four designs, six colours, your logo and signature. Switch whenever you like." />
          <div className="reveal"><DesignGallery /></div>
        </section>

        <Features />
        <Pricing />

        <section id="faq" className="scroll-mt-16 max-w-3xl mx-auto px-5 py-20">
          <h2 className="reveal text-3xl font-bold text-slate-900 text-center">Common questions</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="reveal group rounded-2xl border border-slate-200 bg-white px-5 open:shadow-md">
                <summary className="flex items-center justify-between gap-4 py-4 font-bold cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  {q}
                  <Plus className="w-5 h-5 flex-shrink-0 text-brand-600 transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <p className="pb-5 text-slate-600 leading-relaxed animate-rise">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 pb-20">
          <div className="reveal relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-900 px-6 py-14 text-center text-white shadow-2xl">
            <div aria-hidden="true" className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/15 blur-3xl" />
            <h2 className="relative text-3xl sm:text-4xl font-bold">Make your next bill here</h2>
            <p className="relative mt-3 text-brand-100">Set up your business in a few minutes. The free plan needs no card.</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/register" className="btn h-14 px-8 text-base rounded-xl bg-white text-brand-700 hover:bg-brand-50 hover:-translate-y-0.5">
                Create your free account <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/try" className="btn h-14 px-8 text-base rounded-xl border border-white/30 bg-white/10 text-white hover:bg-white/20">
                Make a free bill
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500">
          <span className="flex items-center gap-2 font-bold text-slate-800"><Logo className="w-7 h-7" /> GST Invoice</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
            <a href="#features" className="hover:text-brand-700">Features</a>
            <a href="#pricing" className="hover:text-brand-700">Pricing</a>
            <Link to="/try" className="hover:text-brand-700">Free bill maker</Link>
            <Link to="/login" className="text-brand-700">Log in</Link>
          </nav>
          <span className="w-full">© {new Date().getFullYear()} GST Invoice. GST figures in reports are working estimates, not a filed return.</span>
        </div>
      </footer>
    </div>
  );
}
