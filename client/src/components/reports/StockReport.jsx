// What is in stock now and what it is worth at cost.
import { useState } from "react";
import { Link } from "react-router-dom";
import { Boxes, TriangleAlert, Wallet } from "lucide-react";
import DataTable from "./DataTable";
import { col, sumCol } from "./columns";
import { Stats, EmptyState } from "../ui";
import { rupees } from "../../lib/format";
import { todayISO } from "../../lib/period";

export default function StockReport({ report }) {
  const { stock, untracked, value, low } = report;
  const [lowOnly, setLowOnly] = useState(false);
  const rows = stock
    .filter((s) => !lowOnly || s.low)
    .map((s) => ({
      ...s,
      status: s.stock <= 0 ? "Out of stock" : s.low ? "Low" : "In stock",
      // Without a purchase price there is no cost to show
      cost: s.cost || "",
    }));

  if (!stock.length) {
    return (
      <section className="card">
        <EmptyState title="No product has stock tracking switched on"
          hint="Switch it on in a product's Optional Details to see its quantity here."
          action={<Link to="/items" className="btn-primary">Go to Products</Link>} />
      </section>
    );
  }
  return (
    <>
      <Stats items={[
        { label: "Stock value at cost", value: rupees(value), icon: Wallet },
        { label: "Products tracked", value: stock.length, icon: Boxes, tone: "green" },
        { label: "Low or out of stock", value: low, icon: TriangleAlert, tone: low ? "red" : "amber" },
      ]} />
      <DataTable title="Current stock report" note="As on today. The period above does not apply." file={`current-stock-${todayISO()}`}
        rows={rows} empty="Nothing is running low"
        actions={
          <label className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="w-4 h-4" />
            Low only
          </label>
        }
        columns={[
          col("Product", "name"),
          col("In stock", "stock", "number"),
          col("Unit", "unit"),
          col("Status", "status"),
          col("Opening", "opening", "number"),
          col("Purchased", "purchased", "number"),
          col("Sold", "sold", "number"),
          col("Returned", "returned", "number"),
          col("Adjusted", "adjusted", "number"),
          col("Cost per unit", "cost", "money"),
          sumCol("Stock value", "value"),
          col("HSN", "hsn"),
        ]} />
      <p className="text-sm text-slate-600">
        {untracked > 0 && `${untracked} product${untracked === 1 ? " is" : "s are"} not tracked and not listed here. `}
        <Link to="/stock" className="font-bold text-brand-700 hover:underline">Adjust stock</Link>
      </p>
    </>
  );
}
