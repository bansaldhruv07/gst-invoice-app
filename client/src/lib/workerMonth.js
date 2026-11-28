// What happened in one worker's month, for the screen, the PDF and the spreadsheet.
const day = (date) => date.split("-").reverse().join("-");

// Dates with a given mark, oldest first, as YYYY-MM-DD
export const datesMarked = (worker, status) =>
  Object.keys(worker.marks).filter((date) => worker.marks[date] === status).sort();

// "3, 12, 21": the days of the month with a given mark
export const daysMarked = (worker, status) =>
  datesMarked(worker, status).map((date) => Number(date.slice(8))).join(", ");

// Days not worked: absent, leave and half days, in date order
export const daysOff = (worker) =>
  Object.entries(worker.marks)
    .filter(([, status]) => status !== "present")
    .sort(([a], [b]) => a.localeCompare(b));

const byDate = (a, b) => a.date.localeCompare(b.date);
export const advancesOf = (worker) => worker.payments.filter((p) => p.kind === "advance").sort(byDate);
export const paymentsInOrder = (worker) => [...worker.payments].sort(byDate);

// "05-11-2026: 2000 (medicine); 18-11-2026: 500"
export const advanceDetails = (worker) =>
  advancesOf(worker).map((p) => `${day(p.date)}: ${p.amount}${p.note ? ` (${p.note})` : ""}`).join("; ");
