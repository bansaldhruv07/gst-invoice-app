// Turns an invoice or quotation request into the fields to store.
const Buyer = require("../models/Buyer");
const { taxTypeFor, computeTotals } = require("./gst");
const { BadRequest } = require("./common");
const { roleOf } = require("./permissions");
const { stateCodeFor } = require("./states");

// Free-text fields copied as sent
const TEXT_FIELDS = [
  "notes", "challanNumber", "vehicleNumber", "lrNumber", "placeOfSupply", "transporterName",
  "transporterId", "optionalField1", "optionalValue1", "optionalField2", "optionalValue2",
  "signatureUrl", "supplierName", "supplierGstin", "supplierAddress", "supplierCity",
  "supplierState", "supplierPincode", "supplierPhone", "supplierEmail", "supplierStateCode",
  "ewayBillNumber",
];

const CONSIGNEE_FIELDS = ["name", "gstin", "address", "city", "state", "pincode"];

// "Shipped to": the buyer, nobody, or another address
function consigneeFields(body) {
  const mode = ["none", "other"].includes(body.consigneeMode) ? body.consigneeMode : "same";
  if (mode !== "other") return { consigneeMode: mode, consignee: {} };
  const consignee = Object.fromEntries(
    CONSIGNEE_FIELDS.map((key) => [key, String(body.consignee?.[key] || "").trim().slice(0, 200)]),
  );
  if (!consignee.name) throw new BadRequest("Enter the consignee's name");
  consignee.gstin = consignee.gstin.toUpperCase();
  consignee.stateCode = consignee.gstin.slice(0, 2) || stateCodeFor(consignee.state);
  return { consigneeMode: mode, consignee };
}

const SUPPLIER_FIELDS = [
  "supplierName", "supplierGstin", "supplierAddress", "supplierCity", "supplierState",
  "supplierPincode", "supplierPhone", "supplierEmail", "supplierStateCode",
];

const withBusinessDetails = (user, body) => ({
  ...body,
  ...Object.fromEntries(SUPPLIER_FIELDS.map((key) => [key, user[key] || ""])),
  bankDetailsOverride: null,
  showBankDetails: true,
  signatureUrl: "",
});

async function buildDocument(user, body) {
  if (!body.buyerId) throw new BadRequest("Choose a buyer");
  const buyer = await Buyer.findOne({ _id: body.buyerId, user: user._id });
  if (!buyer) throw new BadRequest("Buyer not found", 404);

  // Staff cannot change whose name, bank account or signature goes on a bill
  if (roleOf(user) === "staff") body = withBusinessDetails(user, body);

  const invoiceType = body.invoiceType === "bill_of_supply" ? "bill_of_supply" : "tax_invoice";
  const taxMode = body.taxMode === "inclusive" ? "inclusive" : "exclusive";
  const taxType = taxTypeFor(
    body.supplierStateCode || user.supplierStateCode || "07",
    buyer.stateCode,
    buyer.gstTreatment,
  );

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
    showBankDetails: body.showBankDetails !== false,
    reverseCharge: body.reverseCharge === true,
    ewayBillDate: body.ewayBillDate || null,
    ...consigneeFields(body),
  };
  for (const key of TEXT_FIELDS) fields[key] = body[key] || "";

  return fields;
}

// Two records saved at the same moment can pick the same number; the unique index
// rejects the second, which waits a moment and takes the next one.
const MAX_ATTEMPTS = 30;

async function createNumbered(Model, fields, numberKey, nextNumber) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await Model.create({ ...fields, [numberKey]: await nextNumber() });
    } catch (err) {
      if (err.code !== 11000 || attempt >= MAX_ATTEMPTS) throw err;
      // A random pause stops the waiting requests from colliding again together
      await new Promise((resolve) => setTimeout(resolve, Math.random() * Math.min(attempt * 15, 150)));
    }
  }
}

module.exports = { buildDocument, createNumbered };
