// GST arithmetic for invoices, quotations and credit notes.
// The browser previews the same rules in CreateInvoice.jsx.
const mongoose = require("mongoose");
const { round2, sum, BadRequest } = require("./common");

const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];

const taxTypeFor = (supplierStateCode, buyerStateCode) =>
  buyerStateCode && buyerStateCode !== supplierStateCode ? "igst" : "cgst_sgst";

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

    if (!name) throw new BadRequest(`Item ${i + 1} needs a name`);
    if (!(quantity > 0)) throw new BadRequest(`Enter a quantity for ${name}`);
    if (!(rate >= 0)) throw new BadRequest(`Enter a rate for ${name}`);
    if (!GST_RATES.includes(gstPercent)) throw new BadRequest(`GST rate for ${name} is not valid`);

    return {
      item: mongoose.isValidObjectId(line.item) ? line.item : null,
      name,
      hsn: String(line.hsn || "").trim(),
      unit: String(line.unit || "pcs"),
      quantity,
      rate,
      gstPercent,
    };
  });
}

// taxMode: "exclusive" (rate excludes GST) or "inclusive" (rate includes GST)
function calculateLine(line, taxType, taxMode) {
  const gross = line.rate * line.quantity;
  let taxable = gross;
  let gst = (gross * line.gstPercent) / 100;
  if (taxMode === "inclusive") {
    taxable = gross / (1 + line.gstPercent / 100);
    gst = gross - taxable;
  }
  const taxableAmount = round2(taxable);
  const gstAmount = round2(gst);
  const split = taxType === "cgst_sgst";

  return {
    ...line,
    taxableAmount,
    cgstPercent: split ? line.gstPercent / 2 : 0,
    cgstAmount: split ? round2(gstAmount / 2) : 0,
    sgstPercent: split ? line.gstPercent / 2 : 0,
    sgstAmount: split ? round2(gstAmount / 2) : 0,
    igstPercent: split ? 0 : line.gstPercent,
    igstAmount: split ? 0 : gstAmount,
    totalAmount: round2(taxableAmount + gstAmount),
  };
}

function computeTotals(rawItems, options) {
  const { taxType, taxMode = "exclusive", billOfSupply = false } = options;
  const discountType = options.discountType === "percent" ? "percent" : "amount";
  const discountValue = Number(options.discountValue) || 0;

  const items = cleanLines(rawItems, { billOfSupply }).map((l) => calculateLine(l, taxType, taxMode));

  const subTotal = sum(items, (i) => i.taxableAmount);
  // Tax is summed before the CGST/SGST halves are rounded, so odd paise do not
  // inflate the total.
  const totalTax = sum(items, (i) => i.totalAmount - i.taxableAmount);
  const discountAmount =
    discountType === "percent" ? round2((subTotal * discountValue) / 100) : round2(discountValue);

  if (discountValue < 0 || discountAmount > subTotal + totalTax) {
    throw new BadRequest("Discount cannot be negative or more than the bill");
  }

  const totalAmount = round2(subTotal - discountAmount + totalTax);
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
    totalAmount,
    roundOff: round2(grandTotal - totalAmount),
    grandTotal,
  };
}

module.exports = { GST_RATES, taxTypeFor, computeTotals };
