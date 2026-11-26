// A party's account statement as an A4 PDF.
import { loadFonts } from "./invoicePdf";

const amount = (n) =>
  n ? Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
const day = (iso) => (iso ? iso.split("-").reverse().join("-") : "");

export async function downloadStatementPdf({ business, party, ledger, from, to, kind }) {
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

  font(13, true);
  doc.text(business?.name || "", 12, 16);
  font(8.5);
  doc.text([business?.address, business?.city, business?.state].filter(Boolean).join(", "), 12, 21);
  doc.text([business?.phone, business?.gstin && `GSTIN ${business.gstin}`].filter(Boolean).join("   "), 12, 25.5);

  font(11, true);
  doc.text("STATEMENT OF ACCOUNT", 198, 16, { align: "right" });
  font(8.5);
  const period = from || to ? `${day(from) || "Start"} to ${day(to) || "today"}` : "All transactions";
  doc.text(period, 198, 21, { align: "right" });

  font(9, true);
  doc.text(party.name, 12, 35);
  font(8.5);
  doc.text([party.address, party.city, party.state].filter(Boolean).join(", "), 12, 40, { maxWidth: 150 });
  if (party.gstin) doc.text(`GSTIN ${party.gstin}`, 12, 45);

  autoTable(doc, {
    startY: 50,
    margin: { left: 12, right: 12 },
    theme: "grid",
    styles: { font: "DejaVuSans", fontSize: 8, cellPadding: 1.6, textColor: 20, lineColor: 180, lineWidth: 0.15 },
    headStyles: { fillColor: 240, textColor: 20, fontStyle: "bold" },
    footStyles: { fillColor: 240, textColor: 20, fontStyle: "bold" },
    head: [["Date", "Type", "Reference", "Debit", "Credit", "Balance"]],
    body: [
      [day(from), "Balance brought forward", "", "", "", amount(ledger.broughtForward) || "0.00"],
      ...ledger.rows.map((r) => [day(r.date), r.type, r.ref, amount(r.debit), amount(r.credit), amount(r.balance) || "0.00"]),
    ],
    foot: [["", "Total", "", amount(ledger.totalDebit), amount(ledger.totalCredit), amount(ledger.closing) || "0.00"]],
    showFoot: "lastPage",
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  const y = doc.lastAutoTable.finalY + 8;
  font(10, true);
  const owes = kind === "buyer" ? "Amount receivable" : "Amount payable";
  const label = ledger.closing < 0 ? "Advance / credit balance" : owes;
  doc.text(`${label}: ₹${amount(Math.abs(ledger.closing)) || "0.00"}`, 198, y > 285 ? 285 : y, { align: "right" });

  doc.save(`Statement-${party.name.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`);
}
