// Every entry in a period, and money in and out by payment method.
import DataTable from "./DataTable";
import { col } from "./columns";
import { money } from "../../lib/format";

const MODES = { cash: "Cash", upi: "UPI", bank_transfer: "Bank transfer", cheque: "Cheque", card: "Card", other: "Other" };

export default function DayBook({ report, file }) {
  return (
    <>
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        {[["Money in", report.moneyIn], ["Money out", report.moneyOut], ["Net", report.moneyIn - report.moneyOut]].map(([label, value]) => (
          <p key={label} className="flex items-baseline gap-2">
            <span className="text-slate-500">{label}</span>
            <span className="text-lg font-semibold tabular">{money(value)}</span>
          </p>
        ))}
      </div>
      <DataTable title="Cash and bank by payment method" file={`${file}-methods`}
        rows={report.modes.map((m) => ({ ...m, mode: MODES[m.mode] || m.mode, net: m.moneyIn - m.moneyOut }))}
        columns={[col("Method", "mode"), col("In", "moneyIn", "money"), col("Out", "moneyOut", "money"), col("Net", "net", "money")]} />
      <DataTable title="All entries" file={`${file}-entries`}
        rows={report.rows.map((r) => ({ ...r, mode: MODES[r.mode] || r.mode }))}
        columns={[col("Date", "date", "date"), col("Entry", "type"), col("Reference", "ref"), col("Party", "party"), col("Method", "mode"), col("Amount", "amount", "money"), col("In", "moneyIn", "money"), col("Out", "moneyOut", "money")]} />
    </>
  );
}
