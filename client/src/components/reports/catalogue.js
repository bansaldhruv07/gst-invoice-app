// Every report on the Reports page, in the order shown. `data` names the server
// report it is drawn from; `dated` reports use the chosen period.
import {
  Users, Package, ReceiptText, Truck, ShoppingCart, FileInput, FileOutput, FileCheck2, Boxes, BookUser,
  BookOpen, BarChart3,
} from "lucide-react";

const report = (id, title, text, icon, data, dated = true) => ({ id, title, text, icon, data, dated });

export const GROUPS = [
  {
    title: "Sales",
    reports: [
      report("party-sales", "Party-wise sales", "What each buyer bought and still owes", Users, "sales"),
      report("product-sales", "Product-wise sales", "Quantity, value and margin of each product", Package, "sales"),
      report("gst-sales", "GST sales report", "Tax on every sale, bill by bill and by rate", ReceiptText, "sales"),
    ],
  },
  {
    title: "Purchases",
    reports: [
      report("party-purchases", "Party-wise purchase", "What you bought from each seller", Truck, "purchases"),
      report("product-purchases", "Product-wise purchase", "Quantity and value of each product bought", ShoppingCart, "purchases"),
      report("gst-purchases", "GST purchase report", "Tax paid on every purchase, and input credit", FileInput, "purchases"),
    ],
  },
  {
    title: "GST returns",
    reports: [
      report("gstr1", "GSTR-1", "Working sheet of your sales", FileOutput, "gst"),
      report("gstr2", "GSTR-2", "Working sheet of your purchases", FileInput, "gstr2"),
      report("gstr3b", "GSTR-3B", "Tax collected, input credit and tax to pay", FileCheck2, "gst"),
    ],
  },
  {
    title: "Stock and accounts",
    reports: [
      report("stock", "Current stock", "Quantity in hand and its value", Boxes, "stock", false),
      report("ledgers", "Ledgers: debtors and creditors", "Who owes you and whom you owe", BookUser, "outstanding", false),
      report("daybook", "Day book", "Every entry, and money in and out", BookOpen, "daybook"),
      report("profit", "Profit and summary", "Estimated profit, month by month", BarChart3, "summary"),
    ],
  },
];

export const REPORTS = GROUPS.flatMap((g) => g.reports);

// Addresses used before the reports had their own names
export const OLD_TABS = {
  summary: "profit", gst: "gstr3b", products: "product-sales", buyers: "party-sales", daybook: "daybook",
};
