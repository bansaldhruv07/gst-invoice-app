// Records successful changes (and backup downloads) in the activity log.
const Activity = require("../models/Activity");

const ID = "[a-f0-9]{24}";
const entry = (method, pattern, action, label = () => "") => ({
  method, pattern: new RegExp(`^/api/${pattern}$`, "i"), action, label,
});

const invoiceNo = (b) => b.invoice?.invoiceNumber;
const quoteNo = (b) => b.quotation?.invoiceNumber;
const nameOf = (key) => (b) => b[key]?.name;
const purchaseNo = (b) => b.purchase?.purchaseNumber;

const ENTRIES = [
  entry("POST", "invoices", "Created an invoice", invoiceNo),
  entry("PUT", `invoices/${ID}`, "Edited an invoice", invoiceNo),
  entry("PUT", `invoices/${ID}/status`, "Changed an invoice's status",
    (b) => `${b.invoice?.invoiceNumber} → ${b.invoice?.status}`),
  entry("POST", `invoices/${ID}/payment`, "Recorded a payment", invoiceNo),
  entry("PUT", `invoices/${ID}/compliance`, "Saved e-invoice or e-way bill details", invoiceNo),
  entry("PUT", `invoices/${ID}/signature`, "Changed the signature", invoiceNo),
  entry("DELETE", `invoices/${ID}`, "Deleted an invoice", (b) => b.invoiceNumber),
  entry("POST", "quotations", "Created a quotation", quoteNo),
  entry("PUT", `quotations/${ID}`, "Edited a quotation", quoteNo),
  entry("PUT", `quotations/${ID}/status`, "Changed a quotation's status", quoteNo),
  entry("POST", `quotations/${ID}/convert`, "Turned a quotation into an invoice", invoiceNo),
  entry("DELETE", `quotations/${ID}`, "Deleted a quotation"),
  entry("POST", "credit-notes", "Created a credit note", (b) => b.creditNote?.number),
  entry("DELETE", `credit-notes/${ID}`, "Deleted a credit note"),
  entry("POST", "buyers", "Added a buyer", nameOf("buyer")),
  entry("PUT", `buyers/${ID}`, "Edited a buyer", nameOf("buyer")),
  entry("DELETE", `buyers/${ID}`, "Deleted a buyer"),
  entry("POST", "sellers", "Added a seller", nameOf("seller")),
  entry("PUT", `sellers/${ID}`, "Edited a seller", nameOf("seller")),
  entry("DELETE", `sellers/${ID}`, "Deleted a seller"),
  entry("POST", "items", "Added a product", nameOf("item")),
  entry("PUT", `items/${ID}`, "Edited a product", nameOf("item")),
  entry("DELETE", `items/${ID}`, "Deleted a product"),
  entry("POST", "purchases", "Recorded a purchase", purchaseNo),
  entry("PUT", `purchases/${ID}/status`, "Changed a purchase's status", purchaseNo),
  entry("POST", `purchases/${ID}/payment`, "Paid a seller", purchaseNo),
  entry("DELETE", `purchases/${ID}`, "Deleted a purchase"),
  entry("POST", "expenses", "Added an expense", (b) => b.expense?.category),
  entry("PUT", `expenses/${ID}`, "Edited an expense", (b) => b.expense?.category),
  entry("DELETE", `expenses/${ID}`, "Deleted an expense"),
  entry("POST", "stock/adjust", "Adjusted stock"),
  entry("POST", `ledger/buyer/${ID}/receive`, "Received money from a buyer",
    (b) => b.allocations?.map((a) => a.ref).join(", ")),
  entry("POST", "data/import/(buyers|items)", "Imported records", (b) => `${b.created} added`),
  entry("GET", "data/export", "Downloaded a full backup"),
  entry("PUT", "auth/password", "Changed their password"),
  entry("PUT", "auth/supplier-info", "Changed business details"),
  entry("POST", "assistant/confirm", "Saved a draft from the assistant", (b) => b.card?.title),
  entry("POST", "team", "Added a team login", nameOf("member")),
  entry("PUT", `team/${ID}`, "Changed a team login", nameOf("member")),
  entry("DELETE", `team/${ID}`, "Removed a team login", nameOf("member")),
  entry("POST", "subscriptions/verify-payment", "Paid for a plan"),
  entry("POST", "subscriptions/cancel", "Cancelled the plan"),
];

// The record a change was made to, so each invoice can show its own history
const targetOf = (body, path) =>
  body.invoice?._id || body.quotation?._id || body.creditNote?.invoice || path.match(/[a-f0-9]{24}/i)?.[0] || null;

// Called by the sign-in check for each request
function watch(req, res, path) {
  const found = ENTRIES.find((e) => e.method === req.method && e.pattern.test(path));
  if (!found) return;

  let body = {};
  const json = res.json.bind(res);
  res.json = (payload) => {
    body = payload || {};
    return json(payload);
  };
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    Activity.create({
      user: req.user._id,
      actor: req.actor._id,
      actorName: req.actor.name,
      role: req.role,
      action: found.action,
      label: String(found.label(body) || "").slice(0, 200),
      target: targetOf(body, path),
    }).catch((err) => console.error("Activity log:", err.message));
  });
}

module.exports = { watch };
