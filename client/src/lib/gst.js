// The same GST rules the server applies (server/services/gst.js), so the form
// shows exactly what will be saved. The tests compare the two.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (list, pick) => round2(list.reduce((total, x) => total + (Number(pick(x)) || 0), 0));

const ALWAYS_IGST = ["sez", "overseas"];

export const taxTypeFor = (supplierStateCode, buyerStateCode, gstTreatment) =>
  ALWAYS_IGST.includes(gstTreatment) || (buyerStateCode && buyerStateCode !== supplierStateCode)
    ? "igst"
    : "cgst_sgst";

export function calculateLine(raw, taxType, documentTaxMode = "exclusive", billOfSupply = false) {
  const number = (v) => Math.max(0, Number(v) || 0);
  const quantity = number(raw.quantity);
  const rate = number(raw.rate);
  const gstPercent = billOfSupply ? 0 : number(raw.gstPercent);
  const discountValue = number(raw.discountValue);
  const cessValue = billOfSupply ? 0 : number(raw.cessValue);
  const mode = raw.taxMode || documentTaxMode;

  const gross = rate * quantity;
  const discount = Math.min(gross, raw.discountType === "amount" ? discountValue : (gross * discountValue) / 100);
  const net = gross - discount;
  const cessRate = raw.cessType === "amount" ? 0 : cessValue;
  const cessFixed = raw.cessType === "amount" ? cessValue : 0;

  let taxable = net;
  let gst = (net * gstPercent) / 100;
  let cess = (net * cessRate) / 100 + cessFixed;
  if (mode === "inclusive") {
    taxable = Math.max(0, net - cessFixed) / (1 + (gstPercent + cessRate) / 100);
    cess = (taxable * cessRate) / 100 + cessFixed;
    gst = gstPercent ? net - taxable - cess : 0;
  }
  const taxableAmount = round2(taxable);
  const gstAmount = round2(gst);
  const cessAmount = round2(cess);
  const split = taxType !== "igst";

  return {
    ...raw,
    taxMode: mode,
    gross: round2(gross),
    discountAmount: round2(discount),
    taxableAmount,
    gstAmount,
    cgstAmount: split ? round2(gstAmount / 2) : 0,
    sgstAmount: split ? round2(gstAmount / 2) : 0,
    igstAmount: split ? 0 : gstAmount,
    cessAmount,
    totalAmount: round2(taxableAmount + gstAmount + cessAmount),
  };
}

export function computeTotals(rawLines, options) {
  const { taxType, taxMode = "exclusive", billOfSupply = false, discountType, discountValue } = options;
  const items = rawLines.map((l) => calculateLine(l, taxType, taxMode, billOfSupply));
  const subTotal = sum(items, (i) => i.taxableAmount);
  const totalCess = sum(items, (i) => i.cessAmount);
  const totalTax = sum(items, (i) => i.totalAmount - i.taxableAmount - i.cessAmount);
  const value = Math.max(0, Number(discountValue) || 0);
  const discountAmount = discountType === "percent" ? round2((subTotal * value) / 100) : round2(value);
  const totalAmount = round2(subTotal - discountAmount + totalTax + totalCess);
  const grandTotal = Math.round(totalAmount);
  return {
    items,
    subTotal,
    totalCgst: sum(items, (i) => i.cgstAmount),
    totalSgst: sum(items, (i) => i.sgstAmount),
    totalIgst: sum(items, (i) => i.igstAmount),
    totalTax,
    totalCess,
    discountAmount,
    totalAmount,
    roundOff: round2(grandTotal - totalAmount),
    grandTotal,
  };
}
