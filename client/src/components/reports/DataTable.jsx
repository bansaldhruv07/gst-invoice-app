// A titled report table with a search box, a totals line and CSV export.
import { useState } from "react";
import { Link } from "react-router-dom";
import { FileSpreadsheet, Search } from "lucide-react";
import { EmptyState } from "../ui";
import { downloadCsv } from "../../lib/csv";
import { show, isNumeric, totalsOf } from "./columns";

export default function DataTable({ title, note, columns, rows, file, empty = "Nothing in this period", actions }) {
  const [query, setQuery] = useState("");
  const wanted = query.trim().toLowerCase();
  const pinned = (i) => (i === 0 ? "max-sm:sticky max-sm:left-0 max-sm:shadow-[1px_0_0_#e2e8f0]" : "");
  const shown = wanted
    ? rows.filter((r) => columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(wanted)))
    : rows;
  const totals = totalsOf(shown, columns);

  // Exports what is on screen, with the totals line
  const csv = () =>
    downloadCsv(`${file}.csv`, [
      columns.map((c) => c.label),
      ...shown.map((r) => columns.map((c) => r[c.key] ?? "")),
      ...(totals ? [columns.map((c, i) => (c.total ? totals[c.key] : i === 0 ? "Total" : ""))] : []),
    ]);

  return (
    <section aria-label={title} className="card overflow-hidden">
      <div className="card-head flex-wrap gap-3">
        <div className="min-w-0">
          <h2 className="card-title">{title}</h2>
          {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {rows.length > 8 && (
            <label className="relative">
              <Search className="absolute left-2.5 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-slate-400" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={`Search ${title}`}
                placeholder="Search" className="input h-8 w-36 pl-8 text-sm" />
            </label>
          )}
          <button onClick={csv} disabled={!shown.length} className="btn-secondary btn-sm">
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState title={wanted ? "Nothing matches your search" : empty} />
      ) : (
        <div className="overflow-auto max-h-[32rem]">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                {columns.map((c, i) => (
                  <th key={c.key} className={`th whitespace-nowrap ${isNumeric(c) ? "text-right" : ""} ${pinned(i)}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, i) => (
                <tr key={i}>
                  {columns.map((c, n) => {
                    const text = show(row[c.key], c.type);
                    const to = c.link?.(row);
                    return (
                      <td key={c.key} className={`td whitespace-nowrap ${isNumeric(c) ? "text-right tabular" : ""} ${pinned(n)} ${n === 0 ? "max-sm:bg-white" : ""}`}>
                        {to ? (
                          <Link to={to} className="font-medium text-brand-700 hover:underline">{text}</Link>
                        ) : c.pick ? (
                          <button type="button" onClick={() => c.pick(row)} className="font-medium text-brand-700 hover:underline">{text}</button>
                        ) : (
                          text
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot className="sticky bottom-0">
                <tr className="bg-slate-100 font-bold">
                  {columns.map((c, i) => (
                    <td key={c.key} className={`td whitespace-nowrap ${isNumeric(c) ? "text-right tabular" : ""} ${pinned(i)} ${i === 0 ? "max-sm:bg-slate-100" : ""}`}>
                      {c.total ? show(totals[c.key], c.type) : i === 0 ? "Total" : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}
