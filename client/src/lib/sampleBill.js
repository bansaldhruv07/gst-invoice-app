// The made-up sale shown on the home page. The animation types these details in
// and the bill pictures in assets/bills are printed from them by the app's own
// bill designs, so the two always agree.
import { computeTotals } from "./gst.js";

export const SELLER = {
  name: "Sharma Hardware Store", gstin: "07AAAAA0000A1Z5", address: "Shop 14, Main Market, Rohini",
  city: "", state: "Delhi", pincode: "110085", phone: "98765 43210", email: "sales@sharmahardware.example",
  stateCode: "07", bankName: "Sample Bank", bankAccount: "123456789012", bankIfsc: "SAMP0001234",
  bankBranch: "Rohini",
};

export const BUYERS = [
  {
    name: "Verma Constructions", gstin: "07BBBBB1111B1Z5", address: "22, Industrial Area, Wazirpur",
    city: "", state: "Delhi", pincode: "110052", stateCode: "07",
  },
  { name: "Gupta Interiors", city: "Delhi" },
  { name: "City Builders", city: "Delhi" },
];

export const LINES = [
  { name: "Wall Putty 20 kg", hsn: "32141000", unit: "bag", quantity: 10, rate: 450, gstPercent: 18 },
  { name: "White Cement 5 kg", hsn: "25232100", unit: "bag", quantity: 5, rate: 650, gstPercent: 18 },
  { name: "Tile Adhesive 20 kg", hsn: "35069190", unit: "bag", quantity: 4, rate: 380, gstPercent: 18 },
];

export const totalsFor = (count) =>
  computeTotals(LINES.slice(0, count), { taxType: "cgst_sgst", discountType: "amount", discountValue: 0 });

export function sampleInvoice() {
  const totals = totalsFor(LINES.length);
  return {
    ...totals,
    items: totals.items.map((item) => ({
      ...item,
      cgstPercent: item.gstPercent / 2,
      sgstPercent: item.gstPercent / 2,
    })),
    invoiceNumber: "SHS2026-27/142",
    invoiceDate: "2026-11-28T00:00:00",
    invoiceType: "tax_invoice",
    taxType: "cgst_sgst",
    buyer: BUYERS[0],
    printCopies: ["recipient"],
  };
}
