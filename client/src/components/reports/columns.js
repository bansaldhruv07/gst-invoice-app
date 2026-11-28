// Report table columns: how they are described, shown and totalled.
import { money, shortDate } from "../../lib/format.js";

// col("Taxable", "taxable", "money", { total: true })
export const col = (label, key, type, more) => ({ label, key, type, ...more });
export const sumCol = (label, key, type = "money", more) => col(label, key, type, { total: true, ...more });

export const isNumeric = (c) => ["money", "number", "percent"].includes(c.type);

export function show(value, type) {
  if (value === "" || value === undefined || value === null) return "—";
  if (type === "money") return money(value);
  if (type === "date") return shortDate(value);
  if (type === "percent") return `${value}%`;
  return value;
}

// Sums of the columns marked `total`, or null when there is nothing to add up
export function totalsOf(rows, columns) {
  const summed = columns.filter((c) => c.total);
  if (!summed.length || !rows.length) return null;
  return Object.fromEntries(
    summed.map((c) => [c.key, Math.round(rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0) * 1000) / 1000]),
  );
}
