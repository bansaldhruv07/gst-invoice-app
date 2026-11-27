// The conversation itself: messages, result cards and the question box.
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { SendHorizonal, ArrowUpRight, Download, FileText, Boxes, IndianRupee, Trophy, UserPlus, Wallet } from "lucide-react";
import api from "../../api/axios";
import { useAssistant } from "../../context/AssistantContext";
import { useAuth } from "../../context/AuthContext";
import { ASSISTANT_NAME } from "../../lib/assistant";
import { downloadInvoicePdf, downloadQuotationPdf } from "../../lib/invoicePdf";
import { Spark } from "../Logo";
import { UserBubble, BotRow, BotBubble, Typing, Rows, CardFrame, DraftBody, DoneHeader } from "./Bubbles";

const STARTERS = [
  { icon: FileText, title: "Make a bill", prompt: "Create invoice for Raj Traders with Laptop of Rs.25,000 + tax", edit: true },
  { icon: Boxes, title: "Stock value", prompt: "What is my current stock value?" },
  { icon: Trophy, title: "Top sellers", prompt: "What are my top selling products this month?" },
  { icon: IndianRupee, title: "Who owes me", prompt: "Who owes me money?" },
  { icon: Wallet, title: "Add expense", prompt: "Add expense 500 for transport", edit: true },
  { icon: UserPlus, title: "Add buyer", prompt: "Add buyer Sharma Traders mobile 9876543210", edit: true },
];

// Renders the small subset of formatting replies use: bullets and bold
function Formatted({ text }) {
  const bold = (line) =>
    line.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i} className="font-bold">{part}</strong> : part));
  return text.trim().split("\n").map((line, i) => {
    const bullet = line.match(/^\s*[-•*]\s+(.*)/);
    if (bullet) {
      return (
        <p key={i} className="flex gap-2">
          <span aria-hidden="true">•</span>
          <span>{bold(bullet[1])}</span>
        </p>
      );
    }
    return line.trim() ? <p key={i}>{bold(line)}</p> : <div key={i} className="h-2" />;
  });
}

function Card({ card, onNavigate }) {
  const { replaceCard } = useAssistant();
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");

  const confirm = async () => {
    setSaving(true);
    setProblem("");
    try {
      const { data } = await api.post("/assistant/confirm", { draftId: card.draftId });
      replaceCard(card.draftId, { ...data.card, draftId: card.draftId });
    } catch (err) {
      setProblem(err.response?.data?.message || "Could not save it. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const pdf = async () => {
    try {
      if (card.invoiceId) await downloadInvoicePdf(card.invoiceId);
      else await downloadQuotationPdf(card.quotationId);
    } catch {
      toast.error("Could not create the PDF");
    }
  };

  if (card.kind === "dismissed") {
    return <p className="text-xs text-slate-400 animate-fade">Draft discarded. Nothing was saved.</p>;
  }

  if (card.kind === "draft") {
    return (
      <CardFrame>
        <DraftBody card={card} />
        {problem && <p role="alert" className="px-4 py-2 text-xs font-semibold text-red-700 bg-red-50">{problem}</p>}
        <div className="flex gap-2 p-3 border-t border-slate-100">
          <button type="button" onClick={confirm} disabled={saving} className="btn-primary btn-sm flex-1">
            {saving ? "Saving…" : card.confirmLabel}
          </button>
          <button type="button" disabled={saving} onClick={() => replaceCard(card.draftId, { kind: "dismissed", draftId: card.draftId, title: "Draft discarded" })}
            className="btn-secondary btn-sm">
            Discard
          </button>
        </div>
      </CardFrame>
    );
  }

  if (card.kind === "done") {
    return (
      <CardFrame>
        <DoneHeader title={card.title} />
        {card.rows.length > 0 && <Rows rows={card.rows} />}
        <div className="flex flex-wrap gap-2 p-3 border-t border-slate-100">
          {(card.invoiceId || card.quotationId) && (
            <button type="button" onClick={pdf} className="btn-primary btn-sm">
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
          )}
          {card.links.map((l) => (
            <button key={l.to} type="button" onClick={() => onNavigate(l.to)} className="btn-secondary btn-sm">
              {l.label}
            </button>
          ))}
        </div>
      </CardFrame>
    );
  }

  return (
    <CardFrame>
      <p className="px-4 py-2.5 text-xs font-bold text-slate-500 border-b border-slate-100">{card.title}</p>
      <Rows rows={card.rows} onNavigate={onNavigate} />
      {card.link && (
        <button type="button" onClick={() => onNavigate(card.link.to)}
          className="flex items-center gap-1 w-full px-4 py-2.5 border-t border-slate-100 text-xs font-bold text-brand-700 hover:bg-brand-50">
          {card.link.label} <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      )}
    </CardFrame>
  );
}

export default function Chat({ autoFocus, onNavigate, large }) {
  const { messages, busy, error, engine, ask } = useAssistant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const initial = (user?.name || "?").charAt(0).toUpperCase();
  const starters = STARTERS.filter((s) =>
    user?.role === "staff" ? !["Stock value", "Add expense"].includes(s.title)
      : user?.role === "accountant" ? !s.edit
        : true,
  );

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, error]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const go = (to) => {
    onNavigate?.();
    navigate(to);
  };

  const send = (text) => {
    ask(text);
    setDraft("");
  };

  // Examples with made-up names are put in the box to edit; questions run at once
  const choose = (starter) => {
    if (!starter.edit) return send(starter.prompt);
    setDraft(starter.prompt);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-5 text-sm" aria-live="polite">
        {messages.length === 0 && (
          <div className={`mx-auto ${large ? "max-w-xl pt-6" : ""}`}>
            <div className="text-center animate-rise">
              <span className="mx-auto w-14 h-14 grid place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-glow animate-float">
                <Spark className="w-7 h-7" />
              </span>
              <h3 className="mt-4 text-xl font-bold text-slate-900">Namaste, I am {ASSISTANT_NAME}</h3>
              <p className="mt-1 text-slate-500">Ask about your business, or tell me what to write.</p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2.5 stagger">
              {starters.map((s) => (
                <button key={s.title} type="button" onClick={() => choose(s)} className="card card-lift p-3 text-left">
                  <s.icon className="w-4 h-4 text-brand-600" />
                  <span className="mt-2 block text-sm font-bold text-slate-800">{s.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500 line-clamp-2">{s.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4 max-w-2xl mx-auto">
          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} initial={initial}>{m.text}</UserBubble>
            ) : (
              <BotRow key={m.id}>
                {m.parts.map((p, i) => {
                  if (p.type === "text") {
                    return p.text.trim() ? <div key={i}><BotBubble><Formatted text={p.text} /></BotBubble></div> : null;
                  }
                  if (p.type === "card") return <Card key={i} card={p.card} onNavigate={go} />;
                  return (
                    <div key={i} className="flex flex-col items-start gap-1.5 stagger">
                      {p.items.map((s) => (
                        <button key={s} type="button" onClick={() => { setDraft(s); inputRef.current?.focus(); }}
                          className="btn-secondary btn-sm h-auto py-1.5 whitespace-normal text-left">
                          {s}
                        </button>
                      ))}
                    </div>
                  );
                })}
                {m.streaming && (m.parts.length === 0 || m.status) && busy && <Typing status={m.status} />}
              </BotRow>
            ),
          )}
        </div>
        {error && <p role="alert" className="mt-3 text-center font-semibold text-red-700">{error}</p>}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex-shrink-0 border-t border-slate-150 p-3">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            placeholder={`Ask ${ASSISTANT_NAME} anything…`}
            aria-label="Your question"
            className="flex-1 min-w-0 h-12 rounded-xl bg-slate-100 px-4 text-sm border border-transparent transition focus:outline-none focus:bg-white focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          />
          <button type="submit" disabled={busy || !draft.trim()} aria-label="Send" className="btn-primary w-12 h-12 px-0 rounded-xl">
            <SendHorizonal className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">
          {engine === "claude"
            ? "Answered by Anthropic's Claude from your records. Nothing is saved until you confirm."
            : "Built-in commands: your data stays on your server. Nothing is saved until you confirm."}
        </p>
      </form>
    </div>
  );
}
