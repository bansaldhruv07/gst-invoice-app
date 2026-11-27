import { useEffect, useRef, useState } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Counts from the previous value to the new one
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const from = useRef(value);

  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    const length = prefersReducedMotion() ? 0 : duration;
    let frame;
    const tick = (now) => {
      const t = length ? Math.min(1, (now - start) / length) : 1;
      const next = begin + (target - begin) * (1 - (1 - t) ** 3);
      from.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

// Elements with the "reveal" class inside the returned ref fade in when scrolled to
export function useReveal(dependency) {
  const ref = useRef(null);

  useEffect(() => {
    const nodes = ref.current?.querySelectorAll(".reveal:not(.is-visible)") || [];
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-visible");
          observer.unobserve(e.target);
        });
      },
      { threshold: 0.12 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [dependency]);

  return ref;
}
