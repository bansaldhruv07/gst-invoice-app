// GST, numbering, returns, stock and the assistant's drafts.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { start } = require("./helpers");

let app;
let s;
before(async () => {
  app = await start();
  s = await app.shop();
});
after(() => app.stop());

const create = (body, token = s.token) =>
  app.call("POST", "/invoices", { token, body: { buyerId: s.buyer._id, ...body } });

test("tax splits into CGST and SGST in the same state, IGST outside it", async () => {
  const local = (await create({ items: [s.line(10)] })).data.invoice;
  assert.equal(local.taxType, "cgst_sgst");
  assert.equal(local.items[0].cgstAmount, 360);
  assert.equal(local.items[0].sgstAmount, 360);
  assert.equal(local.grandTotal, 4720);

  const far = (await app.call("POST", "/buyers", { token: s.token, body: { name: "Far", state: "Haryana" } })).data.buyer;
  const outside = (await create({ buyerId: far._id, items: [s.line(10)] })).data.invoice;
  assert.equal(outside.taxType, "igst");
  assert.equal(outside.items[0].igstAmount, 720);
});

test("tax-inclusive prices and bills of supply", async () => {
  const inclusive = (await create({ taxMode: "inclusive", items: [s.line(1, { rate: 118 })] })).data.invoice;
  assert.equal(inclusive.grandTotal, 118);
  assert.equal(inclusive.totalTax, 18);
  const supply = (await create({ invoiceType: "bill_of_supply", items: [s.line(1)] })).data.invoice;
  assert.equal(supply.totalTax, 0);
  assert.equal(supply.grandTotal, 400);
});

test("rejects impossible lines", async () => {
  assert.equal((await create({ items: [s.line(0)] })).status, 400);
  assert.equal((await create({ items: [] })).status, 400);
  assert.equal((await create({ items: [s.line(1)], discountValue: 999999 })).status, 400);
});

test("stock follows sales, returns and cancellations", async () => {
  const shop = await app.shop();
  const stock = async () =>
    (await app.call("GET", "/stock", { token: shop.token })).data.stock[0].stock;
  const invoice = await shop.bill(30);
  assert.equal(await stock(), 70);
  await app.call("POST", "/credit-notes", {
    token: shop.token, body: { invoiceId: invoice._id, items: [{ lineId: invoice.items[0]._id, quantity: 5 }] },
  });
  assert.equal(await stock(), 75);
  const second = await shop.bill(5);
  await app.call("PUT", `/invoices/${second._id}/status`, { token: shop.token, body: { status: "cancelled" } });
  assert.equal(await stock(), 75);
});

test("another business cannot read or change records", async () => {
  const other = await app.register();
  const mine = (await create({ items: [s.line(1)] })).data.invoice;
  for (const [method, path] of [["GET", `/invoices/${mine._id}`], ["PUT", `/invoices/${mine._id}`]]) {
    const res = await app.call(method, path, { token: other.token, body: method === "PUT" ? { buyerId: s.buyer._id, items: [s.line(1)] } : undefined });
    assert.equal(res.status, 404, path);
  }
  assert.equal((await create({ items: [s.line(1)] }, other.token)).status, 404);
});

test("the free plan stops at its invoice limit", async () => {
  const free = await app.register();
  const buyer = (await app.call("POST", "/buyers", { token: free.token, body: { name: "B" } })).data.buyer;
  const make = () => app.call("POST", "/invoices", { token: free.token, body: { buyerId: buyer._id, items: [s.line(1)] } });
  for (let i = 0; i < 10; i += 1) assert.equal((await make()).status, 201);
  assert.equal((await make()).status, 403);
});

test("the assistant saves a bill only after confirmation, and only once", async () => {
  const shop = await app.shop();
  const count = async () => (await app.call("GET", "/invoices", { token: shop.token })).data.total;
  const reply = await app.call("POST", "/assistant/chat", {
    token: shop.token,
    body: { messages: [{ role: "user", content: "Create invoice for Verma Hardware with 3 Wall Putty at Rs. 450" }] },
  });
  const card = String(reply.data).trim().split("\n").map((l) => JSON.parse(l)).find((e) => e.type === "card").card;
  assert.equal(card.kind, "draft");
  assert.equal(await count(), 0);

  const confirm = () => app.call("POST", "/assistant/confirm", { token: shop.token, body: { draftId: card.draftId } });
  assert.equal((await confirm()).status, 200);
  assert.equal(await count(), 1);
  assert.equal((await confirm()).status, 404);
});

test("payment webhooks need a valid signature", async () => {
  const raw = JSON.stringify({ event: "something.else" });
  const send = (signature) =>
    app.call("POST", "/subscriptions/webhook", { raw, headers: { "x-razorpay-signature": signature } });
  assert.equal((await send("0".repeat(64))).status, 400);
  const good = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
  assert.equal((await send(good)).status, 200);
});

test("responses carry security headers and do not reveal internals", async () => {
  const health = await app.call("GET", "/health");
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.equal(health.headers.get("x-powered-by"), null);
  assert.equal((await app.call("GET", "/nothing-here")).status, 404);
  const broken = await app.call("POST", "/auth/login", { raw: "{not json" });
  assert.equal(broken.status, 400);
  assert.doesNotMatch(JSON.stringify(broken.data), /at |SyntaxError|node_modules/);
  const bad = await app.call("GET", "/invoices/not-an-id", { token: s.token });
  assert.equal(bad.status, 400);
});

test("a UPI ID must look like one", async () => {
  const save = (upiId) => app.call("PUT", "/auth/supplier-info", { token: s.token, body: { upiId } });
  assert.equal((await save("not a upi id")).status, 400);
  assert.equal((await save("vermastore@okbank")).data.supplier.upiId, "vermastore@okbank");
});
