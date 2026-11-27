// Chat pieces shared by the real assistant and the landing page demo.
import { Check } from "lucide-react";
import { Spark } from "../Logo";

export function UserBubble({ children, initial }) {
  return (
    <div className="flex justify-end items-end gap-2 animate-pop">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-white shadow-glow whitespace-pre-wrap">
        {children}
      </div>
      {initial && (
        <span className="w-7 h-7 flex-shrink-0 grid place-items-center rounded-full bg-slate-150 text-xs font-bold text-slate-600">
          {initial}
        </span>
      )}
    </div>
  );
}

export function BotRow({ children }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-8 h-8 flex-shrink-0 grid place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-glow animate-pop">
        <Spark />
      </span>
      <div className="flex-1 min-w-0 space-y-2">{children}</div>
    </div>
  );
}

export function BotBubble({ children }) {
  return (
    <div className="inline-block max-w-full rounded-2xl rounded-tl-md bg-slate-100 px-4 py-2.5 leading-relaxed text-slate-700 animate-pop">
      {children}
    </div>
  );
}

export function Typing({ status }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3.5 animate-pop" role="status" aria-label={status || "Thinking"}>
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2 h-2 rounded-full bg-brand-500 animate-dot" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </span>
      {status && <span className="text-xs text-slate-500">{status}…</span>}
    </div>
  );
}

// Rows of label and value, used by every kind of result card
export function Rows({ rows, onNavigate }) {
  return (
    <ul className="divide-y divide-slate-100 stagger">
      {rows.map((r, i) => {
        const tone = r.tone === "bad" ? "text-red-700" : r.tone === "good" ? "text-emerald-700" : "text-slate-900";
        const body = (
          <>
            <span className="min-w-0">
              <span className={`block ${r.strong ? "font-bold text-slate-900" : "text-slate-600"}`}>{r.label}</span>
              {r.note && <span className="block text-xs text-slate-400">{r.note}</span>}
            </span>
            <span className={`tabular font-bold whitespace-nowrap capitalize ${tone} ${r.strong ? "text-base" : ""}`}>{r.value}</span>
          </>
        );
        const className = `flex items-center justify-between gap-4 px-4 py-2.5 ${r.strong ? "bg-brand-50" : ""}`;
        return (
          <li key={`${r.label}-${i}`}>
            {r.to && onNavigate ? (
              <button type="button" onClick={() => onNavigate(r.to)} className={`${className} w-full text-left hover:bg-brand-50 transition-colors`}>
                {body}
              </button>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function CardFrame({ children, className = "" }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md animate-pop ${className}`}>
      {children}
    </div>
  );
}

export function DraftBody({ card }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{card.title}</p>
          {card.party && <p className="font-bold text-slate-900 truncate">{card.party}</p>}
        </div>
        <span className="badge bg-saffron-100 text-saffron-700 border-saffron-400/40 normal-case">Not saved yet</span>
      </div>
      {card.lines?.length > 0 && (
        <ul className="px-4 py-2 border-b border-dashed border-slate-200">
          {card.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 py-1.5">
              <span className="min-w-0">
                <span className="block font-semibold text-slate-800">{l.name}</span>
                <span className="block text-xs text-slate-500">{l.detail}</span>
              </span>
              <span className="tabular whitespace-nowrap">{l.amount}</span>
            </li>
          ))}
        </ul>
      )}
      <Rows rows={card.rows} />
      {card.notes?.length > 0 && (
        <ul className="px-4 py-2 text-xs text-saffron-700 bg-saffron-100/60">
          {card.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </>
  );
}

export function DoneHeader({ title }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50">
      <span className="w-7 h-7 grid place-items-center rounded-full bg-emerald-600 text-white animate-pop">
        <Check className="w-4 h-4" strokeWidth={3} />
      </span>
      <p className="font-bold text-emerald-900">{title}</p>
    </div>
  );
}
