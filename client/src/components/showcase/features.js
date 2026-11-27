// What the app does, as shown on the home page and the sign-in screen.
// Only list things that exist in the app.
import { FileText, Sparkles, Boxes, IndianRupee, BarChart3 } from "lucide-react";
import { InvoiceScene, AssistantScene, StockScene, PaymentScene, ReportScene } from "./scenes";
import { ASSISTANT_NAME } from "../../lib/assistant";

export const FEATURES = [
  {
    id: "invoices",
    tab: "Invoices",
    icon: FileText,
    title: "GST invoices in seconds",
    text: "Pick the buyer and the items. The tax, totals and bill number fill themselves in.",
    points: [
      "Tax invoice and bill of supply, in your printed format",
      "CGST + SGST or IGST chosen from the buyer's state",
      "Logo, signature, bank details and three copies",
      "Quotations that turn into invoices in one press",
    ],
    Scene: InvoiceScene,
    duration: 8000,
  },
  {
    id: "assistant",
    tab: `Ask ${ASSISTANT_NAME}`,
    icon: Sparkles,
    title: `${ASSISTANT_NAME}, your AI helper`,
    text: "Ask a question or say what to write. You check the draft before it is saved.",
    points: [
      "Make bills, quotations, payments and expenses by typing",
      "Ask about stock, dues, top sellers, GST and profit",
      "Answers come from your own records",
      "Nothing is saved until you confirm",
    ],
    Scene: AssistantScene,
    duration: 7000,
  },
  {
    id: "stock",
    tab: "Stock",
    icon: Boxes,
    title: "Stock that counts itself",
    text: "Every sale, purchase and return updates the quantity. You hear about it before you run out.",
    points: [
      "Live quantity and value at cost",
      "Low-stock warning level for each product",
      "Adjust for damage or counting differences",
      "Full history for every product",
    ],
    Scene: StockScene,
    duration: 7500,
  },
  {
    id: "payments",
    tab: "Payments",
    icon: IndianRupee,
    title: "Get paid on time",
    text: "See who is late, send a reminder on WhatsApp and record the money when it arrives.",
    points: [
      "Overdue list with days late",
      "Reminder message ready to send",
      "Buyer statements as PDF",
      "Credit limits and old opening balances",
    ],
    Scene: PaymentScene,
    duration: 8000,
  },
  {
    id: "reports",
    tab: "Reports",
    icon: BarChart3,
    title: "Know your numbers",
    text: "Profit, GST and every day's entries, ready for you and your accountant.",
    points: [
      "Estimated profit and monthly trend",
      "GSTR-1 and GSTR-3B working sheets",
      "Day book and CSV export",
      "Full backup whenever you like",
    ],
    Scene: ReportScene,
    duration: 7000,
  },
];
