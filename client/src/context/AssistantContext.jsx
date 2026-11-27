// One conversation shared by the side panel and the full assistant page.
import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import api from "../api/axios";
import { streamChat, asHistory } from "../lib/assistant";

const AssistantContext = createContext(null);
const MIN_THINKING_MS = 550; // lets the typing dots register before an instant reply

export function AssistantProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [engine, setEngine] = useState("");
  const abortRef = useRef(null);
  const messagesRef = useRef(messages);
  const busyRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    api.get("/assistant/status")
      .then(({ data }) => setEngine(data.engine))
      .catch(() => {});
    return () => abortRef.current?.abort();
  }, []);

  const ask = useCallback(async (question) => {
    const text = question.trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");

    const earlier = messagesRef.current;
    const history = [...earlier, { id: crypto.randomUUID(), role: "user", text }];
    const reply = { id: crypto.randomUUID(), role: "assistant", parts: [], status: "", streaming: true };
    setMessages([...history, reply]);

    const controller = new AbortController();
    abortRef.current = controller;
    const started = Date.now();
    let parts = [];
    let waited = false;
    const publish = (changes) => setMessages([...history, { ...reply, ...changes, parts }]);

    try {
      await streamChat(asHistory(history), controller.signal, async (event) => {
        if (!waited) {
          waited = true;
          const left = MIN_THINKING_MS - (Date.now() - started);
          if (left > 0) await new Promise((r) => setTimeout(r, left));
        }
        if (event.type === "text") {
          const last = parts.at(-1);
          parts = last?.type === "text"
            ? [...parts.slice(0, -1), { type: "text", text: last.text + event.text }]
            : [...parts, { type: "text", text: event.text }];
          publish({ status: "" });
        } else if (event.type === "card") {
          parts = [...parts, { type: "card", card: event.card }];
          publish({ status: "" });
        } else if (event.type === "suggestions") {
          parts = [...parts, { type: "suggestions", items: event.items }];
          publish({ status: "" });
        } else if (event.type === "status") {
          publish({ status: event.text });
        } else if (event.type === "done") {
          if (event.truncated) parts = [...parts, { type: "text", text: "\n(The answer was cut short.)" }];
          publish({ streaming: false, status: "" });
        }
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
        setMessages(parts.length ? [...history, { ...reply, parts, streaming: false }] : history);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  // Swaps a draft card for its result, or marks it dismissed
  const replaceCard = useCallback((draftId, card) => {
    setMessages((list) =>
      list.map((m) =>
        m.role !== "assistant"
          ? m
          : { ...m, parts: m.parts.map((p) => (p.type === "card" && p.card.draftId === draftId ? { ...p, card } : p)) },
      ),
    );
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError("");
  }, []);

  return (
    <AssistantContext.Provider value={{ messages, busy, error, engine, open, setOpen, ask, reset, replaceCard }}>
      {children}
    </AssistantContext.Provider>
  );
}

export const useAssistant = () => useContext(AssistantContext);
