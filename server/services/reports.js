// Period reports: business summary, GST working sheets and the day book.
// These are worked out from the records in the app. They are not a GST filing.
const Invoice = require("../models/Invoice");
const Purchase = require("../models/Purchase");
const CreditNote = require("../models/CreditNote");
const Expense = require("../models/Expense");
const Buyer = require("../models/Buyer");
const Item = require("../models/Item");
const { round2, sum, istDate, normaliseName } = require("./common");
const { GST_STATES } = require("./states");

// Inter-state sales to unregistered buyers above this are reported one by one
const B2CL_THRESHOLD = 100000;

const inRange = (value, from, to) => {
  const day = istDate(value);
  return day >= from && day <= to;
};

// Query a day wider than needed, then filter by the Indian calendar date
const around = (from, to) => ({
  $gte: new Date(Date.parse(`${from}T00:00:00Z`) - 86400000),
  $lte: new Date(Date.parse(`${to}T23:59:59Z`) + 86400000),
});

async function loadPeriod(userId, from, to) {
  const range = around(from, to);
  const [invoices, notes, purchases, expenses] = await Promise.all([
    Invoice.find({ user: userId, invoiceDate: range })
      .select("-signatureUrl")
      .populate("buyer", "name gstin state stateCode")
      .sort({ invoiceDate: 1, invoiceNumber: 1 })
      .lean(),
    CreditNote.find({ user: userId, date: range })
      .populate("buyer", "name gstin state stateCode")
      .populate("invoice", "invoiceNumber invoiceDate invoiceType grandTotal")
      .sort({ date: 1 })
      .lean(),
    Purchase.find({ user: userId, purchaseDate: range, status: { $ne: "cancelled" } })
      .populate("seller", "name gstin")
      .sort({ purchaseDate: 1 })
      .lean(),
    Expense.find({ user: userId, date: range }).sort({ date: 1 }).lean(),
  ]);
  return {
    allInvoices: invoices.filter((i) => inRange(i.invoiceDate, from, to)),
    invoices: invoices.filter((i) => inRange(i.invoiceDate, from, to) && i.status !== "cancelled"),
    notes: notes.filter((n) => inRange(n.date, from, to)),
    purchases: purchases.filter((p) => inRange(p.purchaseDate, from, to)),
    expenses: expenses.filter((e) => inRange(e.date, from, to)),
  };
}

const totalsOf = (docs) => ({
  count: docs.length,
  taxable: sum(docs, (d) => d.subTotal),
  discount: sum(docs, (d) => d.discountAmount),
  cgst: sum(docs, (d) => d.totalCgst),
  sgst: sum(docs, (d) => d.totalSgst),
  igst: sum(docs, (d) => d.totalIgst),
  tax: sum(docs, (d) => d.totalTax),
  cess: sum(docs, (d) => d.totalCess),
  total: sum(docs, (d) => d.grandTotal),
});

const { costOf: unitCost } = require("./cost");

// Input tax can only be claimed on a tax invoice from a registered seller
const claimsCredit = (p) => Boolean(p.seller?.gstin) && p.purchaseType !== "bill_of_supply";

async function summaryReport(userId, from, to) {
  const { invoices, notes, purchases, expenses } = await loadPeriod(userId, from, to);
  const items = await Item.find({ user: userId })
    .select("name purchasePrice purchaseTaxMode gstPercent")
    .lean();
  const costById = new Map(items.map((i) => [String(i._id), unitCost(i)]));
  const costByName = new Map(items.map((i) => [normaliseName(i.name), unitCost(i)]));
  const costOf = (l) => costById.get(String(l.item)) || costByName.get(normaliseName(l.name)) || 0;

  const products = new Map();
  let goodsCost = 0;
  let costedSales = 0;
  let allLineSales = 0;
  const addLines = (doc, sign, restocked) => {
    for (const l of doc.items) {
      const key = `${normaliseName(l.name)}|${l.unit}`;
      const row = products.get(key) ||
        { name: l.name, hsn: l.hsn, unit: l.unit, quantity: 0, taxable: 0, total: 0, cost: 0, costKnown: true };
      const cost = costOf(l);
      row.quantity = Math.round((row.quantity + sign * l.quantity) * 1000) / 1000;
      row.taxable = round2(row.taxable + sign * l.taxableAmount);
      row.total = round2(row.total + sign * l.totalAmount);
      allLineSales += sign * l.taxableAmount;
      if (cost > 0) {
        // Goods that did not come back are still a cost
        const used = sign > 0 || restocked ? sign * l.quantity * cost : 0;
        row.cost = round2(row.cost + used);
        goodsCost += used;
        costedSales += sign * l.taxableAmount;
      } else {
        row.costKnown = false;
      }
      products.set(key, row);
    }
  };
  invoices.forEach((i) => addLines(i, 1, false));
  notes.forEach((n) => addLines(n, -1, n.restock));

  const buyers = new Map();
  const buyerRow = (doc) => {
    const key = String(doc.buyer?._id || "unknown");
    if (!buyers.has(key)) {
      buyers.set(key, {
        id: doc.buyer?._id ? key : "", name: doc.buyer?.name || "Unknown buyer",
        gstin: doc.buyer?.gstin || "", invoices: 0, taxable: 0, total: 0, balance: 0,
      });
    }
    return buyers.get(key);
  };
  for (const i of invoices) {
    const row = buyerRow(i);
    row.invoices += 1;
    row.taxable = round2(row.taxable + i.subTotal);
    row.total = round2(row.total + i.grandTotal);
    row.balance = round2(row.balance + i.balanceAmount);
  }
  for (const n of notes) {
    const row = buyerRow(n);
    row.taxable = round2(row.taxable - n.subTotal);
    row.total = round2(row.total - n.grandTotal);
  }

  const sales = totalsOf(invoices);
  const returns = totalsOf(notes);
  const categories = new Map();
  for (const e of expenses) categories.set(e.category, round2((categories.get(e.category) || 0) + e.amount));

  // Profit is measured without GST, except input tax that cannot be claimed back
  const revenue = round2(sales.taxable - sales.discount - (returns.taxable - returns.discount));
  const expenseTotal = sum(expenses, (e) => e.amount - (e.gstAmount || 0));

  const months = new Map();
  const month = (value) => {
    const key = istDate(value).slice(0, 7);
    if (!months.has(key)) months.set(key, { month: key, sales: 0, purchases: 0, expenses: 0 });
    return months.get(key);
  };
  invoices.forEach((i) => { const m = month(i.invoiceDate); m.sales = round2(m.sales + i.grandTotal); });
  notes.forEach((n) => { const m = month(n.date); m.sales = round2(m.sales - n.grandTotal); });
  purchases.forEach((p) => { const m = month(p.purchaseDate); m.purchases = round2(m.purchases + p.grandTotal); });
  expenses.forEach((e) => { const m = month(e.date); m.expenses = round2(m.expenses + e.amount); });

  return {
    sales,
    returns,
    purchases: totalsOf(purchases),
    expenses: {
      total: sum(expenses, (e) => e.amount),
      byCategory: [...categories].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    },
    profit: {
      revenue,
      goodsCost: round2(goodsCost),
      expenses: expenseTotal,
      profit: round2(revenue - goodsCost - expenseTotal),
      // Share of sales for which a purchase price is known
      costCoverage: allLineSales > 0 ? Math.max(0, Math.min(1, costedSales / allLineSales)) : 0,
    },
    months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    buyers: [...buyers.values()].sort((a, b) => b.total - a.total),
    products: [...products.values()].sort((a, b) => b.total - a.total),
  };
}

// Taxable value and tax of a document, grouped by GST rate
function byRate(doc) {
  const rates = new Map();
  for (const l of doc.items) {
    const row = rates.get(l.gstPercent) || { rate: l.gstPercent, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
    row.taxable = round2(row.taxable + l.taxableAmount);
    row.igst = round2(row.igst + (l.igstAmount || 0));
    row.cgst = round2(row.cgst + (l.cgstAmount || 0));
    row.sgst = round2(row.sgst + (l.sgstAmount || 0));
    rates.set(l.gstPercent, row);
  }
  return [...rates.values()].sort((a, b) => a.rate - b.rate);
}

function placeOfSupply(code) {
  return code ? `${code}-${GST_STATES[code] || ""}` : "";
}

function accumulate(map, key, base, row, sign = 1) {
  const target = map.get(key) || { ...base, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
  for (const f of ["taxable", "igst", "cgst", "sgst"]) target[f] = round2(target[f] + sign * row[f]);
  map.set(key, target);
  return target;
}

async function gstReport(user, from, to) {
  const { allInvoices, invoices, notes, purchases, expenses } = await loadPeriod(user._id, from, to);
  const homeState = user.supplierStateCode || "07";
  const codeOf = (buyer) => buyer?.stateCode || homeState;
  const isLarge = (inv) => !inv.buyer?.gstin && inv.taxType === "igst" && inv.grandTotal > B2CL_THRESHOLD;

  const b2b = [];
  const b2cl = [];
  const b2cs = new Map();
  const creditNotes = [];
  const hsn = new Map();
  const outward = { taxable: 0, igst: 0, cgst: 0, sgst: 0 };
  let exempt = 0;

  const addHsn = (doc, sign) => {
    const segment = doc.buyer?.gstin ? "B2B" : "B2C";
    for (const l of doc.items) {
      const key = [segment, l.hsn, l.unit, l.gstPercent].join("|");
      const row = accumulate(hsn, key,
        { segment, hsn: l.hsn || "", unit: l.unit, rate: l.gstPercent, quantity: 0 },
        { taxable: l.taxableAmount, igst: l.igstAmount || 0, cgst: l.cgstAmount || 0, sgst: l.sgstAmount || 0 }, sign);
      row.quantity = Math.round((row.quantity + sign * l.quantity) * 1000) / 1000;
    }
  };

  const addOutward = (doc, sign) => {
    for (const r of byRate(doc)) {
      if (r.rate === 0) exempt = round2(exempt + sign * r.taxable);
      else for (const f of ["taxable", "igst", "cgst", "sgst"]) outward[f] = round2(outward[f] + sign * r[f]);
    }
  };

  for (const inv of invoices) {
    addHsn(inv, 1);
    addOutward(inv, 1);
    if (inv.invoiceType === "bill_of_supply") continue;
    const base = {
      invoiceNumber: inv.invoiceNumber, date: istDate(inv.invoiceDate), value: inv.grandTotal,
      buyer: inv.buyer?.name || "", placeOfSupply: placeOfSupply(codeOf(inv.buyer)),
    };
    for (const r of byRate(inv)) {
      if (r.rate === 0) continue;
      if (inv.buyer?.gstin) b2b.push({ gstin: inv.buyer.gstin, ...base, ...r });
      else if (isLarge(inv)) b2cl.push({ ...base, ...r });
      else accumulate(b2cs, `${codeOf(inv.buyer)}|${r.rate}`,
        { placeOfSupply: base.placeOfSupply, rate: r.rate }, r);
    }
  }

  for (const note of notes) {
    addHsn(note, -1);
    addOutward(note, -1);
    const invoice = note.invoice || {};
    const large = !note.buyer?.gstin && note.taxType === "igst" && invoice.grandTotal > B2CL_THRESHOLD;
    for (const r of byRate(note)) {
      if (r.rate === 0) continue;
      if (note.buyer?.gstin || large) {
        creditNotes.push({
          gstin: note.buyer?.gstin || "", buyer: note.buyer?.name || "", number: note.number,
          date: istDate(note.date), invoiceNumber: invoice.invoiceNumber || "", value: note.grandTotal,
          placeOfSupply: placeOfSupply(codeOf(note.buyer)), ...r,
        });
      } else {
        // Small sales to unregistered buyers are reported net of returns
        accumulate(b2cs, `${codeOf(note.buyer)}|${r.rate}`,
          { placeOfSupply: placeOfSupply(codeOf(note.buyer)), rate: r.rate }, r, -1);
      }
    }
  }

  const eligible = purchases.filter(claimsCredit);
  const itc = {
    taxable: sum(eligible, (p) => p.subTotal),
    igst: sum(eligible, (p) => p.totalIgst),
    cgst: sum(eligible, (p) => p.totalCgst),
    sgst: sum(eligible, (p) => p.totalSgst),
  };
  const outTax = round2(outward.igst + outward.cgst + outward.sgst);
  const inTax = round2(itc.igst + itc.cgst + itc.sgst);

  const numbered = allInvoices.map((i) => i.invoiceNumber);
  return {
    gstr1: {
      b2b,
      b2cl,
      b2cs: [...b2cs.values()],
      creditNotes,
      hsn: [...hsn.values()].sort((a, b) => a.segment.localeCompare(b.segment) || a.hsn.localeCompare(b.hsn)),
      documents: {
        from: numbered[0] || "",
        to: numbered[numbered.length - 1] || "",
        total: numbered.length,
        cancelled: allInvoices.filter((i) => i.status === "cancelled").length,
        creditNotes: notes.length,
      },
    },
    gstr3b: {
      outward,
      exempt,
      cess: round2(sum(invoices, (i) => i.totalCess) - sum(notes, (n) => n.totalCess)),
      itc,
      outputTax: outTax,
      inputTax: inTax,
      payable: round2(Math.max(0, outTax - inTax)),
      carryForward: round2(Math.max(0, inTax - outTax)),
      unclaimed: {
        // Purchases with GST that has no credit because the seller has no GSTIN
        purchaseTax: sum(purchases.filter((p) => !claimsCredit(p)), (p) => p.totalTax),
        // The split between CGST, SGST and IGST is not recorded for expenses
        expenseTax: sum(expenses, (e) => e.gstAmount),
      },
    },
    missing: {
      hsn: invoices.filter((i) => i.items.some((l) => !l.hsn)).map((i) => i.invoiceNumber),
    },
  };
}

async function dayBook(userId, from, to) {
  const range = around(from, to);
  const paidInRange = { "paymentHistory.date": range };
  const [period, receivedOn, paidOn, buyers] = await Promise.all([
    loadPeriod(userId, from, to),
    Invoice.find({ user: userId, status: { $ne: "cancelled" }, ...paidInRange })
      .select("invoiceNumber paymentHistory buyer").populate("buyer", "name").lean(),
    Purchase.find({ user: userId, status: { $ne: "cancelled" }, ...paidInRange })
      .select("purchaseNumber paymentHistory seller").populate("seller", "name").lean(),
    Buyer.find({ user: userId, "openingPayments.date": range }).select("name openingPayments").lean(),
  ]);

  const rows = [];
  const add = (date, type, ref, party, extra) =>
    rows.push({ date: istDate(date), type, ref, party, mode: "", amount: 0, moneyIn: 0, moneyOut: 0, ...extra });

  period.invoices.forEach((i) => add(i.invoiceDate, "Sale", i.invoiceNumber, i.buyer?.name, { amount: i.grandTotal }));
  period.notes.forEach((n) => add(n.date, "Credit note", n.number, n.buyer?.name, { amount: n.grandTotal }));
  period.purchases.forEach((p) => add(p.purchaseDate, "Purchase", p.purchaseNumber, p.seller?.name, { amount: p.grandTotal }));
  period.expenses.forEach((e) =>
    add(e.date, "Expense", e.category, e.payee, { amount: e.amount, moneyOut: e.amount, mode: e.mode }));

  const payments = (list, fn) => list.filter((p) => inRange(p.date, from, to)).forEach(fn);
  receivedOn.forEach((i) => payments(i.paymentHistory, (p) =>
    add(p.date, "Receipt", i.invoiceNumber, i.buyer?.name, { amount: p.amount, moneyIn: p.amount, mode: p.mode })));
  buyers.forEach((b) => payments(b.openingPayments, (p) =>
    add(p.date, "Receipt", "Opening balance", b.name, { amount: p.amount, moneyIn: p.amount, mode: p.mode })));
  paidOn.forEach((x) => payments(x.paymentHistory, (p) =>
    add(p.date, "Payment", x.purchaseNumber, x.seller?.name, { amount: p.amount, moneyOut: p.amount, mode: p.mode })));

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));

  const modes = new Map();
  for (const r of rows) {
    if (!r.mode) continue;
    const m = modes.get(r.mode) || { mode: r.mode, moneyIn: 0, moneyOut: 0 };
    m.moneyIn = round2(m.moneyIn + r.moneyIn);
    m.moneyOut = round2(m.moneyOut + r.moneyOut);
    modes.set(r.mode, m);
  }
  return {
    rows,
    moneyIn: sum(rows, (r) => r.moneyIn),
    moneyOut: sum(rows, (r) => r.moneyOut),
    modes: [...modes.values()],
  };
}

module.exports = { summaryReport, gstReport, dayBook, claimsCredit };
