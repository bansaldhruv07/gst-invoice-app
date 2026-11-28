import { useState, useEffect } from "react";
import { prefersReducedMotion } from "../../hooks/motion";

// How many of the given moments (ms after mounting) have passed.
// Pass a constant array so the clock is not restarted on every render.
export function useTimeline(moments) {
  const [passed, setPassed] = useState(() => (prefersReducedMotion() ? moments.length : 0));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timers = moments.map((ms, i) => setTimeout(() => setPassed(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [moments]);
  return passed;
}
