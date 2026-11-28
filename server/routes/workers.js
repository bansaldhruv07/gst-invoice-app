// Workers, their daily attendance and what they have been paid.
const express = require("express");
const router = express.Router();
const Worker = require("../models/Worker");
const Attendance = require("../models/Attendance");
const { protect } = require("../middleware/auth");
const { monthSummary, daysIn } = require("../services/payroll");
const { readMobile } = require("../services/identity");
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

const FIELDS = ["name", "work", "payType", "rate"];

// Copies only the fields present in the request
function fill(worker, body) {
  for (const key of FIELDS) {
    if (body[key] === undefined) continue;
    if (key === "rate" && !(Number(body.rate) >= 0)) throw new BadRequest("Enter the pay as a number");
    worker[key] = body[key];
  }
  if (body.mobile !== undefined) worker.mobile = readMobile(body.mobile);
  if (body.joinedOn !== undefined) worker.joinedOn = readDay(body.joinedOn, "joining date");
}

const publicWorker = (w) => ({
  _id: w._id, name: w.name, mobile: w.mobile, work: w.work, payType: w.payType, rate: w.rate,
  joinedOn: w.joinedOn, leftOn: w.leftOn,
});

// Everyone for one month: their marks, pay earned and payments
router.get("/", route(async (req, res) => {
  const month = isMonth(req.query.month) ? req.query.month : today().slice(0, 7);
  const [workers, records] = await Promise.all([
    Worker.find({ user: req.user._id }).sort({ name: 1 }),
    Attendance.find({
      user: req.user._id,
      date: { $gte: `${month}-01`, $lte: `${month}-31` },
    }).lean(),
  ]);

  const marks = new Map();
  for (const r of records) {
    const key = String(r.worker);
    if (!marks.has(key)) marks.set(key, {});
    marks.get(key)[r.date] = r.status;
  }

  const rows = workers
    .map((w) => {
      const own = marks.get(String(w._id)) || {};
      return {
        ...publicWorker(w),
        marks: own,
        summary: monthSummary(w, month, own, today()),
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
    totals: {
      earned: sum(rows, (w) => w.summary.earned),
      paid: sum(rows, (w) => w.summary.paid),
      balance: sum(rows, (w) => w.summary.balance),
    },
  });
}));

router.post("/", route(async (req, res) => {
  if ((await Worker.countDocuments({ user: req.user._id })) >= MAX_WORKERS) {
    throw new BadRequest(`You can add up to ${MAX_WORKERS} workers`);
  }
  const worker = new Worker({ user: req.user._id, joinedOn: today() });
  fill(worker, req.body);
  await worker.save();
  res.status(201).json({ success: true, worker: publicWorker(worker) });
}));

// body: { date, marks: [{ worker, status }] }; an empty status clears the day
router.put("/attendance", route(async (req, res) => {
  const date = readDay(req.body.date, "date");
  if (date > today()) throw new BadRequest("Attendance cannot be marked for a coming day");
  const { marks } = req.body;
  if (!Array.isArray(marks) || !marks.length || marks.length > MAX_WORKERS) {
    throw new BadRequest("Choose who to mark");
  }

  const mine = await Worker.find({ user: req.user._id, _id: { $in: marks.map((m) => String(m?.worker)) } });
  const byId = new Map(mine.map((w) => [String(w._id), w]));
  const writes = marks.map((mark) => {
    const worker = byId.get(String(mark?.worker));
    if (!worker) throw new BadRequest("Worker not found", 404);
    const key = { user: req.user._id, worker: worker._id, date };
    if (!mark.status) return { deleteOne: { filter: key } };
    if (!Attendance.STATUSES.includes(mark.status)) throw new BadRequest("Choose present, half day, absent or leave");
    if (date < worker.joinedOn) throw new BadRequest(`${worker.name} had not joined on that date`);
    if (worker.leftOn && date > worker.leftOn) throw new BadRequest(`${worker.name} had left by that date`);
    return { updateOne: { filter: key, update: { $set: { status: mark.status } }, upsert: true } };
  });
  await Attendance.bulkWrite(writes);
  res.json({ success: true, date });
}));

router.put("/:id", route(async (req, res) => {
  const worker = await retryOnConflict(async () => {
    const found = await findOwned(Worker, req, req.params.id, "Worker");
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
    payment.deleteOne();
    return found.save();
  });
  res.json({ success: true, worker: publicWorker(worker) });
}));

module.exports = router;
