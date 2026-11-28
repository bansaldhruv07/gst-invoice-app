// Label and amount lines, the last one standing out.
import { money } from "../../lib/format";

export default function Lines({ rows }) {
  return (
    <dl className="px-5 py-3 text-sm">
      {rows.map(([label, value, strong]) => (
        <div key={label} className={`flex justify-between gap-4 py-1.5 ${strong ? "border-t border-slate-300 mt-1 font-semibold text-base" : ""}`}>
          <dt className={strong ? "" : "text-slate-600"}>{label}</dt>
          <dd className="tabular">{money(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
