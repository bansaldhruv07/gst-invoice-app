// What a plan costs for a period, and what is saved compared with the price
// before it. Percentages are rounded down so a saving is never overstated.
export function priceOf(plan, period) {
  const yearly = period === "yearly" && plan.yearlyPrice > 0;
  const amount = yearly ? plan.yearlyPrice : plan.price;
  // A year is compared with twelve monthly payments; a month with the regular price
  const before = yearly ? plan.price * 12 : Math.max(plan.listPrice || 0, plan.price);
  const saving = Math.max(0, before - amount);
  return {
    amount,
    before,
    saving,
    percent: before > 0 ? Math.floor((saving / before) * 100) : 0,
    perMonth: yearly ? Math.round(amount / 12) : amount,
  };
}

// What every plan includes. List only things that exist in the app.
export const INCLUDED = [
  "GST invoices and bills of supply as PDF",
  "Four bill designs with your logo and signature",
  "Quotations and credit notes",
  "CGST, SGST and IGST worked out for you",
  "Payment tracking and WhatsApp reminders",
  "Stock with low-stock warnings",
  "Purchases and expenses",
  "Worker attendance and monthly pay",
  "Reports and GST working sheets",
  "CSV import and a full backup",
];
