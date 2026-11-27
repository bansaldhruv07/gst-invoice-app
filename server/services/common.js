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

// Wraps an async route so thrown errors become a clean JSON response
const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    const status =
      err.status || (["ValidationError", "CastError"].includes(err.name) ? 400 : 500);
    if (status === 500) console.error(`${req.method} ${req.originalUrl}:`, err);
    res.status(status).json({
      success: false,
      message:
        status === 500
          ? "Something went wrong. Please try again."
          : err.name === "CastError"
            ? "That record could not be found"
            : err.message,
    });
  }
};

// Finds a record owned by the signed-in user, or fails with 404
async function findOwned(Model, req, id, label) {
  const doc = await Model.findOne({ _id: id, user: req.user._id });
  if (!doc) throw new BadRequest(`${label} not found`, 404);
  return doc;
}

module.exports = { round2, sum, istDate, isDateString, normaliseName, BadRequest, route, findOwned };
