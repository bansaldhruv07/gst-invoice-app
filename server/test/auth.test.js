const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { start } = require("./helpers");

let app;
const mail = [];
let mailServer;

before(async () => {
  app = await start();
  mailServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      mail.push(JSON.parse(raw));
      res.end("{}");
    });
  });
  await new Promise((r) => mailServer.listen(0, "127.0.0.1", r));
});
after(async () => {
  mailServer.close();
  await app.stop();
});

const login = (email, password) => app.call("POST", "/auth/login", { body: { email, password } });

const nextMail = async (count) => {
  for (let i = 0; i < 100 && mail.length < count; i += 1) await new Promise((r) => setTimeout(r, 20));
  return mail[count - 1];
};

test("registers, signs in and reports the role", async () => {
  const person = await app.register("Asha");
  const res = await login(person.email.toUpperCase(), "password123");
  assert.equal(res.status, 200);
  assert.equal(res.data.user.role, "owner");
  assert.equal(res.data.user.password, undefined);
});

test("rejects weak passwords, bad emails and duplicate accounts", async () => {
  const body = { name: "A", email: "weak@example.com", password: "short" };
  assert.equal((await app.call("POST", "/auth/register", { body })).status, 400);
  assert.equal((await app.call("POST", "/auth/register", { body: { ...body, email: "nope", password: "password123" } })).status, 400);
  const person = await app.register();
  const again = await app.call("POST", "/auth/register", { body: { name: "B", email: person.email, password: "password123" } });
  assert.equal(again.status, 400);
});

test("registration cannot choose a role or join another business", async () => {
  const victim = await app.register();
  const res = await app.call("POST", "/auth/register", {
    body: { name: "Eve", email: "eve@example.com", password: "password123", role: "accountant", owner: victim.id },
  });
  assert.equal(res.data.user.role, "owner");
  const stored = await app.mongoose.models.User.findOne({ email: "eve@example.com" });
  assert.equal(stored.owner, null);
});

test("query objects in place of text are refused", async () => {
  await app.register();
  const res = await login({ $ne: null }, { $ne: null });
  assert.equal(res.status, 400);
});

test("wrong email and wrong password look the same", async () => {
  const person = await app.register();
  const a = await login(person.email, "not-the-password");
  const b = await login("nobody@example.com", "not-the-password");
  assert.equal(a.status, 401);
  assert.deepEqual(a.data, b.data);
});

test("repeated wrong passwords are slowed down, without blocking other accounts", async () => {
  const target = await app.register();
  const other = await app.register();
  for (let i = 0; i < 10; i += 1) assert.equal((await login(target.email, "wrong-password")).status, 401);
  assert.equal((await login(target.email, "password123")).status, 429);
  assert.equal((await login(other.email, "password123")).status, 200);
});

test("changing the password signs out older sessions", async () => {
  const person = await app.register();
  await new Promise((r) => setTimeout(r, 1100)); // sign-in times are counted in seconds
  const changed = await app.call("PUT", "/auth/password", {
    token: person.token, body: { currentPassword: "password123", newPassword: "a-new-password" },
  });
  assert.equal(changed.status, 200);
  assert.equal((await app.call("GET", "/auth/me", { token: person.token })).status, 401);
  assert.equal((await app.call("GET", "/auth/me", { token: changed.data.token })).status, 200);
});

test("password reset is off until email is set up", async () => {
  assert.equal((await app.call("GET", "/auth/options")).data.passwordReset, false);
  const res = await app.call("POST", "/auth/forgot-password", { body: { email: "x@example.com" } });
  assert.equal(res.status, 503);
});

test("a reset link works once and does not reveal who has an account", async () => {
  Object.assign(process.env, {
    RESEND_API_KEY: "test", MAIL_FROM: "app@example.com",
    MAIL_API_URL: `http://127.0.0.1:${mailServer.address().port}`,
  });
  const person = await app.register();
  const known = await app.call("POST", "/auth/forgot-password", { body: { email: person.email } });
  const unknown = await app.call("POST", "/auth/forgot-password", { body: { email: "stranger@example.com" } });
  assert.deepEqual(known.data, unknown.data);

  const message = await nextMail(1);
  assert.deepEqual(message.to, [person.email]);
  assert.equal(mail.length, 1);
  const token = message.text.match(/token=([a-f0-9]{64})/)[1];
  const stored = await app.mongoose.models.User.findById(person.id);
  assert.notEqual(stored.resetTokenHash, token, "only a hash is stored");

  const reset = (password) => app.call("POST", "/auth/reset-password", { body: { token, password } });
  assert.equal((await reset("short")).status, 400);
  assert.equal((await reset("brand-new-password")).status, 200);
  assert.equal((await reset("another-password")).status, 400);
  assert.equal((await login(person.email, "brand-new-password")).status, 200);
});

test("an expired reset link is refused", async () => {
  const person = await app.register();
  await app.call("POST", "/auth/forgot-password", { body: { email: person.email } });
  const token = (await nextMail(2)).text.match(/token=([a-f0-9]{64})/)[1];
  await app.mongoose.models.User.updateOne({ _id: person.id }, { resetTokenExpires: new Date(Date.now() - 1000) });
  const res = await app.call("POST", "/auth/reset-password", { body: { token, password: "brand-new-password" } });
  assert.equal(res.status, 400);
});

test("tampered and missing sign-ins are refused", async () => {
  const person = await app.register();
  assert.equal((await app.call("GET", "/invoices")).status, 401);
  assert.equal((await app.call("GET", "/invoices", { token: `${person.token}x` })).status, 401);
});
