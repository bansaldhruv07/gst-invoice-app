// Coming and leaving times, hours worked, overtime and the hours report.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { start } = require("./helpers");
const { dayHours, hoursTotals, monthSummary } = require("../services/payroll");

let app;
let s;
before(async () => {
  app = await start();
  s = await app.shop();
});
after(() => app.stop());

const shift = { shiftHours: 8, breakMinutes: 60, overtimeRate: 100 };
const day = (inTime, outTime, worker = shift) => dayHours(worker, { inTime, outTime });

test("hours leave out the break, and time beyond the shift is overtime", () => {
  assert.deepEqual(day("09:00", "18:00"), { in: "09:00", out: "18:00", minutes: 480, overtime: 0 });
  assert.deepEqual([day("09:00", "20:30").minutes, day("09:00", "20:30").overtime], [630, 150]);
  assert.equal(day("09:00", "12:00").minutes, 180, "no break on a short visit");
  assert.equal(day("09:00", "").minutes, 0, "still at work");
  assert.equal(day("09:00", "09:00").minutes, 0);
  const night = day("22:00", "08:00");
  assert.deepEqual([night.minutes, night.overtime], [540, 60], "leaving the next morning");
});

test("overtime is paid at the rate set, on either kind of pay", () => {
  const days = [day("09:00", "20:30"), day("09:00", "19:00")];
  assert.deepEqual(hoursTotals(shift, days), { timedDays: 2, minutes: 1170, overtimeMinutes: 210, overtimePay: 350 });
  assert.equal(hoursTotals({ ...shift, overtimeRate: 0 }, days).overtimePay, 0);

  const times = { "2026-09-01": days[0], "2026-09-02": days[1] };
  const marks = { "2026-09-01": "present", "2026-09-02": "present" };
  const person = { joinedOn: "2026-01-01", leftOn: "", payments: [], ...shift };
  const daily = monthSummary({ ...person, payType: "daily", rate: 600 }, "2026-09", marks, "2026-11-28", times);
  assert.deepEqual([daily.earned, daily.overtimePay, daily.minutes], [1550, 350, 1170]);
  const salaried = monthSummary({ ...person, payType: "monthly", rate: 18000 }, "2026-09", marks, "2026-11-28", times);
  assert.equal(salaried.earned, 18350);
});

const call = (method, path, body, token = s.token) => app.call(method, path, { token, body });

test("times are noted, reported over a duration and cleared", async () => {
  const worker = (await call("POST", "/workers", {
    name: "Ramesh", payType: "daily", rate: 600, joinedOn: "2026-01-01", shiftHours: 8, breakMinutes: 60, overtimeRate: 100,
  })).data.worker;
  assert.deepEqual([worker.shiftHours, worker.breakMinutes, worker.overtimeRate], [8, 60, 100]);
  const mark = (date, body) => call("PUT", "/workers/attendance", { date, marks: [{ worker: worker._id, ...body }] });
  const month = async () => (await call("GET", "/workers?month=2026-09")).data.workers.find((w) => w._id === worker._id);

  // Coming in marks the person present
  assert.equal((await mark("2026-09-01", { inTime: "09:00" })).status, 200);
  assert.equal((await month()).marks["2026-09-01"], "present");
  assert.equal((await mark("2026-09-01", { outTime: "20:30" })).status, 200);
  let row = await month();
  assert.deepEqual(row.times["2026-09-01"], { in: "09:00", out: "20:30", minutes: 630, overtime: 150 });
  assert.deepEqual([row.summary.minutes, row.summary.overtimePay, row.summary.earned], [630, 250, 850]);

  // A half day stays a half day when times are added
  await mark("2026-09-02", { status: "half" });
  await mark("2026-09-02", { inTime: "09:00", outTime: "13:00" });
  assert.equal((await month()).marks["2026-09-02"], "half");
  // Changing the mark keeps the times; absent or leave removes them
  await mark("2026-09-02", { status: "present" });
  assert.equal((await month()).times["2026-09-02"].minutes, 240);
  await mark("2026-09-02", { status: "absent" });
  assert.equal((await month()).times["2026-09-02"], undefined);
  // Someone who then arrives was not absent
  await mark("2026-09-02", { inTime: "11:00" });
  assert.equal((await month()).marks["2026-09-02"], "present");

  assert.equal((await mark("2026-09-03", { outTime: "18:00" })).status, 400, "left without coming");
  assert.equal((await mark("2026-09-03", { inTime: "25:00" })).status, 400);
  assert.equal((await mark("2026-09-03", { inTime: "9am" })).status, 400);
  assert.equal((await mark("2026-09-03", { inTime: "" })).status, 200);
  assert.equal((await month()).marks["2026-09-03"], undefined, "clearing nothing marks nothing");

  const report = (await call("GET", "/workers/hours?from=2026-09-01&to=2026-09-30")).data;
  const mine = report.workers.find((w) => w._id === worker._id);
  assert.deepEqual(mine.days.map((d) => [d.date, d.minutes]), [["2026-09-01", 630], ["2026-09-02", 0]]);
  assert.deepEqual(
    [mine.totals.minutes, mine.totals.overtimeMinutes, mine.totals.overtimePay, mine.totals.timedDays, mine.totals.present],
    [630, 150, 250, 1, 2],
  );
  const later = (await call("GET", "/workers/hours?from=2026-09-02&to=2026-09-02")).data.workers;
  assert.equal(later.find((w) => w._id === worker._id).totals.minutes, 0);

  // Clearing the mark clears the day
  await mark("2026-09-01", { status: "" });
  assert.equal((await month()).summary.minutes, 0);
});

test("the duration and the shift must make sense", async () => {
  const hours = (query) => call("GET", `/workers/hours?${query}`);
  assert.equal((await hours("from=2026-09-10&to=2026-09-01")).status, 400);
  assert.equal((await hours("from=2024-01-01&to=2026-09-01")).status, 400);
  assert.equal((await hours("from=2026-09-01")).status, 400);
  assert.equal((await call("POST", "/workers", { name: "X", shiftHours: 30 })).status, 400);
  assert.equal((await call("POST", "/workers", { name: "X", overtimeRate: -1 })).status, 400);
});

test("times follow the plan, and another business sees none of them", async () => {
  const mine = (await call("POST", "/workers", { name: "Mine", joinedOn: "2026-01-01" })).data.worker;
  await call("PUT", "/workers/attendance", { date: "2026-09-05", marks: [{ worker: mine._id, inTime: "09:00" }] });
  const other = await app.shop();
  assert.equal((await call("GET", "/workers/hours?from=2026-09-01&to=2026-09-30", undefined, other.token)).data.workers.length, 0);

  await app.givePlan(s.owner.id, "free");
  const refused = await call("PUT", "/workers/attendance", { date: "2026-09-05", marks: [{ worker: mine._id, outTime: "17:00" }] });
  assert.equal(refused.status, 403);
  const kept = (await call("GET", "/workers/hours?from=2026-09-01&to=2026-09-30")).data.workers;
  assert.ok(kept.some((w) => w._id === mine._id && w.days.length === 1), "records can still be read");
  await app.givePlan(s.owner.id, "growth");
});
