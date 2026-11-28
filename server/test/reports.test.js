// Sales and purchase reports, GSTR-2, stock, debtors and creditors.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start } = require("./helpers");

let app;
let s;
let away;
let walkIn;
let supplier;
let small;
let sales;
const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const range = `from=${today}&to=${today}`;

const call = (method, path, body, token = s.token) => app.call(method, path, { token, body });
const report = async (name, query = range, token = s.token) =>
  (await call("GET", `/reports/${name}?${query}`, undefined, token)).data.report;
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 0.005, `${label}: ${a} is not ${b}`);
const total = (rows, key) => rows.reduce((sum, r) => sum + (r[key] || 0), 0);

before(async () => {
  app = await start();
  s = await app.shop();
  // The shop starts with "Verma Hardware" (Delhi) and "Wall Putty": 400 a bag,
  // 300 to buy, 18% GST, 100 in stock
  away = (await call("POST", "/buyers", { name: "Hisar Traders", state: "Haryana", gstin: "06AAAAA0000A1Z5", openingBalance: 500 })).data.buyer;
  walkIn = (await call("POST", "/buyers", { name: "Walk In", state: "Delhi" })).data.buyer;
  supplier = (await call("POST", "/sellers", { name: "Putty Works", state: "Delhi", gstin: "07BBBBB1111B1Z5", openingBalance: 1000 })).data.seller;
  small = (await call("POST", "/sellers", { name: "Local Carter", state: "Delhi" })).data.seller;

  const first = await s.bill(10); // Verma: 4000 + 720
  await call("POST", `/invoices/${first._id}/payment`, { amount: 1000 });
  await call("POST", "/invoices", { buyerId: away._id, items: [s.line(5)] }); // 2000 + 360 IGST
  const returned = (await call("POST", "/invoices", { buyerId: walkIn._id, items: [s.line(2)] })).data.invoice; // 800 + 144
  await call("POST", "/credit-notes", { invoiceId: returned._id, items: [{ lineId: returned.items[0]._id, quantity: 1 }] });
  const cancelled = await s.bill(7);
  await call("PUT", `/invoices/${cancelled._id}/status`, { status: "cancelled" });

  const bought = (await call("POST", "/purchases", {
    sellerId: supplier._id, sellerInvoiceNumber: "PW-9",
    items: [{ name: "Wall Putty", unit: "bag", hsn: "32141000", quantity: 20, rate: 300, gstPercent: 18 }],
  })).data.purchase; // 6000 + 1080
  await call("POST", `/purchases/${bought._id}/payment`, { amount: 2080 });
  await call("POST", "/purchases", {
    sellerId: small._id, items: [{ name: "Cartage", unit: "pcs", quantity: 1, rate: 200, gstPercent: 0 }],
  });
  sales = await report("sales");
});
after(() => app.stop());

test("party-wise sales add up, after returns and without cancelled bills", () => {
  const by = Object.fromEntries(sales.parties.map((p) => [p.name, p]));
  assert.deepEqual([by["Verma Hardware"].bills, by["Verma Hardware"].taxable, by["Verma Hardware"].tax, by["Verma Hardware"].total, by["Verma Hardware"].balance],
    [1, 4000, 720, 4720, 3720]);
  assert.equal(by["Hisar Traders"].total, 2360);
  assert.deepEqual([by["Walk In"].taxable, by["Walk In"].total, by["Walk In"].returns], [400, 472, 472]);
  assert.equal(sales.bills.filter((b) => b.type === "Credit note").length, 1);
  assert.equal(total(sales.bills, "total"), 7552);
});

test("product-wise sales give quantity, average rate and margin", () => {
  assert.equal(sales.products.length, 1);
  const [putty] = sales.products;
  assert.deepEqual([putty.quantity, putty.taxable, putty.tax, putty.total, putty.averageRate], [16, 6400, 1152, 7552, 400]);
  // 17 bags sold at a cost of 300; the returned bag came back into stock
  assert.equal(putty.margin, 6400 - 16 * 300);
  assert.equal(total(sales.lines, "quantity"), 16);
});

test("the GST sales report splits tax by rate and by place", () => {
  assert.deepEqual(sales.rates.map((r) => [r.rate, r.taxable, r.cgst, r.sgst, r.igst]), [[18, 6400, 396, 396, 360]]);
  const outside = sales.bills.find((b) => b.party === "Hisar Traders");
  assert.deepEqual([outside.igst, outside.cgst, outside.placeOfSupply], [360, 0, "06-Haryana"]);
  near(total(sales.bills, "tax"), total(sales.rates, "tax"), "bill and rate totals");
});

test("purchase reports by party, product and bill", async () => {
  const r = await report("purchases");
  assert.deepEqual(r.parties.map((p) => [p.name, p.total, p.balance]), [["Putty Works", 7080, 5000], ["Local Carter", 200, 200]]);
  assert.deepEqual(r.products.map((p) => [p.name, p.quantity, p.taxable]), [["Wall Putty", 20, 6000], ["Cartage", 1, 200]]);
  assert.deepEqual(r.bills.map((b) => [b.party, b.credit, b.supplierBill]), [["Putty Works", "Yes", "PW-9"], ["Local Carter", "No", ""]]);
  assert.deepEqual(r.rates.map((x) => [x.rate, x.taxable, x.tax]), [[0, 200, 0], [18, 6000, 1080]]);
});

test("GSTR-2 counts credit only for registered sellers", async () => {
  const r = await report("gstr2");
  assert.deepEqual(r.registered.map((x) => [x.gstin, x.rate, x.taxable, x.cgst, x.sgst]), [["07BBBBB1111B1Z5", 18, 6000, 540, 540]]);
  assert.deepEqual([r.itc.taxable, r.itc.tax], [6000, 1080]);
  assert.equal(r.unregistered.length, 0);
  assert.deepEqual(r.exempt.map((x) => [x.seller, x.taxable]), [["Local Carter", 200]]);
  assert.equal(r.hsn.reduce((q, h) => q + h.quantity, 0), 21);
});

test("the stock report shows quantity and value as of now", async () => {
  const r = await report("stock", "");
  const [putty] = r.stock;
  // 100 + 20 bought - 17 sold + 1 returned
  assert.deepEqual([putty.stock, putty.purchased, putty.sold, putty.returned], [104, 20, 17, 1]);
  assert.equal(r.value, 104 * 300);
});

test("debtors and creditors match each party's statement", async () => {
  const r = await report("outstanding", "");
  const by = Object.fromEntries(r.parties.map((p) => [p.name, p]));
  assert.deepEqual([by["Verma Hardware"].side, by["Verma Hardware"].balance], ["debtor", 3720]);
  assert.deepEqual([by["Hisar Traders"].side, by["Hisar Traders"].balance], ["debtor", 2860]);
  assert.deepEqual([by["Walk In"].side, by["Walk In"].balance], ["debtor", 472]);
  assert.deepEqual([by["Putty Works"].side, by["Putty Works"].balance], ["creditor", 6000]);
  assert.deepEqual([by["Local Carter"].side, by["Local Carter"].balance], ["creditor", 200]);
  assert.deepEqual([r.receivable, r.payable], [7052, 6200]);

  for (const p of r.parties) {
    const path = p.kind === "Buyer" ? "buyer" : "seller";
    const { ledger } = (await call("GET", `/ledger/${path}/${p.id}`)).data;
    near(Math.abs(ledger.closing), p.balance, `statement of ${p.name}`);
  }
});

test("a buyer paid in advance by returns is shown as a creditor", async () => {
  const buyer = (await call("POST", "/buyers", { name: "Prepaid", state: "Delhi" })).data.buyer;
  const invoice = (await call("POST", "/invoices", { buyerId: buyer._id, items: [s.line(2)] })).data.invoice;
  await call("POST", `/invoices/${invoice._id}/payment`, { amount: invoice.grandTotal });
  await call("POST", "/credit-notes", { invoiceId: invoice._id, items: [{ lineId: invoice.items[0]._id, quantity: 1 }] });
  const row = (await report("outstanding", "")).parties.find((p) => p.name === "Prepaid");
  assert.deepEqual([row.side, row.balance], ["creditor", 472]);
});

test("reports are for the owner and the accountant, and each business sees its own", async () => {
  const other = await app.shop();
  for (const name of ["sales", "purchases", "gstr2", "stock", "outstanding"]) {
    const mine = await report(name, range, other.token);
    assert.ok(mine, name);
  }
  assert.equal((await report("sales", range, other.token)).bills.length, 0);
  assert.equal((await report("purchases", range, other.token)).bills.length, 0);

  for (const role of ["staff", "accountant"]) {
    const email = `${role}@reports.example.com`;
    await call("POST", "/team", { name: role, email, password: "counter-pass-1", role });
    const { token } = (await app.call("POST", "/auth/login", { body: { login: email, password: "counter-pass-1" } })).data;
    const status = (await call("GET", "/reports/outstanding", undefined, token)).status;
    assert.equal(status, role === "staff" ? 403 : 200, role);
  }
  assert.equal((await call("GET", "/reports/sales?from=2026-02-02&to=2026-01-01")).status, 400);
});
