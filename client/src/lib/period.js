// Date ranges used by statements, expenses and reports. Financial year is April to March.
const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

export function todayISO() {
  const now = new Date();
  return iso(now.getFullYear(), now.getMonth(), now.getDate());
}

export const PERIODS = [
  ["this-month", "This month"],
  ["last-month", "Last month"],
  ["this-quarter", "This quarter"],
  ["this-year", "This financial year"],
  ["last-year", "Last financial year"],
  ["custom", "Custom dates"],
];

export function periodRange(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fy = m >= 3 ? y : y - 1;
  const quarterStart = m - (m % 3);
  switch (key) {
    case "last-month":
      return { from: iso(y, m - 1, 1), to: iso(y, m, 0) };
    case "this-quarter":
      return { from: iso(y, quarterStart, 1), to: iso(y, quarterStart + 3, 0) };
    case "this-year":
      return { from: iso(fy, 3, 1), to: iso(fy + 1, 2, 31) };
    case "last-year":
      return { from: iso(fy - 1, 3, 1), to: iso(fy, 2, 31) };
    default:
      return { from: iso(y, m, 1), to: iso(y, m + 1, 0) };
  }
}
