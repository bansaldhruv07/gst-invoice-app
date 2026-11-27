// A self-playing preview of the assistant, using made-up sample data.
import { useState, useEffect } from "react";
import { SendHorizonal } from "lucide-react";
import { Spark } from "./Logo";
import { UserBubble, BotRow, BotBubble, Typing, Rows, CardFrame, DraftBody, DoneHeader } from "./assistant/Bubbles";
import { prefersReducedMotion } from "../hooks/motion";
import { ASSISTANT_NAME } from "../lib/assistant";

const SCENES = [
  {
    tab: "Make a bill",
    question: "Create invoice for Raj Traders with Laptop of Rs.25,000 + tax",
    status: "Writing the draft",
    reply: "Here is the draft. Check it, then confirm.",
    draft: {
      title: "Invoice draft",
      party: "Raj Traders",
      lines: [{ name: "Laptop", detail: "1 pcs × ₹25,000 · GST 18%", amount: "₹29,500" }],
      rows: [
        { label: "CGST + SGST", value: "₹4,500" },
        { label: "Total", value: "₹29,500", strong: true },
      ],
    },
    done: {
      title: "INV-2026-0042 created",
      rows: [
        { label: "Party", value: "Raj Traders" },
        { label: "Total", value: "₹29,500" },
      ],
    },
  },
  {
    tab: "Stock value",
    question: "What is my current stock value?",
    status: "Counting stock",
    reply: "Your stock is worth ₹4,82,350 at purchase price.",
    table: [
      { label: "White cement", note: "240 bag", value: "₹1,20,000" },
      { label: "Wall putty", note: "112 bag", value: "₹33,600" },
      { label: "Tile adhesive", note: "9 bag · low", value: "₹3,240", tone: "bad" },
      { label: "Total stock value", value: "₹4,82,350", strong: true },
    ],
  },
  {
    tab: "Who owes me",
    question: "Who owes me money?",
    status: "Checking dues",
    reply: "₹57,125 to collect, of which ₹34,875 is overdue.",
    table: [
      { label: "Verma Hardware", note: "12 days late", value: "₹23,250", tone: "bad" },
      { label: "Sharma Traders", note: "7 days late", value: "₹11,625", tone: "bad" },
      { label: "Total to collect", value: "₹57,125", strong: true },
    ],
  },
];

// Time spent in each step before moving on (ms)
const durations = (scene) => (scene.draft ? [700, 1300, 2200, 600, 3200] : [700, 1300, 4200]);

export default function ChatDemo() {
  const [still] = useState(prefersReducedMotion);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(still ? 2 : 0);
  const scene = SCENES[index];

  useEffect(() => {
    if (still) return;
    const times = durations(SCENES[index]);
    const timer = setTimeout(() => {
      if (step < times.length - 1) setStep(step + 1);
      else {
        setStep(0);
        setIndex((index + 1) % SCENES.length);
      }
    }, times[step]);
    return () => clearTimeout(timer);
  }, [index, step, still]);

  const pick = (i) => {
    setIndex(i);
    setStep(still ? 2 : 0);
  };

  const pressing = scene.draft && step === 3;
  const finished = scene.draft && step === 4;

  return (
    <div>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-sm text-left shadow-2xl">
        <div className="flex items-center gap-2 px-5 h-12 border-b border-slate-150 bg-slate-50">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </span>
          <span className="ml-2 flex items-center gap-1.5 font-bold text-slate-800">
            <Spark className="w-4 h-4 text-brand-600" /> {ASSISTANT_NAME}
          </span>
          <span className="ml-auto text-xs text-slate-400">Sample data</span>
        </div>

        <div className="flex flex-col gap-3 p-5 overflow-hidden h-[26rem]">
          <UserBubble key={`q-${index}`}>{scene.question}</UserBubble>
          {step >= 1 && (
            <BotRow key={`a-${index}`}>
              {step === 1 ? (
                <Typing status={scene.status} />
              ) : (
                <>
                  {!finished && <div><BotBubble>{scene.reply}</BotBubble></div>}
                  {scene.table && (
                    <CardFrame><Rows rows={scene.table} /></CardFrame>
                  )}
                  {scene.draft && !finished && (
                    <CardFrame>
                      <DraftBody card={scene.draft} />
                      <div className="p-3 border-t border-slate-100">
                        <span className={`btn-primary btn-sm w-full transition ${pressing ? "scale-95 ring-4 ring-brand-200" : ""}`}>
                          {pressing ? "Saving…" : "Create invoice"}
                        </span>
                      </div>
                    </CardFrame>
                  )}
                  {finished && (
                    <CardFrame>
                      <DoneHeader title={scene.done.title} />
                      <Rows rows={scene.done.rows} />
                    </CardFrame>
                  )}
                </>
              )}
            </BotRow>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-150" aria-hidden="true">
          <span className="flex-1 flex items-center h-11 px-4 rounded-xl bg-slate-100 text-slate-400">
            Ask {ASSISTANT_NAME} anything…
          </span>
          <span className="w-11 h-11 grid place-items-center rounded-xl bg-brand-600 text-white">
            <SendHorizonal className="w-5 h-5" />
          </span>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="Examples">
        {SCENES.map((s, i) => (
          <button key={s.tab} role="tab" aria-selected={i === index} onClick={() => pick(i)}
            className={`h-8 px-3 rounded-full text-xs font-bold transition ${
              i === index ? "bg-brand-600 text-white shadow-glow" : "bg-white text-slate-600 border border-slate-200 hover:border-brand-300"
            }`}>
            {s.tab}
          </button>
        ))}
      </div>
    </div>
  );
}
