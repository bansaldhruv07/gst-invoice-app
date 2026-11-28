// How many workers a plan covers, and which ones. Records are never removed when
// a plan ends or shrinks: they can still be read, but only the covered workers
// can be marked, edited or paid.
const Worker = require("../models/Worker");
const { getUserPlan } = require("../middleware/checkPlan");
const { BadRequest } = require("./common");

class PlanLimit extends BadRequest {
  constructor(message) {
    super(message, 403);
    this.upgrade = true;
  }
}

// { name, limit }; a limit of -1 means any number, 0 means attendance is not included
async function workerPlan(userId) {
  const { plan } = await getUserPlan(userId);
  return { name: plan?.displayName || "Free", limit: plan?.limits?.workers ?? 0 };
}

// Workers still employed count towards the limit, the earliest added first
async function coveredIds(userId, limit) {
  const query = Worker.find({ user: userId, leftOn: "" }).sort({ createdAt: 1, _id: 1 }).select("_id");
  const list = await (limit > 0 ? query.limit(limit) : query).lean();
  return new Set(list.map((w) => String(w._id)));
}

const notIncluded = (plan) =>
  new PlanLimit(`Attendance is not part of the ${plan.name} plan. Upgrade to Starter or Growth.`);

const full = (plan) =>
  new PlanLimit(`The ${plan.name} plan covers ${plan.limit} workers. Upgrade to Growth for any number.`);

// Before adding a worker, or taking one back
async function assertRoom(userId) {
  const plan = await workerPlan(userId);
  if (plan.limit === 0) throw notIncluded(plan);
  if (plan.limit > 0 && (await Worker.countDocuments({ user: userId, leftOn: "" })) >= plan.limit) {
    throw full(plan);
  }
}

// Before changing anything about these workers. People who have left may still
// be settled with on any plan that includes attendance.
async function assertCovered(userId, workers) {
  const plan = await workerPlan(userId);
  if (plan.limit === 0) throw notIncluded(plan);
  if (plan.limit < 0) return;
  const covered = await coveredIds(userId, plan.limit);
  if (workers.some((w) => !w.leftOn && !covered.has(String(w._id)))) throw full(plan);
}

module.exports = { workerPlan, coveredIds, assertRoom, assertCovered };
