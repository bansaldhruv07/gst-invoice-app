import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { FileSpreadsheet } from "lucide-react";
import { Spinner, EmptyState } from "../components/ui";
import { money, shortDate } from "../lib/format";
import { downloadCsv } from "../lib/csv";
import { PERIODS, periodRange } from "../lib/period";

const TABS = [
  ["summary", "Profit and summary"],
  ["gst", "GST returns"],
  ["products", "By product"],
  ["buyers", "By buyer"],
  ["daybook", "Day book"],
];

const ENDPOINT = { summary: "summary", products: "summary", buyers: "summary", gst: "gst", daybook: "daybook" };

const MODES = { cash: "Cash", upi: "UPI", bank_transfer: "Bank transfer", cheque: "Cheque", card: "Card", other: "Other" };

const col = (label, key, type) => ({ label, key, type });

function show(value, type) {
  if (value === "" || value === undefined || value === null) return "—";
  if (type === "money") return money(value);
  if (type === "date") return shortDate(value);
  if (type === "percent") return `${value}%`;
  return value;
}

// A titled table that can be exported exactly as shown
function DataTable({ title, note, columns, rows, file, empty = "Nothing in this period", link }) {
  const numeric = (c) => ["money", "number", "percent"].includes(c.type);
  const csv = () =>
    downloadCsv(`${file}.csv`, [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => r[c.key] ?? ""))]);

  return (
    <section className="card overflow-hidden">
      <div className="card-head">
        <div>
          <h2 className="card-title">{title}</h2>
          {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
        </div>
        <button onClick={csv} disabled={!rows.length} className="btn-secondary btn-sm">
          <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
        </button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <div className="overflow-auto max-h-[28rem]">
          <table className="w-full">
            <thead className="sticky top-0">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`th ${numeric(c) ? "text-right" : ""}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c, j) => (
                    <td key={c.key} className={`td whitespace-nowrap ${numeric(c) ? "text-right" : ""}`}>
                      {j === 0 && link?.(row) ? (
                        <Link to={link(row)} className="text-brand-700 hover:underline">{show(row[c.key], c.type)}</Link>
                      ) : (
                        show(row[c.key], c.type)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Lines({ rows }) {
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

const monthName = (iso) =>
  new Date(`${iso}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

function Summary({ report, file }) {
  const { sales, returns, purchases, expenses, profit, months } = report;
  const coverage = Math.round(profit.costCoverage * 100);
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <section className="card">
          <div className="card-head"><h2 className="card-title">Estimated profit</h2></div>
          <Lines
            rows={[
              ["Sales before GST, after discounts and returns", profit.revenue],
              ["Less: purchase cost of goods sold", -profit.goodsCost],
              ["Less: expenses (without claimable GST)", -profit.expenses],
              ["Profit", profit.profit, true],
            ]}
          />
          {sales.count > 0 && coverage < 100 && (
            <p className="px-5 pb-4 text-sm text-amber-800">
              Only {coverage}% of sales have a purchase price, so profit looks higher than it is.{" "}
              <Link to="/items" className="underline">Add purchase prices to your products</Link>.
            </p>
          )}
        </section>
        <section className="card">
          <div className="card-head"><h2 className="card-title">Totals, including GST</h2></div>
          <Lines
            rows={[
              [`Sales (${sales.count} invoices)`, sales.total],
              [`Returns (${returns.count} credit notes)`, -returns.total],
              [`Purchases (${purchases.count} bills)`, purchases.total],
              ["Expenses", expenses.total],
              ["Net sales", sales.total - returns.total, true],
            ]}
          />
        </section>
      </div>
      <DataTable title="Month by month" file={`${file}-months`} rows={months.map((m) => ({ ...m, month: monthName(m.month) }))}
        columns={[col("Month", "month"), col("Sales", "sales", "money"), col("Purchases", "purchases", "money"), col("Expenses", "expenses", "money")]} />
      <DataTable title="Expenses by category" file={`${file}-expenses`} rows={expenses.byCategory}
        columns={[col("Category", "category"), col("Amount", "amount", "money")]} />
    </>
  );
}

function Gst({ report, file }) {
  const { gstr1, gstr3b, missing } = report;
  const tax = [col("Rate", "rate", "percent"), col("Taxable", "taxable", "money"), col("IGST", "igst", "money"), col("CGST", "cgst", "money"), col("SGST", "sgst", "money")];
  const docs = gstr1.documents;
  return (
    <>
      <p className="text-sm text-slate-600">
        Working sheets from your records to give your accountant. They are not a filed return, do not match GSTR-2B,
        and discounts applied after tax do not reduce the taxable value.
      </p>
      {missing.hsn.length > 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some items have no HSN code on: {missing.hsn.slice(0, 8).join(", ")}{missing.hsn.length > 8 ? " and more" : ""}.
        </p>
      )}
      <section className="card">
        <div className="card-head"><h2 className="card-title">GSTR-3B summary</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th" />
                {["Taxable", "IGST", "CGST", "SGST"].map((h) => <th key={h} className="th text-right">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[["Sales with GST, less returns", gstr3b.outward], ["Input credit from purchases", gstr3b.itc]].map(([label, r]) => (
                <tr key={label}>
                  <td className="td">{label}</td>
                  {["taxable", "igst", "cgst", "sgst"].map((k) => <td key={k} className="td text-right whitespace-nowrap">{money(r[k])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Lines
          rows={[
            ["Exempt and nil-rated sales", gstr3b.exempt],
            ["Tax collected", gstr3b.outputTax],
            ...(gstr3b.cess ? [["CESS collected (paid separately)", gstr3b.cess]] : []),
            ["Input credit", -gstr3b.inputTax],
            ...(gstr3b.carryForward ? [["Credit to carry forward", gstr3b.carryForward]] : []),
            ["Estimated tax payable", gstr3b.payable, true],
          ]}
        />
        {(gstr3b.unclaimed.purchaseTax > 0 || gstr3b.unclaimed.expenseTax > 0) && (
          <p className="px-5 pb-4 text-sm text-slate-600">
            Not counted above: {money(gstr3b.unclaimed.purchaseTax)} GST on purchases from sellers without a GSTIN, and{" "}
            {money(gstr3b.unclaimed.expenseTax)} GST on expenses (ask your accountant which can be claimed).
          </p>
        )}
        <p className="px-5 pb-4 text-xs text-slate-500">
          This is a simple total. The rules for setting IGST, CGST and SGST credit against each other are not applied.
        </p>
      </section>

      <DataTable title="GSTR-1: sales to registered buyers (B2B)" file={`${file}-b2b`} rows={gstr1.b2b}
        columns={[col("GSTIN", "gstin"), col("Buyer", "buyer"), col("Invoice", "invoiceNumber"), col("Date", "date", "date"), col("Invoice value", "value", "money"), col("Place of supply", "placeOfSupply"), ...tax]} />
      <DataTable title="GSTR-1: large inter-state sales to unregistered buyers" note="Invoices above ₹1,00,000" file={`${file}-b2cl`} rows={gstr1.b2cl}
        columns={[col("Invoice", "invoiceNumber"), col("Date", "date", "date"), col("Invoice value", "value", "money"), col("Place of supply", "placeOfSupply"), ...tax]} />
      <DataTable title="GSTR-1: other sales to unregistered buyers" note="Totalled by state and rate, after returns" file={`${file}-b2cs`} rows={gstr1.b2cs}
        columns={[col("Place of supply", "placeOfSupply"), ...tax]} />
      <DataTable title="GSTR-1: credit notes" file={`${file}-credit-notes`} rows={gstr1.creditNotes}
        columns={[col("Credit note", "number"), col("Date", "date", "date"), col("GSTIN", "gstin"), col("Buyer", "buyer"), col("Against", "invoiceNumber"), col("Note value", "value", "money"), ...tax]} />
      <DataTable title="GSTR-1: HSN summary" note="After returns" file={`${file}-hsn`} rows={gstr1.hsn}
        columns={[col("Supply to", "segment"), col("HSN", "hsn"), col("Unit", "unit"), col("Quantity", "quantity", "number"), ...tax]} />
      <DataTable title="GSTR-1: documents issued" file={`${file}-documents`}
        rows={docs.total ? [docs] : []}
        columns={[col("First invoice", "from"), col("Last invoice", "to"), col("Issued", "total", "number"), col("Cancelled", "cancelled", "number"), col("Credit notes", "creditNotes", "number")]} />
    </>
  );
}

function DayBook({ report, file }) {
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

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "summary";
  const period = params.get("period") || "this-month";
  const range =
    period === "custom"
      ? { from: params.get("from") || periodRange("this-month").from, to: params.get("to") || periodRange("this-month").to }
      : periodRange(period);

  const endpoint = ENDPOINT[tab];
  const key = `${endpoint}|${range.from}|${range.to}`;
  const [result, setResult] = useState({ key: "" });

  useEffect(() => {
    let current = true;
    const [path, from, to] = key.split("|");
    api.get(`/reports/${path}`, { params: { from, to } })
      .then(({ data }) => current && setResult({ key, report: data.report }))
      .catch((err) => current && setResult({ key, error: err.response?.data?.message || "Could not build the report" }));
    return () => {
      current = false;
    };
  }, [key]);

  const update = (changes) => setParams({ tab, period, ...(period === "custom" ? range : {}), ...changes }, { replace: true });
  const file = `${tab}-${range.from}-to-${range.to}`;
  const ready = result.key === key;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Period" value={period}
          onChange={(e) => update(e.target.value === "custom" ? { period: "custom", ...range } : { tab, period: e.target.value })}
          className="input w-auto">
          {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {period === "custom" ? (
          <>
            <input type="date" aria-label="From date" value={range.from} onChange={(e) => update({ from: e.target.value })} className="input w-auto" />
            <input type="date" aria-label="To date" value={range.to} onChange={(e) => update({ to: e.target.value })} className="input w-auto" />
          </>
        ) : (
          <span className="text-sm text-slate-500">{shortDate(range.from)} to {shortDate(range.to)}</span>
        )}
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => update({ tab: k })}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
              tab === k ? "border-brand-600 text-brand-700 font-medium" : "border-transparent text-slate-600 hover:text-slate-800"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {!ready ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : result.error ? (
        <EmptyState title={result.error} />
      ) : (
        <div className="space-y-4">
          {tab === "summary" && <Summary report={result.report} file={file} />}
          {tab === "gst" && <Gst report={result.report} file={file} />}
          {tab === "daybook" && <DayBook report={result.report} file={file} />}
          {tab === "products" && (
            <DataTable title="Sales by product" note="After returns, before the invoice discount" file={file} rows={result.report.products.map((p) => ({ ...p, margin: p.costKnown ? p.taxable - p.cost : "" }))}
              columns={[col("Product", "name"), col("HSN", "hsn"), col("Quantity", "quantity", "number"), col("Unit", "unit"), col("Before GST", "taxable", "money"), col("With GST", "total", "money"), col("Margin", "margin", "money")]} />
          )}
          {tab === "buyers" && (
            <DataTable title="Sales by buyer" note="After returns. Balance is what is still unpaid on these invoices." file={file} rows={result.report.buyers}
              link={(r) => r.id && `/buyers/${r.id}`}
              columns={[col("Buyer", "name"), col("GSTIN", "gstin"), col("Invoices", "invoices", "number"), col("Before GST", "taxable", "money"), col("With GST", "total", "money"), col("Balance", "balance", "money")]} />
          )}
        </div>
      )}
    </div>
  );
}
