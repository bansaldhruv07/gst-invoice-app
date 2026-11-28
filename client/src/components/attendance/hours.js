// Showing times and lengths of time.

// 510 → "8h 30m"
export function formatHours(minutes) {
  const m = Math.max(0, Math.round(minutes || 0));
  const rest = m % 60;
  return `${Math.floor(m / 60)}h${rest ? ` ${rest}m` : ""}`;
}

// Hours as a decimal, for spreadsheets: 510 → 8.5
export const decimalHours = (minutes) => Math.round(((minutes || 0) / 60) * 100) / 100;

// "18:05" → "6:05 pm"
export function clock(time) {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

// The time now, as the time fields hold it
export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const leftNextDay = (day) => Boolean(day.in && day.out && day.out < day.in);
