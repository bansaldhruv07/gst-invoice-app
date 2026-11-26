// Turns an invoice or quotation request into the fields to store.
const Buyer = require("../models/Buyer");
const { taxTypeFor, computeTotals } = require("./gst");
const { BadRequest } = require("./common");

// Free-text fields copied as sent
const TEXT_FIELDS = [
  "notes", "challanNumber", "vehicleNumber", "lrNumber", "placeOfSupply", "transporterName",
  "transporterId", "optionalField1", "optionalValue1", "optionalField2", "optionalValue2",
  "signatureUrl", "supplierName", "supplierGstin", "supplierAddress", "supplierCity",
  "supplierState", "supplierPincode", "supplierPhone", "supplierEmail", "supplierStateCode",
];

async function buildDocument(user, body) {
  if (!body.buyerId) throw new BadRequest("Choose a buyer");
  const buyer = await Buyer.findOne({ _id: body.buyerId, user: user._id });
  if (!buyer) throw new BadRequest("Buyer not found", 404);

  const invoiceType = body.invoiceType === "bill_of_supply" ? "bill_of_supply" : "tax_invoice";
  const taxMode = body.taxMode === "inclusive" ? "inclusive" : "exclusive";
  const taxType = taxTypeFor(body.supplierStateCode || user.supplierStateCode || "07", buyer.stateCode);

  const totals = computeTotals(body.items, {
    taxType,
    taxMode,
    billOfSupply: invoiceType === "bill_of_supply",
    discountType: body.discountType,
    discountValue: body.discountValue,
  });

  const fields = {
    ...totals,
    user: user._id,
    buyer: buyer._id,
    invoiceType,
    taxMode,
    taxType,
    invoiceDate: body.invoiceDate || new Date(),
    dueDate: body.dueDate || null,
    lrDate: body.lrDate || null,
    dateOfSupply: body.dateOfSupply || null,
    terms: body.terms ?? user.defaultTerms ?? "",
    transportMode: body.transportMode || "none",
    bankDetailsOverride: body.bankDetailsOverride || {
      bankName: "", bankAccount: "", bankIfsc: "", bankBranch: "", bankHolderName: "",
    },
    printCopies: body.printCopies || ["recipient", "transporter", "supplier"],
  };
  for (const key of TEXT_FIELDS) fields[key] = body[key] || "";

  return fields;
}

// Two records saved at the same moment can pick the same number; the unique index
// rejects the second, which then takes the next one.
async function createNumbered(Model, fields, numberKey, nextNumber) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await Model.create({ ...fields, [numberKey]: await nextNumber() });
    } catch (err) {
      if (err.code !== 11000 || attempt >= 3) throw err;
    }
  }
}

module.exports = { buildDocument, createNumbered };
