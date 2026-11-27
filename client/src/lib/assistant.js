// Talking to the assistant API.
import api from "../api/axios";

export const ASSISTANT_NAME = "Munshi";

// Calls the streaming endpoint and reports each event as it arrives
export async function streamChat(messages, signal, onEvent) {
  const response = await fetch(`${api.defaults.baseURL}/assistant/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "The assistant is unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "done") finished = true;
      await onEvent(event);
    }
  }
  if (!finished) throw new Error("The connection dropped before the answer finished.");
}

// What the server needs to remember about an earlier reply
export function asHistory(messages) {
  return messages.map((m) => {
    if (m.role === "user") return { role: "user", content: m.text };
    const parts = m.parts.map((p) => {
      if (p.type === "text") return p.text;
      if (p.type === "card") {
        const state = p.card.kind === "draft" ? " (draft, not saved)" : "";
        return `[Showed card: ${p.card.title}${p.card.party ? ` for ${p.card.party}` : ""}${state}]`;
      }
      return "";
    });
    return { role: "assistant", content: parts.join("\n").trim() || "[No reply]" };
  });
}
