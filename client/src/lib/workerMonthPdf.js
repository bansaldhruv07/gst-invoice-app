// A worker's month on one A4 page: days off, money taken and what is left to pay.
import { loadFonts } from "./invoicePdf";
import { daysOff, paymentsInOrder } from "./workerMonth";
import { STATUSES, monthName } from "../components/attendance/statuses";

const amount = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso) => iso.split("-").reverse().join("-");
const weekday = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" });
const LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));

export async function downloadWorkerMonthPdf({ business, worker, month }) {
  const [{ default: jsPDF }, { default: autoTable }, layout, fonts] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("./invoiceLayout.js"),
    loadFonts(),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  layout.registerFonts(doc, fonts);
  const font = (size, bold) => {
    doc.setFont("DejaVuSans", bold ? "bold" : "normal");
    doc.setFontSize(size);
  };
  const { summary } = worker;

  font(13, true);
  doc.text(business?.name || "", 12, 16);
  font(8.5);
  doc.text([business?.address, business?.city, business?.state].filter(Boolean).join(", "), 12, 21);
  font(11, true);
  doc.text("ATTENDANCE AND PAY", 198, 16, { align: "right" });
  font(8.5);
  doc.text(monthName(month), 198, 21, { align: "right" });

  font(10, true);
  doc.text(worker.name, 12, 32);
  font(8.5);
  const rate = `₹${amount(worker.rate)} a ${worker.payType === "daily" ? "day" : "month"}`;
  doc.text([worker.work, rate, worker.mobile].filter(Boolean).join("   "), 12, 37);

  const table = (options) =>
    autoTable(doc, {
      margin: { left: 12, right: 12 },
      theme: "grid",
      styles: { font: "DejaVuSans", fontSize: 8.5, cellPadding: 1.8, textColor: 20, lineColor: 180, lineWidth: 0.15 },
      headStyles: { fillColor: 240, textColor: 20, fontStyle: "bold" },
      footStyles: { fillColor: 240, textColor: 20, fontStyle: "bold" },
      showFoot: "lastPage",
      ...options,
    });

  table({
    startY: 42,
    head: [["Present", "Half days", "Absent", "Leave"]],
    body: [[summary.present, summary.half, summary.absent, summary.leave]],
  });

  const off = daysOff(worker);
  table({
    startY: doc.lastAutoTable.finalY + 6,
    head: [["Days off and half days", "Day", "Marked as"]],
    body: off.length ? off.map(([date, status]) => [day(date), weekday(date), LABEL[status]]) : [["None this month", "", ""]],
  });

  const payments = paymentsInOrder(worker);
  table({
    startY: doc.lastAutoTable.finalY + 6,
    head: [["Money given on", "Type", "Note", "Amount (₹)"]],
    body: payments.length
      ? payments.map((p) => [day(p.date), p.kind === "advance" ? "Advance" : "Salary / wages", p.note, amount(p.amount)])
      : [["Nothing paid this month", "", "", ""]],
    foot: [["Total", "", "", amount(summary.paid)]],
    columnStyles: { 3: { halign: "right" } },
  });

  table({
    startY: doc.lastAutoTable.finalY + 6,
    body: [
      ["Pay earned this month", amount(summary.earned)],
      ["Less: advance taken", amount(summary.advance)],
      ["Less: salary already paid", amount(summary.salaryPaid)],
    ],
    foot: [[summary.balance < 0 ? "Taken more than earned" : "Left to pay", `₹${amount(Math.abs(summary.balance))}`]],
    columnStyles: { 1: { halign: "right" } },
  });

  let y = doc.lastAutoTable.finalY + 22;
  if (y > 285) {
    doc.addPage();
    y = 40;
  }
  font(8.5);
  doc.text("Worker's signature", 12, y);
  doc.text("Owner's signature", 198, y, { align: "right" });

  doc.save(`${worker.name.replace(/[^A-Za-z0-9]+/g, "-")}-${month}.pdf`);
}
