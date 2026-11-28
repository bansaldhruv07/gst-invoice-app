// Mobile sign-in, bill designs, hostile input, plans and yearly payments.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Razorpay is replaced by a stand-in that remembers the orders it is asked for
const orders = new Map();
const cancelled = [];
class FakeRazorpay {
  constructor() {
    this.orders = {
      create: async (order) => {
        const id = `order_${orders.size + 1}`;
        orders.set(id, { id, ...order });
        return orders.get(id);
      },
      fetch: async (id) => orders.get(id),
    };
    this.subscriptions = { cancel: async (id) => cancelled.push(id) };
  }
}
const razorpayPath = require.resolve("razorpay");
require.cache[razorpayPath] = { id: razorpayPath, filename: razorpayPath, loaded: true, exports: FakeRazorpay };

const { start } = require("./helpers");

let app;
before(async () => {
  app = await start({ assistant: false });
});
after(() => app.stop());

const login = (name, password = "password123") =>
  app.call("POST", "/auth/login", { body: { login: name, password } });

const signUp = (body) =>
  app.call("POST", "/auth/register", { body: { name: "Shop", password: "password123", ...body } });

test("an account can be opened and used with a mobile number", async () => {
  const made = await signUp({ email: "m1@example.com", mobile: "+91 98765-43210" });
  assert.equal(made.status, 201);
  assert.equal(made.data.user.mobile, "9876543210");
  for (const typed of ["9876543210", "09876543210", "+919876543210", "98765 43210", "M1@Example.com"]) {
    assert.equal((await login(typed)).status, 200, typed);
  }
  assert.equal((await login("9876543210", "wrong-password")).status, 401);
  assert.equal((await login("9000000000")).status, 401);
  assert.equal((await login("not a login")).status, 401);
  // Older pages still send "email"
  const old = await app.call("POST", "/auth/login", { body: { email: "m1@example.com", password: "password123" } });
  assert.equal(old.status, 200);
});

test("a mobile number belongs to one account, and accounts may have none", async () => {
  assert.equal((await signUp({ email: "m2@example.com", mobile: "9876543210" })).status, 400);
  assert.equal((await signUp({ email: "m3@example.com", mobile: "12345" })).status, 400);
  assert.equal((await signUp({ email: "m4@example.com" })).status, 201);
  assert.equal((await signUp({ email: "m5@example.com", mobile: "" })).status, 201);
});

test("changing the sign-in number needs the password", async () => {
  const token = (await signUp({ email: "m6@example.com" })).data.token;
  const save = (body) => app.call("PUT", "/auth/mobile", { token, body });
  assert.equal((await save({ mobile: "9811111111", currentPassword: "nope-nope" })).status, 400);
  assert.equal((await save({ mobile: "9876543210", currentPassword: "password123" })).status, 400, "taken");
  const done = await save({ mobile: "9811111111", currentPassword: "password123" });
  assert.equal(done.data.user.mobile, "9811111111");
  assert.equal((await login("9811111111")).status, 200);
  assert.equal((await save({ mobile: "", currentPassword: "password123" })).data.user.mobile, "");
  assert.equal((await login("9811111111")).status, 401);
});

test("staff may sign in with a mobile number too", async () => {
  const s = await app.shop();
  const body = { name: "Ravi", email: "ravi@example.com", mobile: "9822222222", password: "counter-pass-1", role: "staff" };
  assert.equal((await app.call("POST", "/team", { token: s.token, body })).status, 201);
  const signedIn = await login("9822222222", "counter-pass-1");
  assert.equal(signedIn.data.user.role, "staff");
});

test("easy passwords are refused", async () => {
  for (const password of ["password", "12345678", "aaaaaaaaaa", "Password@123"]) {
    assert.equal((await signUp({ email: "weak@example.com", password })).status, 400, password);
  }
  assert.equal((await signUp({ email: "weak@example.com", password: "weak@example.com" })).status, 400);
});

test("requests carrying query operators or oversized text are refused", async () => {
  const hostile = [
    { login: { $ne: null }, password: "password123" },
    { login: "m1@example.com", password: "password123", extra: { $where: "1" } },
    JSON.parse('{"login":"m1@example.com","password":"password123","__proto__":{"role":"owner"}}'),
  ];
  for (const body of hostile) {
    const raw = JSON.stringify(body).replace('"login"', '"login"');
    assert.equal((await app.call("POST", "/auth/login", { raw })).status, 400, raw);
  }
  const proto = '{"login":"m1@example.com","password":"password123","__proto__":{"a":1}}';
  assert.equal((await app.call("POST", "/auth/login", { raw: proto })).status, 400);
  const s = await app.shop();
  const long = await app.call("POST", "/buyers", { token: s.token, body: { name: "x".repeat(30000) } });
  assert.equal(long.status, 400);
  // Nested query strings are read as plain names, never as operators
  const odd = await app.call("GET", "/invoices?status[$ne]=paid", { token: s.token });
  assert.notEqual(odd.status, 500);
});

test("the assistant is switched off unless it is turned on", async () => {
  const s = await app.shop();
  assert.equal((await app.call("GET", "/assistant/status", { token: s.token })).status, 404);
});

test("only the offered bill designs and picture addresses are saved", async () => {
  const s = await app.shop();
  const save = (body) => app.call("PUT", "/auth/supplier-info", { token: s.token, body });
  const start_ = await app.call("GET", "/auth/supplier-info", { token: s.token });
  assert.equal(start_.data.supplier.template, "classic", "existing bills keep their look");
  const ok = await save({ template: "modern", color: "maroon" });
  assert.deepEqual([ok.data.supplier.template, ok.data.supplier.color], ["modern", "maroon"]);
  assert.equal((await save({ template: "fancy" })).status, 400);
  assert.equal((await save({ color: "#ff0000" })).status, 400);
  assert.equal((await save({ logoUrl: "javascript:alert(1)" })).status, 400);
  assert.equal((await save({ logoUrl: "data:text/html;base64,AAAA" })).status, 400);
  assert.equal((await save({ logoUrl: "data:image/png;base64,AAAA" })).status, 200);
});

test("three plans are on sale, with yearly prices", async () => {
  const { plans } = (await app.call("GET", "/subscriptions/plans")).data;
  assert.deepEqual(
    plans.map((p) => [p.name, p.price, p.listPrice, p.yearlyPrice, Object.values(p.limits)]),
    [
      ["free", 0, 0, 0, [20, 10, 10]],
      ["starter", 499, 699, 4999, [100, 50, 50]],
      ["growth", 799, 1299, 7999, [-1, -1, -1]],
    ],
  );
  assert.deepEqual(plans.map((p) => p.features.multiUser), [false, false, true]);
});

test("stored plans are updated once, and the old plan is no longer sold", async () => {
  const { Plan } = app.mongoose.models;
  const { seedPlans } = require("../services/seedPlans");
  await Plan.updateOne({ name: "starter" }, { price: 299, version: 1, razorpayPlanId: "plan_old_price" });
  await Plan.updateOne({ name: "growth" }, { version: 1, razorpayPlanId: "plan_same_price" });
  await Plan.create({ name: "pro", displayName: "Pro", price: 1999, isActive: true });
  await seedPlans();
  const starter = await Plan.findOne({ name: "starter" });
  assert.deepEqual([starter.price, starter.razorpayPlanId], [499, ""], "it would still charge the old price");
  assert.equal((await Plan.findOne({ name: "growth" })).razorpayPlanId, "plan_same_price");
  assert.equal((await Plan.findOne({ name: "pro" })).isActive, false);
  await Plan.updateOne({ name: "growth" }, { razorpayPlanId: "" });
  // A later change in the database is left alone
  await Plan.updateOne({ name: "starter" }, { price: 450, razorpayPlanId: "" });
  await seedPlans();
  assert.equal((await Plan.findOne({ name: "starter" })).price, 450);
  await Plan.updateOne({ name: "starter" }, { price: 499 });
});

test("a year and a month are charged and counted correctly", async () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_standin";
  process.env.RAZORPAY_KEY_SECRET = "standin-secret";
  const owner = await app.register();
  const { plans } = (await app.call("GET", "/subscriptions/plans")).data;
  const starter = plans.find((p) => p.name === "starter");

  let payments = 0;
  const buy = async (period, tamper) => {
    const order = (await app.call("POST", "/subscriptions/create-order", {
      token: owner.token, body: { planId: starter._id, period },
    })).data;
    if (tamper) tamper(orders.get(order.orderId));
    payments += 1;
    const paymentId = `pay_${payments}`;
    const signature = crypto.createHmac("sha256", "standin-secret").update(`${order.orderId}|${paymentId}`).digest("hex");
    const body = { razorpay_order_id: order.orderId, razorpay_payment_id: paymentId, razorpay_signature: signature };
    const res = await app.call("POST", "/subscriptions/verify-payment", { token: owner.token, body });
    return { order, res, body };
  };
  const monthsAhead = (date) => Math.round((new Date(date) - Date.now()) / (30.44 * 86400000));

  const year = await buy("yearly");
  assert.equal(year.order.amount, 499900);
  assert.equal(year.res.data.subscription.billingPeriod, "yearly");
  assert.equal(monthsAhead(year.res.data.subscription.currentPeriodEnd), 12);

  // The same confirmation sent again adds nothing
  const again = await app.call("POST", "/subscriptions/verify-payment", { token: owner.token, body: year.body });
  assert.equal(monthsAhead(again.data.subscription.currentPeriodEnd), 12);

  // Paying again for the same plan adds to the time left
  const month = await buy("monthly");
  assert.equal(month.order.amount, 49900);
  assert.equal(monthsAhead(month.res.data.subscription.currentPeriodEnd), 13);

  // A monthly amount does not buy a year
  const cheat = await buy("monthly", (order) => { order.notes.period = "yearly"; });
  assert.equal(cheat.res.status, 400);

  const pro = await app.mongoose.models.Plan.findOne({ name: "pro" });
  const retired = await app.call("POST", "/subscriptions/create-order", { token: owner.token, body: { planId: String(pro._id) } });
  assert.equal(retired.status, 400);
  process.env.RAZORPAY_KEY_ID = "";
  process.env.RAZORPAY_KEY_SECRET = "";
});
