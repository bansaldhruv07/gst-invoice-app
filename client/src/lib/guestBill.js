// A bill made without signing in. Everything happens in the browser; nothing is
// sent to the server or saved.
import { computeTotals, taxTypeFor } from "./gst.js";
import { stateCodeFor } from "./states.js";
import { SELLER, BUYERS, LINES } from "./sampleBill.js";

export const MAX_LINES = 20;

export const emptyLine = () => ({ name: "", hsn: "", unit: "pcs", quantity: 1, rate: "", gstPercent: 18 });

export const blankForm = (date) => ({
  seller: { name: "", gstin: "", state: "Delhi", address: "", phone: "", bankName: "", bankAccount: "", bankIfsc: "" },
  buyer: { name: "", gstin: "", state: "Delhi", address: "" },
  number: "INV-001",
  date,
  billOfSupply: false,
  inclusive: false,
  logo: "",
  lines: [emptyLine()],
});

export const sampleForm = (date) => ({
  ...blankForm(date),
  seller: {
    name: SELLER.name, gstin: SELLER.gstin, state: SELLER.state, address: `${SELLER.address}, Delhi ${SELLER.pincode}`,
    phone: SELLER.phone, bankName: SELLER.bankName, bankAccount: SELLER.bankAccount, bankIfsc: SELLER.bankIfsc,
  },
  buyer: { name: BUYERS[0].name, gstin: BUYERS[0].gstin, state: BUYERS[0].state, address: BUYERS[0].address },
  lines: LINES.map((line) => ({ ...line })),
});

// Lines with something typed in them
const usable = (lines) => lines.filter((l) => l.name.trim() || Number(l.rate) > 0);

// What still has to be filled in before the bill can be downloaded
export function missingFrom(form) {
  if (!form.seller.name.trim()) return "Enter your business name";
  if (!form.buyer.name.trim()) return "Enter the buyer's name";
  const lines = usable(form.lines);
  if (!lines.length) return "Add at least one product";
  if (lines.some((l) => !l.name.trim() || !(Number(l.quantity) > 0) || !(Number(l.rate) > 0))) {
    return "Each product needs a name, a quantity and a rate";
  }
  return "";
}

const codeOf = (party) => (/^\d{2}/.test(party.gstin) ? party.gstin.slice(0, 2) : stateCodeFor(party.state) || "");

// The bill and the business in the shape the bill designs expect
export function buildGuestBill(form) {
  const seller = { ...form.seller, stateCode: codeOf(form.seller) };
  const buyer = { ...form.buyer, stateCode: codeOf(form.buyer) };
  const taxType = taxTypeFor(seller.stateCode, buyer.stateCode);
  const totals = computeTotals(usable(form.lines), {
    taxType,
    taxMode: form.inclusive ? "inclusive" : "exclusive",
    billOfSupply: form.billOfSupply,
    discountType: "amount",
    discountValue: 0,
  });
  const half = taxType === "igst" ? 0 : 0.5;
  return {
    supplier: seller,
    invoice: {
      ...totals,
      items: totals.items.map((item) => ({
        ...item,
        cgstPercent: item.gstPercent * half,
        sgstPercent: item.gstPercent * half,
        igstPercent: half ? 0 : item.gstPercent,
      })),
      invoiceNumber: form.number.trim() || "INV-001",
      invoiceDate: `${form.date}T00:00:00`,
      invoiceType: form.billOfSupply ? "bill_of_supply" : "tax_invoice",
      taxType,
      taxMode: form.inclusive ? "inclusive" : "exclusive",
      buyer,
      showBankDetails: Boolean(seller.bankAccount),
      bankDetailsOverride: {
        bankHolderName: seller.bankAccount ? seller.name : "",
        bankName: seller.bankName,
        bankAccount: seller.bankAccount,
        bankIfsc: seller.bankIfsc,
      },
      printCopies: ["recipient"],
    },
  };
}

const CREDIT = "Made with GST Invoice";

// Prints the bill in the chosen design, with one line saying where it was made
export async function makeGuestPdf(form, design, logo) {
  const [{ default: jsPDF }, { registerFonts, invoiceFileName }, { renderBill }, { loadFonts }] = await Promise.all([
    import("jspdf"),
    import("./invoiceLayout.js"),
    import("./renderBill.js"),
    import("./invoicePdf.js"),
  ]);
  const { supplier, invoice } = buildGuestBill(form);
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  registerFonts(doc, await loadFonts());
  renderBill(doc, { ...design, invoice, supplier, logo });
  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    doc.setFont("DejaVuSans", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 138, 156);
    doc.text(CREDIT, 105, 293, { align: "center" });
  }
  return { doc, fileName: invoiceFileName(invoice, "Bill") };
}
