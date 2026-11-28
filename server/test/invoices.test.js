// Line discounts and CESS, consignees, invoice numbers, deleting, government
// numbers, and the extra product and buyer details.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start } = require("./helpers");

let app;
let s;
let staff;

before(async () => {
  app = await start();
  s = await app.shop();
  const email = "counter@example.com";
  await app.call("POST", "/team", { token: s.token, body: { name: "Counter", email, password: "password123", role: "staff" } });
  staff = (await app.call("POST", "/auth/login", { body: { email, password: "password123" } })).data.token;
});
after(() => app.stop());

const create = (body, token = s.token) =>
  app.call("POST", "/invoices", { token, body: { buyerId: s.buyer._id, items: [s.line(2)], ...body } });
const get = async (id) => (await app.call("GET", `/invoices/${id}`, { token: s.token })).data.invoice;

test("a line keeps its own tax setting, discount and CESS", async () => {
  const { data } = await create({
    items: [
      s.line(10, { discountType: "percent", discountValue: 10, cessType: "percent", cessValue: 12, description: "20 kg" }),
      s.line(1, { rate: 118, taxMode: "inclusive" }),
    ],
  });
  const [a, b] = data.invoice.items;
  assert.deepEqual([a.discountAmount, a.taxableAmount, a.cessAmount, a.totalAmount], [400, 3600, 432, 4680]);
  assert.equal(a.description, "20 kg");
  assert.deepEqual([b.taxableAmount, b.totalAmount], [100, 118]);
  assert.equal(data.invoice.totalCess, 432);
  assert.equal(data.invoice.totalTax, 666, "GST does not include CESS");
  assert.equal(data.invoice.grandTotal, 4798);
});

test("a discount larger than the line is refused", async () => {
  assert.equal((await create({ items: [s.line(1, { discountType: "amount", discountValue: 401 })] })).status, 400);
});

test("returning part of a discounted line credits the same share", async () => {
  const invoice = (await create({
    items: [s.line(10, { discountType: "amount", discountValue: 100, cessType: "amount", cessValue: 50 })],
  })).data.invoice;
  const lineId = invoice.items[0]._id;
  const back = (quantity) =>
    app.call("POST", "/credit-notes", { token: s.token, body: { invoiceId: invoice._id, items: [{ lineId, quantity }] } });
  const half = (await back(5)).data.creditNote;
  assert.equal(half.items[0].taxableAmount, 1950);
  assert.equal(half.totalCess, 25);
  const rest = (await back(5)).data.creditNote;
  assert.equal(half.grandTotal + rest.grandTotal, invoice.grandTotal);
});

test("the consignee and the reverse charge are saved", async () => {
  assert.equal((await create({ consigneeMode: "other", consignee: {} })).status, 400);
  const { invoice } = (await create({
    consigneeMode: "other", reverseCharge: true,
    consignee: { name: "Site Office", state: "Haryana", gstin: "06abcde1234f1z5" },
  })).data;
  assert.equal(invoice.consignee.gstin, "06ABCDE1234F1Z5");
  assert.equal(invoice.consignee.stateCode, "06");
  assert.equal(invoice.reverseCharge, true);
  const same = (await create({ consignee: { name: "ignored" } })).data.invoice;
  assert.equal(same.consigneeMode, "same");
  assert.equal(same.consignee.name, "");
});

test("the owner can type a number, once", async () => {
  await app.call("PUT", "/auth/supplier-info", { token: s.token, body: { invoicePrefix: "AB" } });
  const next = (await app.call("GET", "/invoices/next-number?date=2026-11-28", { token: s.token })).data;
  assert.equal(next.prefix, "AB2026-27/");
  const typed = await create({ invoiceDate: "2026-11-28", invoiceNumber: "AB2026-27/870" });
  assert.equal(typed.data.invoice.invoiceNumber, "AB2026-27/870");
  assert.equal((await create({ invoiceNumber: "AB2026-27/870" })).status, 400);
  assert.equal((await create({ invoiceNumber: "has spaces" })).status, 400);
  assert.equal((await create({ invoiceNumber: "X".repeat(17) })).status, 400);
  const after = await create({ invoiceDate: "2026-11-28" });
  assert.equal(after.data.invoice.invoiceNumber, "AB2026-27/871", "the series carries on");
});

test("staff get the next number in the series, whatever they send", async () => {
  const res = await create({ invoiceNumber: "MINE-1" }, staff);
  assert.equal(res.status, 201);
  assert.notEqual(res.data.invoice.invoiceNumber, "MINE-1");
  assert.equal((await app.call("GET", "/invoices/next-number", { token: staff })).status, 200);
});

test("an invoice with money against it cannot be deleted", async () => {
  const paid = (await create({})).data.invoice;
  await app.call("POST", `/invoices/${paid._id}/payment`, { token: s.token, body: { amount: 10 } });
  assert.equal((await app.call("DELETE", `/invoices/${paid._id}`, { token: s.token })).status, 400);

  const free = (await create({})).data.invoice;
  assert.equal((await app.call("DELETE", `/invoices/${free._id}`, { token: staff })).status, 403);
  assert.equal((await app.call("DELETE", `/invoices/${free._id}`, { token: s.token })).status, 200);
  assert.equal((await app.call("GET", `/invoices/${free._id}`, { token: s.token })).status, 404);
});

test("deleting does not give back the month's free allowance", async () => {
  const free = await app.register();
  const buyer = (await app.call("POST", "/buyers", { token: free.token, body: { name: "B" } })).data.buyer;
  const make = () => app.call("POST", "/invoices", { token: free.token, body: { buyerId: buyer._id, items: [s.line(1)] } });
  let last;
  for (let i = 0; i < 10; i += 1) last = (await make()).data.invoice;
  await app.call("DELETE", `/invoices/${last._id}`, { token: free.token });
  assert.equal((await make()).status, 403);
});

test("e-invoice and e-way bill numbers are checked and saved", async () => {
  const invoice = (await create({})).data.invoice;
  await app.call("POST", `/invoices/${invoice._id}/payment`, { token: s.token, body: { amount: invoice.grandTotal } });
  const save = (body, token = s.token) => app.call("PUT", `/invoices/${invoice._id}/compliance`, { token, body });
  assert.equal((await save({ ewayBillNumber: "123" })).status, 400);
  assert.equal((await save({ irn: "not valid!" })).status, 400);
  const ok = await save({ ewayBillNumber: "1234 5678 9012", ewayBillDate: "2026-11-28" }, staff);
  assert.equal(ok.data.invoice.ewayBillNumber, "123456789012");
  const irn = "a".repeat(64);
  assert.equal((await save({ irn, ackNumber: "99" })).data.invoice.irn, irn);
  assert.equal((await get(invoice._id)).ewayBillNumber, "123456789012", "saving one keeps the other");
  assert.equal((await get(invoice._id)).balanceAmount, 0, "amounts are untouched");

  const list = await app.call("GET", "/invoices?einvoice=1", { token: s.token });
  assert.deepEqual(list.data.invoices.map((i) => i._id), [invoice._id]);
});

test("only the owner places a signature, and only an image", async () => {
  const invoice = (await create({ invoiceType: "bill_of_supply" })).data.invoice;
  const sign = (signatureUrl, token = s.token) =>
    app.call("PUT", `/invoices/${invoice._id}/signature`, { token, body: { signatureUrl } });
  assert.equal((await sign("javascript:alert(1)")).status, 400);
  assert.equal((await sign("data:image/png;base64,AAAA", staff)).status, 403);
  assert.equal((await sign("data:image/png;base64,AAAA")).status, 200);
  const list = await app.call("GET", "/invoices?type=bill_of_supply", { token: s.token });
  assert.ok(list.data.invoices.every((i) => i.invoiceType === "bill_of_supply"));
});

test("each invoice has its own history", async () => {
  const invoice = (await create({})).data.invoice;
  await app.call("POST", `/invoices/${invoice._id}/payment`, { token: staff, body: { amount: 5 } });
  await new Promise((r) => setTimeout(r, 200));
  const { entries } = (await app.call("GET", `/invoices/${invoice._id}/history`, { token: s.token })).data;
  assert.deepEqual(entries.map((e) => [e.action, e.who]), [["Recorded a payment", "Counter"], ["Created an invoice", "Owner"]]);
  assert.equal((await app.call("GET", `/invoices/${invoice._id}/history`, { token: staff })).status, 403);
});

test("products keep their extra prices and settings", async () => {
  const body = {
    name: "Adhesive", price: 590, taxMode: "inclusive", gstPercent: 18, category: "Tiling", mrp: 650,
    purchasePrice: 472, purchaseTaxMode: "inclusive", wholesalePrice: 550, minWholesaleQty: 10,
    defaultQuantity: 5, discountType: "amount", discountValue: 20, cessValue: 1, trackStock: true, openingStock: 4,
  };
  const item = (await app.call("POST", "/items", { token: s.token, body })).data.item;
  for (const [key, value] of Object.entries(body)) assert.equal(item[key], value, key);
  const cleared = await app.call("PUT", `/items/${item._id}`, { token: s.token, body: { category: "" } });
  assert.equal(cleared.data.item.category, "");
  const stock = (await app.call("GET", "/stock", { token: s.token })).data.stock.find((x) => x.id === item._id);
  assert.equal(stock.cost, 400, "stock is valued without GST");
});

test("buyers keep their GST treatment and can also be sellers", async () => {
  const body = {
    name: "Both Ways Ltd", state: "Delhi", gstTreatment: "sez", optionalField1: "PAN",
    optionalValue1: "ABCDE1234F", alsoSeller: true,
  };
  const buyer = (await app.call("POST", "/buyers", { token: s.token, body })).data.buyer;
  assert.equal(buyer.optionalValue1, "ABCDE1234F");
  const invoice = (await create({ buyerId: buyer._id })).data.invoice;
  assert.equal(invoice.taxType, "igst", "an SEZ supply is inter-state");
  await app.call("PUT", `/buyers/${buyer._id}`, { token: s.token, body: { alsoSeller: true } });
  const sellers = (await app.call("GET", "/sellers", { token: s.token })).data.sellers;
  assert.equal(sellers.filter((x) => x.name === "Both Ways Ltd").length, 1);
  assert.equal((await app.call("POST", "/buyers", { token: s.token, body: { name: "X", gstTreatment: "alien" } })).status, 400);
});

test("the assistant prices a product the way it is set up", async () => {
  await app.call("POST", "/items", { token: s.token, body: { name: "Primer Plus", price: 118, gstPercent: 18, taxMode: "inclusive" } });
  await app.call("POST", "/items", { token: s.token, body: { name: "Sealer Max", price: 100, gstPercent: 18 } });
  const draft = async (text) => {
    const reply = await app.call("POST", "/assistant/chat", { token: s.token, body: { messages: [{ role: "user", content: text }] } });
    return String(reply.data).trim().split(/\r?\n/).map((l) => JSON.parse(l)).find((e) => e.type === "card").card;
  };
  const total = (card) => card.rows.find((r) => r.label === "Total").value;
  assert.equal(total(await draft("Create invoice for Verma Hardware with 1 Primer Plus")), "₹118");
  assert.equal(total(await draft("Create invoice for Verma Hardware with 1 Sealer Max")), "₹118");
  assert.equal(total(await draft("Create invoice for Verma Hardware with 1 Sealer Max including GST")), "₹100");
});
