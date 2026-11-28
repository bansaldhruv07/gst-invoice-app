// Worker attendance, pay for a month and payments.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start } = require("./helpers");
const { monthSummary, employedDays } = require("../services/payroll");

let app;
let s;
before(async () => {
  app = await start();
  s = await app.shop();
});
after(() => app.stop());

const person = (extra) => ({ joinedOn: "2026-01-01", leftOn: "", payments: [], ...extra });
const marks = (statuses) =>
  Object.fromEntries(statuses.map((status, i) => [`2026-09-${String(i + 1).padStart(2, "0")}`, status]));

test("a daily wage pays the days worked", () => {
  const worker = person({ payType: "daily", rate: 600 });
  const summary = monthSummary(worker, "2026-09", marks(["present", "present", "half", "absent", "leave"]), "2026-11-28");
  assert.deepEqual(
    [summary.present, summary.half, summary.absent, summary.leave, summary.earned],
    [2, 1, 1, 1, 1500],
  );
});

test("a monthly salary takes off absences and half days", () => {
  const worker = person({ payType: "monthly", rate: 18000, payments: [{ forMonth: "2026-09", amount: 5000 }, { forMonth: "2026-10", amount: 1 }] });
  const full = monthSummary(worker, "2026-09", {}, "2026-11-28");
  assert.deepEqual([full.earned, full.paid, full.balance], [18000, 5000, 13000]);
  const cut = monthSummary(worker, "2026-09", marks(["absent", "half", "leave"]), "2026-11-28");
  assert.equal(cut.earned, 17100);
  assert.equal(monthSummary(worker, "2026-12", {}, "2026-11-28").earned, 0, "a month not yet begun");
});

test("a salary counts only the days employed", () => {
  const worker = person({ payType: "monthly", rate: 3000, joinedOn: "2026-09-16", leftOn: "2026-10-10" });
  assert.equal(employedDays(worker, "2026-09"), 15);
  assert.equal(employedDays(worker, "2026-08"), 0);
  assert.equal(employedDays(worker, "2026-10"), 10);
  assert.equal(employedDays(worker, "2026-11"), 0);
  assert.equal(monthSummary(worker, "2026-09", {}, "2026-11-28").earned, 1500);
});

const call = (method, path, body, token = s.token) => app.call(method, path, { token, body });
const today = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

test("workers are added, marked and paid", async () => {
  const made = await call("POST", "/workers", { name: "Ramesh", payType: "daily", rate: 500, joinedOn: "2026-01-01" });
  assert.equal(made.status, 201);
  const id = made.data.worker._id;
  const mark = (date, status) => call("PUT", "/workers/attendance", { date, marks: [{ worker: id, status }] });

  assert.equal((await mark("2026-09-01", "present")).status, 200);
  assert.equal((await mark("2026-09-02", "half")).status, 200);
  assert.equal((await mark("2026-09-03", "absent")).status, 200);
  assert.equal((await mark("2026-09-03", "present")).status, 200, "marking again replaces");
  assert.equal((await mark("2026-09-02", "")).status, 200, "clearing");
  assert.equal((await mark("2099-01-01", "present")).status, 400);
  assert.equal((await mark("2025-12-31", "present")).status, 400, "before joining");
  assert.equal((await mark("2026-02-30", "present")).status, 400, "no such day");
  assert.equal((await mark("2026-09-04", "holiday")).status, 400);

  const paid = await call("POST", `/workers/${id}/payments`, { amount: 400, forMonth: "2026-09", kind: "advance" });
  assert.equal(paid.status, 201);
  assert.equal((await call("POST", `/workers/${id}/payments`, { amount: -5 })).status, 400);

  const month = (await call("GET", "/workers?month=2026-09")).data;
  const row = month.workers.find((w) => w._id === id);
  assert.deepEqual(row.marks, { "2026-09-01": "present", "2026-09-03": "present" });
  assert.deepEqual([row.summary.earned, row.summary.paid, row.summary.balance], [1000, 400, 600]);
  assert.deepEqual(month.totals, { advance: 400, earned: 1000, paid: 400, balance: 600 });
  assert.deepEqual([row.summary.advance, row.summary.salaryPaid], [400, 0]);

  await call("DELETE", `/workers/${id}/payments/${row.payments[0]._id}`);
  assert.equal((await call("GET", "/workers?month=2026-09")).data.totals.paid, 0);

  // Someone with records is kept, marked as having left
  const removed = await call("DELETE", `/workers/${id}`);
  assert.equal(removed.data.kept, true);
  assert.equal(removed.data.worker.leftOn, today());
  const back = await call("PUT", `/workers/${id}`, { active: true });
  assert.equal(back.data.worker.leftOn, "");

  const unused = (await call("POST", "/workers", { name: "Trial" })).data.worker;
  assert.equal((await call("DELETE", `/workers/${unused._id}`)).data.kept, false);
});

test("another business cannot see or mark these workers", async () => {
  const mine = (await call("POST", "/workers", { name: "Private", joinedOn: "2026-01-01" })).data.worker;
  const other = await app.shop();
  assert.equal((await call("GET", "/workers", undefined, other.token)).data.workers.length, 0);
  const mark = await call("PUT", "/workers/attendance", { date: "2026-09-01", marks: [{ worker: mine._id, status: "present" }] }, other.token);
  assert.equal(mark.status, 404);
  assert.equal((await call("PUT", `/workers/${mine._id}`, { name: "Taken" }, other.token)).status, 404);
  assert.equal((await call("POST", `/workers/${mine._id}/payments`, { amount: 1 }, other.token)).status, 404);
});

test("billing staff cannot see pay; an accountant may only look", async () => {
  const logins = {};
  for (const role of ["staff", "accountant"]) {
    const email = `${role}@pay.example.com`;
    await call("POST", "/team", { name: role, email, password: "counter-pass-1", role });
    logins[role] = (await app.call("POST", "/auth/login", { body: { login: email, password: "counter-pass-1" } })).data;
  }
  assert.equal((await call("GET", "/workers", undefined, logins.staff.token)).status, 403);
  assert.equal(logins.staff.user.can.workers, false);
  assert.equal((await call("GET", "/workers", undefined, logins.accountant.token)).status, 200);
  assert.equal((await call("POST", "/workers", { name: "No" }, logins.accountant.token)).status, 403);
});

test("attendance is part of the backup and the activity log", async () => {
  const backup = (await call("GET", "/data/export")).data;
  assert.ok(backup.workers.length >= 1);
  assert.ok(Array.isArray(backup.attendance));
  await new Promise((r) => setTimeout(r, 200));
  const { entries } = (await call("GET", "/activity")).data;
  assert.ok(entries.some((e) => e.action === "Marked attendance"));
});

test("an advance is kept apart from salary, and can exceed the pay", () => {
  const worker = person({
    payType: "monthly", rate: 3000,
    payments: [
      { forMonth: "2026-09", amount: 2500, kind: "advance" },
      { forMonth: "2026-09", amount: 800, kind: "salary" },
      { forMonth: "2026-08", amount: 999, kind: "advance" },
    ],
  });
  const summary = monthSummary(worker, "2026-09", {}, "2026-11-28");
  assert.deepEqual([summary.advance, summary.salaryPaid, summary.paid, summary.balance], [2500, 800, 3300, -300]);
});

test("each plan covers its own number of workers", async () => {
  const owner = await app.register();
  const as = (method, path, body) => call(method, path, body, owner.token);
  const add = (name) => as("POST", "/workers", { name, joinedOn: "2026-01-01" });
  const mark = (id) => as("PUT", "/workers/attendance", { date: "2026-09-01", marks: [{ worker: id, status: "present" }] });

  // Free: not included
  const refused = await add("Nobody");
  assert.deepEqual([refused.status, refused.data.upgrade], [403, true]);
  assert.equal((await as("GET", "/workers")).data.plan.limit, 0);

  // Starter: two
  await app.givePlan(owner.id, "starter");
  const first = (await add("First")).data.worker._id;
  const second = (await add("Second")).data.worker._id;
  const third = await add("Third");
  assert.equal(third.status, 403);
  assert.match(third.data.message, /covers 2 workers/);
  assert.equal((await mark(first)).status, 200);

  // A place is freed when someone leaves, and they cannot return while it is full
  await mark(second);
  await as("DELETE", `/workers/${second}`);
  const replacement = (await add("Replacement")).data.worker._id;
  assert.equal((await as("PUT", `/workers/${second}`, { active: true })).status, 403);
  assert.equal((await as("POST", `/workers/${second}/payments`, { amount: 10 })).status, 201, "a final settlement");

  // Growth: any number
  await app.givePlan(owner.id, "growth");
  const extra = (await add("Extra")).data.worker._id;
  assert.equal((await add("One more")).status, 201);

  // Back to Starter: the first two stay in use, the rest can only be read
  await app.givePlan(owner.id, "starter");
  const month = (await as("GET", "/workers?month=2026-09")).data;
  const locked = Object.fromEntries(month.workers.map((w) => [w.name, w.locked]));
  assert.deepEqual(locked, { First: false, Replacement: false, Extra: true, "One more": true, Second: false });
  assert.equal((await mark(replacement)).status, 200);
  assert.equal((await mark(extra)).status, 403);
  assert.equal((await as("POST", `/workers/${extra}/payments`, { amount: 10 })).status, 403);
  assert.equal((await as("PUT", `/workers/${extra}`, { rate: 1 })).status, 403);

  // Back to Free: everything stays readable, nothing can be changed
  await app.givePlan(owner.id, "free");
  const kept = (await as("GET", "/workers?month=2026-09")).data;
  assert.equal(kept.workers.length, 5);
  assert.ok(kept.workers.every((w) => w.locked));
  assert.equal((await mark(first)).status, 403);
  assert.equal((await as("POST", `/workers/${first}/payments`, { amount: 10 })).status, 403);
});
