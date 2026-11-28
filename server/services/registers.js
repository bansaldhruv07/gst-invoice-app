// Sales and purchase reports (by party, by product and bill by bill), the inward
// supplies sheet (GSTR-2), current stock, and who owes whom.
const Invoice = require("../models/Invoice");
const Purchase = require("../models/Purchase");
const CreditNote = require("../models/CreditNote");
const Buyer = require("../models/Buyer");
const Seller = require("../models/Seller");
const Item = require("../models/Item");
const { loadPeriod, claimsCredit, placeOfSupply } = require("./reports");
const { computeStock } = require("./stock");
const { costOf } = require("./cost");
const { round2, sum, istDate, normaliseName } = require("./common");

const round3 = (n) => Math.round(n * 1000) / 1000;
const MONEY = ["taxable", "discount", "cgst", "sgst", "igst", "cess", "tax", "total"];

// Adds the money fields of `row` onto `target`
function addMoney(target, row, fields = MONEY) {
  for (const f of fields) if (row[f] !== undefined) target[f] = round2((target[f] || 0) + row[f]);
  return target;
}

// ── Building blocks ──────────────────────────────────────────────────────────
// One bill or credit note as a row; `sign` is -1 for a credit note
function billRow(doc, party, sign, extra) {
  const m = (value) => round2(sign * (value || 0));
  return {
    partyId: party?._id ? String(party._id) : "",
    party: party?.name || "Unknown",
    gstin: party?.gstin || "",
    taxable: m(doc.subTotal),
    discount: m(doc.discountAmount),
    cgst: m(doc.totalCgst),
    sgst: m(doc.totalSgst),
    igst: m(doc.totalIgst),
    cess: m(doc.totalCess),
    tax: m((doc.totalCgst || 0) + (doc.totalSgst || 0) + (doc.totalIgst || 0)),
    total: m(doc.grandTotal),
    ...extra,
  };
}

// One product line of a bill
function lineRows(doc, bill, sign) {
  const m = (value) => round2(sign * (value || 0));
  return doc.items.map((l) => ({
    key: `${normaliseName(l.name)}|${l.unit || ""}`,
    billId: bill.id,
    date: bill.date,
    number: bill.number,
    party: bill.party,
    name: l.name,
    hsn: l.hsn || "",
    unit: l.unit || "",
    rate: l.rate,
    gstPercent: l.gstPercent || 0,
    quantity: round3(sign * l.quantity),
    taxable: m(l.taxableAmount),
    cgst: m(l.cgstAmount),
    sgst: m(l.sgstAmount),
    igst: m(l.igstAmount),
    cess: m(l.cessAmount),
    tax: m((l.cgstAmount || 0) + (l.sgstAmount || 0) + (l.igstAmount || 0)),
    total: m(l.totalAmount),
  }));
}

function byParty(bills) {
  const parties = new Map();
  for (const b of bills) {
    const key = b.partyId || b.party;
    const row = parties.get(key) ||
      { key, id: b.partyId, name: b.party, gstin: b.gstin, bills: 0, returns: 0, balance: 0 };
    if (b.isReturn) row.returns = round2(row.returns - b.total);
    else row.bills += 1;
    row.balance = round2(row.balance + (b.balance || 0));
    addMoney(row, b);
    parties.set(key, row);
  }
  return [...parties.values()].sort((a, b) => b.total - a.total);
}

function byProduct(lines) {
  const products = new Map();
  for (const l of lines) {
    const row = products.get(l.key) || { key: l.key, name: l.name, hsn: l.hsn, unit: l.unit, quantity: 0 };
    row.quantity = round3(row.quantity + l.quantity);
    row.hsn ||= l.hsn;
    addMoney(row, l);
    products.set(l.key, row);
  }
  return [...products.values()]
    .map((p) => ({ ...p, averageRate: p.quantity > 0 ? round2(p.taxable / p.quantity) : 0 }))
    .sort((a, b) => b.total - a.total);
}

function byTaxRate(lines) {
  const rates = new Map();
  for (const l of lines) {
    const row = rates.get(l.gstPercent) || { rate: l.gstPercent };
    addMoney(row, l, ["taxable", "cgst", "sgst", "igst", "cess", "tax"]);
    rates.set(l.gstPercent, row);
  }
  return [...rates.values()].sort((a, b) => a.rate - b.rate);
}

const inOrder = (a, b) => a.date.localeCompare(b.date) || String(a.number).localeCompare(String(b.number));

// ── Sales ────────────────────────────────────────────────────────────────────
async function salesReport(user, from, to) {
  const [{ invoices, notes }, items] = await Promise.all([
    loadPeriod(user._id, from, to),
    Item.find({ user: user._id }).select("name purchasePrice purchaseTaxMode gstPercent").lean(),
  ]);
  const homeState = user.supplierStateCode || "07";
  const supplyTo = (buyer) => placeOfSupply(buyer?.stateCode || homeState);

  const bills = [];
  const lines = [];
  for (const i of invoices) {
    const bill = billRow(i, i.buyer, 1, {
      id: String(i._id), number: i.invoiceNumber, date: istDate(i.invoiceDate),
      type: i.invoiceType === "bill_of_supply" ? "Bill of supply" : "Invoice",
      placeOfSupply: supplyTo(i.buyer), balance: i.balanceAmount || 0, isReturn: false,
    });
    bills.push(bill);
    lines.push(...lineRows(i, bill, 1));
  }
  for (const n of notes) {
    const bill = billRow(n, n.buyer, -1, {
      id: n.invoice?._id ? String(n.invoice._id) : "", number: n.number, date: istDate(n.date),
      type: "Credit note", placeOfSupply: supplyTo(n.buyer), balance: 0, isReturn: true,
    });
    bills.push(bill);
    lines.push(...lineRows(n, bill, -1));
  }

  // Margin, for products whose purchase price is known. Goods that did not come
  // back into stock are still a cost.
  const costById = new Map(items.map((i) => [String(i._id), costOf(i)]));
  const costByName = new Map(items.map((i) => [normaliseName(i.name), costOf(i)]));
  const costs = new Map();
  const sold = invoices.map((record) => [record, 1, true]);
  const returned = notes.map((record) => [record, -1, record.restock]);
  for (const [record, sign, counted] of [...sold, ...returned]) {
    for (const l of record.items) {
      const key = `${normaliseName(l.name)}|${l.unit || ""}`;
      const cost = costById.get(String(l.item)) || costByName.get(normaliseName(l.name)) || 0;
      const entry = costs.get(key) || { cost: 0, known: true };
      if (!cost) entry.known = false;
      else if (counted) entry.cost += sign * l.quantity * cost;
      costs.set(key, entry);
    }
  }

  bills.sort(inOrder);
  lines.sort(inOrder);
  return {
    bills,
    lines,
    parties: byParty(bills),
    products: byProduct(lines).map((p) => {
      const entry = costs.get(p.key);
      return { ...p, margin: entry?.known ? round2(p.taxable - entry.cost) : null };
    }),
    rates: byTaxRate(lines),
  };
}

// ── Purchases ────────────────────────────────────────────────────────────────
async function purchaseReport(user, from, to) {
  const { purchases } = await loadPeriod(user._id, from, to);
  const bills = [];
  const lines = [];
  for (const p of purchases) {
    const bill = billRow(p, p.seller, 1, {
      id: String(p._id), number: p.purchaseNumber, supplierBill: p.sellerInvoiceNumber || "",
      date: istDate(p.purchaseDate),
      type: p.purchaseType === "bill_of_supply" ? "Bill of supply" : "Tax invoice",
      balance: p.balanceAmount || 0, credit: claimsCredit(p) ? "Yes" : "No", isReturn: false,
    });
    bills.push(bill);
    lines.push(...lineRows(p, bill, 1));
  }
  bills.sort(inOrder);
  lines.sort(inOrder);
  return { bills, lines, parties: byParty(bills), products: byProduct(lines), rates: byTaxRate(lines) };
}

// ── GSTR-2: inward supplies ──────────────────────────────────────────────────
async function gstr2Report(user, from, to) {
  const { purchases } = await loadPeriod(user._id, from, to);
  const registered = [];
  const unregistered = [];
  const exempt = [];
  const hsn = new Map();
  const itc = { taxable: 0, igst: 0, cgst: 0, sgst: 0 };
  const FIELDS = ["taxable", "igst", "cgst", "sgst"];

  for (const p of purchases) {
    const base = {
      gstin: p.seller?.gstin || "", seller: p.seller?.name || "", number: p.purchaseNumber,
      supplierBill: p.sellerInvoiceNumber || "", date: istDate(p.purchaseDate), value: p.grandTotal,
    };
    const rates = new Map();
    let nil = 0;
    for (const l of p.items) {
      const amounts = {
        taxable: l.taxableAmount || 0, igst: l.igstAmount || 0, cgst: l.cgstAmount || 0, sgst: l.sgstAmount || 0,
      };
      const key = [l.hsn, l.unit, l.gstPercent].join("|");
      const row = hsn.get(key) || { hsn: l.hsn || "", unit: l.unit || "", rate: l.gstPercent || 0, quantity: 0 };
      row.quantity = round3(row.quantity + l.quantity);
      addMoney(row, amounts, FIELDS);
      hsn.set(key, row);

      if (p.purchaseType === "bill_of_supply" || !l.gstPercent) {
        nil = round2(nil + amounts.taxable);
        continue;
      }
      rates.set(l.gstPercent, addMoney(rates.get(l.gstPercent) || { rate: l.gstPercent }, amounts, FIELDS));
    }
    if (nil) exempt.push({ ...base, taxable: nil });
    for (const r of [...rates.values()].sort((a, b) => a.rate - b.rate)) {
      (claimsCredit(p) ? registered : unregistered).push({ ...base, ...r });
      if (claimsCredit(p)) addMoney(itc, r, FIELDS);
    }
  }

  return {
    registered,
    unregistered,
    exempt,
    hsn: [...hsn.values()].sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate),
    itc: { ...itc, tax: round2(itc.igst + itc.cgst + itc.sgst) },
  };
}

// ── Current stock ────────────────────────────────────────────────────────────
async function stockReport(userId) {
  const [stock, untracked] = await Promise.all([
    computeStock(userId),
    Item.countDocuments({ user: userId, trackStock: { $ne: true } }),
  ]);
  return { stock, untracked, value: sum(stock, (s) => s.value), low: stock.filter((s) => s.low).length };
}

// ── Debtors and creditors, as of now ─────────────────────────────────────────
// The same arithmetic as each party's statement: what was owed at the start,
// plus bills, less payments and returns.
async function outstandingReport(userId) {
  const [buyers, sellers, invoices, notes, purchases] = await Promise.all([
    Buyer.find({ user: userId }).select("name gstin mobile openingBalance openingPayments").lean(),
    Seller.find({ user: userId }).select("name gstin mobile openingBalance").lean(),
    Invoice.find({ user: userId, status: { $ne: "cancelled" } })
      .select("buyer grandTotal paymentHistory.amount").lean(),
    CreditNote.find({ user: userId }).select("buyer grandTotal").lean(),
    Purchase.find({ user: userId, status: { $ne: "cancelled" } })
      .select("seller grandTotal paymentHistory.amount").lean(),
  ]);

  const totals = new Map();
  const bucket = (id) => {
    const key = String(id);
    if (!totals.has(key)) totals.set(key, { billed: 0, paid: 0, returns: 0 });
    return totals.get(key);
  };
  const paidOn = (doc) => sum(doc.paymentHistory || [], (p) => p.amount);
  for (const [list, party] of [[invoices, "buyer"], [purchases, "seller"]]) {
    for (const doc of list) {
      const t = bucket(doc[party]);
      t.billed = round2(t.billed + doc.grandTotal);
      t.paid = round2(t.paid + paidOn(doc));
    }
  }
  for (const n of notes) {
    const t = bucket(n.buyer);
    t.returns = round2(t.returns + n.grandTotal);
  }

  const row = (party, kind) => {
    const t = totals.get(String(party._id)) || { billed: 0, paid: 0, returns: 0 };
    const paid = round2(t.paid + sum(party.openingPayments || [], (p) => p.amount));
    const opening = round2(party.openingBalance || 0);
    const balance = round2(opening + t.billed - paid - t.returns);
    // A buyer who owes is a debtor; a seller who is owed is a creditor. A
    // negative balance (money paid in advance) puts them on the other side.
    const theyOwe = kind === "Buyer" ? balance > 0 : balance < 0;
    return {
      id: String(party._id), kind, name: party.name, gstin: party.gstin || "", mobile: party.mobile || "",
      opening, billed: t.billed, paid, returns: t.returns,
      side: balance === 0 ? "settled" : theyOwe ? "debtor" : "creditor",
      balance: Math.abs(balance),
    };
  };

  const parties = [...buyers.map((b) => row(b, "Buyer")), ...sellers.map((s) => row(s, "Seller"))]
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  return {
    parties,
    receivable: sum(parties.filter((p) => p.side === "debtor"), (p) => p.balance),
    payable: sum(parties.filter((p) => p.side === "creditor"), (p) => p.balance),
  };
}

module.exports = { salesReport, purchaseReport, gstr2Report, stockReport, outstandingReport };
