// Estimated profit and the totals for a period.
import { Link } from "react-router-dom";
import DataTable from "./DataTable";
import Lines from "./Lines";
import { col } from "./columns";

const monthName = (iso) =>
  new Date(`${iso}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

export default function Profit({ report, file }) {
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
