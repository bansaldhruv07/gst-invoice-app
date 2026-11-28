// Hours worked and overtime between any two dates.
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Clock, Timer, IndianRupee, FileSpreadsheet } from "lucide-react";
import api from "../../api/axios";
import Sheet from "../mobile/Sheet";
import { Spinner, EmptyState, Stats } from "../ui";
import { STATUSES } from "./statuses";
import { formatHours, decimalHours, clock, leftNextDay } from "./hours";
import { money, rupees, shortDate } from "../../lib/format";
import { downloadCsv } from "../../lib/csv";
import { todayISO } from "../../lib/period";

const LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));

const iso = (date) => date.toISOString().slice(0, 10);
const plus = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};

const PRESETS = [["week", "This week"], ["last-week", "Last week"], ["month", "This month"], ["last-month", "Last month"], ["custom", "Custom dates"]];

function rangeOf(preset) {
  const today = todayISO();
  const monday = plus(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const first = `${today.slice(0, 7)}-01`;
  if (preset === "week") return { from: monday, to: today };
  if (preset === "last-week") return { from: plus(monday, -7), to: plus(monday, -1) };
  if (preset === "last-month") {
    const end = plus(first, -1);
    return { from: `${end.slice(0, 7)}-01`, to: end };
  }
  return { from: first, to: today };
}

const average = (t) => (t.timedDays ? Math.round(t.minutes / t.timedDays) : 0);

function DaySheet({ worker, onClose }) {
  const { totals } = worker;
  return (
    <Sheet title={`Hours of ${worker.name}`} onClose={onClose} wide>
      <p className="px-4 py-2.5 text-sm text-slate-600 border-b border-slate-200">
        <strong>{formatHours(totals.minutes)}</strong> over {totals.timedDays} {totals.timedDays === 1 ? "day" : "days"} ·{" "}
        {formatHours(totals.overtimeMinutes)} overtime
      </p>
      {worker.days.length === 0 ? (
        <EmptyState title="Nothing marked between these dates" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {worker.days.map((d) => (
            <li key={d.date} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{shortDate(d.date)}</span>
                <span className="block text-xs text-slate-500">
                  {d.in ? `${clock(d.in)} to ${clock(d.out)}${leftNextDay(d) ? " next day" : ""}` : LABEL[d.status]}
                </span>
              </span>
              {d.overtime > 0 && <span className="badge bg-amber-50 text-amber-800 border-amber-200">{formatHours(d.overtime)} OT</span>}
              <span className="w-16 text-right font-bold tabular">{d.minutes ? formatHours(d.minutes) : "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

export default function HoursReport() {
  const [preset, setPreset] = useState("month");
  const [range, setRange] = useState(() => rangeOf("month"));
  const [result, setResult] = useState({ key: "" });
  const [opened, setOpened] = useState(null);
  const key = `${range.from}|${range.to}`;

  useEffect(() => {
    let current = true;
    const [from, to] = key.split("|");
    api.get("/workers/hours", { params: { from, to } })
      .then(({ data }) => current && setResult({ key, data }))
      .catch((err) => {
        if (!current) return;
        toast.error(err.response?.data?.message || "Could not load the hours");
        setResult({ key, data: { workers: [] } });
      });
    return () => {
      current = false;
    };
  }, [key]);

  const choose = (value) => {
    setPreset(value);
    if (value !== "custom") setRange(rangeOf(value));
  };

  const ready = result.key === key;
  const workers = ready ? result.data.workers : [];
  const total = (field) => workers.reduce((s, w) => s + w.totals[field], 0);
  const file = `hours-${range.from}-to-${range.to}`;

  const summaryCsv = () =>
    downloadCsv(`${file}.csv`, [
      ["Name", "Days timed", "Hours", "Overtime hours", "Overtime pay", "Present", "Half days", "Absent", "Leave"],
      ...workers.map((w) => [
        w.name, w.totals.timedDays, decimalHours(w.totals.minutes), decimalHours(w.totals.overtimeMinutes),
        w.totals.overtimePay, w.totals.present, w.totals.half, w.totals.absent, w.totals.leave,
      ]),
    ]);
  const dailyCsv = () =>
    downloadCsv(`${file}-day-by-day.csv`, [
      ["Date", "Name", "Marked as", "Came", "Left", "Hours", "Overtime hours"],
      ...workers.flatMap((w) => w.days.map((d) => [
        d.date, w.name, LABEL[d.status], d.in, d.out, decimalHours(d.minutes), decimalHours(d.overtime),
      ])).sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])),
    ]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Duration" value={preset} onChange={(e) => choose(e.target.value)} className="input w-auto">
          {PRESETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {preset === "custom" ? (
          <>
            <input type="date" aria-label="Hours from" value={range.from} max={range.to}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className="input w-auto" />
            <input type="date" aria-label="Hours to" value={range.to} min={range.from}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className="input w-auto" />
          </>
        ) : (
          <span className="text-sm text-slate-500">{shortDate(range.from)} to {shortDate(range.to)}</span>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={summaryCsv} disabled={!workers.length} className="btn-secondary"><FileSpreadsheet className="w-4 h-4" /> Totals CSV</button>
          <button onClick={dailyCsv} disabled={!workers.some((w) => w.days.length)} className="btn-secondary"><FileSpreadsheet className="w-4 h-4" /> Day by day CSV</button>
        </div>
      </div>

      {!ready ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : workers.length === 0 ? (
        <section className="card"><EmptyState title="No workers between these dates" /></section>
      ) : (
        <>
          <Stats items={[
            { label: "Hours worked", value: formatHours(total("minutes")), icon: Clock },
            { label: "Overtime", value: formatHours(total("overtimeMinutes")), icon: Timer, tone: "amber" },
            { label: "Overtime pay", value: rupees(total("overtimePay")), icon: IndianRupee, tone: "green" },
          ]} />
          <section className="card overflow-hidden">
            <ul className="md:hidden divide-y divide-slate-100">
              {workers.map((w) => (
                <li key={w._id}>
                  <button type="button" onClick={() => setOpened(w)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{w.name}</span>
                      <span className="block text-xs text-slate-500">
                        {w.totals.timedDays} days · {formatHours(w.totals.overtimeMinutes)} overtime
                        {w.totals.overtimePay > 0 && ` · ${money(w.totals.overtimePay)}`}
                      </span>
                    </span>
                    <span className="text-sm font-bold tabular">{formatHours(w.totals.minutes)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Worker</th>
                    <th className="th text-right">Days timed</th>
                    <th className="th text-right">Total hours</th>
                    <th className="th text-right">Average a day</th>
                    <th className="th text-right">Overtime</th>
                    <th className="th text-right">Overtime pay</th>
                    <th className="th text-right">Absent</th>
                    <th className="th text-right">Leave</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((w) => (
                    <tr key={w._id}>
                      <td className="td">
                        <button type="button" onClick={() => setOpened(w)} className="font-bold text-brand-700 hover:underline">{w.name}</button>
                        <span className="block text-xs text-slate-500">{formatHours(w.shiftHours * 60)} shift</span>
                      </td>
                      <td className="td text-right tabular">{w.totals.timedDays}</td>
                      <td className="td text-right tabular font-bold">{formatHours(w.totals.minutes)}</td>
                      <td className="td text-right tabular">{average(w.totals) ? formatHours(average(w.totals)) : "—"}</td>
                      <td className="td text-right tabular">{formatHours(w.totals.overtimeMinutes)}</td>
                      <td className="td text-right tabular">{w.overtimeRate ? money(w.totals.overtimePay) : "No rate set"}</td>
                      <td className="td text-right tabular">{w.totals.absent}</td>
                      <td className="td text-right tabular">{w.totals.leave}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="text-xs text-slate-500">
            Hours come from the came and left times, less the unpaid break. Overtime is the time beyond each worker&apos;s shift.
            Tap a name to see it day by day.
          </p>
        </>
      )}
      {opened && <DaySheet worker={opened} onClose={() => setOpened(null)} />}
    </>
  );
}
