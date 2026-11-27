// Fills over the time a feature stays on screen, then calls onDone.
export default function Progress({ duration, paused, onDone, className = "" }) {
  return (
    <span aria-hidden="true" className={`block animate-progress ${className}`}
      style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? "paused" : "running" }}
      onAnimationEnd={onDone} />
  );
}
