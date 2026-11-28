// What the app does beyond the bill, as shown in the home page tour.
// Only list things that exist in the app.
import { Boxes, IndianRupee, BarChart3, CalendarCheck } from "lucide-react";
import { StockScene, PaymentScene, AttendanceScene, ReportScene } from "./scenes";

export const FEATURES = [
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
      "UPI payment QR for unpaid bills",
    ],
    Scene: PaymentScene,
    duration: 8000,
  },
  {
    id: "stock",
    tab: "Stock",
    icon: Boxes,
    title: "Stock that counts itself",
    text: "Every sale, purchase and return updates the quantity. You are warned before you run out.",
    points: [
      "Live quantity and value at cost",
      "Low-stock warning for each product",
      "Adjust for damage or counting differences",
      "Purchases and suppliers in the same place",
    ],
    Scene: StockScene,
    duration: 7500,
  },
  {
    id: "attendance",
    tab: "Attendance",
    icon: CalendarCheck,
    title: "Attendance and wages",
    text: "Mark who came in each day. The month's pay is worked out for you.",
    points: [
      "Present, half day, absent or leave in one tap",
      "Daily wage or monthly salary",
      "Came and left times, total hours and overtime",
      "Money taken in advance, with its date",
      "Month report to download (Starter and Growth plans)",
    ],
    Scene: AttendanceScene,
    duration: 7000,
  },
  {
    id: "reports",
    tab: "Reports",
    icon: BarChart3,
    title: "Know your numbers",
    text: "Profit, GST and each day's entries, ready for you and your accountant.",
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
