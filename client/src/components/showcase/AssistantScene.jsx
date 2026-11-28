// The assistant's story for the home page. Not shown while the assistant is
// switched off (lib/flags.js).
import { UserBubble, BotRow, BotBubble, Typing, CardFrame } from "../assistant/Bubbles";
import { Spark } from "../Logo";
import { ASSISTANT_NAME } from "../../lib/assistant";
import { useTimeline } from "./useTimeline";

// ── Asking the assistant ────────────────────────────────────────────────────
const ASK_MOMENTS = [250, 1000, 2200, 2550, 2900, 3800];
const TOP = [
  ["White cement", "₹86,400", 100],
  ["Wall putty", "₹54,200", 63],
  ["Tile adhesive", "₹31,780", 37],
];

export function AssistantScene() {
  const passed = useTimeline(ASK_MOMENTS);

  return (
    <div className="mx-auto flex flex-col w-[400px] h-full overflow-hidden rounded-3xl bg-white text-left text-sm text-slate-800 shadow-2xl animate-rise">
      <div className="flex items-center gap-2 px-4 h-11 flex-shrink-0 border-b border-slate-150 bg-slate-50">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="ml-2 flex items-center gap-1.5 font-bold"><Spark className="w-4 h-4 text-brand-600" /> {ASSISTANT_NAME}</span>
      </div>
      <div className="flex-1 space-y-3 p-4">
        {passed >= 1 && <UserBubble>Top selling products this month?</UserBubble>}
        {passed >= 2 && (
          <BotRow>
            {passed < 3 ? (
              <Typing status="Reading your bills" />
            ) : (
              <>
                <div><BotBubble>Here are your top 3 by sales:</BotBubble></div>
                <CardFrame>
                  {TOP.map(([name, value, width], i) => (
                    <div key={name} className={`px-3.5 py-2.5 border-b border-slate-100 last:border-0 ${passed >= i + 3 ? "animate-rise" : "opacity-0"}`}>
                      <p className="flex justify-between"><span>{name}</span><b className="tabular">{value}</b></p>
                      <span className="block mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        {passed >= i + 3 && <span className="block h-full rounded-full bg-brand-500 origin-left animate-widen" style={{ width: `${width}%` }} />}
                      </span>
                    </div>
                  ))}
                </CardFrame>
                <div className={`flex flex-wrap gap-1.5 ${passed >= 6 ? "animate-rise" : "opacity-0"}`}>
                  {["Who owes me?", "Stock value", "Make a bill"].map((t) => (
                    <span key={t} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{t}</span>
                  ))}
                </div>
              </>
            )}
          </BotRow>
        )}
      </div>
    </div>
  );
}
