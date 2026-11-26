// Invoice numbering.
// With a prefix:    SBP2026-27/774   (restarts each Indian financial year)
// Without a prefix: INV-2026-0001
const Invoice = require("../models/Invoice");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// April to March, e.g. 3 Nov 2026 -> "2026-27"
function financialYear(date) {
  const d = new Date(date);
  const start = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

async function highestSequence(userId, head) {
  const docs = await Invoice.find({
    user: userId,
    invoiceNumber: { $regex: `^${escapeRegex(head)}\\d+$` },
  })
    .select("invoiceNumber")
    .lean();

  return docs.reduce((max, d) => Math.max(max, Number(d.invoiceNumber.slice(head.length))), 0);
}

async function nextInvoiceNumber(user, invoiceDate = new Date()) {
  const prefix = user.invoicePrefix || "";

  if (!prefix) {
    const head = `INV-${new Date(invoiceDate).getUTCFullYear()}-`;
    const last = await highestSequence(user._id, head);
    return `${head}${String(last + 1).padStart(4, "0")}`;
  }

  const head = `${prefix}${financialYear(invoiceDate)}/`;
  const last = await highestSequence(user._id, head);
  if (last) return `${head}${last + 1}`;

  // The starting number applies only to the first series under this prefix, so a
  // business moving from other software can continue where it left off.
  const usedBefore = await Invoice.exists({
    user: user._id,
    invoiceNumber: { $regex: `^${escapeRegex(prefix)}\\d{4}-\\d{2}/` },
  });
  return `${head}${usedBefore ? 1 : user.invoiceStartNumber || 1}`;
}

// Next number in a simple series such as QT-2026-27/4
async function nextInSeries(Model, userId, field, head) {
  const docs = await Model.find({
    user: userId,
    [field]: { $regex: `^${escapeRegex(head)}[0-9]+$` },
  })
    .select(field)
    .lean();
  const last = docs.reduce((max, d) => Math.max(max, Number(d[field].slice(head.length))), 0);
  return `${head}${last + 1}`;
}

module.exports = { nextInvoiceNumber, nextInSeries, financialYear, escapeRegex };
