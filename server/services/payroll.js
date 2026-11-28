// What a worker has earned in a month, from the days marked.
//
// Daily wage: each day present is paid, a half day pays half; absent, leave and
// unmarked days are not paid.
// Monthly salary: the salary for the days the person was employed that month,
// less a day's pay for each absence and half for each half day. Leave is paid.
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

// `marks` maps dates (YYYY-MM-DD) in the month to a status. `today` stops a
// salary being counted for months that have not started.
function monthSummary(worker, month, marks, today) {
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
  const paid = sum(worker.payments.filter((p) => p.forMonth === month), (p) => p.amount);
  return { ...counts, worked, earned: round2(earned), paid, balance: round2(round2(earned) - paid) };
}

module.exports = { daysIn, employedDays, monthSummary };
