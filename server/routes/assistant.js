const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { canCreateInvoice, canAddBuyer, canAddItem } = require("../middleware/checkPlan");
const { Anthropic, engine, answer } = require("../services/assistant");
const { getDraft, confirmDraft } = require("../services/assistantActions");
const { route } = require("../services/common");

router.use(protect);

// ─── Per-user limits on paid AI calls ────────────────────────────────────────
// Held in memory: resets on restart and is per server instance.
const LIMITS = [
  { windowMs: 10 * 60 * 1000, max: 20 },
  { windowMs: 24 * 60 * 60 * 1000, max: Number(process.env.ASSISTANT_DAILY_LIMIT) || 60 },
];
const history = new Map();

function takeSlot(userId) {
  const now = Date.now();
  const longest = Math.max(...LIMITS.map((l) => l.windowMs));
  const recent = (history.get(userId) || []).filter((t) => now - t < longest);
  const allowed = LIMITS.every((l) => recent.filter((t) => now - t < l.windowMs).length < l.max);
  if (allowed) recent.push(now);
  history.set(userId, recent);
  return allowed;
}

const MAX_TURNS = 12;

// Returns the recent conversation, or null if the request is malformed
function cleanMessages(input) {
  if (!Array.isArray(input) || !input.length) return null;
  const messages = [];
  for (const m of input.slice(-MAX_TURNS)) {
    const limit = m?.role === "user" ? 1000 : 8000;
    if (!["user", "assistant"].includes(m?.role)) return null;
    if (typeof m.content !== "string" || !m.content.trim()) return null;
    messages.push({ role: m.role, content: m.content.slice(0, limit) });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();
  return messages.at(-1)?.role === "user" ? messages : null;
}

router.get("/status", (req, res) => {
  res.json({ success: true, enabled: true, engine: engine() });
});

// POST /api/assistant/chat — replies as newline-delimited JSON:
//   {"type":"text"|"status"|"card"|"suggestions", …} repeated,
//   then {"type":"done"} or {"type":"error","message":"…"}
router.post("/chat", async (req, res) => {
  const messages = cleanMessages(req.body?.messages);
  if (!messages) {
    return res.status(400).json({ success: false, message: "Type a question first." });
  }
  if (engine() === "claude" && !takeSlot(String(req.user._id))) {
    return res.status(429).json({
      success: false,
      message: "You have asked a lot of questions in a short time. Please try again later.",
    });
  }

  const controller = new AbortController();
  // Stop generating if the user closes the panel
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  const send = (event) => {
    if (res.writableEnded || res.destroyed) return;
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
    }
    res.write(`${JSON.stringify(event)}\n`);
  };

  try {
    const result = await answer(req.user, messages, send, controller.signal);
    if (result) send({ type: "done", truncated: result.truncated });
    res.end();
  } catch (err) {
    if (res.destroyed) return;
    console.error("Assistant error:", err.status || "", err.message);

    let message = "I could not answer just now. Please try again.";
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      message = "The assistant is not configured correctly. Please contact support.";
    } else if (err instanceof Anthropic.RateLimitError) {
      message = "I am busy right now. Please try again in a minute.";
    }

    if (res.headersSent) {
      send({ type: "error", message });
      res.end();
    } else {
      res.status(502).json({ success: false, message });
    }
  }
});

// POST /api/assistant/confirm { draftId } — saves a draft the user approved.
// Plan limits apply exactly as they do on the normal screens.
const GUARDS = { invoice: canCreateInvoice, buyer: canAddBuyer, product: canAddItem };

router.post(
  "/confirm",
  route(async (req, res, next) => {
    const draft = getDraft(req.user, req.body?.draftId);
    const save = route(async () => {
      res.json({ success: true, card: await confirmDraft(req, req.body.draftId) });
    });
    const guard = GUARDS[draft.type];
    // A bill for a new buyer also adds a buyer
    const alsoBuyer = draft.newBuyer && !draft.buyerId;
    const run = guard ? () => guard(req, res, () => save(req, res)) : () => save(req, res);
    return alsoBuyer ? canAddBuyer(req, res, run) : run();
  }),
);

module.exports = router;
