// Drafts the assistant has prepared, and saving them once the user confirms.
// The browser only ever sends back a draft id, so the saved record is exactly
// what was shown, and each draft can be used once.
const crypto = require("crypto");
const Buyer = require("../models/Buyer");
const Item = require("../models/Item");
const Invoice = require("../models/Invoice");
const Quotation = require("../models/Quotation");
const Expense = require("../models/Expense");
const { nextInvoiceNumber, nextInSeries, financialYear } = require("./invoiceNumber");
const { buildDocument, createNumbered } = require("./documents");
const { receiveFromBuyer } = require("./ledger");
const { stateCodeFor } = require("./states");
const { istDate, BadRequest } = require("./common");

const TTL = 30 * 60 * 1000;
const drafts = new Map(); // held in memory: cleared when the server restarts

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function saveDraft(user, payload) {
  const now = Date.now();
  for (const [id, d] of drafts) if (d.expires < now) drafts.delete(id);
  const id = crypto.randomBytes(12).toString("hex");
  drafts.set(id, { ...payload, userId: String(user._id), expires: now + TTL });
  return id;
}

function getDraft(user, id) {
  const draft = drafts.get(String(id));
  if (!draft || draft.userId !== String(user._id) || draft.expires < Date.now()) {
    throw new BadRequest("That draft has expired. Ask me again.", 404);
  }
  return draft;
}

const done = (title, rows, links = []) => ({ kind: "done", title, rows, links });

const savers = {
  async invoice(req, draft) {
    return saveBill(req, draft, false);
  },
  async quotation(req, draft) {
    return saveBill(req, draft, true);
  },
  async payment(req, draft) {
    const buyer = await Buyer.findOne({ _id: draft.buyerId, user: req.user._id });
    if (!buyer) throw new BadRequest("That buyer no longer exists", 404);
    const allocations = await receiveFromBuyer(req.user._id, buyer, draft);
    return done(`${rupees(draft.amount)} recorded`,
      allocations.map((a) => ({ label: a.ref, value: rupees(a.amount) })),
      [{ to: `/buyers/${buyer._id}`, label: "Open statement" }]);
  },
  async expense(req, draft) {
    const { amount, category, mode, note } = draft;
    await Expense.create({ user: req.user._id, amount, category, mode, note, date: new Date(istDate(Date.now())) });
    return done("Expense saved", [{ label: category, value: rupees(amount) }], [{ to: "/expenses", label: "Open expenses" }]);
  },
  async buyer(req, draft) {
    const { name, mobile, gstin, state } = draft;
    const buyer = await Buyer.create({
      user: req.user._id, name, mobile, gstin, state,
      stateCode: gstin.slice(0, 2) || stateCodeFor(state),
    });
    return done(`${buyer.name} added`, [], [
      { to: `/invoices/create?buyer=${buyer._id}`, label: "Bill this buyer" },
      { to: `/buyers/${buyer._id}`, label: "Open account" },
    ]);
  },
  async product(req, draft) {
    const { name, price, gstPercent, unit, hsn } = draft;
    await Item.create({ user: req.user._id, name, price, gstPercent, unit, hsn });
    return done(`${name} added`, [], [{ to: `/items?search=${encodeURIComponent(name)}`, label: "Open product" }]);
  },
};

async function saveBill(req, draft, isQuote) {
  let buyerId = draft.buyerId;
  if (!buyerId) {
    const buyer = await Buyer.create({ user: req.user._id, name: draft.newBuyer });
    buyerId = String(buyer._id);
    draft.buyerId = buyerId; // a retry must not add the buyer twice
  }
  const fields = await buildDocument(req.user, {
    buyerId,
    items: draft.items,
    taxMode: draft.taxMode,
    invoiceDate: istDate(Date.now()),
  });
  const Model = isQuote ? Quotation : Invoice;
  const head = `QT-${financialYear(fields.invoiceDate)}/`;
  const record = await createNumbered(
    Model,
    {
      ...fields,
      status: isQuote ? "open" : "unpaid",
      paidAmount: 0,
      balanceAmount: isQuote ? 0 : fields.grandTotal,
    },
    "invoiceNumber",
    () =>
      isQuote
        ? nextInSeries(Quotation, req.user._id, "invoiceNumber", head)
        : nextInvoiceNumber(req.user, fields.invoiceDate),
  );
  if (!isQuote && req.sub) {
    req.sub.usage.invoicesThisMonth += 1;
    await req.sub.save();
  }
  const buyer = await Buyer.findById(buyerId);
  return {
    ...done(`${record.invoiceNumber} created`, [
      { label: "Party", value: buyer.name },
      { label: "Total", value: rupees(record.grandTotal) },
    ], isQuote
      ? [{ to: `/quotations?search=${encodeURIComponent(record.invoiceNumber)}`, label: "Open quotation" }]
      : [{ to: `/invoices/${record._id}`, label: "View invoice" }]),
    ...(isQuote ? { quotationId: String(record._id) } : { invoiceId: String(record._id) }),
  };
}

// Removes the draft first so that two quick clicks cannot save it twice
async function confirmDraft(req, id) {
  const draft = getDraft(req.user, id);
  drafts.delete(String(id));
  try {
    return await savers[draft.type](req, draft);
  } catch (err) {
    drafts.set(String(id), draft);
    throw err;
  }
}

module.exports = { saveDraft, getDraft, confirmDraft };
