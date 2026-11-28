// What a worker has earned in a month, from the days marked.
//
// Daily wage: each day present is paid, a half day pays half; absent, leave and
// unmarked days are not paid.
// Monthly salary: the salary for the days the person was employed that month,
// less a day's pay for each absence and half for each half day. Leave is paid.
// Either way, hours beyond a shift are paid at the overtime rate, if one is set.
const { round2, sum } = require("./common");

const daysIn = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

// Days of the month between joining and leaving, both included
function employedDays(worker, month) {
  const first = `${month}-01`;
  const last = `${month}-${String(daysIn(month)).padStart(2, "0")}`;
  const from = worker.joinedOn > first ? worker.joinedOn : first;
  const to = worker.leftOn && worker.leftOn < last ? worker.leftOn : last;
  if (from > to) return 0;
  return Number(to.slice(8)) - Number(from.slice(8)) + 1;
}

const minutesOf = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

// One day's hours from the coming and leaving times. Leaving "earlier" than
// coming means the next morning. The unpaid break is taken off once the person
// stayed longer than half a shift.
function dayHours(worker, { inTime, outTime }) {
  const shift = (worker.shiftHours || 8) * 60;
  let minutes = 0;
  if (inTime && outTime) {
    const span = (minutesOf(outTime) - minutesOf(inTime) + 1440) % 1440;
    minutes = span > shift / 2 ? Math.max(0, span - (worker.breakMinutes || 0)) : span;
  }
  return { in: inTime || "", out: outTime || "", minutes, overtime: Math.max(0, Math.round(minutes - shift)) };
}

// Hours, overtime and overtime pay over a list of days from dayHours
function hoursTotals(worker, days) {
  const overtimeMinutes = days.reduce((s, d) => s + d.overtime, 0);
  return {
    timedDays: days.filter((d) => d.minutes > 0).length,
    minutes: days.reduce((s, d) => s + d.minutes, 0),
    overtimeMinutes,
    overtimePay: round2((overtimeMinutes / 60) * (worker.overtimeRate || 0)),
  };
}

// `marks` maps dates (YYYY-MM-DD) in the month to a status, and `times` maps them
// to dayHours. `today` stops a salary being counted for months that have not
// started.
function monthSummary(worker, month, marks, today, times = {}) {
  const counts = { present: 0, half: 0, absent: 0, leave: 0 };
  for (const status of Object.values(marks)) counts[status] += 1;

  const worked = counts.present + counts.half / 2;
  let earned = 0;
  if (worker.payType === "daily") {
    earned = worked * worker.rate;
  } else if (month <= today.slice(0, 7)) {
    const perDay = worker.rate / daysIn(month);
    earned = Math.max(0, (employedDays(worker, month) - counts.absent - counts.half / 2) * perDay);
  }
  const hours = hoursTotals(worker, Object.values(times));
  earned += hours.overtimePay;
  const payments = worker.payments.filter((p) => p.forMonth === month);
  const paid = sum(payments, (p) => p.amount);
  // Money taken before pay day, kept apart from the pay itself
  const advance = sum(payments.filter((p) => p.kind === "advance"), (p) => p.amount);
  return {
    ...counts, ...hours, worked, earned: round2(earned), advance, salaryPaid: round2(paid - advance), paid,
    balance: round2(round2(earned) - paid),
  };
}

module.exports = { daysIn, employedDays, dayHours, hoursTotals, monthSummary };
