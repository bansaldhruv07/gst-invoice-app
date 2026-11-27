import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import Chat from "../components/assistant/Chat";
import { Spark } from "../components/Logo";
import { useAssistant } from "../context/AssistantContext";
import { ASSISTANT_NAME } from "../lib/assistant";

export default function AssistantPage() {
  const { setOpen, reset, messages, engine } = useAssistant();

  useEffect(() => {
    setOpen(false);
  }, [setOpen]);

  return (
    <section className="max-w-3xl mx-auto h-full flex flex-col card rounded-2xl shadow-xl overflow-hidden">
      <header className="flex-shrink-0 flex items-center gap-3 px-5 h-14 border-b border-slate-150 bg-slate-50">
        <span className="hidden sm:flex gap-1.5" aria-hidden="true">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </span>
        <h2 className="sm:ml-2 flex items-center gap-2 text-sm font-bold">
          <Spark className="w-4 h-4 text-brand-600" /> {ASSISTANT_NAME}
        </h2>
        <span className="mr-auto badge bg-brand-50 text-brand-700 border-brand-200 normal-case whitespace-nowrap">
          {engine === "claude" ? "Claude" : "Built-in"}
        </span>
        {messages.length > 0 && (
          <button onClick={reset} aria-label="New chat" className="btn-secondary btn-sm">
            <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">New chat</span>
          </button>
        )}
      </header>
      <Chat autoFocus large />
    </section>
  );
}
