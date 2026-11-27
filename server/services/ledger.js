// Account statements for buyers and sellers, and receipts spread over old bills.
const Invoice = require("../models/Invoice");
const Purchase = require("../models/Purchase");
const CreditNote = require("../models/CreditNote");
const { refreshBalance } = require("./balance");
const { round2, sum, istDate, BadRequest } = require("./common");

// For a buyer, debit = they owe more; credit = they owe less.
// For a seller, credit = we owe more; debit = we owe less.
function statement(entries, openingBalance, sign, from, to) {
  const ORDER = { Invoice: 0, Purchase: 0, "Credit note": 1, Payment: 2 };
  entries.sort((a, b) => a.date.localeCompare(b.date) || ORDER[a.type] - ORDER[b.type]);
  const change = (e) => sign * (e.debit - e.credit);

  let balance = openingBalance || 0;
  for (const e of entries) if (from && e.date < from) balance += change(e);
  const broughtForward = round2(balance);

  const rows = entries
    .filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
    .map((e) => ({ ...e, balance: (balance = round2(balance + change(e))) }));

  return {
    broughtForward,
    rows,
    totalDebit: sum(rows, (r) => r.debit),
    totalCredit: sum(rows, (r) => r.credit),
    closing: round2(balance),
  };
}

const MODES = {
  cash: "Cash", upi: "UPI", bank_transfer: "Bank transfer", cheque: "Cheque", card: "Card", other: "Other",
};

const payment = (p, ref, link, side) => ({
  date: istDate(p.date),
  type: "Payment",
  ref,
  link,
  note: [MODES[p.mode] || p.mode, p.note].filter(Boolean).join(" · "),
  debit: side === "debit" ? p.amount : 0,
  credit: side === "credit" ? p.amount : 0,
});

async function buyerRecords(userId, buyerId) {
  return Promise.all([
    Invoice.find({ user: userId, buyer: buyerId, status: { $ne: "cancelled" } }).sort({ invoiceDate: 1 }),
    CreditNote.find({ user: userId, buyer: buyerId }).lean(),
  ]);
}

// What the buyer owes right now
function outstandingOf(buyer, invoices) {
  const opening = Math.max(0, round2((buyer.openingBalance || 0) - sum(buyer.openingPayments || [], (p) => p.amount)));
  const onInvoices = sum(invoices, (i) => i.balanceAmount);
  return { opening, onInvoices, total: round2(opening + onInvoices) };
}

async function buyerLedger(userId, buyer, from, to) {
  const [invoices, notes] = await buyerRecords(userId, buyer._id);
  const entries = [];

  for (const i of invoices) {
    const link = `/invoices/${i._id}`;
    entries.push({
      date: istDate(i.invoiceDate), type: "Invoice", ref: i.invoiceNumber, link, note: "",
      debit: i.grandTotal, credit: 0,
    });
    for (const p of i.paymentHistory) entries.push(payment(p, i.invoiceNumber, link, "credit"));
  }
  for (const n of notes) {
    entries.push({
      date: istDate(n.date), type: "Credit note", ref: n.number, link: `/invoices/${n.invoice}`,
      note: n.reason, debit: 0, credit: n.grandTotal,
    });
  }
  for (const p of buyer.openingPayments || []) {
    entries.push(payment(p, "Opening balance", "", "credit"));
  }

  return {
    ...statement(entries, buyer.openingBalance, 1, from, to),
    outstanding: outstandingOf(buyer, invoices),
    openInvoices: invoices
      .filter((i) => i.balanceAmount > 0)
      .map((i) => ({
        id: String(i._id), invoiceNumber: i.invoiceNumber, date: istDate(i.invoiceDate),
        balance: i.balanceAmount,
      })),
  };
}

// One receipt, applied to the opening balance first and then the oldest invoices
async function receiveFromBuyer(userId, buyer, { amount, date, mode, note }) {
  const value = round2(amount);
  if (!(value > 0)) throw new BadRequest("Enter an amount");
  const [invoices] = await buyerRecords(userId, buyer._id);
  const owed = outstandingOf(buyer, invoices);
  if (value > owed.total + 0.001) {
    throw new BadRequest(`This buyer owes ₹${owed.total.toLocaleString("en-IN")}, so the amount cannot be more`);
  }

  const entry = { date: date ? new Date(date) : new Date(), mode: mode || "upi", note: note || "" };
  const allocations = [];
  let left = value;

  const fromOpening = Math.min(left, owed.opening);
  if (fromOpening > 0) {
    buyer.openingPayments.push({ ...entry, amount: fromOpening });
    await buyer.save();
    allocations.push({ ref: "Opening balance", amount: fromOpening });
    left = round2(left - fromOpening);
  }
  for (const invoice of invoices) {
    if (left <= 0) break;
    const part = Math.min(left, invoice.balanceAmount);
    if (part <= 0) continue;
    invoice.paymentHistory.push({ ...entry, amount: part });
    refreshBalance(invoice);
    await invoice.save();
    allocations.push({ ref: invoice.invoiceNumber, amount: part });
    left = round2(left - part);
  }
  return allocations;
}

async function sellerLedger(userId, seller, from, to) {
  const purchases = await Purchase.find({ user: userId, seller: seller._id, status: { $ne: "cancelled" } }).lean();
  const entries = [];
  for (const p of purchases) {
    entries.push({
      date: istDate(p.purchaseDate), type: "Purchase", ref: p.purchaseNumber, link: "",
      note: p.sellerInvoiceNumber ? `Seller bill ${p.sellerInvoiceNumber}` : "",
      debit: 0, credit: p.grandTotal,
    });
    for (const x of p.paymentHistory || []) entries.push(payment(x, p.purchaseNumber, "", "debit"));
  }
  const result = statement(entries, seller.openingBalance, -1, from, to);
  return {
    ...result,
    outstanding: { total: round2((seller.openingBalance || 0) + sum(purchases, (p) => p.balanceAmount)) },
  };
}

// For the new-invoice screen: dues, credit limit and the last price charged
async function buyerContext(userId, buyer) {
  const [invoices] = await buyerRecords(userId, buyer._id);
  const prices = {};
  for (const i of invoices) {
    // Oldest first, so the latest sale wins
    for (const l of i.items) {
      prices[String(l.name).trim().toLowerCase()] = {
        rate: l.rate, date: istDate(i.invoiceDate), invoiceNumber: i.invoiceNumber,
      };
    }
  }
  return {
    outstanding: outstandingOf(buyer, invoices).total,
    creditLimit: buyer.creditLimit || 0,
    prices,
  };
}

module.exports = { buyerLedger, sellerLedger, receiveFromBuyer, buyerContext, outstandingOf };
