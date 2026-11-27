// Small helpers shared by routes and reports.
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (list, pick) => round2(list.reduce((total, x) => total + (Number(pick(x)) || 0), 0));

// Calendar date in India as YYYY-MM-DD, whatever the server's time zone
const istDate = (value) => new Date(new Date(value).getTime() + IST_OFFSET).toISOString().slice(0, 10);

const isDateString = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

// Used to match invoice lines to products by name
const normaliseName = (name) => String(name || "").trim().replace(/\s+/g, " ").toLowerCase();

class BadRequest extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const CHANGED = "Someone else changed this record just now. Please refresh and try again.";

// Turns any error into a JSON response without leaking internals
function sendError(req, res, err) {
  const status =
    err.status ||
    (err.name === "VersionError" ? 409 : ["ValidationError", "CastError"].includes(err.name) ? 400 : 500);
  if (status >= 500) console.error(`${req.method} ${req.originalUrl}:`, err);
  res.status(status).json({
    success: false,
    message:
      status >= 500
        ? "Something went wrong. Please try again."
        : err.name === "CastError"
          ? "That record could not be found"
          : err.name === "VersionError"
            ? CHANGED
            : err.message,
  });
}

// For money updates: if the record changed between reading and saving, run the
// whole step again on the fresh record. `step` must load what it saves.
async function retryOnConflict(step, attempts = 5) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await step();
    } catch (err) {
      if (err.name !== "VersionError" || attempt >= attempts) throw err;
    }
  }
}

// Runs `task` while no other request holds the same record. The lock is a time
// stamp in the database, so it also works with more than one server, and it
// expires by itself if a server stops halfway.
async function withLock(Model, id, task, holdMs = 15000) {
  const now = new Date();
  const claimed = await Model.updateOne(
    { _id: id, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
    { $set: { lockedUntil: new Date(now.getTime() + holdMs) } },
    { timestamps: false },
  );
  if (!claimed.modifiedCount) {
    throw new BadRequest("This record is being updated. Please try again in a moment.", 409);
  }
  try {
    return await task();
  } finally {
    await Model.updateOne({ _id: id }, { $set: { lockedUntil: null } }, { timestamps: false });
  }
}

// Wraps an async route so thrown errors become a clean JSON response
const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    sendError(req, res, err);
  }
};

// Finds a record owned by the signed-in user, or fails with 404
async function findOwned(Model, req, id, label) {
  const doc = await Model.findOne({ _id: id, user: req.user._id });
  if (!doc) throw new BadRequest(`${label} not found`, 404);
  return doc;
}

module.exports = {
  round2, sum, istDate, isDateString, normaliseName, BadRequest, route, findOwned,
  sendError, retryOnConflict, withLock,
};
