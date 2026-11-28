// The home page tour: pick a feature on the left, watch it on the right.
import { useState, useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { FEATURES } from "./features";
import FitStage from "./FitStage";
import Progress from "./Progress";
import { useRotation } from "./useRotation";

function Details({ feature }) {
  return (
    <div className="animate-rise">
      <p className="text-slate-600 leading-relaxed">{feature.text}</p>
      <ul className="mt-3 space-y-2 stagger">
        {feature.points.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-sm text-slate-700">
            <span className="grid place-items-center w-5 h-5 mt-px flex-shrink-0 rounded-full bg-brand-600 text-white">
              <Check className="w-3 h-3" strokeWidth={4} />
            </span>
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProductTour() {
  const { index, still, hovered, select, next, hover } = useRotation(FEATURES.length);
  const [visible, setVisible] = useState(false);
  const [seen, setSeen] = useState(false);
  const ref = useRef(null);
  const feature = FEATURES[index];
  const { Scene } = feature;
  const paused = hovered || !visible;

  // The tour starts when it is first scrolled to and waits while off screen
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { threshold: 0.25 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const bar = (f, className) =>
    !still && (
      <Progress key={f.id} duration={f.duration} paused={paused} onDone={next} className={className} />
    );

  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 lg:gap-10 items-center">
      {/* Phones: a row of buttons above the scene */}
      <div role="tablist" aria-label="Features" className="lg:hidden -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {FEATURES.map((f, i) => (
          <button key={f.id} role="tab" aria-selected={i === index} onClick={() => select(i)}
            className={`relative overflow-hidden flex flex-shrink-0 items-center gap-1.5 h-10 px-3.5 rounded-xl text-sm font-bold ${
              i === index ? "bg-brand-600 text-white shadow-glow" : "bg-white text-slate-600 border border-slate-200"
            }`}>
            <f.icon className="w-4 h-4" /> {f.tab}
            {i === index && bar(f, "absolute inset-x-0 bottom-0 h-[3px] bg-saffron-400")}
          </button>
        ))}
      </div>

      <ul role="tablist" aria-label="Features" className="hidden lg:block space-y-2 min-h-[31rem]">
        {FEATURES.map((f, i) => {
          const active = i === index;
          return (
            <li key={f.id} className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
              active ? "border-brand-200 bg-white shadow-xl" : "border-transparent hover:bg-white hover:shadow-md"
            }`}>
              <button role="tab" aria-selected={active} onClick={() => select(i)} className="flex w-full items-center gap-3.5 p-3.5 text-left">
                <span className={`grid place-items-center w-11 h-11 flex-shrink-0 rounded-xl transition duration-300 ${
                  active ? "bg-brand-600 text-white shadow-glow -rotate-6" : "bg-brand-50 text-brand-600"
                }`}>
                  <f.icon className="w-5 h-5" />
                </span>
                <span className={`text-lg font-bold ${active ? "text-slate-900" : "text-slate-600"}`}>{f.title}</span>
              </button>
              {active && (
                <div className="pl-[4.5rem] pr-5 pb-5">
                  <Details feature={f} />
                </div>
              )}
              {active && bar(f, "absolute inset-x-0 bottom-0 h-1 bg-brand-600")}
            </li>
          );
        })}
      </ul>

      <div {...hover} data-stage className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-700 to-brand-950 shadow-2xl h-[22rem] sm:h-[32rem] lg:h-[34rem]">
        <div aria-hidden="true" className="absolute inset-0 dot-grid" />
        <div aria-hidden="true" className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-white/10 blur-3xl animate-float" />
        <div aria-hidden="true" className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-brand-300/30 blur-3xl animate-float [animation-delay:2s]" />
        <div className="absolute inset-x-3 top-3 bottom-8 sm:inset-x-8 sm:top-8 sm:bottom-10">
          {seen && (
            <FitStage>
              <Scene key={feature.id} />
            </FitStage>
          )}
        </div>
        <span className="absolute bottom-3 right-4 text-xs text-brand-200">Sample data</span>
      </div>

      <div key={feature.id} className="lg:hidden">
        <h3 className="mb-2 text-xl font-bold text-slate-900">{feature.title}</h3>
        <Details feature={feature} />
      </div>
    </div>
  );
}
