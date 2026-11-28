// The bill form works out totals in the browser. It must agree with the server,
// which has the final say.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const server = require("../services/gst");

test("the form and the server agree on many kinds of line", async () => {
  const { computeTotals } = await import("../../client/src/lib/gst.js");
  const pick = (list, n) => list[n % list.length];
  for (let n = 0; n < 600; n += 1) {
    const lines = [0, 1, 2].map((i) => {
      const m = n * 7 + i * 13;
      const rate = ((m * 977) % 500000) / 100 + 50;
      const quantity = ((m * 31) % 400) / 8 + 1;
      return {
        name: "x", quantity, rate,
        gstPercent: pick(server.GST_RATES, m),
        taxMode: pick(["", "inclusive", "exclusive"], m + i),
        discountType: pick(["percent", "amount"], n + i),
        discountValue: pick([0, 5, 12.5, 40], m),
        cessType: pick(["percent", "amount"], Math.floor(n / 3) + i),
        cessValue: pick([0, 0, 1, 15], n + i),
      };
    });
    const options = {
      taxType: pick(["cgst_sgst", "igst"], n),
      taxMode: pick(["exclusive", "inclusive"], Math.floor(n / 2)),
      billOfSupply: n % 11 === 0,
      discountType: pick(["percent", "amount"], n),
      discountValue: pick([0, 1, 3], n),
    };
    const mine = computeTotals(lines, options);
    const theirs = server.computeTotals(lines, options);
    for (const key of ["subTotal", "totalCgst", "totalSgst", "totalIgst", "totalTax", "totalCess", "grandTotal", "roundOff"]) {
      assert.equal(mine[key], theirs[key], `${key} differs in case ${n}: ${JSON.stringify({ lines, options })}`);
    }
    mine.items.forEach((l, i) => {
      for (const key of ["taxableAmount", "cessAmount", "totalAmount", "discountAmount"]) {
        assert.equal(l[key], theirs.items[i][key], `line ${key} differs in case ${n}`);
      }
    });
  }
});
