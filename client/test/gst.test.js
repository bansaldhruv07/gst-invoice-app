// The arithmetic behind the bill form. The server tests compare it with the
// server's own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateLine, taxTypeFor } from "../src/lib/gst.js";

test("a tax-inclusive line is worked back to its taxable value", () => {
  const line = calculateLine({ quantity: 14, rate: 2150, gstPercent: 18, taxMode: "inclusive" }, "cgst_sgst");
  assert.equal(line.totalAmount, 30100);
  assert.equal(line.taxableAmount, 25508.47);
});

test("discount comes off before tax, and CESS is shown apart from GST", () => {
  const line = calculateLine(
    { quantity: 10, rate: 100, gstPercent: 28, discountType: "percent", discountValue: 10, cessType: "percent", cessValue: 12 },
    "igst",
  );
  assert.equal(line.discountAmount, 100);
  assert.equal(line.taxableAmount, 900);
  assert.equal(line.igstAmount, 252);
  assert.equal(line.cessAmount, 108);
  assert.equal(line.totalAmount, 1260);
});

test("supplies to SEZ units and abroad are always inter-state", () => {
  for (const treatment of ["sez", "overseas"]) assert.equal(taxTypeFor("07", "07", treatment), "igst");
  assert.equal(taxTypeFor("07", "07", "registered"), "cgst_sgst");
});
