import { test } from "node:test";
import assert from "node:assert/strict";
import { amountInWords } from "../src/lib/amountInWords.js";
import { parseCsv, downloadCsv } from "../src/lib/csv.js";
import { upiLink } from "../src/lib/upi.js";

test("amounts are written in the Indian system", () => {
  assert.match(amountInWords(12345678), /One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight/);
  assert.match(amountInWords(100000), /One Lakh/);
});

test("CSV files from spreadsheets are read, including quoted cells", () => {
  const rows = parseCsv('﻿Name;Opening Balance;Address\r\n"Verma; Sons";500;"Line 1\nLine ""2"""\r\n\r\n');
  assert.deepEqual(rows, [{ name: "Verma; Sons", openingbalance: "500", address: 'Line 1\nLine "2"' }]);
  assert.deepEqual(parseCsv("name\n"), []);
});

test("exported cells cannot run as spreadsheet formulas", async () => {
  let saved;
  globalThis.URL.createObjectURL = (blob) => {
    saved = blob;
    return "blob:test";
  };
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.document = { createElement: () => ({ click() {} }) };
  downloadCsv("x.csv", [["=HYPERLINK(1)", "+1", "@x", -5, "plain"]]);
  assert.equal((await saved.text()).replace("﻿", ""), "'=HYPERLINK(1),'+1,'@x,-5,plain");
});

test("a UPI link carries the payee, amount and bill number", () => {
  assert.equal(
    upiLink({ upiId: "shop@okbank", name: "Verma & Sons", amount: 1180.5, note: "INV/1" }),
    "upi://pay?pa=shop@okbank&pn=Verma%20%26%20Sons&am=1180.50&cu=INR&tn=INV%2F1",
  );
});
