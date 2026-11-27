import { useState } from "react";
import { prefersReducedMotion } from "../../hooks/motion";

// Steps through the features. The timer is the progress bar's own animation,
// so pausing the bar pauses the tour. People who prefer less motion pick
// features themselves.
export function useRotation(count) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [still] = useState(prefersReducedMotion);

  return {
    index,
    still,
    hovered,
    select: setIndex,
    next: () => setIndex((i) => (i + 1) % count),
    hover: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
  };
}
