import { useId } from "react";

export function Logo({ className = "w-8 h-8" }) {
  // Each copy needs its own id: a gradient inside a hidden copy does not paint
  const gradient = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b86ff" />
          <stop offset="1" stopColor="#1d43d3" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradient})`} />
      <path d="M9.5 9h13M9.5 14h13M9.5 9H14c4 0 6 2.2 6 5s-2 5-6 5h-4l8 6.500" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25" cy="24" r="2.600" fill="#ffbe3d" />
    </svg>
  );
}

// The assistant's mark: a four-point spark
export function Spark({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M10 3c.7 4.600 2.400 6.300 7 7-4.600.7-6.300 2.400-7 7-.7-4.600-2.400-6.300-7-7 4.600-.7 6.300-2.400 7-7Z" />
      <path d="M18.500 14c.3 2.200 1.100 3 3.300 3.300-2.200.3-3 1.100-3.300 3.300-.3-2.200-1.100-3-3.300-3.300 2.200-.3 3-1.100 3.300-3.300Z" />
    </svg>
  );
}
