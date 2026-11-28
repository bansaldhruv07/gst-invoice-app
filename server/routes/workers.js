// Workers, their daily attendance and what they have been paid.
const express = require("express");
const router = express.Router();
const Worker = require("../models/Worker");
const Attendance = require("../models/Attendance");
const { protect } = require("../middleware/auth");
const { monthSummary, daysIn, dayHours, hoursTotals } = require("../services/payroll");
const { readMobile } = require("../services/identity");
const { workerPlan, coveredIds, assertRoom, assertCovered } = require("../services/workerPlan");
const {
  route, findOwned, BadRequest, istDate, isDateString, sum, retryOnConflict,
} = require("../services/common");

const MAX_WORKERS = 200;

router.use(protect);

const today = () => istDate(Date.now());
const isDay = (s) => isDateString(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s);
const isMonth = (s) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(String(s || ""));

function readDay(value, label) {
  if (!isDay(value)) throw new BadRequest(`Choose the ${label}`);
  return value;
}

const FIELDS = ["name", "work", "payType", "rate", "shiftHours", "breakMinutes", "overtimeRate"];
const NUMBERS = { rate: "pay", shiftHours: "shift hours", breakMinutes: "break", overtimeRate: "overtime pay" };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DAYS = 366;

// Copies only the fields present in the request
function fill(worker, body) {
  for (const key of FIELDS) {
    if (body[key] === undefined) continue;
    if (NUMBERS[key] && !(Number(body[key]) >= 0)) throw new BadRequest(`Enter the ${NUMBERS[key]} as a number`);
    worker[key] = body[key];
  }
  if (body.mobile !== undefined) worker.mobile = readMobile(body.mobile);
  if (body.joinedOn !== undefined) worker.joinedOn = readDay(body.joinedOn, "joining date");
}

const publicWorker = (w) => ({
  _id: w._id, name: w.name, mobile: w.mobile, work: w.work, payType: w.payType, rate: w.rate,
  joinedOn: w.joinedOn, leftOn: w.leftOn,
  shiftHours: w.shiftHours, breakMinutes: w.breakMinutes, overtimeRate: w.overtimeRate,
});

const hasTimes = (record) => Boolean(record.inTime || record.outTime);

// Each worker's records, keyed by worker id
function byWorker(records) {
  const map = new Map();
  for (const r of records) {
    const key = String(r.worker);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

// Whether the plan allows a worker to be marked, edited or paid
async function lockCheck(userId, plan) {
  const covered = plan.limit > 0 ? await coveredIds(userId, plan.limit) : null;
  return (w) => plan.limit === 0 || Boolean(covered && !w.leftOn && !covered.has(String(w._id)));
}

// Everyone for one month: their marks, pay earned and payments
router.get("/", route(async (req, res) => {
  const month = isMonth(req.query.month) ? req.query.month : today().slice(0, 7);
  const [workers, records, plan] = await Promise.all([
    Worker.find({ user: req.user._id }).sort({ name: 1 }),
    Attendance.find({
      user: req.user._id,
      date: { $gte: `${month}-01`, $lte: `${month}-31` },
    }).lean(),
    workerPlan(req.user._id),
  ]);
  const locked = await lockCheck(req.user._id, plan);
  const found = byWorker(records);

  const rows = workers
    .map((w) => {
      const list = found.get(String(w._id)) || [];
      const marks = Object.fromEntries(list.map((r) => [r.date, r.status]));
      const times = Object.fromEntries(list.filter(hasTimes).map((r) => [r.date, dayHours(w, r)]));
      return {
        ...publicWorker(w),
        locked: locked(w),
        marks,
        times,
        summary: monthSummary(w, month, marks, today(), times),
        payments: w.payments.filter((p) => p.forMonth === month),
      };
    })
    // People who have left stay visible in the months they have records for
    .filter((w) => !w.leftOn || w.leftOn >= `${month}-01` || w.payments.length || Object.keys(w.marks).length);

  res.json({
    success: true,
    month,
    today: today(),
    days: daysIn(month),
    workers: rows,
    plan: { ...plan, used: workers.filter((w) => !w.leftOn).length },
    totals: {
      advance: sum(rows, (w) => w.summary.advance),
      earned: sum(rows, (w) => w.summary.earned),
      paid: sum(rows, (w) => w.summary.paid),
      balance: sum(rows, (w) => w.summary.balance),
    },
  });
}));

// Hours and overtime between two dates, day by day
router.get("/hours", route(async (req, res) => {
  const from = readDay(req.query.from, "first date");
  const to = readDay(req.query.to, "last date");
  if (from > to) throw new BadRequest("The first date is after the last date");
  if ((Date.parse(to) - Date.parse(from)) / 86400000 >= MAX_DAYS) throw new BadRequest("Choose up to one year");

  const [workers, records, plan] = await Promise.all([
    Worker.find({ user: req.user._id }).sort({ name: 1 }),
    Attendance.find({ user: req.user._id, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean(),
    workerPlan(req.user._id),
  ]);
  const locked = await lockCheck(req.user._id, plan);
  const found = byWorker(records);

  const rows = workers
    .map((w) => {
      const days = (found.get(String(w._id)) || []).map((r) => ({ date: r.date, status: r.status, ...dayHours(w, r) }));
      const counts = { present: 0, half: 0, absent: 0, leave: 0 };
      for (const d of days) counts[d.status] += 1;
      return { ...publicWorker(w), locked: locked(w), days, totals: { ...counts, ...hoursTotals(w, days) } };
    })
    .filter((w) => w.days.length || (w.joinedOn <= to && (!w.leftOn || w.leftOn >= from)));

  res.json({ success: true, from, to, plan, workers: rows });
}));

router.post("/", route(async (req, res) => {
  if ((await Worker.countDocuments({ user: req.user._id })) >= MAX_WORKERS) {
    throw new BadRequest(`You can add up to ${MAX_WORKERS} workers`);
  }
  await assertRoom(req.user._id);
  const worker = new Worker({ user: req.user._id, joinedOn: today() });
  fill(worker, req.body);
  await worker.save();
  res.status(201).json({ success: true, worker: publicWorker(worker) });
}));

// body: { date, marks: [{ worker, status?, inTime?, outTime? }] }. An empty
// status clears the day. Noting a time alone marks the person present.
router.put("/attendance", route(async (req, res) => {
  const date = readDay(req.body.date, "date");
  if (date > today()) throw new BadRequest("Attendance cannot be marked for a coming day");
  const { marks } = req.body;
  if (!Array.isArray(marks) || !marks.length || marks.length > MAX_WORKERS) {
    throw new BadRequest("Choose who to mark");
  }

  const ids = marks.map((m) => String(m?.worker));
  const [mine, existing] = await Promise.all([
    Worker.find({ user: req.user._id, _id: { $in: ids } }),
    Attendance.find({ user: req.user._id, date, worker: { $in: ids } }).lean(),
  ]);
  const byId = new Map(mine.map((w) => [String(w._id), w]));
  const saved = new Map(existing.map((r) => [String(r.worker), r]));

  const writes = marks.flatMap((mark) => {
    const worker = byId.get(String(mark?.worker));
    if (!worker) throw new BadRequest("Worker not found", 404);
    const key = { user: req.user._id, worker: worker._id, date };
    const timed = mark.inTime !== undefined || mark.outTime !== undefined;
    if (mark.status === "" || (mark.status === undefined && !timed)) return [{ deleteOne: { filter: key } }];
    if (mark.status !== undefined && !Attendance.STATUSES.includes(mark.status)) {
      throw new BadRequest("Choose present, half day, absent or leave");
    }
    if (date < worker.joinedOn) throw new BadRequest(`${worker.name} had not joined on that date`);
    if (worker.leftOn && date > worker.leftOn) throw new BadRequest(`${worker.name} had left by that date`);

    const before = saved.get(String(worker._id));
    const set = {};
    if (timed) {
      for (const field of ["inTime", "outTime"]) {
        const value = mark[field];
        if (value === undefined) continue;
        if (value !== "" && !TIME.test(value)) throw new BadRequest("Enter the time as hours and minutes");
        set[field] = value;
      }
      const inTime = set.inTime ?? before?.inTime ?? "";
      const outTime = set.outTime ?? before?.outTime ?? "";
      if (outTime && !inTime) throw new BadRequest(`Enter the time ${worker.name} came first`);
      // Clearing times on a day with nothing marked leaves it unmarked
      if (!inTime && !before && mark.status === undefined) return [];
      // Someone with a coming time was not absent
      if (mark.status === undefined && set.inTime && (!before || ["absent", "leave"].includes(before.status))) {
        set.status = "present";
      }
    }
    if (mark.status !== undefined) {
      set.status = mark.status;
      if (["absent", "leave"].includes(mark.status)) Object.assign(set, { inTime: "", outTime: "" });
    }
    const update = { $set: set };
    if (!set.status) update.$setOnInsert = { status: "present" };
    return [{ updateOne: { filter: key, update, upsert: true } }];
  });

  await assertCovered(req.user._id, marks.map((m) => byId.get(String(m.worker))));
  if (writes.length) await Attendance.bulkWrite(writes);
  res.json({ success: true, date });
}));

router.put("/:id", route(async (req, res) => {
  const worker = await retryOnConflict(async () => {
    const found = await findOwned(Worker, req, req.params.id, "Worker");
    // Taking someone back needs a free place; other changes need them covered
    if (req.body.active === true && found.leftOn) await assertRoom(req.user._id);
    else await assertCovered(req.user._id, [found]);
    fill(found, req.body);
    if (req.body.active === true) found.leftOn = "";
    if (req.body.active === false) found.leftOn = found.leftOn || today();
    return found.save();
  });
  res.json({ success: true, worker: publicWorker(worker) });
}));

// Someone with attendance or payments is marked as having left, so the records stay
router.delete("/:id", route(async (req, res) => {
  const worker = await findOwned(Worker, req, req.params.id, "Worker");
  const used = worker.payments.length || (await Attendance.exists({ user: req.user._id, worker: worker._id }));
  if (used) {
    worker.leftOn = worker.leftOn || today();
    await worker.save();
  } else {
    await worker.deleteOne();
  }
  res.json({ success: true, kept: Boolean(used), worker: publicWorker(worker) });
}));

router.post("/:id/payments", route(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!(amount > 0) || amount > 10000000) throw new BadRequest("Enter the amount paid");
  const date = readDay(req.body.date || today(), "payment date");
  const forMonth = req.body.forMonth || date.slice(0, 7);
  if (!isMonth(forMonth)) throw new BadRequest("Choose the month it is for");

  const worker = await retryOnConflict(async () => {
    const found = await findOwned(Worker, req, req.params.id, "Worker");
    await assertCovered(req.user._id, [found]);
    if (found.payments.length >= 2000) throw new BadRequest("This worker has too many payments recorded");
    found.payments.push({ date, forMonth, amount, kind: req.body.kind || "salary", note: req.body.note || "" });
    return found.save();
  });
  res.status(201).json({ success: true, worker: publicWorker(worker) });
}));

router.delete("/:id/payments/:paymentId", route(async (req, res) => {
  const worker = await retryOnConflict(async () => {
    const found = await findOwned(Worker, req, req.params.id, "Worker");
    const payment = found.payments.id(req.params.paymentId);
    if (!payment) throw new BadRequest("Payment not found", 404);
    await assertCovered(req.user._id, [found]);
    payment.deleteOne();
    return found.save();
  });
  res.json({ success: true, worker: publicWorker(worker) });
}));

module.exports = router;
