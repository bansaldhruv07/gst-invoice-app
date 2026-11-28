// Workers: who came in each day, what they earned this month and what was paid.
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ChevronLeft, ChevronRight, Plus, Pencil, IndianRupee, FileSpreadsheet, CheckCheck,
  Wallet, HandCoins, Hourglass, Lock,
} from "lucide-react";
import api from "../api/axios";
import { Spinner, EmptyState, Stats } from "../components/ui";
import WorkerForm from "../components/attendance/WorkerForm";
import WorkerPayForm from "../components/attendance/WorkerPayForm";
import WorkerSheet from "../components/attendance/WorkerSheet";
import { STATUSES, monthName, shiftMonth } from "../components/attendance/statuses";
import TimeRow from "../components/attendance/TimeRow";
import HoursReport from "../components/attendance/HoursReport";
import { formatHours, decimalHours } from "../components/attendance/hours";
import { money, rupees, shortDate } from "../lib/format";
import { downloadCsv } from "../lib/csv";
import { daysMarked, advanceDetails } from "../lib/workerMonth";
import { todayISO } from "../lib/period";
import { useCan } from "../context/AuthContext";

const failure = (err, fallback) => toast.error(err.response?.data?.message || fallback);

const payLabel = (w) => `${money(w.rate)} a ${w.payType === "daily" ? "day" : "month"}`;

const onDate = (w, date) => w.joinedOn <= date && (!w.leftOn || w.leftOn >= date);

export default function Attendance() {
  const can = useCan();
  const editable = can("editWorkers");
  const [tab, setTab] = useState("day");
  const [date, setDate] = useState(todayISO);
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [data, setData] = useState(null);
  const [panel, setPanel] = useState(null);

  // The day view always loads the month of the chosen date
  const wanted = tab === "month" ? month : date.slice(0, 7);

  const load = useCallback(
    () =>
      api.get("/workers", { params: { month: wanted } })
        .then((res) => setData(res.data))
        .catch((err) => {
          failure(err, "Could not load attendance");
          setData({ month: wanted, workers: [], totals: {}, days: 30, today: todayISO(), failed: true });
        }),
    [wanted],
  );
  useEffect(() => {
    load();
  }, [load]);

  const ready = data?.month === wanted;
  const workers = ready ? data.workers : [];
  const present = workers.filter((w) => onDate(w, date));
  // What the plan covers: none, a few, or any number of workers
  const plan = ready ? data.plan : null;
  const excluded = plan?.limit === 0;
  const full = plan?.limit > 0 && plan.used >= plan.limit;
  const canAdd = editable && !excluded && !full;
  const advanceFor = (worker) => setPanel({ kind: "pay", payKind: "advance", worker, date: tab === "day" ? date : "" });
  const salaryFor = (worker) => setPanel({ kind: "pay", payKind: "salary", worker });

  // Shown at once, then saved; a failure reloads what the server holds
  const mark = async (list, status) => {
    const ids = new Set(list.map((w) => w._id));
    setData((d) => ({
      ...d,
      workers: d.workers.map((w) => {
        if (!ids.has(w._id)) return w;
        const marks = { ...w.marks };
        if (status) marks[date] = status;
        else delete marks[date];
        return { ...w, marks };
      }),
    }));
    try {
      await api.put("/workers/attendance", { date, marks: list.map((w) => ({ worker: w._id, status })) });
    } catch (err) {
      failure(err, "Could not save the attendance");
    }
    load();
  };

  // Saves a coming or leaving time, then shows what the server worked out
  const saveTimes = async (w, times) => {
    try {
      await api.put("/workers/attendance", { date, marks: [{ worker: w._id, ...times }] });
    } catch (err) {
      failure(err, "Could not save the time");
    }
    load();
  };

  const unmarked = present.filter((w) => !w.marks[date] && !w.locked);
  const counts = STATUSES.map((s) => [s, present.filter((w) => w.marks[date] === s.id).length]);
  const notMarked = present.filter((w) => !w.marks[date]).length;

  const exportCsv = () =>
    downloadCsv(`attendance-${month}.csv`, [
      [
        "Name", "Work", "Pay type", "Rate", "Present", "Half days", "Absent", "Leave",
        "Absent on (day)", "Half day on (day)", "Leave on (day)",
        "Hours", "Overtime hours", "Overtime pay",
        "Earned", "Advance taken", "Advance details", "Salary paid", "Balance",
      ],
      ...workers.map((w) => [
        w.name, w.work, w.payType === "daily" ? "Daily wage" : "Monthly salary", w.rate,
        w.summary.present, w.summary.half, w.summary.absent, w.summary.leave,
        daysMarked(w, "absent"), daysMarked(w, "half"), daysMarked(w, "leave"),
        decimalHours(w.summary.minutes), decimalHours(w.summary.overtimeMinutes), w.summary.overtimePay,
        w.summary.earned, w.summary.advance, advanceDetails(w), w.summary.salaryPaid, w.summary.balance,
      ]),
    ]);

  const opened = panel?.id && workers.find((w) => w._id === panel.id);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="View" className="flex rounded-xl border border-slate-200 bg-white p-1">
          {[["day", "Daily"], ["month", "Monthly pay"], ["hours", "Hours"]].map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`h-8 px-3.5 rounded-lg text-sm font-bold transition ${tab === key ? "bg-brand-600 text-white shadow-glow" : "text-slate-600 hover:text-brand-700"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "day" && (
          <input type="date" aria-label="Attendance date" value={date} max={data?.today || todayISO()}
            onChange={(e) => e.target.value && setDate(e.target.value)} className="input w-auto" />
        )}
        {tab === "month" && (
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1">
            <button onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month" className="p-2 text-slate-600 hover:text-brand-700">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm font-bold">{monthName(month)}</span>
            <button onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={month >= todayISO().slice(0, 7)}
              aria-label="Next month" className="p-2 text-slate-600 hover:text-brand-700 disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="ml-auto flex gap-2">
          {tab === "month" && (
            <button onClick={exportCsv} disabled={!workers.length} className="btn-secondary">
              <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
          {canAdd && (
            <button onClick={() => setPanel({ kind: "form", worker: null })} className="btn-primary">
              <Plus className="w-4 h-4" /> Add worker
            </button>
          )}
        </div>
      </div>

      {plan && plan.limit >= 0 && !(excluded && !workers.length) && (
        <div role="note" className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
          excluded || full ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-600"
        }`}>
          <Lock className="w-4 h-4 flex-shrink-0" />
          <p className="flex-1 min-w-[14rem]">
            {excluded
              ? `Attendance is not part of the ${plan.name} plan. Your records are kept; upgrade to mark attendance and record money.`
              : `${plan.name} plan: ${Math.min(plan.used, plan.limit)} of ${plan.limit} workers used.${
                  plan.used > plan.limit ? " The others can be viewed but not changed." : " Growth covers any number."
                }`}
          </p>
          {can("plans") && <Link to="/pricing" className="btn-primary btn-sm">Upgrade</Link>}
        </div>
      )}

      {!ready ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : workers.length === 0 ? (
        <section className="card">
          {excluded && !data.failed ? (
            <EmptyState
              title={`Attendance is not part of the ${plan.name} plan`}
              hint="Starter (₹499 a month) covers 2 workers. Growth covers any number."
              action={can("plans") && <Link to="/pricing" className="btn-primary">See plans</Link>}
            />
          ) : (
            <EmptyState
              title={data.failed ? "Attendance could not be loaded" : "No workers yet"}
              hint={data.failed ? "Check your internet connection and try again." : "Add the people who work for you, then mark who came in each day."}
              action={
                data.failed ? <button onClick={load} className="btn-secondary">Try again</button>
                  : canAdd && <button onClick={() => setPanel({ kind: "form", worker: null })} className="btn-primary"><Plus className="w-4 h-4" /> Add worker</button>
              }
            />
          )}
        </section>
      ) : tab === "hours" ? (
        <HoursReport />
      ) : tab === "day" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {counts.map(([s, n]) => (
              <span key={s.id} className={`badge ${s.soft}`}>{s.label}: {n}</span>
            ))}
            <span className="badge bg-slate-100 text-slate-600 border-slate-200">Not marked: {notMarked}</span>
            {editable && unmarked.length > 0 && (
              <button onClick={() => mark(unmarked, "present")} className="btn-secondary btn-sm ml-auto">
                <CheckCheck className="w-4 h-4" /> Mark the rest present
              </button>
            )}
          </div>
          <section className="card overflow-hidden">
            {present.length === 0 ? (
              <EmptyState title={`No one was working on ${shortDate(date)}`} hint="Check each worker's joining date." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {present.map((w) => (
                  <li key={w._id} className="px-4 py-3 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <div className="flex items-center gap-3 sm:mr-auto min-w-0 sm:flex-1">
                      <button type="button" onClick={() => setPanel({ kind: "detail", id: w._id })} className="min-w-0 mr-auto text-left">
                        <span className="flex items-center gap-1.5 text-[15px] font-bold text-slate-900">
                          <span className="truncate">{w.name}</span>
                          {w.locked && <Lock aria-label="Not covered by your plan" className="w-3.5 h-3.5 flex-shrink-0 text-amber-700" />}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {[w.work, payLabel(w), w.summary.advance > 0 && `advance ${money(w.summary.advance)}`].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                      {editable && !w.locked && (
                        <button type="button" onClick={() => advanceFor(w)} aria-label={`Money taken by ${w.name}`} className="btn-secondary btn-sm flex-shrink-0">
                          <HandCoins className="w-3.5 h-3.5" /> Money taken
                        </button>
                      )}
                    </div>
                    <div role="group" aria-label={`Attendance of ${w.name}`} className="grid grid-cols-4 gap-1.5 sm:w-[22rem]">
                      {STATUSES.map((s) => {
                        const on = w.marks[date] === s.id;
                        return (
                          <button key={s.id} type="button" aria-pressed={on} disabled={!editable || w.locked}
                            onClick={() => mark([w], on ? "" : s.id)}
                            className={`h-10 rounded-lg border text-xs font-bold transition active:scale-95 ${
                              on ? s.solid : "border-slate-200 bg-white text-slate-600 enabled:hover:border-brand-300"
                            }`}>
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                    </div>
                    <TimeRow worker={w} day={date} today={date === (data.today || todayISO())} disabled={!editable || w.locked}
                      onSave={(times) => saveTimes(w, times)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <>
          <Stats items={[
            { label: "Earned this month", value: rupees(data.totals.earned), icon: Wallet },
            { label: "Advance taken", value: rupees(data.totals.advance), icon: HandCoins, tone: "green" },
            { label: "Still to pay", value: rupees(data.totals.balance), icon: Hourglass, tone: "amber" },
          ]} />
          <section className="card overflow-hidden">
            <ul className="md:hidden divide-y divide-slate-100">
              {workers.map((w) => (
                <li key={w._id}>
                  <button type="button" onClick={() => setPanel({ kind: "detail", id: w._id })} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{w.name}</span>
                      <span className="block text-xs text-slate-500">
                        {w.summary.worked} {w.summary.worked === 1 ? "day" : "days"} worked · {w.summary.absent} absent · {w.summary.leave} leave
                      </span>
                      {w.summary.minutes > 0 && (
                        <span className="block text-xs text-slate-500">
                          {formatHours(w.summary.minutes)} worked · {formatHours(w.summary.overtimeMinutes)} overtime
                        </span>
                      )}
                      <span className="block text-xs text-slate-500">
                        Advance {money(w.summary.advance)} · salary paid {money(w.summary.salaryPaid)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className={`block text-sm font-bold tabular ${w.summary.balance < 0 ? "text-red-700" : ""}`}>
                        {money(Math.abs(w.summary.balance))}
                      </span>
                      <span className="block text-xs text-slate-500">{w.summary.balance < 0 ? "taken extra" : "to pay"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Worker</th>
                    <th className="th text-right">Present</th>
                    <th className="th text-right">Half</th>
                    <th className="th text-right">Absent</th>
                    <th className="th text-right">Leave</th>
                    <th className="th text-right">Earned</th>
                    <th className="th text-right">Advance</th>
                    <th className="th text-right">Salary paid</th>
                    <th className="th text-right">To pay</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((w) => (
                    <tr key={w._id}>
                      <td className="td">
                        <button type="button" onClick={() => setPanel({ kind: "detail", id: w._id })} className="text-left font-bold text-brand-700 hover:underline">
                          {w.name}
                        </button>
                        <span className="block text-xs text-slate-500">{payLabel(w)}</span>
                        {w.summary.minutes > 0 && (
                          <span className="block text-xs text-slate-500">
                            {formatHours(w.summary.minutes)} worked
                            {w.summary.overtimeMinutes > 0 && ` · ${formatHours(w.summary.overtimeMinutes)} overtime`}
                          </span>
                        )}
                      </td>
                      <td className="td text-right tabular">{w.summary.present}</td>
                      {["half", "absent", "leave"].map((status) => (
                        <td key={status} className="td text-right tabular">
                          {w.summary[status]}
                          {w.summary[status] > 0 && (
                            <span title="Days of the month" className="block max-w-[8rem] truncate text-[11px] text-slate-500">
                              on {daysMarked(w, status)}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="td text-right tabular whitespace-nowrap">{money(w.summary.earned)}</td>
                      <td className="td text-right tabular whitespace-nowrap">{money(w.summary.advance)}</td>
                      <td className="td text-right tabular whitespace-nowrap">{money(w.summary.salaryPaid)}</td>
                      <td className={`td text-right tabular whitespace-nowrap font-bold ${w.summary.balance < 0 ? "text-red-700" : ""}`}>
                        {money(w.summary.balance)}
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          {editable && !w.locked && (
                            <>
                              <button onClick={() => advanceFor(w)} aria-label={`Money taken by ${w.name}`} title="Money taken" className="btn-secondary btn-sm">
                                <HandCoins className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => salaryFor(w)} className="btn-secondary btn-sm">
                                <IndianRupee className="w-3.5 h-3.5" /> Pay
                              </button>
                              <button onClick={() => setPanel({ kind: "form", worker: w })} aria-label={`Edit ${w.name}`} className="btn btn-sm text-slate-600 hover:bg-slate-100">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="text-xs text-slate-500">
            Daily wage: present days are paid, half days pay half. Monthly salary: a day&apos;s pay is taken off for each absence,
            half for a half day, and leave is paid. Overtime is added where a rate is set. Advances are taken off what is left to pay. Tap a name for the month&apos;s
            report and PDF.
          </p>
        </>
      )}

      {panel?.kind === "detail" && opened && (
        <WorkerSheet
          worker={opened}
          month={wanted}
          days={data.days}
          editable={editable && !opened.locked}
          onClose={() => setPanel(null)}
          onAdvance={() => advanceFor(opened)}
          onPay={() => salaryFor(opened)}
          onEdit={() => setPanel({ kind: "form", worker: opened })}
          onDeletePayment={async (payment) => {
            if (!window.confirm(`Delete this payment of ${money(payment.amount)}?`)) return;
            try {
              await api.delete(`/workers/${opened._id}/payments/${payment._id}`);
              load();
            } catch (err) {
              failure(err, "Could not delete the payment");
            }
          }}
        />
      )}
      {panel?.kind === "form" && (
        <WorkerForm worker={panel.worker} onClose={() => setPanel(null)} onSaved={load} />
      )}
      {panel?.kind === "pay" && (
        <WorkerPayForm worker={panel.worker} kind={panel.payKind} date={panel.date} month={wanted}
          onClose={() => setPanel(null)} onSaved={load} />
      )}
    </div>
  );
}
