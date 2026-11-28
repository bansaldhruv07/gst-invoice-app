// GST arithmetic for invoices, quotations and credit notes.
// The browser previews the same rules in client/src/lib/gst.js; the tests check
// that both give the same answers.
const mongoose = require("mongoose");
const { round2, sum, BadRequest } = require("./common");

const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];

// Supplies to SEZ units and outside India are inter-state, whatever the address
const ALWAYS_IGST = ["sez", "overseas"];

const taxTypeFor = (supplierStateCode, buyerStateCode, gstTreatment) =>
  ALWAYS_IGST.includes(gstTreatment) || (buyerStateCode && buyerStateCode !== supplierStateCode)
    ? "igst"
    : "cgst_sgst";

const choice = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

function cleanLines(items, { billOfSupply = false } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequest("Add at least one item");
  }
  if (items.length > 500) throw new BadRequest("An invoice can have up to 500 items");

  return items.map((line, i) => {
    const name = String(line?.name || "").trim();
    const quantity = Number(line?.quantity);
    const rate = Number(line?.rate);
    // A bill of supply does not charge tax
    const gstPercent = billOfSupply ? 0 : Number(line?.gstPercent) || 0;
    const discountValue = Number(line?.discountValue) || 0;
    const cessValue = billOfSupply ? 0 : Number(line?.cessValue) || 0;

    if (!name) throw new BadRequest(`Item ${i + 1} needs a name`);
    if (!(quantity > 0)) throw new BadRequest(`Enter a quantity for ${name}`);
    if (!(rate >= 0)) throw new BadRequest(`Enter a rate for ${name}`);
    if (!GST_RATES.includes(gstPercent)) throw new BadRequest(`GST rate for ${name} is not valid`);
    if (discountValue < 0) throw new BadRequest(`Discount for ${name} cannot be negative`);
    if (cessValue < 0) throw new BadRequest(`CESS for ${name} cannot be negative`);

    return {
      item: mongoose.isValidObjectId(line.item) ? line.item : null,
      name,
      description: String(line.description || "").trim().slice(0, 300),
      hsn: String(line.hsn || "").trim(),
      unit: String(line.unit || "pcs"),
      quantity,
      rate,
      gstPercent,
      // Blank follows the document's setting
      taxMode: choice(line.taxMode, ["exclusive", "inclusive"], ""),
      discountType: choice(line.discountType, ["percent", "amount"], "percent"),
      discountValue,
      cessType: choice(line.cessType, ["percent", "amount"], "percent"),
      cessValue,
    };
  });
}

// The discount comes off quantity × rate. "inclusive" means the rate already
// contains GST and CESS; "exclusive" means they are added on top.
function calculateLine(line, taxType, documentTaxMode = "exclusive") {
  const mode = line.taxMode || documentTaxMode;
  const gross = line.rate * line.quantity;
  const discount = line.discountType === "amount" ? line.discountValue : (gross * line.discountValue) / 100;
  if (discount > gross + 0.001) throw new BadRequest(`Discount for ${line.name} is more than its value`);
  const net = gross - discount;
  const cessRate = line.cessType === "amount" ? 0 : line.cessValue;
  const cessFixed = line.cessType === "amount" ? line.cessValue : 0;

  let taxable = net;
  let gst = (net * line.gstPercent) / 100;
  let cess = (net * cessRate) / 100 + cessFixed;
  if (mode === "inclusive") {
    if (cessFixed > net + 0.001) throw new BadRequest(`CESS for ${line.name} is more than its price`);
    taxable = (net - cessFixed) / (1 + (line.gstPercent + cessRate) / 100);
    cess = (taxable * cessRate) / 100 + cessFixed;
    gst = line.gstPercent ? net - taxable - cess : 0;
  }
  const taxableAmount = round2(taxable);
  const gstAmount = round2(gst);
  const cessAmount = round2(cess);
  const split = taxType === "cgst_sgst";

  return {
    ...line,
    taxMode: mode,
    discountAmount: round2(discount),
    taxableAmount,
    cgstPercent: split ? line.gstPercent / 2 : 0,
    cgstAmount: split ? round2(gstAmount / 2) : 0,
    sgstPercent: split ? line.gstPercent / 2 : 0,
    sgstAmount: split ? round2(gstAmount / 2) : 0,
    igstPercent: split ? 0 : line.gstPercent,
    igstAmount: split ? 0 : gstAmount,
    cessAmount,
    totalAmount: round2(taxableAmount + gstAmount + cessAmount),
  };
}

function computeTotals(rawItems, options) {
  const { taxType, taxMode = "exclusive", billOfSupply = false } = options;
  const discountType = options.discountType === "percent" ? "percent" : "amount";
  const discountValue = Number(options.discountValue) || 0;

  const items = cleanLines(rawItems, { billOfSupply }).map((l) => calculateLine(l, taxType, taxMode));

  const subTotal = sum(items, (i) => i.taxableAmount);
  const totalCess = sum(items, (i) => i.cessAmount);
  // Tax is summed before the CGST/SGST halves are rounded, so odd paise do not
  // inflate the total.
  const totalTax = sum(items, (i) => i.totalAmount - i.taxableAmount - i.cessAmount);
  const discountAmount =
    discountType === "percent" ? round2((subTotal * discountValue) / 100) : round2(discountValue);

  if (discountValue < 0 || discountAmount > subTotal + totalTax + totalCess) {
    throw new BadRequest("Discount cannot be negative or more than the bill");
  }

  const totalAmount = round2(subTotal - discountAmount + totalTax + totalCess);
  const grandTotal = Math.round(totalAmount);

  return {
    items,
    discountType,
    discountValue,
    discountAmount,
    subTotal,
    totalCgst: sum(items, (i) => i.cgstAmount),
    totalSgst: sum(items, (i) => i.sgstAmount),
    totalIgst: sum(items, (i) => i.igstAmount),
    totalTax,
    totalCess,
    totalAmount,
    roundOff: round2(grandTotal - totalAmount),
    grandTotal,
  };
}

module.exports = { GST_RATES, taxTypeFor, cleanLines, calculateLine, computeTotals };
