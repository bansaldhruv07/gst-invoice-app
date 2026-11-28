// Every bill design draws every kind of bill, and the free bill maker's totals.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { jsPDF } from "jspdf";
import { registerFonts } from "../src/lib/invoiceLayout.js";
import { renderBill } from "../src/lib/renderBill.js";
import { TEMPLATES, COLORS } from "../src/lib/billDesigns.js";
import { SELLER, sampleInvoice } from "../src/lib/sampleBill.js";
import { blankForm, sampleForm, buildGuestBill, missingFrom } from "../src/lib/guestBill.js";
import { priceOf } from "../src/lib/pricing.js";

const require = createRequire(import.meta.url);
const font = (file) => fs.readFileSync(require.resolve(`dejavu-fonts-ttf/ttf/${file}`)).toString("base64");
const fonts = { regular: font("DejaVuSans.ttf"), bold: font("DejaVuSans-Bold.ttf") };

function draw(options) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  registerFonts(doc, fonts);
  const written = [];
  const text = doc.text.bind(doc);
  doc.text = (value, ...rest) => {
    written.push(String(value));
    return text(value, ...rest);
  };
  renderBill(doc, { supplier: SELLER, ...options });
  return { pages: doc.getNumberOfPages(), text: written.join("\n") };
}

for (const { id } of TEMPLATES) {
  test(`${id}: one page holds a short bill with its tax and total`, () => {
    const { pages, text } = draw({ template: id, color: "green", invoice: sampleInvoice() });
    assert.equal(pages, 1);
    for (const expected of ["SHS2026-27/142", "Verma Constructions", "Tile Adhesive 20 kg", "35069190", "₹10,939.00", SELLER.name]) {
      assert.ok(text.includes(expected), `${expected} is printed`);
    }
    assert.match(text, /CGST/);
  });

  test(`${id}: a long bill runs over pages, once for each copy`, () => {
    const base = sampleInvoice();
    const invoice = { ...base, items: Array.from({ length: 60 }, (_, i) => ({ ...base.items[0], name: `Product ${i + 1}` })) };
    const one = draw({ template: id, invoice });
    assert.ok(one.pages > 1);
    assert.ok(one.text.includes("Product 60"));
    const two = draw({ template: id, invoice: { ...invoice, printCopies: ["recipient", "transporter"] } });
    assert.equal(two.pages, one.pages * 2);
  });

  test(`${id}: bill of supply, inter-state sale and a different heading`, () => {
    const base = sampleInvoice();
    const supply = draw({ template: id, invoice: { ...base, invoiceType: "bill_of_supply", consigneeMode: "none", showBankDetails: false } });
    assert.match(supply.text, /BILL OF SUPPLY/);
    const igst = draw({ template: id, invoice: { ...base, taxType: "igst" } });
    assert.match(igst.text, /IGST/);
    const quote = draw({
      template: id, invoice: base, title: "QUOTATION",
      meta: () => ({ left: [["Quotation No.", "QT-9"]], right: [["Place of Supply", "Delhi"]] }),
    });
    assert.match(quote.text, /QUOTATION/);
    assert.ok(quote.text.includes("QT-9"));
  });
}

test("every colour works", () => {
  for (const { id } of COLORS) assert.equal(draw({ template: "modern", color: id, invoice: sampleInvoice() }).pages, 1);
});

test("the free bill maker works out tax from the two states", () => {
  const form = sampleForm("2026-11-28");
  assert.equal(missingFrom(form), "");
  const local = buildGuestBill(form).invoice;
  assert.deepEqual([local.taxType, local.grandTotal, local.items[0].cgstPercent], ["cgst_sgst", 10939, 9]);
  const away = buildGuestBill({ ...form, buyer: { ...form.buyer, gstin: "", state: "Haryana" } }).invoice;
  assert.deepEqual([away.taxType, away.items[0].igstPercent, away.items[0].cgstAmount], ["igst", 18, 0]);
  const supply = buildGuestBill({ ...form, billOfSupply: true }).invoice;
  assert.equal(supply.grandTotal, 9270);
});

test("the free bill maker says what is missing", () => {
  const form = blankForm("2026-11-28");
  assert.match(missingFrom(form), /business name/);
  const named = { ...form, seller: { ...form.seller, name: "A" }, buyer: { ...form.buyer, name: "B" } };
  assert.match(missingFrom(named), /at least one product/);
  assert.match(missingFrom({ ...named, lines: [{ ...form.lines[0], name: "Cement" }] }), /rate/);
  assert.equal(draw({ template: "classic", invoice: buildGuestBill(form).invoice, supplier: buildGuestBill(form).supplier }).pages, 1);
});

test("discounts shown on plans are never overstated", () => {
  const plan = { price: 499, listPrice: 699, yearlyPrice: 4999 };
  assert.deepEqual(priceOf(plan, "monthly"), { amount: 499, before: 699, saving: 200, percent: 28, perMonth: 499 });
  assert.deepEqual(priceOf(plan, "yearly"), { amount: 4999, before: 5988, saving: 989, percent: 16, perMonth: 417 });
  assert.equal(priceOf({ price: 0, listPrice: 0, yearlyPrice: 0 }, "yearly").percent, 0);
});
