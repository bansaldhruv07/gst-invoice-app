// Draws the tax invoice. All coordinates are millimetres on A4, measured from the
// reference bill, so change them only when the printed format itself changes.
// This module has no browser or bundler dependencies: pass it a jsPDF document.
import { amountInWords } from "./amountInWords.js";
import { defaultTerms } from "./terms.js";

const FONT = "DejaVuSans";
const LINE = 0.2;

const LEFT = 8.3;
const RIGHT = 201.4;
const BOTTOM = 260.75;

const ITEMS_TOP = 112.16; // first item row starts here
const TOTAL_ROW_TOP = 165.01; // last page: items end here
const TOTAL_ROW_BOTTOM = 170.3;
const ROW_HEIGHT = 5.29;
const WRAP_STEP = 3.05;
const CONTINUED_LIMIT = BOTTOM - ROW_HEIGHT; // other pages: items may run to here

const COPY_LABELS = [
  ["recipient", "Original for Recipient"],
  ["transporter", "Duplicate for Transporter"],
  ["supplier", "Triplicate for Supplier"],
];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n) =>
  round2(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const rupee = (n) => `₹${money(n)}`;
// Item-row tax amounts are printed without digit grouping.
const plain = (n) => round2(n).toFixed(2);
const sum = (list, pick) => round2(list.reduce((total, x) => total + (pick(x) || 0), 0));

export function formatBillDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const two = (n) => String(n).padStart(2, "0");
  return `${two(d.getDate())}-${two(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function registerFonts(doc, { regular, bold }) {
  doc.addFileToVFS("DejaVuSans.ttf", regular);
  doc.addFont("DejaVuSans.ttf", FONT, "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", bold);
  doc.addFont("DejaVuSans-Bold.ttf", FONT, "bold");
}

// ─── Primitives ───────────────────────────────────────────────────────────────
function createPen(doc) {
  const font = (size, bold) => {
    doc.setFont(FONT, bold ? "bold" : "normal");
    doc.setFontSize(size);
  };

  // Writes one line, shrinking the type if it would overflow `max` mm.
  const text = (value, x, y, { size = 8.07, bold = false, align = "left", max } = {}) => {
    const str = String(value ?? "");
    if (!str) return;
    font(size, bold);
    if (max) {
      const width = doc.getTextWidth(str);
      if (width > max) doc.setFontSize((size * max) / width);
    }
    doc.text(str, x, y, { align });
  };

  const wrap = (value, width, size = 8.07, bold = false) => {
    font(size, bold);
    return doc.splitTextToSize(String(value ?? ""), width);
  };

  const h = (y, x1 = LEFT, x2 = RIGHT) => doc.line(x1, y, x2, y);
  const v = (x, y1, y2) => doc.line(x, y1, x, y2);

  return { text, wrap, h, v };
}

// ─── Columns ──────────────────────────────────────────────────────────────────
// Boundaries of Sr | Name | HSN | Qty | Unit | Rate | Taxable
const BASE_X = [LEFT, 15.62, 48.75, 68.06, 76.39, 85.54, 99.36, 121.72];
const TOTAL_X = 179.04;
// IGST needs one tax column pair, so the spare width goes to the product name.
const IGST_SHIFT = 18;

function baseColumns(invoice) {
  if (invoice.taxType !== "igst") return BASE_X;
  return BASE_X.map((x, i) => (i >= 2 ? x + IGST_SHIFT : x));
}

function taxGroups(invoice) {
  if (invoice.taxType === "igst") {
    return [
      { title: "IGST", x1: 121.72 + IGST_SHIFT, mid: 156, x2: TOTAL_X, rate: "igstPercent", amount: "igstAmount" },
    ];
  }
  return [
    { title: "CGST", x1: 121.72, mid: 134.52, x2: 150.38, rate: "cgstPercent", amount: "cgstAmount" },
    { title: "SGST", x1: 150.38, mid: 162.98, x2: TOTAL_X, rate: "sgstPercent", amount: "sgstAmount" },
  ];
}

// ─── Static top section (repeated on every page) ──────────────────────────────
function drawHeader(doc, pen, { seller, logo, title, copy }) {
  const { text, h, v } = pen;

  if (logo?.data) {
    const box = { x: 9.42, y: 9.42, w: 34.55, h: 27.44 };
    const ratio = Math.min(box.w / logo.width, box.h / logo.height);
    const w = logo.width * ratio;
    const ht = logo.height * ratio;
    doc.addImage(logo.data, "PNG", box.x + (box.w - w) / 2, box.y + (box.h - ht) / 2, w, ht, "logo", "FAST");
  }

  const cx = 108.65;
  const max = 124;
  const address = [seller.address, seller.city, seller.state, seller.pincode].filter(Boolean).join(", ");
  text(seller.name, cx, 16.33, { size: 11.52, bold: true, align: "center", max });
  text(address && `${address},`, cx, 21.41, { size: 8.64, bold: true, align: "center", max: 150 });
  text(seller.phone && `${seller.phone},`, cx, 26.49, { size: 8.64, bold: true, align: "center", max });
  text(seller.email, cx, 31.58, { size: 8.64, bold: true, align: "center", max });
  text(seller.gstin && `GSTIN : ${seller.gstin}`, cx, 36.86, { bold: true, align: "center", max });
  h(38.59);

  // Title band with the copy checklist
  text(title, 105.97, 46.21, { size: 11.52, bold: true, align: "center" });
  v(166.64, 38.59, 50.99);
  v(170.7, 38.59, 50.99);
  h(42.86, 166.64);
  h(46.92, 166.64);
  COPY_LABELS.forEach(([key, label], i) => {
    text(label, 171.25, [41.33, 45.6, 49.67][i], { size: 6.34 });
    if (key === copy) {
      const top = [39.71, 43.9, 47.97][i];
      doc.setLineWidth(0.28);
      doc.line(167.35, top + 1.15, 168.2, top + 1.95);
      doc.line(168.2, top + 1.95, 169.95, top + 0.15);
      doc.setLineWidth(LINE);
    }
  });
  h(50.99);
}

// The four label/value rows on each side. Other documents (quotation, credit
// note) pass their own rows and keep the same layout.
function invoiceMeta(invoice, seller) {
  const left = [
    ["Reverse Charge", "No"],
    ["Invoice No.", invoice.invoiceNumber],
    ["Invoice Date", formatBillDate(invoice.invoiceDate)],
    ["State", seller.state],
  ];
  const right = [
    ["Challan No.", invoice.challanNumber],
    ["Vehicle No.", invoice.vehicleNumber],
    ["Date of Supply", formatBillDate(invoice.dateOfSupply || invoice.invoiceDate)],
    ["Place of Supply", invoice.placeOfSupply],
  ];
  return { left, right };
}

function drawMeta(pen, { invoice, seller, meta }) {
  const { text, h, v } = pen;
  const { left, right } = meta || invoiceMeta(invoice, seller);
  left.forEach(([label, value], i) => {
    const y = [54.34, 58.81, 63.08, 67.55][i];
    text(label, 9.02, y, { size: 8.64 });
    text(`: ${value || ""}`, 58.69, y, { size: 8.64, max: 29 });
  });
  right.forEach(([label, value], i) => {
    const y = [54.75, 59.83, 64.91, 69.99][i];
    text(label, 105.66, y, { size: 8.64 });
    text(`: ${value || ""}`, 151.52, y, { size: 8.64, max: 48 });
  });

  v(105.05, 50.99, 71.51);
  h(64.4, 88.79, 105.05);
  v(88.79, 64.4, 71.51);
  text("State", 89.42, 68.16, { size: 6.91 });
  text("Code", 89.42, 70.8, { size: 6.91 });
  text(`: ${seller.stateCode || ""}`, 97.97, 69.38, { size: 8.64 });
  h(71.51);
}

function drawParty(pen, party, offset) {
  const { text, wrap } = pen;
  const { labelX, colonX, valueX, codeX, codeValueX, nameY, addressY, gstinY } = offset;
  const width = 74;

  text("Name", labelX, nameY);
  text(":", colonX, nameY);
  if (wrap(party.name, width, 7).length > 1) {
    // Too long for one readable line: use two.
    wrap(party.name, width, 6.8)
      .slice(0, 2)
      .forEach((line, i) => text(line, valueX, nameY - 0.5 + i * 2.5, { size: 6.8, max: width }));
  } else {
    text(party.name, valueX, nameY, { max: width });
  }

  // Normally two lines; longer addresses shrink and take up to three.
  let size = 8.07;
  let lines = wrap(party.address, width, size);
  while (lines.length > 2 && size > 6.4) {
    size -= 0.4;
    lines = wrap(party.address, width, size);
  }
  while (lines.length > 3 && size > 4.8) {
    size -= 0.3;
    lines = wrap(party.address, width, size);
  }
  const threeLines = lines.length > 2;
  const step = threeLines ? 2.2 : WRAP_STEP;
  const firstLine = addressY - (threeLines ? 0.5 : 0.2);

  text("Address", labelX, addressY);
  text(":", colonX, addressY);
  lines.slice(0, 3).forEach((line, i) => {
    text(line, valueX, firstLine + i * step, { size });
  });

  text("GSTIN", labelX, gstinY);
  text(":", colonX, gstinY);
  text(party.gstin, valueX, gstinY);

  text("State", labelX, 99.06);
  text(":", colonX, 99.06);
  text(party.state, valueX - 0.6, 98.45, { max: 52 });

  text("State", codeX, 97.84, { size: 6.91 });
  text("Code", codeX, 100.89, { size: 6.91 });
  text(`: ${party.stateCode || ""}`, codeValueX, 98.45);
}

function drawParties(pen, buyer) {
  const { text, h, v } = pen;
  text("Details of Receiver | Billed to:", 56.6, 75.07, { bold: true, align: "center" });
  text("Details of Consignee | Shipped to:", 153.2, 75.07, { bold: true, align: "center" });
  v(104.95, 71.51, 76.8);
  h(76.8);
  v(104.85, 76.8, 101.6);

  drawParty(pen, buyer, {
    labelX: 9.62, colonX: 25.29, valueX: 28.78, codeX: 84.63, codeValueX: 96.21,
    nameY: 80.97, addressY: 86.05, gstinY: 93.16,
  });
  drawParty(pen, buyer, {
    labelX: 105.56, colonX: 122.03, valueX: 125.63, codeX: 181.17, codeValueX: 195.61,
    nameY: 80.36, addressY: 85.44, gstinY: 92.76,
  });

  h(94.68, 83.9, 104.85);
  v(83.9, 94.68, 101.6);
  h(94.68, 180.46);
  v(180.46, 94.68, 101.6);
  h(101.6);
}

function drawTableHead(pen, cols, groups) {
  const { text, h } = pen;
  const head = { bold: true, align: "center" };
  const mid = (i) => (cols[i] + cols[i + 1]) / 2;

  text("Sr.", mid(0), 106.37, head);
  text("No.", mid(0), 109.42, head);
  text("Name of product", mid(1), 107.8, head);
  text("HSN/SAC", mid(2), 107.8, head);
  text("QTY", mid(3), 107.8, head);
  text("Unit", mid(4), 107.8, head);
  text("Rate", mid(5), 107.8, head);
  text("Taxable", mid(6), 106.37, head);
  text("Value", mid(6), 109.42, head);
  groups.forEach((g) => {
    text(g.title, (g.x1 + g.x2) / 2, 105.15, head);
    text("Rate", (g.x1 + g.mid) / 2, 110.44, head);
    text("Amount", (g.mid + g.x2) / 2, 110.44, head);
  });
  text("Total", (TOTAL_X + RIGHT) / 2, 107.8, head);

  h(106.88, cols[7], TOTAL_X);
  h(ITEMS_TOP);
}

function drawColumnLines(pen, cols, groups, bottom) {
  const { v } = pen;
  cols.slice(1).forEach((x) => v(x, 101.6, bottom));
  groups.forEach((g) => {
    v(g.mid, 106.88, bottom);
    v(g.x2, 101.6, bottom);
  });
}

function drawItem(pen, row, cols, groups, top) {
  const { text, h } = pen;
  const { item, index, nameLines } = row;
  const y = top + 3.55;
  const center = (i) => (cols[i] + cols[i + 1]) / 2;

  text(index + 1, center(0), y, { align: "center" });
  nameLines.forEach((line, i) => text(line, cols[1] + 0.67, y + i * WRAP_STEP));
  text(item.hsn, cols[2] + 0.72, y, { max: 18 });
  text(item.quantity, center(3), y, { align: "center", max: 7.8 });
  text(String(item.unit || "").toUpperCase(), center(4), y, { align: "center", max: 8.6 });
  text(money(item.rate), cols[6] - 0.76, y, { align: "right", max: 12.8 });
  text(money(item.taxableAmount), cols[7] - 0.62, y, { align: "right", max: 21 });
  groups.forEach((g) => {
    text(`${plain(item[g.rate])}%`, (g.x1 + g.mid) / 2, y, { align: "center", max: g.mid - g.x1 - 0.8 });
    text(plain(item[g.amount]), (g.mid + g.x2) / 2, y, { align: "center", max: g.x2 - g.mid - 0.8 });
  });
  const lineTotal = item.taxableAmount + groups.reduce((s, g) => s + (item[g.amount] || 0), 0);
  text(money(lineTotal), 201.1, y, { bold: true, align: "right", max: 21.4 });

  h(top + row.height);
}

// ─── Footer (last page only) ──────────────────────────────────────────────────
function drawTotalRow(pen, { invoice, cols, groups }) {
  const { text, h, v } = pen;
  const bold = { bold: true };
  const y = 168.57;

  h(TOTAL_ROW_TOP);
  [cols[3], cols[6], cols[7], ...groups.map((g) => g.x2)].forEach((x) =>
    v(x, TOTAL_ROW_TOP, TOTAL_ROW_BOTTOM),
  );

  text("Total Quantity", (LEFT + cols[3]) / 2, y, { ...bold, align: "center" });
  text(round2(invoice.items.reduce((s, i) => s + (i.quantity || 0), 0)), cols[3] + 3.07, y, bold);
  text(rupee(invoice.subTotal), cols[7] - 0.22, y, { ...bold, align: "right", max: 21.6 });
  groups.forEach((g) => {
    text(rupee(sum(invoice.items, (i) => i[g.amount])), (g.x1 + g.x2) / 2, y, {
      ...bold, align: "center", max: g.x2 - g.x1 - 1,
    });
  });
  text(rupee(sum(invoice.items, (i) => i.totalAmount)), 201.1, y, { ...bold, align: "right", max: 21.4 });

  h(TOTAL_ROW_BOTTOM);
}

function drawSummary(pen, { invoice, groups }) {
  const { text, h, v } = pen;
  const itemsTotal = sum(invoice.items, (i) => i.totalAmount);
  const gst = sum(invoice.items, (i) => i.totalAmount - i.taxableAmount);
  const discount = round2(invoice.discountAmount);
  const roundOff = round2(invoice.grandTotal - (itemsTotal - discount));

  const sections = [
    [
      ["Total Amount Before Tax", rupee(invoice.subTotal), true],
      ...(discount > 0 ? [["Less : Discount", rupee(discount), false]] : []),
    ],
    groups.map((g) => [`Add : ${g.title}`, rupee(sum(invoice.items, (i) => i[g.amount])), false]),
    [
      ["Tax Amount : GST", rupee(gst), false],
      ["Round Off Value:", plain(roundOff), true],
      ["Amount With Tax", rupee(invoice.grandTotal), true],
    ],
  ];

  let top = 170.5;
  sections.forEach((rows) => {
    rows.forEach(([label, value, bold]) => {
      const y = top + 3.45;
      text(label, 124.46, y);
      text(":", 162.98, y);
      text(value, 201.1, y, { bold, align: "right", max: 33.5 });
      top += 5.18;
    });
    h(top, 124.16);
  });
  v(166.64, 170.5, top);
}

function drawFooter(doc, pen, { invoice, seller, bank, signature, cols, groups }) {
  const { text, wrap, h, v } = pen;

  drawTotalRow(pen, { invoice, cols, groups });
  h(170.5);
  v(124.16, 170.5, BOTTOM);

  // Amount in words
  const left = (LEFT + 124.16) / 2;
  text("Total Invoice Amount in words", left, 174.06, { size: 7.49, bold: true, align: "center" });
  const words = wrap(amountInWords(invoice.grandTotal), 112, 9.22).slice(0, 2);
  const wordsTop = words.length > 1 ? 178.8 : 180.56;
  words.forEach((line, i) => text(line, left, wordsTop + i * 3.9, { size: 9.22, align: "center" }));
  h(185.34, LEFT, 124.16);

  drawSummary(pen, { invoice, groups });

  // Bank details
  text("Bank Details", left, 188.89, { bold: true, align: "center" });
  [
    ["Account Holder Name :", bank.holder],
    ["Bank Account Number :", bank.account],
    ["Bank IFSC Code :", bank.ifsc],
    ["Bank Name :", bank.name],
    ["Bank Branch Name :", bank.branch],
  ].forEach(([label, value], i) => {
    const y = 192.96 + i * 5.08;
    text(label, 8.81, y, { size: 7.49 });
    text(value, 123.7, y, { size: 7.49, align: "right", max: 76 });
  });
  h(216.03);
  h(216.23);

  // Terms
  text("Terms And Conditions", 9.62, 219.99, { bold: true });
  const terms = (invoice.terms || defaultTerms(seller.city))
    .split("\n")
    .flatMap((line) => wrap(line, 112, 7.49));
  terms.slice(0, 12).forEach((line, i) => text(line, 9.62, 225.68 + i * WRAP_STEP, { size: 7.49 }));

  // Signature block
  const right = (124.16 + RIGHT) / 2;
  text("Certified that the particular given above are true", right, 219.38, { align: "center" });
  text("and correct", right, 222.43, { align: "center" });
  text(`For, ${seller.name || ""}`, right, 227.31, { size: 9.79, bold: true, align: "center", max: 74 });
  if (signature?.data) {
    const ratio = Math.min(48 / signature.width, 24 / signature.height);
    const w = signature.width * ratio;
    const ht = signature.height * ratio;
    doc.addImage(signature.data, "PNG", right - w / 2, 230 + (24 - ht) / 2, w, ht, "signature", "FAST");
  }
  text("Authorised Signatory", right, 259.02, { align: "center" });
}

// Splits rows into pages, keeping the last page short enough for the footer.
function paginate(rows) {
  const lastCapacity = TOTAL_ROW_TOP - ITEMS_TOP;
  const fullCapacity = CONTINUED_LIMIT - ITEMS_TOP;
  const height = (list) => list.reduce((s, r) => s + r.height, 0);
  const pages = [];
  let rest = rows;

  while (height(rest) > lastCapacity + 0.01 && rest.length > 1) {
    let used = 0;
    let take = 0;
    while (take < rest.length - 1 && used + rest[take].height <= fullCapacity) {
      used += rest[take].height;
      take += 1;
    }
    take = Math.max(take, 1);
    pages.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  pages.push(rest);
  return pages;
}

export function resolveParties(invoice, supplier = {}) {
  const pick = (override, key) => override || supplier[key] || "";
  const seller = {
    name: pick(invoice.supplierName, "name"),
    gstin: pick(invoice.supplierGstin, "gstin"),
    address: pick(invoice.supplierAddress, "address"),
    city: pick(invoice.supplierCity, "city"),
    state: pick(invoice.supplierState, "state"),
    pincode: pick(invoice.supplierPincode, "pincode"),
    phone: pick(invoice.supplierPhone, "phone"),
    email: pick(invoice.supplierEmail, "email"),
    stateCode: pick(invoice.supplierStateCode, "stateCode"),
  };

  const b = invoice.buyer || {};
  const buyer = {
    name: b.name || "",
    address: [b.address, b.city, b.state, b.pincode].filter(Boolean).join(", "),
    gstin: b.gstin || "Unregistered",
    state: b.state || "",
    stateCode: b.stateCode || "",
  };

  const o = invoice.bankDetailsOverride || {};
  const custom = [o.bankName, o.bankAccount, o.bankIfsc, o.bankBranch, o.bankHolderName].some(Boolean);
  const bank = custom
    ? { holder: o.bankHolderName, account: o.bankAccount, ifsc: o.bankIfsc, name: o.bankName, branch: o.bankBranch }
    : {
        holder: seller.name,
        account: supplier.bankAccount,
        ifsc: supplier.bankIfsc,
        name: supplier.bankName,
        branch: supplier.bankBranch,
      };

  return { seller, buyer, bank };
}

export function renderInvoice(doc, { invoice, supplier, logo, signature, title: heading, meta }) {
  const pen = createPen(doc);
  const { seller, buyer, bank } = resolveParties(invoice, supplier);
  const groups = taxGroups(invoice);
  const cols = baseColumns(invoice);
  const title = heading || (invoice.invoiceType === "bill_of_supply" ? "BILL OF SUPPLY" : "TAX INVOICE");
  const copies = COPY_LABELS.map(([key]) => key).filter((key) =>
    (invoice.printCopies?.length ? invoice.printCopies : ["recipient"]).includes(key),
  );

  const rows = invoice.items.map((item, index) => {
    const nameLines = pen.wrap(item.name, cols[2] - cols[1] - 1.5);
    return { item, index, nameLines, height: ROW_HEIGHT + (nameLines.length - 1) * WRAP_STEP };
  });
  const pages = paginate(rows);

  let first = true;
  (copies.length ? copies : ["recipient"]).forEach((copy) => {
    pages.forEach((pageRows, pageIndex) => {
      if (!first) doc.addPage();
      first = false;

      doc.setDrawColor(0, 0, 0);
      doc.setTextColor(0, 0, 0);
      doc.setLineWidth(LINE);
      doc.rect(LEFT, LEFT, RIGHT - LEFT, BOTTOM - LEFT);

      drawHeader(doc, pen, { seller, logo, title, copy });
      drawMeta(pen, { invoice, seller, meta: meta?.(invoice, seller) });
      drawParties(pen, buyer);
      drawTableHead(pen, cols, groups);

      let top = ITEMS_TOP;
      pageRows.forEach((row) => {
        drawItem(pen, row, cols, groups, top);
        top += row.height;
      });

      if (pageIndex === pages.length - 1) {
        drawColumnLines(pen, cols, groups, TOTAL_ROW_TOP);
        drawFooter(doc, pen, { invoice, seller, bank, signature, cols, groups });
      } else {
        drawColumnLines(pen, cols, groups, CONTINUED_LIMIT);
        pen.h(CONTINUED_LIMIT);
        pen.text("Continued on next page", RIGHT - 2, BOTTOM - 1.8, { bold: true, align: "right" });
      }
    });
  });

  return doc;
}

export function invoiceFileName(invoice, suffix = "Org") {
  const clean = (s) => String(s || "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const number = String(invoice.invoiceNumber || "invoice").replace(/\//g, "-").replace(/[^A-Za-z0-9-]/g, "");
  return [number, clean(invoice.buyer?.name), suffix].filter(Boolean).join("-") + ".pdf";
}
