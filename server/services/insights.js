// Business figures for the Overview page and the assistant. Everything here is
// computed from the signed-in user's own records.
const Invoice = require("../models/Invoice");
const Purchase = require("../models/Purchase");
const CreditNote = require("../models/CreditNote");
const Quotation = require("../models/Quotation");
const Expense = require("../models/Expense");
const Buyer = require("../models/Buyer");
const Item = require("../models/Item");
const User = require("../models/User");
const { getUserPlan } = require("../middleware/checkPlan");
const { computeStock } = require("./stock");
const { claimsCredit } = require("./reports");
const { deletedThisMonth } = require("./usage");
const { round2, sum: total, istDate } = require("./common");

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_CREDIT_DAYS = 30;

function shiftMonth(month, by) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

const monthLabel = (month, style = "long") =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", {
    month: style, year: "numeric", timeZone: "UTC",
  });

const rupees = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function monthFigures({ invoices, notes, purchases, expenses }, month) {
  const inMonth = (list, key) => list.filter((x) => istDate(x[key]).startsWith(month));
  const sales = inMonth(invoices, "invoiceDate");
  const returns = inMonth(notes, "date");
  const buys = inMonth(purchases, "purchaseDate");
  const outputTax = round2(total(sales, (i) => i.totalTax) - total(returns, (n) => n.totalTax));
  const inputTax = total(buys.filter(claimsCredit), (p) => p.totalTax);
  return {
    month,
    label: monthLabel(month),
    shortLabel: monthLabel(month, "short"),
    invoiceCount: sales.length,
    sales: round2(total(sales, (i) => i.grandTotal) - total(returns, (n) => n.grandTotal)),
    returns: total(returns, (n) => n.grandTotal),
    purchaseCount: buys.length,
    purchases: total(buys, (p) => p.grandTotal),
    expenses: total(inMonth(expenses, "date"), (e) => e.amount),
    outputTax,
    inputTax,
    netTax: round2(outputTax - inputTax),
  };
}

function setupSteps(user, counts, hasLogo) {
  return [
    { id: "business", label: "Business name, address and phone", to: "/settings",
      done: Boolean(user.supplierName && user.supplierAddress && user.supplierPhone) },
    { id: "gstin", label: "GSTIN and state code", to: "/settings",
      done: Boolean(user.supplierGstin) },
    { id: "bank", label: "Bank details printed on invoices", to: "/settings",
      done: Boolean(user.supplierBankAccount && user.supplierBankIfsc) },
    { id: "logo", label: "Logo", to: "/settings", done: hasLogo },
    { id: "buyer", label: "First buyer", to: "/buyers", done: counts.buyers > 0 },
    { id: "item", label: "First product", to: "/items", done: counts.items > 0 },
    { id: "invoice", label: "First invoice", to: "/invoices/create", done: counts.invoices > 0 },
  ];
}

async function buildInsights(user) {
  const userId = user._id;
  const [invoices, purchases, notes, expenses, quotations, buyers, items, stock, planInfo, logo] = await Promise.all([
    Invoice.find({ user: userId, status: { $ne: "cancelled" } })
      .select("invoiceNumber invoiceDate dueDate status grandTotal balanceAmount totalTax buyer createdAt")
      .populate("buyer", "name mobile")
      .lean(),
    Purchase.find({ user: userId, status: { $ne: "cancelled" } })
      .select("purchaseDate purchaseType grandTotal totalTax balanceAmount seller")
      .populate("seller", "gstin")
      .lean(),
    CreditNote.find({ user: userId }).select("date grandTotal totalTax").lean(),
    Expense.find({ user: userId }).select("date amount").lean(),
    Quotation.find({ user: userId, status: { $in: ["open", "accepted"] } })
      .select("invoiceNumber grandTotal validUntil status").lean(),
    Buyer.find({ user: userId }).select("name mobile stateCode openingBalance openingPayments creditLimit").lean(),
    Item.find({ user: userId }).select("name hsn").lean(),
    computeStock(userId),
    getUserPlan(userId),
    // Asked of the database, so the picture itself is never fetched here
    User.exists({ _id: userId, logoUrl: { $nin: ["", null] } }),
  ]);

  const today = istDate(Date.now());
  const month = today.slice(0, 7);
  const dayOfMonth = Number(today.slice(8, 10));
  const data = { invoices, notes, purchases, expenses };
  const trend = [-5, -4, -3, -2, -1, 0].map((by) => monthFigures(data, shiftMonth(month, by)));
  const thisMonth = trend[5];
  const lastMonth = trend[4];

  // ── Money owed to the business ───────────────────────────────────────────
  const open = invoices
    .filter((i) => i.balanceAmount > 0)
    .map((i) => {
      const due = i.dueDate
        ? new Date(i.dueDate)
        : new Date(new Date(i.invoiceDate).getTime() + DEFAULT_CREDIT_DAYS * DAY);
      const daysOverdue = Math.round((Date.parse(today) - Date.parse(istDate(due))) / DAY);
      return {
        id: String(i._id),
        buyerId: String(i.buyer?._id || ""),
        invoiceNumber: i.invoiceNumber,
        buyer: i.buyer?.name || "Unknown buyer",
        mobile: i.buyer?.mobile || "",
        balance: i.balanceAmount,
        dueDate: istDate(due),
        daysOverdue,
      };
    });
  const overdue = open.filter((i) => i.daysOverdue > 0).sort((a, b) => b.balance - a.balance);
  const bucket = (min, max) =>
    total(open.filter((i) => i.daysOverdue >= min && i.daysOverdue <= max), (i) => i.balance);

  // Old dues entered when the buyer was added
  const openingDue = (b) =>
    Math.max(0, round2((b.openingBalance || 0) - total(b.openingPayments || [], (p) => p.amount)));
  const openingTotal = total(buyers, openingDue);

  // Who owes what, largest first
  const debtors = buyers
    .map((b) => {
      const mine = open.filter((i) => i.buyerId === String(b._id));
      return {
        id: String(b._id),
        name: b.name,
        due: round2(openingDue(b) + total(mine, (i) => i.balance)),
        invoices: mine.length,
        daysOverdue: Math.max(0, ...mine.map((i) => i.daysOverdue)),
      };
    })
    .filter((b) => b.due > 0)
    .sort((a, b) => b.due - a.due);

  const receivables = {
    total: round2(total(open, (i) => i.balance) + openingTotal),
    count: open.length,
    overdueTotal: total(overdue, (i) => i.balance),
    overdueCount: overdue.length,
    ageing: [
      { label: "Not yet due", amount: bucket(-Infinity, 0) },
      { label: "1–30 days late", amount: bucket(1, 30) },
      { label: "31–60 days late", amount: bucket(31, 60) },
      { label: "Over 60 days late", amount: bucket(61, Infinity) },
      ...(openingTotal ? [{ label: "Old opening balances", amount: openingTotal }] : []),
    ],
    overdue: overdue.slice(0, 10),
    buyers: debtors.slice(0, 15),
  };

  const unpaidPurchases = purchases.filter((p) => p.balanceAmount > 0);
  const payables = {
    total: total(unpaidPurchases, (p) => p.balanceAmount),
    count: unpaidPurchases.length,
  };

  // ── Best buyers over the last 90 days ────────────────────────────────────
  const since = Date.now() - 90 * DAY;
  const byBuyer = new Map();
  for (const i of invoices) {
    if (new Date(i.invoiceDate).getTime() < since) continue;
    const key = String(i.buyer?._id || "unknown");
    const row = byBuyer.get(key) ||
      { id: i.buyer ? key : "", name: i.buyer?.name || "Unknown buyer", sales: 0, invoices: 0 };
    row.sales = round2(row.sales + i.grandTotal);
    row.invoices += 1;
    byBuyer.set(key, row);
  }
  const topBuyers = [...byBuyer.values()].sort((a, b) => b.sales - a.sales).slice(0, 5);

  const overLimit = buyers
    .filter((b) => b.creditLimit > 0)
    .map((b) => ({
      id: String(b._id), name: b.name, limit: b.creditLimit,
      due: round2(openingDue(b) + total(open.filter((i) => i.buyerId === String(b._id)), (i) => i.balance)),
    }))
    .filter((b) => b.due > b.limit);

  const lowStock = stock
    .filter((s) => s.low)
    .map((s) => ({ name: s.name, stock: s.stock, unit: s.unit, lowStockAt: s.lowStockAt }));

  // ── Plan usage ───────────────────────────────────────────────────────────
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const created =
    invoices.filter((i) => new Date(i.createdAt) >= monthStart).length + deletedThisMonth(user);
  const limits = planInfo.plan?.limits || {};
  const plan = {
    name: planInfo.plan?.displayName || "Free",
    invoices: { used: created, limit: limits.invoicesPerMonth ?? -1 },
    buyers: { used: buyers.length, limit: limits.buyers ?? -1 },
    items: { used: items.length, limit: limits.items ?? -1 },
  };

  const counts = {
    buyers: buyers.length,
    items: items.length,
    invoices: await Invoice.countDocuments({ user: userId }),
  };
  const setup = setupSteps(user, counts, Boolean(logo));

  // ── Things that need attention, most urgent first ────────────────────────
  const attention = [];
  const add = (severity, id, title, detail, to) =>
    attention.push({ severity, id, title, detail, to });

  if (receivables.overdueCount) {
    const worst = overdue[0];
    add("high", "overdue",
      `${rupees(receivables.overdueTotal)} is overdue on ${plural(receivables.overdueCount, "invoice")}`,
      `Largest: ${worst.buyer}, ${rupees(worst.balance)}, ${plural(worst.daysOverdue, "day")} late.`,
      `/invoices/${worst.id}`);
  }
  const missingEssentials = setup.filter((s) => !s.done && ["business", "gstin", "bank"].includes(s.id));
  if (missingEssentials.length) {
    add("high", "setup", "Your invoices are missing business details",
      `Add: ${missingEssentials.map((s) => s.label.toLowerCase()).join("; ")}.`, "/settings");
  }
  if (overLimit.length) {
    add("high", "credit", `${plural(overLimit.length, "buyer")} over the credit limit`,
      overLimit.slice(0, 3).map((b) => `${b.name} owes ${rupees(b.due)} (limit ${rupees(b.limit)})`).join("; ") + ".",
      `/buyers/${overLimit[0].id}`);
  }
  if (lowStock.length) {
    add("medium", "stock", `${plural(lowStock.length, "product")} running low`,
      lowStock.slice(0, 3).map((s) => `${s.name}: ${s.stock} ${s.unit}`).join("; ") + ".", "/stock");
  }
  // Due dates for monthly filers; quarterly (QRMP) filers have different dates
  if (lastMonth.invoiceCount && dayOfMonth <= 11) {
    add("medium", "gstr1", `GSTR-1 for ${lastMonth.label} is due on the 11th`,
      `${plural(lastMonth.invoiceCount, "invoice")}, ${rupees(lastMonth.outputTax)} tax collected (monthly filers).`,
      "/reports?tab=gst&period=last-month");
  } else if ((lastMonth.invoiceCount || lastMonth.purchaseCount) && dayOfMonth <= 20) {
    add("medium", "gstr3b", `GSTR-3B for ${lastMonth.label} is due on the 20th`,
      `Estimated net GST from your records: ${rupees(Math.max(0, lastMonth.netTax))} (monthly filers).`,
      "/reports?tab=gst&period=last-month");
  }
  const soon = istDate(Date.now() + 3 * DAY);
  const expiring = quotations.filter(
    (q) => q.status === "open" && q.validUntil && istDate(q.validUntil) >= today && istDate(q.validUntil) <= soon,
  );
  if (expiring.length) {
    add("medium", "quotes", `${plural(expiring.length, "quotation")} expiring in 3 days`,
      "Follow up before the price lapses.", "/quotations");
  }
  for (const [key, label, to] of [
    ["invoices", "invoices this month", "/pricing"],
    ["buyers", "buyers", "/pricing"],
    ["items", "products", "/pricing"],
  ]) {
    const { used, limit } = plan[key];
    if (limit > 0 && used >= limit * 0.8) {
      add(used >= limit ? "high" : "medium", `limit-${key}`,
        `${used} of ${limit} ${label} used on the ${plan.name} plan`,
        used >= limit ? "You cannot add more until you upgrade." : "You are close to the limit.", to);
    }
  }
  const noHsn = items.filter((i) => !i.hsn).length;
  if (noHsn) {
    add("low", "hsn", `${plural(noHsn, "product")} without an HSN/SAC code`,
      "The code is printed on tax invoices.", "/items");
  }
  const noState = buyers.filter((b) => !b.stateCode).length;
  if (noState) {
    add("low", "state", `${plural(noState, "buyer")} without a GSTIN or state`,
      "These are billed as CGST + SGST even if they are in another state.", "/buyers");
  }
  const noMobile = overdue.filter((i) => !i.mobile).length;
  if (noMobile) {
    add("low", "mobile", `${plural(noMobile, "overdue invoice")} with no buyer mobile number`,
      "Add numbers to send WhatsApp reminders.", "/buyers");
  }

  return {
    today,
    thisMonth,
    lastMonth,
    trend: trend.map(({ month, shortLabel, sales, purchases, expenses }) => ({
      month, label: shortLabel, sales, purchases, expenses,
    })),
    receivables,
    payables,
    topBuyers,
    lowStock: lowStock.slice(0, 20),
    openQuotations: { count: quotations.length, value: total(quotations, (q) => q.grandTotal) },
    plan,
    setup,
    counts,
    attention,
  };
}

module.exports = { buildInsights };
