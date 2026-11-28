// The GSTR-1 and GSTR-3B working sheets.
import DataTable from "./DataTable";
import Lines from "./Lines";
import { col } from "./columns";
import { money } from "../../lib/format";

function Notice({ missing }) {
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
    </>
  );
}

export function Gstr1({ report, file }) {
  const { gstr1, missing } = report;
  const tax = [col("Rate", "rate", "percent"), col("Taxable", "taxable", "money"), col("IGST", "igst", "money"), col("CGST", "cgst", "money"), col("SGST", "sgst", "money")];
  const docs = gstr1.documents;
  return (
    <>
      <Notice missing={missing} />
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

export function Gstr3b({ report }) {
  const { gstr3b, missing } = report;
  return (
    <>
      <Notice missing={missing} />
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
    </>
  );
}
