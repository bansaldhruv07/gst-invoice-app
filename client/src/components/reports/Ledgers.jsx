// Debtors (who owes the business) and creditors (whom it owes), as of today.
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import DataTable from "./DataTable";
import { col, sumCol } from "./columns";
import { Stats } from "../ui";
import { rupees } from "../../lib/format";
import { todayISO } from "../../lib/period";

const VIEWS = [["debtors", "Debtors"], ["creditors", "Creditors"], ["both", "Both"]];

export default function Ledgers({ report, view, onView }) {
  const [settled, setSettled] = useState(false);
  const { parties, receivable, payable } = report;
  const rows = parties
    .filter((p) =>
      view === "debtors" ? p.side === "debtor"
        : view === "creditors" ? p.side === "creditor"
          : settled || p.side !== "settled")
    .map((p) => ({
      ...p,
      receive: p.side === "debtor" ? p.balance : 0,
      pay: p.side === "creditor" ? p.balance : 0,
    }));
  const net = receivable - payable;

  return (
    <>
      <Stats items={[
        { label: "To receive from debtors", value: rupees(receivable), icon: ArrowDownLeft, tone: "green" },
        { label: "To pay to creditors", value: rupees(payable), icon: ArrowUpRight, tone: "red" },
        { label: net >= 0 ? "Net to receive" : "Net to pay", value: rupees(Math.abs(net)), icon: Scale },
      ]} />
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Accounts" className="flex rounded-xl border border-slate-200 bg-white p-1">
          {VIEWS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => onView(key)}
              className={`h-8 px-4 rounded-lg text-sm font-bold transition ${view === key ? "bg-brand-600 text-white shadow-glow" : "text-slate-600 hover:text-brand-700"}`}>
              {label}
            </button>
          ))}
        </div>
        {view === "both" && (
          <label className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer">
            <input type="checkbox" checked={settled} onChange={(e) => setSettled(e.target.checked)} className="w-4 h-4" />
            Show settled accounts
          </label>
        )}
      </div>
      <DataTable
        key={view}
        title={view === "debtors" ? "Debtors: who owes you" : view === "creditors" ? "Creditors: whom you owe" : "Debtors and creditors"}
        note="As on today. Choose a name to see the full statement."
        file={`${view}-${todayISO()}`}
        empty={view === "debtors" ? "No one owes you anything" : view === "creditors" ? "You do not owe anyone" : "No balances yet"}
        rows={rows}
        columns={[
          col("Party", "name", "text", { link: (r) => `/${r.kind === "Buyer" ? "buyers" : "sellers"}/${r.id}` }),
          ...(view !== "creditors" ? [sumCol("To receive", "receive")] : []),
          ...(view !== "debtors" ? [sumCol("To pay", "pay")] : []),
          col("Type", "kind"),
          col("Mobile", "mobile"),
          col("Opening", "opening", "money"),
          col("Billed", "billed", "money"),
          col("Paid", "paid", "money"),
          col("Returns", "returns", "money"),
          col("GSTIN", "gstin"),
        ]}
      />
    </>
  );
}
