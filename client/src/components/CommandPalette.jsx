// Quick search and shortcuts, opened with Ctrl+K.
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import api from "../api/axios";
import { ASSISTANT_NAME } from "../lib/assistant";
import { useCan } from "../context/AuthContext";

// [title, address, ability needed]
const ACTIONS = [
  ["New invoice", "/invoices/create", "createInvoice"],
  ["New quotation", "/quotations/create", "createQuotation"],
  ["New purchase", "/purchases/create", "editPurchases"],
  ["Invoices", "/invoices"],
  ["Buyers", "/buyers"],
  ["Products", "/items"],
  ["Stock", "/stock", "stock"],
  [`Ask ${ASSISTANT_NAME}`, "/assistant"],
  ["Expenses", "/expenses", "expenses"],
  ["Reports", "/reports", "reports"],
  ["GST returns", "/reports?tab=gst&period=last-month", "reports"],
  ["Day book", "/reports?tab=daybook", "reports"],
  ["Team", "/team", "team"],
  ["Settings", "/settings"],
].map(([title, to, need]) => ({ type: "Go to", title, to, need }));

export default function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const can = useCan();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState({ q: "", results: [] });
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    let current = true;
    const timer = setTimeout(() => {
      api.get("/data/search", { params: { q } })
        .then(({ data }) => current && setFound({ q, results: data.results }))
        .catch(() => current && setFound({ q, results: [] }));
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q]);

  const matches = ACTIONS.filter(
    (a) => (!a.need || can(a.need)) && a.title.toLowerCase().includes(q.toLowerCase()),
  );
  const results = [...(q.length >= 2 && found.q === q ? found.results : []), ...matches];
  const selected = Math.min(active, results.length - 1);

  const open = (item) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter") open(results[selected]);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (selected + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      setActive(next || 0);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    }
  };

  return (
    <div
      className="!m-0 fixed inset-0 z-[70] flex justify-center items-start p-4 pt-[12vh] bg-slate-900/40 backdrop-blur-[2px] animate-fade"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-label="Search" className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-pop">
        <div className="flex items-center gap-2 px-4 border-b border-slate-200">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Invoice number, buyer, product or page"
            aria-label="Search everything"
            className="flex-1 h-12 text-sm focus:outline-none"
          />
          <kbd className="text-xs text-slate-500 border border-slate-300 rounded px-1.5">Esc</kbd>
        </div>
        <ul ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {results.map((r, i) => (
            <li key={`${r.type}-${r.to}-${i}`}>
              <button
                onClick={() => open(r)}
                onMouseMove={() => setActive(i)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm ${i === selected ? "bg-brand-50" : ""}`}
              >
                <span className="w-20 flex-shrink-0 text-xs text-slate-500">{r.type}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{r.title}</span>
                  {r.detail && <span className="block truncate text-xs text-slate-500">{r.detail}</span>}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">No results</li>}
        </ul>
      </div>
    </div>
  );
}
