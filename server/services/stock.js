// Stock is derived from records rather than kept as a running counter, so editing,
// cancelling or deleting a bill can never leave the count wrong:
//   opening + purchases - sales + returns +/- adjustments
// Each transaction counts only if dated on or after the product's start date.
const Item = require("../models/Item");
const Invoice = require("../models/Invoice");
const Purchase = require("../models/Purchase");
const CreditNote = require("../models/CreditNote");
const StockAdjustment = require("../models/StockAdjustment");
const { round2, istDate, normaliseName } = require("./common");

const round3 = (n) => Math.round(n * 1000) / 1000;

async function stockMovements(userId, items) {
  const byId = new Map(items.map((i) => [String(i._id), i]));
  const byName = new Map(items.map((i) => [normaliseName(i.name), i]));
  const moves = new Map(items.map((i) => [String(i._id), []]));
  if (!items.length) return moves;

  const since = new Date(Math.min(...items.map((i) => new Date(i.stockSince || 0).getTime())) - 86400000);
  const [invoices, purchases, notes, adjustments] = await Promise.all([
    Invoice.find({ user: userId, status: { $ne: "cancelled" }, invoiceDate: { $gte: since } })
      .select("invoiceNumber invoiceDate items.item items.name items.quantity")
      .lean(),
    Purchase.find({ user: userId, status: { $ne: "cancelled" }, purchaseDate: { $gte: since } })
      .select("purchaseNumber purchaseDate items.name items.quantity")
      .lean(),
    CreditNote.find({ user: userId, restock: true, date: { $gte: since } })
      .select("number date items.item items.name items.quantity")
      .lean(),
    StockAdjustment.find({ user: userId, date: { $gte: since } }).lean(),
  ]);

  const add = (item, date, type, ref, quantity) => {
    if (!item) return;
    const day = istDate(date);
    if (item.stockSince && day < istDate(item.stockSince)) return;
    moves.get(String(item._id)).push({ date: day, type, ref, quantity: round3(quantity) });
  };
  // Lines picked from the catalogue carry the product id; typed lines match by name
  const match = (line) => byId.get(String(line.item)) || byName.get(normaliseName(line.name));

  for (const p of purchases) {
    for (const l of p.items) add(match(l), p.purchaseDate, "Purchase", p.purchaseNumber, l.quantity);
  }
  for (const i of invoices) {
    for (const l of i.items) add(match(l), i.invoiceDate, "Sale", i.invoiceNumber, -l.quantity);
  }
  for (const n of notes) {
    for (const l of n.items) add(match(l), n.date, "Return", n.number, l.quantity);
  }
  for (const a of adjustments) {
    add(byId.get(String(a.item)), a.date, "Adjustment", a.reason || "Manual change", a.quantity);
  }
  return moves;
}

async function computeStock(userId) {
  const items = await Item.find({ user: userId, trackStock: true }).sort({ name: 1 }).lean();
  const moves = await stockMovements(userId, items);
  const recent = istDate(Date.now() - 30 * 86400000);

  return items.map((item) => {
    const list = moves.get(String(item._id));
    const total = (type) => round3(list.filter((m) => m.type === type).reduce((s, m) => s + m.quantity, 0));
    const stock = round3((item.openingStock || 0) + list.reduce((s, m) => s + m.quantity, 0));
    const cost = item.purchasePrice || 0;
    return {
      id: String(item._id),
      name: item.name,
      hsn: item.hsn,
      unit: item.unit,
      opening: item.openingStock || 0,
      since: item.stockSince ? istDate(item.stockSince) : "",
      purchased: total("Purchase"),
      sold: -total("Sale"),
      returned: total("Return"),
      adjusted: total("Adjustment"),
      stock,
      lowStockAt: item.lowStockAt || 0,
      low: stock <= (item.lowStockAt || 0),
      soldRecently: -round3(list.filter((m) => m.type === "Sale" && m.date >= recent).reduce((s, m) => s + m.quantity, 0)),
      cost,
      value: round2(Math.max(0, stock) * cost),
    };
  });
}

async function stockHistory(userId, item) {
  const list = (await stockMovements(userId, [item])).get(String(item._id));
  list.sort((a, b) => a.date.localeCompare(b.date));
  let balance = item.openingStock || 0;
  return list.map((m) => ({ ...m, balance: (balance = round3(balance + m.quantity)) }));
}

module.exports = { computeStock, stockHistory };
