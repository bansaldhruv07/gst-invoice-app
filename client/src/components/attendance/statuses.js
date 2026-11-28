export const STATUSES = [
  { id: "present", label: "Present", short: "P", solid: "border-emerald-600 bg-emerald-600 text-white", soft: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { id: "half", label: "Half day", short: "½", solid: "border-amber-500 bg-amber-500 text-white", soft: "bg-amber-50 text-amber-800 border-amber-200" },
  { id: "absent", label: "Absent", short: "A", solid: "border-red-600 bg-red-600 text-white", soft: "bg-red-50 text-red-800 border-red-200" },
  { id: "leave", label: "Leave", short: "L", solid: "border-brand-600 bg-brand-600 text-white", soft: "bg-brand-50 text-brand-700 border-brand-200" },
];

export const monthName = (month) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export function shiftMonth(month, by) {
  const [year, m] = month.split("-").map(Number);
  const moved = new Date(Date.UTC(year, m - 1 + by, 1));
  return moved.toISOString().slice(0, 7);
}
