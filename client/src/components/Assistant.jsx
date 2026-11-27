// The assistant as a panel that slides in from the right.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Maximize2, RotateCcw } from "lucide-react";
import Chat from "./assistant/Chat";
import { Spark } from "./Logo";
import { useAssistant } from "../context/AssistantContext";
import { ASSISTANT_NAME } from "../lib/assistant";

export default function Assistant() {
  const { open, setOpen, reset, messages, engine } = useAssistant();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <>
      <button aria-label="Close assistant" onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] animate-fade" />
      <section
        role="dialog"
        aria-label="Assistant"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-white shadow-2xl animate-slide-left sm:rounded-l-3xl overflow-hidden"
      >
        <header className="flex-shrink-0 flex items-center gap-3 px-4 h-16 border-b border-slate-150">
          <span className="w-9 h-9 grid place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white">
            <Spark />
          </span>
          <div className="mr-auto">
            <h2 className="text-base font-bold leading-tight">{ASSISTANT_NAME}</h2>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {engine === "claude" ? "Powered by Claude" : "Built-in commands"}
            </p>
          </div>
          {messages.length > 0 && (
            <button onClick={reset} title="New chat" aria-label="New chat" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => { setOpen(false); navigate("/assistant"); }} title="Open full page" aria-label="Open full page"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </header>
        <Chat autoFocus onNavigate={() => setOpen(false)} />
      </section>
    </>
  );
}
