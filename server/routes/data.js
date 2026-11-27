// Backup download, CSV import (parsed in the browser) and global search.
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Buyer = require("../models/Buyer");
const Seller = require("../models/Seller");
const Item = require("../models/Item");
const Invoice = require("../models/Invoice");
const Quotation = require("../models/Quotation");
const CreditNote = require("../models/CreditNote");
const Purchase = require("../models/Purchase");
const Expense = require("../models/Expense");
const StockAdjustment = require("../models/StockAdjustment");
const { protect } = require("../middleware/auth");
const { getUserPlan } = require("../middleware/checkPlan");
const { escapeRegex } = require("../services/invoiceNumber");
const { stateCodeFor, GST_STATES } = require("../services/states");
const UNITS = require("../services/units");
const { GST_RATES } = require("../services/gst");
const { route, BadRequest, normaliseName, istDate } = require("../services/common");

router.use(protect);

// ─── Backup: everything this account owns ────────────────────────────────────
router.get("/export", route(async (req, res) => {
  const owned = { user: req.user._id };
  const sets = {
    buyers: Buyer, sellers: Seller, products: Item, invoices: Invoice, quotations: Quotation,
    creditNotes: CreditNote, purchases: Purchase, expenses: Expense, stockAdjustments: StockAdjustment,
  };
  const profile = await User.findById(req.user._id)
    .select("-password -passwordChangedAt -subscription -resetTokenHash -resetTokenExpires -__v")
    .lean();
  const backup = { exportedAt: new Date().toISOString(), profile };
  for (const [key, Model] of Object.entries(sets)) {
    backup[key] = await Model.find(owned).lean();
  }
  res.setHeader("Content-Disposition", `attachment; filename="backup-${istDate(Date.now())}.json"`);
  res.json(backup);
}));

// ─── Import ──────────────────────────────────────────────────────────────────
const text = (v) => String(v ?? "").trim();
const number = (v) => Number(String(v ?? "").replace(/[₹,%\s]/g, "") || 0);

const IMPORTERS = {
  buyers: {
    Model: Buyer,
    limit: "buyers",
    toRecord(row) {
      const gstin = text(row.gstin).toUpperCase();
      const state = text(row.state) || GST_STATES[gstin.slice(0, 2)] || "";
      const openingBalance = number(row.openingbalance);
      if (!(openingBalance >= 0)) throw new Error("Opening balance must be 0 or more");
      return {
        name: text(row.name), gstin, state, stateCode: gstin.slice(0, 2) || stateCodeFor(state),
        address: text(row.address), city: text(row.city), pincode: text(row.pincode),
        mobile: text(row.mobile || row.phone), email: text(row.email), openingBalance,
        creditLimit: number(row.creditlimit) || 0,
      };
    },
  },
  items: {
    Model: Item,
    limit: "items",
    toRecord(row) {
      const unit = text(row.unit).toLowerCase() || "pcs";
      const gstPercent = text(row.gst || row.gstpercent) ? number(row.gst || row.gstpercent) : 18;
      if (!UNITS.includes(unit)) throw new Error(`Unknown unit "${unit}"`);
      if (!GST_RATES.includes(gstPercent)) throw new Error(`Unsupported GST rate ${gstPercent}`);
      const price = number(row.price || row.sellingprice);
      if (!(price >= 0)) throw new Error("Price must be a number");
      const stock = text(row.openingstock);
      return {
        name: text(row.name), hsn: text(row.hsn), unit, price, gstPercent,
        purchasePrice: number(row.purchaseprice) || 0,
        description: text(row.description),
        ...(stock !== "" && {
          trackStock: true,
          openingStock: number(stock),
          stockSince: new Date(istDate(Date.now())),
          lowStockAt: number(row.lowstockat) || 0,
        }),
      };
    },
  },
};

// body: { rows: [{ name: "…", … }] } with lower-case keys
router.post("/import/:type", route(async (req, res) => {
  const importer = IMPORTERS[req.params.type];
  if (!importer) throw new BadRequest("Unknown import type", 404);
  const rows = req.body.rows;
  if (!Array.isArray(rows) || !rows.length) throw new BadRequest("The file has no rows");
  if (rows.length > 2000) throw new BadRequest("Import up to 2,000 rows at a time");

  const { Model, limit, toRecord } = importer;
  const [{ plan }, existing] = await Promise.all([
    getUserPlan(req.user._id),
    Model.find({ user: req.user._id }).select("name").lean(),
  ]);
  const names = new Set(existing.map((d) => normaliseName(d.name)));
  const allowed = plan.limits[limit] === -1 ? Infinity : Math.max(0, plan.limits[limit] - existing.length);

  let created = 0;
  const skipped = [];
  for (const [index, row] of rows.entries()) {
    const line = index + 2; // row 1 of the file holds the headings
    const skip = (reason) => skipped.push({ line, name: text(row?.name), reason });
    const key = normaliseName(row?.name);
    if (!key) { skip("No name"); continue; }
    if (names.has(key)) { skip("Already exists"); continue; }
    if (created >= allowed) { skip(`Your ${plan.displayName} plan limit is reached`); continue; }
    try {
      await Model.create({ ...toRecord(row), user: req.user._id });
      names.add(key);
      created += 1;
    } catch (err) {
      skip(err.errors ? Object.values(err.errors).map((e) => e.message).join(", ") : err.message);
    }
  }
  res.json({ success: true, created, skipped });
}));

// ─── Search across the account ───────────────────────────────────────────────
router.get("/search", route(async (req, res) => {
  const q = text(req.query.q);
  if (q.length < 2) return res.json({ success: true, results: [] });
  const pattern = { $regex: escapeRegex(q), $options: "i" };
  const user = req.user._id;

  const buyers = await Buyer.find({ user, $or: [{ name: pattern }, { gstin: pattern }, { mobile: pattern }] })
    .limit(6).lean();
  const buyerIds = buyers.map((b) => b._id);
  const [invoices, quotations, items, sellers] = await Promise.all([
    Invoice.find({ user, $or: [{ invoiceNumber: pattern }, { buyer: { $in: buyerIds } }] })
      .select("invoiceNumber grandTotal status buyer").populate("buyer", "name").sort({ createdAt: -1 }).limit(6).lean(),
    Quotation.find({ user, invoiceNumber: pattern }).select("invoiceNumber grandTotal buyer")
      .populate("buyer", "name").limit(4).lean(),
    Item.find({ user, $or: [{ name: pattern }, { hsn: pattern }] }).limit(6).lean(),
    // Billing staff do not see sellers
    req.role === "staff" ? [] : Seller.find({ user, $or: [{ name: pattern }, { gstin: pattern }] }).limit(4).lean(),
  ]);

  const rupees = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
  res.json({
    success: true,
    results: [
      ...invoices.map((i) => ({ type: "Invoice", title: i.invoiceNumber, detail: `${i.buyer?.name || ""} · ${rupees(i.grandTotal)} · ${i.status}`, to: `/invoices/${i._id}` })),
      ...buyers.map((b) => ({ type: "Buyer", title: b.name, detail: [b.gstin, b.mobile].filter(Boolean).join(" · "), to: `/buyers/${b._id}` })),
      ...items.map((i) => ({ type: "Product", title: i.name, detail: `${rupees(i.price)} · HSN ${i.hsn || "—"}`, to: `/items?search=${encodeURIComponent(i.name)}` })),
      ...quotations.map((x) => ({ type: "Quotation", title: x.invoiceNumber, detail: `${x.buyer?.name || ""} · ${rupees(x.grandTotal)}`, to: `/quotations?search=${encodeURIComponent(x.invoiceNumber)}` })),
      ...sellers.map((s) => ({ type: "Seller", title: s.name, detail: s.gstin || "", to: `/sellers/${s._id}` })),
    ],
  });
}));

module.exports = router;
