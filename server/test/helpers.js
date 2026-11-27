// Starts the real app against a temporary in-memory database.
// Set MONGOMS_SYSTEM_BINARY to use an installed mongod instead of downloading one.
const { MongoMemoryServer } = require("mongodb-memory-server-core");

async function start() {
  const database = await MongoMemoryServer.create();
  Object.assign(process.env, {
    JWT_SECRET: "test-secret-that-is-long-enough",
    CLIENT_URL: "http://localhost:5173",
    ANTHROPIC_API_KEY: "",
    RAZORPAY_KEY_ID: "",
    RAZORPAY_KEY_SECRET: "",
    RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
    RESEND_API_KEY: "",
    MAIL_FROM: "",
  });

  const mongoose = require("mongoose");
  await mongoose.connect(database.getUri("gsttest"));
  const app = require("../app");
  await require("../services/seedPlans").seedPlans();
  // Unique indexes must exist before anything relies on them
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, path, { token, body, raw, headers = {} } = {}) {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: raw ?? (body ? JSON.stringify(body) : undefined),
    });
    const text = await res.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* a stream or plain text */
    }
    return { status: res.status, data, headers: res.headers };
  }

  let people = 0;
  async function register(name = "Owner") {
    people += 1;
    const email = `person${people}@example.com`;
    const res = await call("POST", "/auth/register", { body: { name, email, password: "password123" } });
    if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.data)}`);
    return { token: res.data.token, id: res.data.user.id, email };
  }

  async function givePlan(userId, planName) {
    const { Plan, Subscription, User } = mongoose.models;
    const plan = await Plan.findOne({ name: planName });
    const subscription = await Subscription.findOneAndUpdate(
      { user: userId },
      { user: userId, plan: plan._id, status: "active", currentPeriodEnd: new Date(Date.now() + 30 * 86400000) },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await User.updateOne({ _id: userId }, { subscription: subscription._id });
  }

  // An owner on the top plan with one buyer and one tracked product
  async function shop() {
    const owner = await register();
    await givePlan(owner.id, "pro");
    const token = owner.token;
    const buyer = (await call("POST", "/buyers", { token, body: { name: "Verma Hardware", state: "Delhi" } })).data.buyer;
    const item = (await call("POST", "/items", {
      token,
      body: {
        name: "Wall Putty", unit: "bag", price: 400, purchasePrice: 300, gstPercent: 18,
        trackStock: true, openingStock: 100,
      },
    })).data.item;
    const line = (quantity, extra = {}) => ({
      item: item._id, name: item.name, unit: item.unit, quantity, rate: item.price, gstPercent: 18, ...extra,
    });
    const bill = async (quantity, who = token) =>
      (await call("POST", "/invoices", { token: who, body: { buyerId: buyer._id, items: [line(quantity)] } })).data.invoice;
    return { owner, token, buyer, item, line, bill };
  }

  async function stop() {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await database.stop();
  }

  return { call, register, givePlan, shop, stop, mongoose };
}

module.exports = { start };
