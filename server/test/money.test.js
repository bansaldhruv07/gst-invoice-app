// Money must stay right when requests arrive at the same moment.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start } = require("./helpers");

let app;
before(async () => {
  app = await start();
});
after(() => app.stop());

const together = (n, request) => Promise.all(Array.from({ length: n }, (_, i) => request(i)));
const succeeded = (results) => results.filter((r) => r.status < 300).length;

test("paying a bill in full many times at once pays it only once", async () => {
  const s = await app.shop();
  const invoice = await s.bill(10);
  const results = await together(6, () =>
    app.call("POST", `/invoices/${invoice._id}/payment`, { token: s.token, body: { amount: invoice.grandTotal } }),
  );
  assert.equal(succeeded(results), 1);
  const saved = (await app.call("GET", `/invoices/${invoice._id}`, { token: s.token })).data.invoice;
  assert.equal(saved.paidAmount, invoice.grandTotal);
  assert.equal(saved.paymentHistory.length, 1);
  assert.equal(saved.balanceAmount, 0);
});

test("part payments made at once are all counted and never exceed the bill", async () => {
  const s = await app.shop();
  const invoice = await s.bill(10); // 4,720
  const results = await together(5, () =>
    app.call("POST", `/invoices/${invoice._id}/payment`, { token: s.token, body: { amount: 1000 } }),
  );
  const saved = (await app.call("GET", `/invoices/${invoice._id}`, { token: s.token })).data.invoice;
  assert.equal(saved.paidAmount, succeeded(results) * 1000);
  assert.ok(saved.paidAmount <= invoice.grandTotal);
  assert.equal(saved.balanceAmount, invoice.grandTotal - saved.paidAmount);
  assert.ok(succeeded(results) >= 2, "waiting requests are retried");
});

test("goods cannot be returned twice", async () => {
  const s = await app.shop();
  const invoice = await s.bill(10);
  const lineId = invoice.items[0]._id;
  const results = await together(4, () =>
    app.call("POST", "/credit-notes", { token: s.token, body: { invoiceId: invoice._id, items: [{ lineId, quantity: 10 }] } }),
  );
  assert.equal(succeeded(results), 1);
  const saved = await app.call("GET", `/invoices/${invoice._id}`, { token: s.token });
  assert.equal(saved.data.creditNotes.length, 1);
  assert.equal(saved.data.invoice.creditedAmount, invoice.grandTotal);
});

test("one receipt at a time is spread over a buyer's bills", async () => {
  const s = await app.shop();
  const first = await s.bill(5); // 2,360
  const second = await s.bill(5);
  const owed = first.grandTotal + second.grandTotal;
  const results = await together(4, () =>
    app.call("POST", `/ledger/buyer/${s.buyer._id}/receive`, { token: s.token, body: { amount: owed } }),
  );
  assert.equal(succeeded(results), 1);
  const ledger = (await app.call("GET", `/ledger/buyer/${s.buyer._id}`, { token: s.token })).data.ledger;
  assert.equal(ledger.outstanding.total, 0);
  assert.equal(ledger.totalCredit, owed);
});

test("a seller's bill cannot be paid twice", async () => {
  const s = await app.shop();
  const seller = (await app.call("POST", "/sellers", { token: s.token, body: { name: "Supplier", state: "Delhi" } })).data.seller;
  const purchase = (await app.call("POST", "/purchases", {
    token: s.token, body: { sellerId: seller._id, items: [{ name: "Wall Putty", quantity: 2, rate: 300, gstPercent: 18 }] },
  })).data.purchase;
  const results = await together(5, () =>
    app.call("POST", `/purchases/${purchase._id}/payment`, { token: s.token, body: { amount: purchase.grandTotal } }),
  );
  assert.equal(succeeded(results), 1);
});

test("invoices created at once get different numbers", async () => {
  const s = await app.shop();
  const results = await together(8, () =>
    app.call("POST", "/invoices", { token: s.token, body: { buyerId: s.buyer._id, items: [s.line(1)] } }),
  );
  assert.equal(succeeded(results), 8, JSON.stringify(results.find((r) => r.status >= 300)?.data));
  assert.equal(new Set(results.map((r) => r.data.invoice.invoiceNumber)).size, 8);
});
