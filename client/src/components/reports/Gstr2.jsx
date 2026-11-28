// GSTR-2: what was bought, for checking input credit.
import { Percent, Receipt } from "lucide-react";
import DataTable from "./DataTable";
import { col, sumCol } from "./columns";
import { Stats } from "../ui";
import { rupees } from "../../lib/format";

export default function Gstr2({ report, file }) {
  const { registered, unregistered, exempt, hsn, itc } = report;
  const tax = [sumCol("Taxable", "taxable"), sumCol("IGST", "igst"), sumCol("CGST", "cgst"), sumCol("SGST", "sgst")];
  const bill = [
    col("Seller", "seller"),
    col("Purchase", "number"),
    col("Seller's bill", "supplierBill"),
    col("Date", "date", "date"),
    col("Bill value", "value", "money"),
  ];
  return (
    <>
      <p className="text-sm text-slate-600">
        A working sheet of your purchases. GSTR-2 is not filed at present: use this to check your records against
        GSTR-2B on the GST portal.
      </p>
      <Stats items={[
        { label: "Taxable purchases with credit", value: rupees(itc.taxable), icon: Receipt },
        { label: "Input tax credit", value: rupees(itc.tax), icon: Percent, tone: "green" },
        { label: "Of which IGST", value: rupees(itc.igst), icon: Percent, tone: "amber" },
      ]} />
      <DataTable title="GSTR-2: purchases from registered sellers (B2B)" note="Input credit counted" file={`${file}-b2b`}
        rows={registered} columns={[col("GSTIN", "gstin"), ...bill, col("Rate", "rate", "percent"), ...tax]} />
      <DataTable title="GSTR-2: purchases from sellers without a GSTIN" note="No input credit" file={`${file}-unregistered`}
        rows={unregistered} columns={[...bill, col("Rate", "rate", "percent"), ...tax]} />
      <DataTable title="GSTR-2: exempt, nil-rated and bill of supply purchases" file={`${file}-exempt`}
        rows={exempt} columns={[col("GSTIN", "gstin"), ...bill, sumCol("Amount without GST", "taxable")]} />
      <DataTable title="GSTR-2: HSN summary of purchases" file={`${file}-hsn`}
        rows={hsn} columns={[col("HSN", "hsn"), col("Unit", "unit"), col("Quantity", "quantity", "number"), col("Rate", "rate", "percent"), ...tax]} />
    </>
  );
}
