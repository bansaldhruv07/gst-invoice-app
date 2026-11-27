// The tour beside the sign-in form: a headline, the animated scene and tabs.
import { FEATURES } from "./features";
import FitStage from "./FitStage";
import Progress from "./Progress";
import { useRotation } from "./useRotation";

export default function PanelShowcase() {
  const { index, still, hovered, select, next, hover } = useRotation(FEATURES.length);
  const feature = FEATURES[index];
  const { Scene } = feature;

  return (
    <div className="relative flex flex-col flex-1 min-h-0 text-center">
      <div key={feature.id} className="flex-shrink-0 stagger">
        <h2 className="text-2xl xl:text-3xl font-bold">{feature.title}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm xl:text-base text-brand-100">{feature.text}</p>
      </div>

      <div className="flex-1 min-h-0 py-4" {...hover}>
        <FitStage>
          <Scene key={feature.id} />
        </FitStage>
      </div>

      <div role="tablist" aria-label="Features" className="flex-shrink-0 flex justify-center gap-2">
        {FEATURES.map((f, i) => {
          const active = i === index;
          return (
            <button key={f.id} role="tab" aria-selected={active} onClick={() => select(i)}
              className={`relative overflow-hidden flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-bold transition duration-300 ${
                active ? "bg-white text-brand-700 shadow-xl -translate-y-0.5" : "bg-white/10 text-white hover:bg-white/20"
              }`}>
              <f.icon className="w-4 h-4" />
              <span className={active ? "" : "hidden xl:inline"}>{f.tab}</span>
              {active && !still && (
                <Progress key={f.id} duration={f.duration} paused={hovered} onDone={next} className="absolute inset-x-0 bottom-0 h-[3px] bg-saffron-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
