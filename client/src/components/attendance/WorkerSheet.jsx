// One worker's month: a calendar of attendance and the payments made.
import { IndianRupee, Pencil, Trash2 } from "lucide-react";
import Sheet from "../mobile/Sheet";
import { STATUSES, monthName } from "./statuses";
import { money, shortDate } from "../../lib/format";

const BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

export default function WorkerSheet({ worker, month, days, editable, onClose, onPay, onEdit, onDeletePayment }) {
  const { summary } = worker;
  // Monday first
  const blanks = (new Date(`${month}-01T00:00:00`).getDay() + 6) % 7;

  return (
    <Sheet
      title={worker.name}
      onClose={onClose}
      footer={editable && (
        <>
          <button type="button" onClick={onEdit} className="btn-secondary h-12 sm:h-10"><Pencil className="w-4 h-4" /> Edit</button>
          <button type="button" onClick={onPay} className="btn-primary h-12 sm:h-10"><IndianRupee className="w-4 h-4" /> Record payment</button>
        </>
      )}
    >
      <dl className="grid grid-cols-3 gap-px bg-slate-200 border-b border-slate-200">
        {[["Earned", summary.earned], ["Paid", summary.paid], ["To pay", summary.balance]].map(([label, value]) => (
          <div key={label} className="bg-white px-3 py-3 text-center">
            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
            <dd className="text-base font-bold tabular">{money(value)}</dd>
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

      <section aria-label="Payments">
        <h3 className="px-4 py-2.5 bg-slate-100 text-sm font-bold text-slate-700">Payments</h3>
        {worker.payments.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">No payment recorded for this month.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {worker.payments.map((p) => (
              <li key={p._id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{p.kind === "advance" ? "Advance" : "Salary / wages"}</span>
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
