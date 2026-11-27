// Public home page.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, FileText, Boxes, IndianRupee, BarChart3, ClipboardList, Users, Check, Plus,
  MessageCircle, ShieldCheck, Menu, X,
} from "lucide-react";
import api from "../api/axios";
import ChatDemo from "../components/ChatDemo";
import ProductTour from "../components/showcase/ProductTour";
import { Logo, Spark } from "../components/Logo";
import { useReveal } from "../hooks/motion";
import { rupees } from "../lib/format";
import { ASSISTANT_NAME } from "../lib/assistant";

const LINKS = [
  ["#tour", "Product tour"],
  ["#features", "Features"],
  ["#assistant", ASSISTANT_NAME],
  ["#pricing", "Pricing"],
  ["#faq", "Questions"],
];

const STRIP = [
  "GST tax invoice", "CGST, SGST and IGST", "Original, duplicate, triplicate", "WhatsApp reminders",
  "Stock and low-stock alerts", "Quotations", "Sales returns", "Party statements", "GSTR-1 and 3B working sheets",
  "Day book", "CSV import", "Full backup",
];

const STEPS = [
  ["Say what you need", "Type it the way you would tell your munshi: “bill Sharma Traders for 10 bags of putty”."],
  ["Check the card", "You see the party, items, tax and total before anything happens. Nothing is saved yet."],
  ["Press confirm", "The bill is saved with your next number, ready to download or share."],
];

const FAQ = [
  ["Does it file my GST returns?", "No. It prepares GSTR-1 and GSTR-3B working sheets from your records, which you or your accountant use to file."],
  [`Can ${ASSISTANT_NAME} change my records by itself?`, "No. It only prepares drafts. A bill, payment or expense is saved when you press the button on the card."],
  ["Can I continue my old bill numbers?", "Yes. Set your prefix and the next number in Settings, and numbering continues from there each financial year."],
  ["Can I bring my data from other software?", "Buyers and products can be imported from a CSV file saved out of Excel. Old balances can be entered as opening balances."],
  ["Does it work on a phone?", "Yes. It works in the phone browser and can be added to your home screen."],
];

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

      <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center px-5 pt-10 pb-20 lg:pt-16">
        <div className="stagger">
          <p className="inline-flex items-center gap-2 h-8 pl-2 pr-3 rounded-full bg-white border border-brand-200 text-xs font-bold text-brand-700 shadow-sm">
            <span className="grid place-items-center w-5 h-5 rounded-full bg-brand-600 text-white"><Spark className="w-3 h-3" /></span>
            Billing, stock and dues for Indian shops
          </p>
          <h1 className="mt-5 text-[2.6rem] leading-[1.08] sm:text-6xl sm:leading-[1.05] font-bold text-slate-900 tracking-tight">
            Say it once.
            <br />
            <span className="relative inline-block text-brand-600">
              {ASSISTANT_NAME}
              <svg aria-hidden="true" viewBox="0 0 220 18" preserveAspectRatio="none" className="absolute -bottom-2 left-0 w-full h-3 text-saffron-400">
                <path d="M3 13C48 5 108 2 217 9" pathLength="1" strokeDasharray="1" className="animate-draw" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>{" "}
            writes
            <br />
            the bill.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-slate-600 leading-relaxed">
            Type “bill Raj Traders for a laptop at ₹25,000”, check the draft and confirm. Then ask who owes you,
            what is selling and how much GST is due.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="btn-primary h-14 px-7 text-base rounded-xl group">
              Start free <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a href="#tour" className="btn-secondary h-14 px-7 text-base rounded-xl">Watch it work</a>
          </div>
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
            {["Free plan, no card needed", "Your bill format, GST ready", "Works on your phone"].map((t) => (
              <span key={t} className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" strokeWidth={3} /> {t}</span>
            ))}
          </p>
        </div>

        <div id="assistant" className="relative scroll-mt-24 animate-rise [animation-delay:250ms]">
          <ChatDemo />
          <div aria-hidden="true" className="hidden xl:flex absolute -left-14 -bottom-3 items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-xl border border-slate-150 animate-float">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-emerald-100 text-emerald-700"><IndianRupee className="w-4 h-4" /></span>
            <span className="text-left"><span className="block text-sm font-bold">₹23,250</span><span className="block text-xs text-slate-500">received by UPI</span></span>
          </div>
          <div aria-hidden="true" className="hidden xl:flex absolute -right-8 bottom-28 items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-xl border border-slate-150 animate-float [animation-delay:1.8s]">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-saffron-100 text-saffron-700"><Boxes className="w-4 h-4" /></span>
            <span className="text-left"><span className="block text-sm font-bold">Low stock</span><span className="block text-xs text-slate-500">Tile adhesive, 9 bags</span></span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Tour() {
  return (
    <section id="tour" className="scroll-mt-16 max-w-6xl mx-auto px-5 pt-20">
      <div className="reveal max-w-2xl mx-auto mb-10 text-center">
        <p className="font-bold text-brand-600">See it work</p>
        <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900">From the first bill to the GST sheet.</h2>
        <p className="mt-3 text-slate-600">Five things a shop does every day. Pick one, or sit back and watch.</p>
      </div>
      <ProductTour />
    </section>
  );
}

function Feature({ icon: Icon, title, text, className = "", children }) {
  return (
    <article className={`reveal group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-xl hover:border-brand-200 ${className}`}>
      <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-50 text-brand-600 transition duration-300 group-hover:bg-brand-600 group-hover:text-white group-hover:-rotate-6">
        <Icon className="w-5 h-5" />
      </span>
      <h3 className="mt-4 text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-slate-600 leading-relaxed">{text}</p>
      {children && <div className="mt-6 flex-1 flex items-end" aria-hidden="true">{children}</div>}
    </article>
  );
}

function BillMock() {
  return (
    <div className="self-stretch flex flex-col w-full rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 p-4 pb-0 transition-transform duration-500 group-hover:-translate-y-1">
      <div className="flex-1 flex flex-col rounded-t-md bg-white border border-b-0 border-slate-300 text-[11px] text-slate-700">
        <p className="py-2 text-center font-bold text-sm border-b border-slate-300">TAX INVOICE</p>
        <div className="grid grid-cols-2 border-b border-slate-300">
          <p className="p-2 border-r border-slate-300">Invoice No. : INV-2026-0042<br />State : Delhi</p>
          <p className="p-2">Billed to : Raj Traders<br />GSTIN : Unregistered</p>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1 p-2 border-b border-slate-300">
          <b>Product</b><b>HSN</b><b>Qty</b><b className="text-right">Amount</b>
          <span>Laptop</span><span>8471</span><span>1</span><span className="text-right">25,000.00</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 p-2 text-right border-b border-slate-300">
          <span>CGST 9%</span><span>2,250.00</span>
          <span>SGST 9%</span><span>2,250.00</span>
          <b>Amount With Tax</b><b>₹29,500.00</b>
        </div>
        <p className="p-2">Rupees Twenty Nine Thousand Five Hundred Only</p>
        <div className="mt-auto grid grid-cols-2 border-t border-slate-300">
          <p className="p-2 border-r border-slate-300"><b>Bank details</b><br />Account and IFSC print here</p>
          <p className="self-end p-2 pt-6 text-right">Authorised Signatory</p>
        </div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-20 max-w-6xl mx-auto px-5 py-20">
      <div className="reveal max-w-2xl">
        <p className="font-bold text-brand-600">Everything on one counter</p>
        <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900">The whole shop, not only the bill.</h2>
      </div>
      <div className="mt-10 grid grid-cols-1 md:grid-cols-6 gap-5">
        <Feature className="md:col-span-3 md:row-span-2 pb-0" icon={FileText} title="A GST bill your buyers know"
          text="The familiar tax invoice with HSN codes, state codes, bank details, signature and three copies. Quotations and credit notes print the same way.">
          <BillMock />
        </Feature>
        <Feature className="md:col-span-3" icon={IndianRupee} title="Collect what you are owed"
          text="Overdue list, credit limits, account statements, and a reminder ready to send on WhatsApp.">
          <div className="ml-auto max-w-xs rounded-2xl rounded-br-sm bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-sm text-emerald-900 transition-transform duration-500 group-hover:-translate-x-2">
            <MessageCircle className="inline w-4 h-4 mr-1.5" />
            Dear Verma Hardware, ₹23,250 is pending on INV-2026-0038.
          </div>
        </Feature>
        <Feature className="md:col-span-3" icon={Boxes} title="Stock that counts itself"
          text="Sales, purchases and returns update the quantity. You are warned before you run out.">
          <div className="w-full space-y-2">
            {[["White cement", 82, "bg-brand-500"], ["Wall putty", 55, "bg-brand-400"], ["Tile adhesive", 12, "bg-saffron-500"]].map(([name, pct, colour]) => (
              <div key={name} className="flex items-center gap-3 text-xs text-slate-600">
                <span className="w-24">{name}</span>
                <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <span className={`block h-full rounded-full origin-left transition-transform duration-700 scale-x-90 group-hover:scale-x-100 ${colour}`} style={{ width: `${pct}%` }} />
                </span>
              </div>
            ))}
          </div>
        </Feature>
        <Feature className="md:col-span-2" icon={BarChart3} title="Profit and GST"
          text="Estimated profit, GSTR-1 and 3B working sheets and a day book, exportable for your accountant." />
        <Feature className="md:col-span-2" icon={ClipboardList} title="Quote, then bill"
          text="Send a price offer. When the buyer agrees, one press turns it into an invoice." />
        <Feature className="md:col-span-2" icon={Users} title="Move in easily"
          text="Import buyers and products from Excel as CSV, and download a full backup whenever you like." />
      </div>
    </section>
  );
}

function How() {
  return (
    <section className="relative bg-slate-900 text-white overflow-hidden">
      <div aria-hidden="true" className="absolute -top-24 left-1/2 w-[40rem] h-[20rem] -translate-x-1/2 rounded-full bg-brand-600/40 blur-3xl" />
      <div className="relative max-w-6xl mx-auto px-5 py-20">
        <h2 className="reveal text-3xl sm:text-4xl font-bold max-w-xl">Quick like a chat. Careful like a ledger.</h2>
        <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="reveal rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur" style={{ transitionDelay: `${i * 120}ms` }}>
              <span className="grid place-items-center w-10 h-10 rounded-full bg-brand-600 font-bold">{i + 1}</span>
              <h3 className="mt-4 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-slate-300 leading-relaxed">{text}</p>
            </li>
          ))}
        </ol>
        <p className="reveal mt-8 flex items-center gap-2 text-slate-300">
          <ShieldCheck className="w-5 h-5 text-saffron-400" /> {ASSISTANT_NAME} only ever sees your own business records.
        </p>
      </div>
    </section>
  );
}

function Pricing() {
  const [plans, setPlans] = useState([]);
  const ref = useReveal(plans.length);

  useEffect(() => {
    api.get("/subscriptions/plans")
      .then(({ data }) => setPlans(data.plans))
      .catch(() => {});
  }, []);

  const limit = (value, noun) => (value === -1 ? `Unlimited ${noun}` : `${value} ${noun}`);

  return (
    <section id="pricing" ref={ref} className="scroll-mt-20 max-w-6xl mx-auto px-5 py-20 text-center">
      <h2 className="reveal text-3xl sm:text-4xl font-bold text-slate-900">Start free. Pay when you grow.</h2>
      <p className="reveal mt-3 text-slate-600">Every plan includes the same features. Plans differ in how much you can add.</p>
      {plans.length === 0 ? (
        <Link to="/register" className="reveal btn-primary mt-8">Create a free account</Link>
      ) : (
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
          {plans.map((p, i) => (
            <article key={p._id} style={{ transitionDelay: `${i * 80}ms` }}
              className={`reveal flex flex-col rounded-3xl border p-6 hover:shadow-xl ${i === 1 ? "border-brand-600 bg-gradient-to-b from-brand-600 to-brand-800 text-white shadow-xl" : "border-slate-200 bg-white"}`}>
              <h3 className="font-bold">{p.displayName}</h3>
              <p className="mt-3 text-4xl font-bold tabular">{rupees(p.price)}<span className={`text-sm font-medium ${i === 1 ? "text-brand-200" : "text-slate-400"}`}> /month</span></p>
              <ul className={`mt-5 mb-6 space-y-2 text-sm ${i === 1 ? "text-brand-100" : "text-slate-600"}`}>
                {[limit(p.limits.invoicesPerMonth, "invoices a month"), limit(p.limits.buyers, "buyers"), limit(p.limits.items, "products")].map((t) => (
                  <li key={t} className="flex items-center gap-2"><Check className="w-4 h-4" strokeWidth={3} /> {t}</li>
                ))}
              </ul>
              <Link to="/register" className={`mt-auto ${i === 1 ? "btn bg-white text-brand-700 hover:bg-brand-50" : "btn-secondary"}`}>
                {p.price === 0 ? "Start free" : `Choose ${p.displayName}`}
              </Link>
            </article>
          ))}
        </div>
      )}
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

        <div className="border-y border-slate-200 bg-white py-4 overflow-hidden" aria-label="What is included">
          <ul className="flex w-max gap-10 animate-marquee whitespace-nowrap">
            {[...STRIP, ...STRIP].map((t, i) => (
              <li key={i} aria-hidden={i >= STRIP.length} className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <Spark className="w-3.5 h-3.5 text-brand-500" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <Tour />
        <Features />
        <How />
        <Pricing />

        <section id="faq" className="scroll-mt-20 max-w-3xl mx-auto px-5 pb-20">
          <h2 className="reveal text-3xl font-bold text-slate-900 text-center">Questions shop owners ask</h2>
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
            <h2 className="relative text-3xl sm:text-4xl font-bold">Your next bill can be one sentence.</h2>
            <p className="relative mt-3 text-brand-100">Set up your business, add a product, and ask {ASSISTANT_NAME} to do the rest.</p>
            <Link to="/register" className="relative btn mt-8 h-14 px-8 text-base rounded-xl bg-white text-brand-700 hover:bg-brand-50 hover:-translate-y-0.5">
              Create your free account <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500">
          <span className="flex items-center gap-2 font-bold text-slate-800"><Logo className="w-7 h-7" /> GST Invoice</span>
          <span>© {new Date().getFullYear()} GST Invoice. GST figures are working estimates, not a filed return.</span>
          <Link to="/login" className="font-bold text-brand-700">Log in</Link>
        </div>
      </footer>
    </div>
  );
}
