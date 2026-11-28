// Requests stay light and the browser may remember its permission check.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start } = require("./helpers");

let app;
let s;
before(async () => {
  app = await start();
  s = await app.shop();
});
after(() => app.stop());

const picture = `data:image/png;base64,${"A".repeat(40000)}`;
const call = (method, path, body, token = s.token) => app.call(method, path, { token, body });

test("the browser may remember the permission check for a day", async () => {
  const res = await app.call("OPTIONS", "/invoices", {
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization",
    },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-max-age"), "86400");
});

test("the logo and signature are read only where they are shown", async () => {
  await call("PUT", "/auth/supplier-info", { logoUrl: picture, signatureUrl: picture });
  const profile = (await call("GET", "/auth/supplier-info")).data.supplier;
  assert.equal(profile.logoUrl, picture);
  assert.equal(profile.signatureUrl, picture);

  // Saving another detail leaves both in place
  await call("PUT", "/auth/supplier-info", { city: "Delhi" });
  assert.equal((await call("GET", "/auth/supplier-info")).data.supplier.logoUrl, picture);
  const { insights } = (await call("GET", "/insights")).data;
  assert.equal(insights.setup.find((x) => x.id === "logo").done, true);

  // Staff see the business's logo on their bills too
  await call("POST", "/team", { name: "Counter", email: "c@speed.example.com", password: "counter-pass-1", role: "staff" });
  const { token } = (await app.call("POST", "/auth/login", { body: { login: "c@speed.example.com", password: "counter-pass-1" } })).data;
  assert.equal((await call("GET", "/auth/supplier-info", undefined, token)).data.supplier.logoUrl, picture);
});

test("creating and deleting bills works without the pictures loaded", async () => {
  const invoice = await s.bill(1);
  assert.equal((await call("DELETE", `/invoices/${invoice._id}`)).status, 200);
  assert.equal((await call("GET", "/auth/supplier-info")).data.supplier.signatureUrl, picture);
});
