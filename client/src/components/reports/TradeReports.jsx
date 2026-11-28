// Sales and purchase reports: by party, by product and the GST register.
// `side` is "sales" or "purchases"; both come in the same shape.
import { useState } from "react";
import { Link } from "react-router-dom";
import { IndianRupee, Percent, Receipt, X } from "lucide-react";
import DataTable from "./DataTable";
import { col, sumCol } from "./columns";
import { Stats } from "../ui";
import { rupees } from "../../lib/format";

const WORDS = {
  sales: { party: "Buyer", bills: "Invoices", statement: "buyers", number: "Invoice", verb: "Sales" },
  purchases: { party: "Seller", bills: "Bills", statement: "sellers", number: "Purchase", verb: "Purchases" },
};

const invoiceLink = (side) => (row) => (side === "sales" && row.billId ? `/invoices/${row.billId}` : null);

function Headline({ rows, side }) {
  const total = (key) => rows.reduce((s, r) => s + (r[key] || 0), 0);
  return (
    <Stats items={[
      { label: `${WORDS[side].verb} before GST`, value: rupees(total("taxable")), icon: Receipt },
      { label: "GST", value: rupees(total("tax")), icon: Percent, tone: "amber" },
      { label: `Total ${side}`, value: rupees(total("total")), icon: IndianRupee, tone: "green" },
    ]} />
  );
}

// A column only when some row has a value in it
const optional = (rows, column) => (rows.some((r) => r[column.key]) ? [column] : []);

export function PartyWise({ report, side, file }) {
  const words = WORDS[side];
  const [picked, setPicked] = useState(null);
  const party = report.parties.find((p) => p.key === picked);
  const bills = report.bills.filter((b) => (b.partyId || b.party) === picked);

  return (
    <>
      <Headline rows={report.parties} side={side} />
      <DataTable
        title={`Party-wise ${side === "sales" ? "sales" : "purchases"}`}
        note={`Choose a ${words.party.toLowerCase()} to see their bills. Balance is what is unpaid on these bills.`}
        file={file}
        rows={report.parties}
        columns={[
          col(words.party, "name", "text", { pick: (r) => setPicked(r.key) }),
          sumCol("Total", "total"),
          sumCol("Balance", "balance"),
          sumCol(words.bills, "bills", "number"),
          sumCol("Before GST", "taxable"),
          sumCol("GST", "tax"),
          ...optional(report.parties, sumCol("CESS", "cess")),
          ...(side === "sales" ? optional(report.parties, sumCol("Returns", "returns")) : []),
          col("GSTIN", "gstin"),
        ]}
      />
      {party && (
        <DataTable
          key={party.key}
          title={`Bills of ${party.name}`}
          file={`${file}-${party.name.replace(/[^A-Za-z0-9]+/g, "-")}`}
          rows={bills.map((b) => ({ ...b, billId: b.id }))}
          actions={
            <>
              {party.id && <Link to={`/${words.statement}/${party.id}`} className="btn-secondary btn-sm">Statement</Link>}
              <button type="button" onClick={() => setPicked(null)} aria-label="Close" className="btn btn-sm text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </>
          }
          columns={[
            col("Date", "date", "date"),
            col(words.number, "number", "text", { link: invoiceLink(side) }),
            col("Type", "type"),
            sumCol("Before GST", "taxable"),
            sumCol("GST", "tax"),
            sumCol("Total", "total"),
            sumCol("Balance", "balance"),
          ]}
        />
      )}
    </>
  );
}

export function ProductWise({ report, side, file }) {
  const words = WORDS[side];
  const [picked, setPicked] = useState(null);
  const product = report.products.find((p) => p.key === picked);
  const lines = report.lines.filter((l) => l.key === picked);

  return (
    <>
      <Headline rows={report.products} side={side} />
      <DataTable
        title={`Product-wise ${side === "sales" ? "sales" : "purchases"}`}
        note={`Choose a product to see each ${words.number.toLowerCase()} it is on. Amounts are before any discount on the whole bill.`}
        file={file}
        rows={report.products}
        columns={[
          col("Product", "name", "text", { pick: (r) => setPicked(r.key) }),
          col("Quantity", "quantity", "number"),
          col("Unit", "unit"),
          sumCol("Total", "total"),
          col("Average rate", "averageRate", "money"),
          sumCol("Before GST", "taxable"),
          sumCol("GST", "tax"),
          ...optional(report.products, sumCol("CESS", "cess")),
          ...(side === "sales" ? [col("Margin", "margin", "money")] : []),
          col("HSN", "hsn"),
        ]}
      />
      {product && (
        <DataTable
          key={product.key}
          title={`${words.verb} of ${product.name}`}
          file={`${file}-${product.name.replace(/[^A-Za-z0-9]+/g, "-")}`}
          rows={lines}
          actions={
            <button type="button" onClick={() => setPicked(null)} aria-label="Close" className="btn btn-sm text-slate-500 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          }
          columns={[
            col("Date", "date", "date"),
            col(words.number, "number", "text", { link: invoiceLink(side) }),
            col(words.party, "party"),
            sumCol("Quantity", "quantity", "number"),
            col("Rate", "rate", "money"),
            sumCol("Before GST", "taxable"),
            sumCol("Total", "total"),
          ]}
        />
      )}
    </>
  );
}

export function GstRegister({ report, side, file }) {
  const words = WORDS[side];
  const sales = side === "sales";
  const bills = report.bills.map((b) => ({ ...b, billId: b.id }));
  const taxes = (rows) => [
    sumCol("CGST", "cgst"),
    sumCol("SGST", "sgst"),
    sumCol("IGST", "igst"),
    ...optional(rows, sumCol("CESS", "cess")),
  ];

  return (
    <>
      <Headline rows={report.bills} side={side} />
      <DataTable
        title={`GST ${side === "sales" ? "sales" : "purchase"} summary by rate`}
        note={sales ? "After credit notes" : undefined}
        file={`${file}-rates`}
        rows={report.rates}
        columns={[col("GST rate", "rate", "percent"), sumCol("Taxable", "taxable"), ...taxes(report.rates), sumCol("Total GST", "tax")]}
      />
      <DataTable
        title={`GST ${side === "sales" ? "sales" : "purchase"} report, bill by bill`}
        note={sales ? "Credit notes are shown as minus amounts" : "Input credit needs a tax invoice from a seller with a GSTIN"}
        file={file}
        rows={bills}
        columns={[
          col("Date", "date", "date"),
          col(words.number, "number", "text", { link: invoiceLink(side) }),
          ...(sales ? [] : [col("Seller's bill", "supplierBill")]),
          col("Type", "type"),
          col(words.party, "party"),
          col("GSTIN", "gstin"),
          ...(sales ? [col("Place of supply", "placeOfSupply")] : []),
          sumCol("Taxable", "taxable"),
          ...taxes(bills),
          ...optional(bills, sumCol("Discount", "discount")),
          sumCol("Bill total", "total"),
          ...(sales ? [] : [col("Input credit", "credit")]),
        ]}
      />
    </>
  );
}
