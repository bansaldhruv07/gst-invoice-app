// When a worker came and left on one day, with the hours that makes.
import { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { formatHours, nowTime, leftNextDay } from "./hours";

// Saved when the field is left, on Enter, or a moment after a time is picked (a
// phone's time picker can leave the field focused), not on every key
function TimeField({ label, name, value, onSave, disabled, canStamp }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const timer = useRef(null);
  // What the server holds replaces what was typed, without losing the cursor
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = (next) => {
    clearTimeout(timer.current);
    if (next !== value) onSave(next);
  };
  const change = (next) => {
    setDraft(next);
    clearTimeout(timer.current);
    // An empty value may only be half typed; clearing is saved on leaving
    if (next) timer.current = setTimeout(() => save(next), 1500);
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 text-xs font-semibold text-slate-500">{label}</span>
      <input type="time" aria-label={`${label} time of ${name}`} value={draft} disabled={disabled}
        onChange={(e) => change(e.target.value)} onBlur={() => save(draft)}
        onKeyDown={(e) => e.key === "Enter" && save(draft)}
        className="input h-9 w-[7.25rem] text-sm" />
      {canStamp && !value && !disabled && (
        <button type="button" onClick={() => onSave(nowTime())} aria-label={`${name} ${label.toLowerCase()} now`} className="btn-secondary btn-sm h-9">
          Now
        </button>
      )}
    </div>
  );
}

// `onSave` receives { inTime } or { outTime }
export default function TimeRow({ worker, day, today, disabled, onSave }) {
  const times = worker.times[day] || { in: "", out: "", minutes: 0, overtime: 0 };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <TimeField key={`in-${day}`} label="Came" name={worker.name} value={times.in} disabled={disabled}
        canStamp={today} onSave={(inTime) => onSave({ inTime })} />
      <TimeField key={`out-${day}`} label="Left" name={worker.name} value={times.out} disabled={disabled || !times.in}
        canStamp={today} onSave={(outTime) => onSave({ outTime })} />
      {times.minutes > 0 && (
        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
          <Clock className="w-4 h-4 text-brand-600" /> {formatHours(times.minutes)}
          {times.overtime > 0 && <span className="badge bg-amber-50 text-amber-800 border-amber-200">{formatHours(times.overtime)} overtime</span>}
          {leftNextDay(times) && <span className="text-xs font-semibold text-slate-500">left next day</span>}
        </p>
      )}
    </div>
  );
}
