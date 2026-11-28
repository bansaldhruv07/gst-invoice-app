// One worker's month: attendance calendar, days off, money taken and what is
// left to pay.
import { useState } from "react";
import toast from "react-hot-toast";
import { IndianRupee, HandCoins, Pencil, Trash2, Download } from "lucide-react";
import Sheet from "../mobile/Sheet";
import { STATUSES, monthName } from "./statuses";
import { formatHours, clock, leftNextDay } from "./hours";
import { daysOff, paymentsInOrder } from "../../lib/workerMonth";
import { downloadWorkerMonthPdf } from "../../lib/workerMonthPdf";
import { useBusiness } from "../../context/BusinessContext";
import { money, shortDate } from "../../lib/format";

const BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

function Heading({ children }) {
  return <h3 className="px-4 py-2.5 bg-slate-100 text-sm font-bold text-slate-700">{children}</h3>;
}

export default function WorkerSheet({ worker, month, days, editable, onClose, onAdvance, onPay, onEdit, onDeletePayment }) {
  const { summary } = worker;
  const { business } = useBusiness();
  const [busy, setBusy] = useState(false);
  // Monday first
  const blanks = (new Date(`${month}-01T00:00:00`).getDay() + 6) % 7;
  const off = daysOff(worker);
  const payments = paymentsInOrder(worker);
  const timed = Object.entries(worker.times || {}).sort(([a], [b]) => a.localeCompare(b));

  const download = async () => {
    setBusy(true);
    try {
      await downloadWorkerMonthPdf({ business, worker, month });
    } catch (err) {
      console.error(err);
      toast.error("Could not make the PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={worker.name}
      onClose={onClose}
      action={
        <button type="button" onClick={download} disabled={busy} className="btn-secondary btn-sm">
          <Download className="w-3.5 h-3.5" /> PDF
        </button>
      }
      footer={editable && (
        <>
          <button type="button" onClick={onEdit} aria-label="Edit worker" className="btn-secondary !flex-none h-12 sm:h-10"><Pencil className="w-4 h-4" /></button>
          <button type="button" onClick={onAdvance} className="btn-secondary h-12 sm:h-10"><HandCoins className="w-4 h-4" /> Money taken</button>
          <button type="button" onClick={onPay} className="btn-primary h-12 sm:h-10"><IndianRupee className="w-4 h-4" /> Pay salary</button>
        </>
      )}
    >
      <dl className="grid grid-cols-2 gap-px bg-slate-200 border-b border-slate-200">
        {[
          ["Earned", summary.earned],
          ["Advance taken", summary.advance],
          ["Salary paid", summary.salaryPaid],
          [summary.balance < 0 ? "Taken extra" : "Left to pay", Math.abs(summary.balance)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-3 py-3 text-center">
            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
            <dd className={`text-base font-bold tabular ${label === "Taken extra" ? "text-red-700" : ""}`}>{money(value)}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Calendar" className="px-4 py-3 border-b border-slate-200">
        <h3 className="mb-2 text-sm font-bold">{monthName(month)}</h3>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d} className="py-1 font-semibold text-slate-400">{d}</span>)}
          {Array.from({ length: blanks }, (_, i) => <span key={`blank-${i}`} />)}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const status = BY_ID[worker.marks[`${month}-${String(day).padStart(2, "0")}`]];
            return (
              <span key={day} title={status?.label}
                className={`flex h-10 flex-col items-center justify-center rounded-lg border leading-none ${status ? status.soft : "border-slate-150 text-slate-500"}`}>
                {day}
                {status && <b className="mt-0.5">{status.short}</b>}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {summary.present} present · {summary.half} half · {summary.absent} absent · {summary.leave} leave
        </p>
      </section>

      <section aria-label="Holidays">
        <Heading>Holidays and half days</Heading>
        {off.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">No holiday or half day marked this month.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 px-4 py-3">
            {off.map(([date, status]) => (
              <li key={date} className={`badge ${BY_ID[status].soft}`}>{shortDate(date)} · {BY_ID[status].label}</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Hours">
        <Heading>Hours and overtime</Heading>
        {timed.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">No came or left time noted this month.</p>
        ) : (
          <>
            <p className="px-4 py-2.5 text-sm text-slate-700 border-b border-slate-100">
              <strong>{formatHours(summary.minutes)}</strong> worked · {formatHours(summary.overtimeMinutes)} overtime
              {summary.overtimePay > 0 && `, adding ${money(summary.overtimePay)} to pay`}
            </p>
            <ul className="divide-y divide-slate-100">
              {timed.map(([date, t]) => (
                <li key={date} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{shortDate(date)}</span>
                    <span className="block text-xs text-slate-500">{clock(t.in)} to {clock(t.out)}{leftNextDay(t) ? " next day" : ""}</span>
                  </span>
                  {t.overtime > 0 && <span className="badge bg-amber-50 text-amber-800 border-amber-200">{formatHours(t.overtime)} OT</span>}
                  <span className="w-16 text-right font-bold tabular">{t.minutes ? formatHours(t.minutes) : "—"}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-label="Money given">
        <Heading>Money taken and salary paid</Heading>
        {payments.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">No money recorded for this month.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {payments.map((p) => (
              <li key={p._id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{p.kind === "advance" ? "Advance taken" : "Salary / wages"}</span>
                  <span className="block text-xs text-slate-500">{[shortDate(p.date), p.note].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="font-bold tabular">{money(p.amount)}</span>
                {editable && (
                  <button type="button" onClick={() => onDeletePayment(p)} aria-label="Delete payment" className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Sheet>
  );
}
