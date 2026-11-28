// Workers: who came in each day, what they earned this month and what was paid.
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  ChevronLeft, ChevronRight, Plus, Pencil, IndianRupee, FileSpreadsheet, CheckCheck,
  Wallet, HandCoins, Hourglass,
} from "lucide-react";
import api from "../api/axios";
import { Spinner, EmptyState, Stats } from "../components/ui";
import WorkerForm from "../components/attendance/WorkerForm";
import WorkerPayForm from "../components/attendance/WorkerPayForm";
import WorkerSheet from "../components/attendance/WorkerSheet";
import { STATUSES, monthName, shiftMonth } from "../components/attendance/statuses";
import { money, rupees, shortDate } from "../lib/format";
import { downloadCsv } from "../lib/csv";
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
  const wanted = tab === "day" ? date.slice(0, 7) : month;

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

  const unmarked = present.filter((w) => !w.marks[date]);
  const counts = STATUSES.map((s) => [s, present.filter((w) => w.marks[date] === s.id).length]);

  const exportCsv = () =>
    downloadCsv(`attendance-${month}.csv`, [
      ["Name", "Work", "Pay type", "Rate", "Present", "Half days", "Absent", "Leave", "Earned", "Paid", "Balance"],
      ...workers.map((w) => [
        w.name, w.work, w.payType === "daily" ? "Daily wage" : "Monthly salary", w.rate,
        w.summary.present, w.summary.half, w.summary.absent, w.summary.leave,
        w.summary.earned, w.summary.paid, w.summary.balance,
      ]),
    ]);

  const opened = panel?.id && workers.find((w) => w._id === panel.id);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="View" className="flex rounded-xl border border-slate-200 bg-white p-1">
          {[["day", "Daily"], ["month", "Monthly pay"]].map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`h-8 px-3.5 rounded-lg text-sm font-bold transition ${tab === key ? "bg-brand-600 text-white shadow-glow" : "text-slate-600 hover:text-brand-700"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "day" ? (
          <input type="date" aria-label="Attendance date" value={date} max={data?.today || todayISO()}
            onChange={(e) => e.target.value && setDate(e.target.value)} className="input w-auto" />
        ) : (
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
          {editable && (
            <button onClick={() => setPanel({ kind: "form", worker: null })} className="btn-primary">
              <Plus className="w-4 h-4" /> Add worker
            </button>
          )}
        </div>
      </div>

      {!ready ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : workers.length === 0 ? (
        <section className="card">
          <EmptyState
            title={data.failed ? "Attendance could not be loaded" : "No workers yet"}
            hint={data.failed ? "Check your internet connection and try again." : "Add the people who work for you, then mark who came in each day."}
            action={
              data.failed ? <button onClick={load} className="btn-secondary">Try again</button>
                : editable && <button onClick={() => setPanel({ kind: "form", worker: null })} className="btn-primary"><Plus className="w-4 h-4" /> Add worker</button>
            }
          />
        </section>
      ) : tab === "day" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {counts.map(([s, n]) => (
              <span key={s.id} className={`badge ${s.soft}`}>{s.label}: {n}</span>
            ))}
            <span className="badge bg-slate-100 text-slate-600 border-slate-200">Not marked: {unmarked.length}</span>
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
                  <li key={w._id} className="flex flex-col sm:flex-row sm:items-center gap-2.5 px-4 py-3">
                    <button type="button" onClick={() => setPanel({ kind: "detail", id: w._id })} className="min-w-0 sm:mr-auto text-left">
                      <span className="block truncate text-[15px] font-bold text-slate-900">{w.name}</span>
                      <span className="block truncate text-xs text-slate-500">{[w.work, payLabel(w)].filter(Boolean).join(" · ")}</span>
                    </button>
                    <div role="group" aria-label={`Attendance of ${w.name}`} className="grid grid-cols-4 gap-1.5 sm:w-[22rem]">
                      {STATUSES.map((s) => {
                        const on = w.marks[date] === s.id;
                        return (
                          <button key={s.id} type="button" aria-pressed={on} disabled={!editable}
                            onClick={() => mark([w], on ? "" : s.id)}
                            className={`h-10 rounded-lg border text-xs font-bold transition active:scale-95 ${
                              on ? s.solid : "border-slate-200 bg-white text-slate-600 enabled:hover:border-brand-300"
                            }`}>
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
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
            { label: "Paid", value: rupees(data.totals.paid), icon: HandCoins, tone: "green" },
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
                        {w.summary.worked} {w.summary.worked === 1 ? "day" : "days"} worked · {w.summary.absent} absent · paid {money(w.summary.paid)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold tabular">{money(w.summary.balance)}</span>
                      <span className="block text-xs text-slate-500">to pay</span>
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
                    <th className="th text-right">Paid</th>
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
                      </td>
                      <td className="td text-right tabular">{w.summary.present}</td>
                      <td className="td text-right tabular">{w.summary.half}</td>
                      <td className="td text-right tabular">{w.summary.absent}</td>
                      <td className="td text-right tabular">{w.summary.leave}</td>
                      <td className="td text-right tabular whitespace-nowrap">{money(w.summary.earned)}</td>
                      <td className="td text-right tabular whitespace-nowrap">{money(w.summary.paid)}</td>
                      <td className="td text-right tabular whitespace-nowrap font-bold">{money(w.summary.balance)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          {editable && (
                            <>
                              <button onClick={() => setPanel({ kind: "pay", worker: w })} className="btn-secondary btn-sm">
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
            half for a half day, and leave is paid.
          </p>
        </>
      )}

      {panel?.kind === "detail" && opened && (
        <WorkerSheet
          worker={opened}
          month={wanted}
          days={data.days}
          editable={editable}
          onClose={() => setPanel(null)}
          onPay={() => setPanel({ kind: "pay", worker: opened })}
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
        <WorkerPayForm worker={panel.worker} month={wanted} onClose={() => setPanel(null)} onSaved={load} />
      )}
    </div>
  );
}
