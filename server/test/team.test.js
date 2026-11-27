const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start } = require("./helpers");
const { allows } = require("../services/permissions");

let app;
let s;
let staff;
let accountant;
let invoice;

const ID = "0123456789abcdef01234567";

before(async () => {
  app = await start();
  s = await app.shop();
  invoice = await s.bill(5);
  staff = await join("staff");
  accountant = await join("accountant");
});
after(() => app.stop());

async function join(role) {
  const email = `${role}@example.com`;
  const made = await app.call("POST", "/team", {
    token: s.token, body: { name: role, email, password: "password123", role },
  });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  const signed = await app.call("POST", "/auth/login", { body: { email, password: "password123" } });
  return { token: signed.data.token, id: made.data.member.id, email, role: signed.data.user.role };
}

const status = async (who, method, path, body) => (await app.call(method, path, { token: who.token, body })).status;

test("a route nobody listed stays private to the owner", () => {
  assert.equal(allows("owner", "DELETE", "/api/anything-new"), true);
  for (const role of ["staff", "unknown"]) assert.equal(allows(role, "GET", "/api/anything-new"), false);
  assert.equal(allows("accountant", "POST", "/api/anything-new"), false);
  // Different spelling of the same address gets the same answer
  assert.equal(allows("staff", "GET", "/API/Reports/summary/"), false);
  assert.equal(allows("accountant", "GET", "/api/Team"), false);
  assert.equal(allows("staff", "DELETE", `/api/invoices/${ID}`), false);
});

test("plans without team logins cannot add them", async () => {
  const free = await app.register();
  const res = await app.call("POST", "/team", {
    token: free.token, body: { name: "A", email: "a@example.com", password: "password123", role: "staff" },
  });
  assert.equal(res.status, 403);
});

test("staff work inside the owner's business", async () => {
  assert.equal(staff.role, "staff");
  const list = await app.call("GET", "/invoices", { token: staff.token });
  assert.equal(list.data.invoices.length >= 1, true);
  const made = await s.bill(1, staff.token);
  const owners = await app.call("GET", `/invoices/${made._id}`, { token: s.token });
  assert.equal(owners.status, 200);
});

test("staff can bill and take money", async () => {
  assert.equal(await status(staff, "POST", `/invoices/${invoice._id}/payment`, { amount: 10 }), 200);
  assert.equal(await status(staff, "POST", "/buyers", { name: "New Buyer", state: "Delhi" }), 201);
  assert.equal(await status(staff, "GET", `/ledger/buyer/${s.buyer._id}`), 200);
});

test("staff cannot put another bank account on a bill", async () => {
  await app.call("PUT", "/auth/supplier-info", { token: s.token, body: { name: "Real Business", stateCode: "07" } });
  const made = await app.call("POST", "/invoices", {
    token: staff.token,
    body: {
      buyerId: s.buyer._id, items: [s.line(1)], supplierName: "Someone Else", signatureUrl: "data:x",
      bankDetailsOverride: { bankName: "X", bankAccount: "999", bankIfsc: "X", bankBranch: "", bankHolderName: "Me" },
    },
  });
  assert.equal(made.status, 201);
  assert.equal(made.data.invoice.supplierName, "Real Business");
  assert.equal(made.data.invoice.bankDetailsOverride.bankAccount, "");
  assert.equal(made.data.invoice.signatureUrl, "");
});

test("screens are told what each login can do", async () => {
  const me = async (token) => (await app.call("GET", "/auth/me", { token })).data.user.can;
  const [owner, worker, books] = await Promise.all([me(s.token), me(staff.token), me(accountant.token)]);
  assert.equal(Object.values(owner).every(Boolean), true);
  assert.equal(worker.createInvoice && worker.recordPayment, true);
  assert.equal(worker.editInvoice || worker.reports || worker.settings || worker.team, false);
  assert.equal(books.reports && books.export, true);
  assert.equal(books.createInvoice || books.recordPayment || books.editExpenses, false);
});

test("staff cannot change history or see the books", async () => {
  const refused = [
    ["PUT", `/invoices/${invoice._id}`, {}],
    ["PUT", `/invoices/${invoice._id}/status`, { status: "cancelled" }],
    ["PUT", `/items/${s.item._id}`, { price: 1 }],
    ["DELETE", `/buyers/${s.buyer._id}`],
    ["POST", "/credit-notes", { invoiceId: invoice._id }],
    ["GET", "/reports/summary"],
    ["GET", "/expenses"],
    ["GET", "/purchases"],
    ["GET", "/sellers"],
    ["GET", "/stock"],
    ["GET", "/data/export"],
    ["PUT", "/auth/supplier-info", { bankAccount: "1" }],
    ["GET", "/team"],
    ["POST", "/team", {}],
    ["GET", "/activity"],
    ["POST", "/subscriptions/create-order", {}],
  ];
  for (const [method, path, body] of refused) {
    assert.equal(await status(staff, method, path, body), 403, `${method} ${path}`);
  }
});

test("staff never receive cost or profit figures", async () => {
  const items = await app.call("GET", "/items", { token: staff.token });
  assert.equal("purchasePrice" in items.data.items[0], false);
  const owners = await app.call("GET", "/items", { token: s.token });
  assert.equal(owners.data.items[0].purchasePrice, 300);

  const { insights } = (await app.call("GET", "/insights", { token: staff.token })).data;
  assert.equal(insights.payables, undefined);
  assert.equal(insights.thisMonth.netTax, undefined);
  assert.equal(insights.trend.some((m) => "purchases" in m || "expenses" in m), false);
});

test("the assistant follows the same limits", async () => {
  const ask = async (text) =>
    String((await app.call("POST", "/assistant/chat", {
      token: staff.token, body: { messages: [{ role: "user", content: text }] },
    })).data);
  assert.match(await ask("profit this year"), /does not have access/);
  assert.match(await ask("What is my current stock value?"), /does not have access/);
  assert.match(await ask("Who owes me money?"), /to collect/);
});

test("an accountant can read everything and change nothing", async () => {
  for (const path of ["/reports/summary?from=2026-04-01&to=2027-03-31", "/expenses", "/purchases", "/data/export", "/invoices"]) {
    assert.equal(await status(accountant, "GET", path), 200, path);
  }
  assert.equal(await status(accountant, "POST", "/invoices", {}), 403);
  assert.equal(await status(accountant, "POST", `/invoices/${invoice._id}/payment`, { amount: 1 }), 403);
  assert.equal(await status(accountant, "POST", "/assistant/confirm", { draftId: "x" }), 403);
  assert.equal(await status(accountant, "GET", "/team"), 403);
});

test("a backup never contains password data", async () => {
  const backup = await app.call("GET", "/data/export", { token: accountant.token });
  assert.doesNotMatch(JSON.stringify(backup.data), /password|resetToken/i);
});

test("one business cannot manage another's team or records", async () => {
  const other = await app.register();
  await app.givePlan(other.id, "pro");
  assert.equal(await status(other, "PUT", `/team/${staff.id}`, { disabled: true }), 404);
  assert.equal(await status(other, "DELETE", `/team/${staff.id}`), 404);
  assert.equal(await status(other, "GET", `/invoices/${invoice._id}`), 404);
});

test("the owner sees who did what", async () => {
  await new Promise((r) => setTimeout(r, 200)); // entries are written after each reply
  const { entries } = (await app.call("GET", "/activity", { token: s.token })).data;
  const byStaff = entries.filter((e) => e.actorName === "staff").map((e) => e.action);
  assert.ok(byStaff.includes("Created an invoice"));
  assert.ok(byStaff.includes("Recorded a payment"));
  assert.equal(entries.some((e) => /password123/.test(JSON.stringify(e))), false);
});

test("refused requests are not logged as changes", async () => {
  const { entries } = (await app.call("GET", "/activity", { token: s.token })).data;
  assert.equal(entries.some((e) => e.action === "Edited an invoice" && e.actorName === "staff"), false);
});

test("pausing, role changes and plan lapses take effect at once", async () => {
  await app.call("PUT", `/team/${accountant.id}`, { token: s.token, body: { role: "staff" } });
  assert.equal(await status(accountant, "GET", "/expenses"), 403);

  await app.call("PUT", `/team/${accountant.id}`, { token: s.token, body: { disabled: true } });
  assert.equal(await status(accountant, "GET", "/invoices"), 401);

  await app.givePlan(s.owner.id, "starter");
  assert.equal(await status(staff, "GET", "/invoices"), 403);
  await app.givePlan(s.owner.id, "pro");
  assert.equal(await status(staff, "GET", "/invoices"), 200);

  await app.call("DELETE", `/team/${staff.id}`, { token: s.token });
  assert.equal(await status(staff, "GET", "/invoices"), 401);
});
