// The Modern, Minimal and Elegant bills. They carry the same details as the
// Classic bill (invoiceLayout.js) in a different design. Coordinates are
// millimetres on A4. No browser or bundler dependencies: pass a jsPDF document.
import { amountInWords } from "./amountInWords.js";
import { defaultTerms } from "./terms.js";
import {
  COPY_LABELS, createPen, formatBillDate, money, resolveParties, unitRate,
} from "./invoiceLayout.js";
import { colorOf } from "./billDesigns.js";

const PAGE_W = 210;
const PAGE_H = 297;
const LEFT = 12;
const RIGHT = PAGE_W - LEFT;
const WIDTH = RIGHT - LEFT;
const BOTTOM = PAGE_H - 14;

const INK = [24, 31, 54];
const GREY = [100, 109, 130];
const LINE = [214, 219, 230];
const WHITE = [255, 255, 255];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (list, pick) => round2(list.reduce((total, x) => total + (pick(x) || 0), 0));
const rupee = (n) => `₹${money(n)}`;

// Transport left as "none" is not printed
const MODES = { road: "Road", rail: "Rail", air: "Air", ship: "Ship" };

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
// `amount` of the colour, the rest white
const tint = (colour, amount) => colour.map((c) => Math.round(255 - (255 - c) * amount));

function createBrush(doc, accent) {
  const pen = createPen(doc);
  const write = (value, x, y, { colour = INK, ...options } = {}) => {
    doc.setTextColor(...colour);
    pen.text(value, x, y, options);
  };
  const box = (x, y, w, h, colour, radius = 0) => {
    doc.setFillColor(...colour);
    if (radius) doc.roundedRect(x, y, w, h, radius, radius, "F");
    else doc.rect(x, y, w, h, "F");
  };
  const rule = (y, { x1 = LEFT, x2 = RIGHT, colour = LINE, width = 0.2 } = {}) => {
    doc.setDrawColor(...colour);
    doc.setLineWidth(width);
    doc.line(x1, y, x2, y);
  };
  const picture = (image, name, x, y, w, h, align = "center") => {
    const ratio = Math.min(w / image.width, h / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    const left = align === "left" ? x : align === "right" ? x + w - width : x + (w - width) / 2;
    doc.addImage(image.data, "PNG", left, y + (h - height) / 2, width, height, name, "FAST");
  };
  return { write, wrap: pen.wrap, box, rule, picture, accent };
}

const addressOf = (seller) => [seller.address, seller.city, seller.state, seller.pincode].filter(Boolean).join(", ");
const contactOf = (seller) => [seller.phone, seller.email].filter(Boolean).join("  |  ");
const gstinOf = (seller) =>
  seller.gstin ? `GSTIN : ${seller.gstin}${seller.stateCode ? `   State code : ${seller.stateCode}` : ""}` : "";

// ─── Headers ──────────────────────────────────────────────────────────────────
// Each returns the height at which the body of the bill starts.
const HEADERS = {
  modern({ write, wrap, box, picture, accent }, { seller, logo, title, copy }) {
    const lines = wrap(addressOf(seller), 104, 8.4).slice(0, 2);
    const height = 36 + (lines.length > 1 ? 4 : 0);
    box(0, 0, PAGE_W, height, accent);
    let x = LEFT;
    if (logo?.data) {
      box(LEFT, 8, 22, 20, WHITE, 2);
      picture(logo, "logo", LEFT + 1.5, 9.5, 19, 17);
      x = LEFT + 27;
    }
    const max = 128 - x;
    write(seller.name, x, 13.5, { size: 15, bold: true, colour: WHITE, max });
    lines.forEach((line, i) => write(line, x, 19 + i * 4, { size: 8.4, colour: WHITE, max }));
    const after = 19 + lines.length * 4;
    write(contactOf(seller), x, after, { size: 8.4, colour: WHITE, max });
    write(gstinOf(seller), x, after + 4.4, { size: 8.4, bold: true, colour: WHITE, max });
    write(title, RIGHT, 14.5, { size: 17, bold: true, colour: WHITE, align: "right", max: 62 });
    write(copy.toUpperCase(), RIGHT, 21, { size: 6.8, colour: WHITE, align: "right" });
    return height + 6;
  },

  minimal({ write, wrap, rule, picture, accent }, { seller, logo, title, copy }) {
    const max = logo?.data ? 132 : WIDTH;
    write(seller.name, LEFT, 18, { size: 17, bold: true, max });
    const lines = wrap(addressOf(seller), max, 8.4).slice(0, 2);
    lines.forEach((line, i) => write(line, LEFT, 24 + i * 4.2, { size: 8.4, colour: GREY }));
    const after = 24 + lines.length * 4.2;
    write(contactOf(seller), LEFT, after, { size: 8.4, colour: GREY, max });
    write(gstinOf(seller), LEFT, after + 4.6, { size: 8.4, bold: true, max });
    if (logo?.data) picture(logo, "logo", RIGHT - 38, 10, 38, 24, "right");
    const y = Math.max(after + 9, 38);
    rule(y, { colour: accent, width: 0.9 });
    write(title, LEFT, y + 9, { size: 15, colour: accent });
    write(copy.toUpperCase(), RIGHT, y + 8.4, { size: 6.8, colour: GREY, align: "right" });
    return y + 13;
  },

  elegant({ write, wrap, box, rule, picture, accent }, { seller, logo, title, copy }) {
    let y = 9;
    if (logo?.data) {
      picture(logo, "logo", PAGE_W / 2 - 20, y, 40, 16);
      y += 18;
    }
    const centre = { align: "center", max: WIDTH };
    write(seller.name, PAGE_W / 2, y + 6, { ...centre, size: 17, bold: true, colour: accent });
    const lines = wrap(addressOf(seller), 150, 8.4).slice(0, 2);
    lines.forEach((line, i) => write(line, PAGE_W / 2, y + 11.5 + i * 4.2, { ...centre, size: 8.4, colour: GREY }));
    let next = y + 11.5 + lines.length * 4.2;
    write(contactOf(seller), PAGE_W / 2, next, { ...centre, size: 8.4, colour: GREY });
    write(gstinOf(seller), PAGE_W / 2, next + 4.6, { ...centre, size: 8.4, bold: true });
    next += 8.5;
    rule(next, { colour: accent, width: 0.8 });
    rule(next + 1.4, { colour: accent });
    box(PAGE_W / 2 - 34, next + 4.5, 68, 9, tint(accent, 0.12), 4.5);
    write(title, PAGE_W / 2, next + 10.6, { size: 11.5, bold: true, colour: accent, align: "center", max: 62 });
    write(copy.toUpperCase(), RIGHT, next + 10.4, { size: 6.8, colour: GREY, align: "right" });
    return next + 18;
  },
};

// ─── Bill details and parties ────────────────────────────────────────────────
function detailRows(invoice, seller, meta) {
  const rows = meta
    ? [...meta.left, ...meta.right]
    : [
        ["Invoice No.", invoice.invoiceNumber],
        ["Invoice Date", formatBillDate(invoice.invoiceDate)],
        ["Due Date", formatBillDate(invoice.dueDate)],
        ["Date of Supply", formatBillDate(invoice.dateOfSupply || invoice.invoiceDate)],
        ["Place of Supply", invoice.placeOfSupply],
        ["State", seller.state],
        ["Reverse Charge", invoice.reverseCharge ? "Yes" : "No"],
        ["Challan No.", invoice.challanNumber],
        ["Vehicle No.", invoice.vehicleNumber],
        ["Transport", [invoice.transporterName, MODES[invoice.transportMode]].filter(Boolean).join(", ")],
        ["LR No.", [invoice.lrNumber, formatBillDate(invoice.lrDate)].filter(Boolean).join("  ")],
      ];
  return rows.filter(([, value]) => value);
}

function partyLines(wrap, party, width) {
  if (!party.name) return [];
  return [
    ...wrap(party.name, width, 9.6, true).slice(0, 2).map((text) => ({ text, size: 9.6, bold: true })),
    ...wrap(party.address, width, 8).slice(0, 3).map((text) => ({ text, size: 8, colour: GREY })),
    { text: `GSTIN : ${party.gstin}`, size: 8 },
    ...(party.state
      ? [{ text: `State : ${party.state}${party.stateCode ? ` (${party.stateCode})` : ""}`, size: 8 }]
      : []),
  ];
}

function drawDetails(brush, style, { invoice, seller, buyer, consignee, meta, top }) {
  const { write, wrap, box, rule, accent } = brush;
  const rows = detailRows(invoice, seller, meta);
  const half = Math.ceil(rows.length / 2);

  // Details in two columns of label and value
  const detailsHeight = half * 4.8 + 5;
  if (style === "elegant") box(LEFT, top, WIDTH, detailsHeight, tint(accent, 0.06), 2);
  if (style === "modern") box(LEFT, top, WIDTH, detailsHeight, [246, 247, 251], 2);
  rows.forEach(([label, value], i) => {
    const x = i < half ? LEFT + 3 : LEFT + WIDTH / 2 + 3;
    const y = top + 5.6 + (i % half) * 4.8;
    write(label, x, y, { size: 8, colour: GREY });
    write(value, x + 31, y, { size: 8.2, bold: true, max: WIDTH / 2 - 37 });
  });
  let y = top + detailsHeight + 4;
  if (style === "minimal") {
    rule(y - 2);
    y += 1;
  }

  const width = WIDTH / 2 - 3;
  const parties = [
    ["BILL TO", buyer],
    ...(consignee.name ? [["SHIP TO", consignee]] : []),
  ].map(([label, party]) => ({ label, lines: partyLines(wrap, party, width - 6) }));
  const height = 8 + Math.max(...parties.map((p) => p.lines.length), 1) * 4.3;

  parties.forEach((party, i) => {
    const x = LEFT + i * (WIDTH / 2 + 3);
    if (style === "elegant") box(x, y, width, height, tint(accent, 0.06), 2);
    write(party.label, x + (style === "elegant" ? 3 : 0), y + 4.4, { size: 7.4, bold: true, colour: accent });
    party.lines.forEach(({ text, ...look }, n) =>
      write(text, x + (style === "elegant" ? 3 : 0), y + 9.4 + n * 4.3, { ...look, max: width - 6 }),
    );
  });
  return y + height + 4;
}

// ─── Items ────────────────────────────────────────────────────────────────────
function columnsFor(invoice) {
  const supply = invoice.invoiceType === "bill_of_supply";
  const taxes = supply
    ? []
    : invoice.taxType === "igst"
      ? [{ key: "igst", title: "IGST", width: 20 }]
      : [{ key: "cgst", title: "CGST", width: 18 }, { key: "sgst", title: "SGST", width: 18 }];
  const list = [
    { key: "index", title: "#", width: 8, align: "left" },
    { key: "name", title: "Item", width: 0, align: "left" },
    { key: "hsn", title: "HSN/SAC", width: 19, align: "left" },
    { key: "qty", title: "Qty", width: 17, align: "right" },
    { key: "rate", title: "Rate", width: 20, align: "right" },
    ...(supply ? [] : [{ key: "taxable", title: "Taxable", width: 22, align: "right" }]),
    ...taxes.map((t) => ({ ...t, align: "right" })),
    { key: "total", title: "Amount", width: 25, align: "right" },
  ];
  const used = list.reduce((s, c) => s + c.width, 0);
  list[1].width = WIDTH - used;
  let x = LEFT;
  return list.map((c) => {
    const placed = { ...c, x, at: c.align === "right" ? x + c.width - 1.6 : x + 1.6 };
    x += c.width;
    return placed;
  });
}

function drawTableHead({ write, box, rule, accent }, style, columns, top) {
  const height = 8;
  let colour = GREY;
  if (style === "modern") {
    box(LEFT, top, WIDTH, height, tint(accent, 0.13), 1.5);
    colour = accent;
  } else if (style === "elegant") {
    box(LEFT, top, WIDTH, height, accent, 1.5);
    colour = WHITE;
  } else {
    rule(top + height, { colour: INK, width: 0.35 });
  }
  columns.forEach((c) =>
    write(c.title, c.at, top + 5.3, { size: 7.6, bold: true, colour, align: c.align, max: c.width - 2 }),
  );
  return top + height;
}

function itemRow(wrap, item, index, invoice, columns) {
  const width = columns[1].width - 3;
  const name = wrap(item.name, width, 8.4, true);
  const extras = [
    ...(item.description ? wrap(item.description, width, 7).slice(0, 2) : []),
    ...(item.discountAmount > 0 ? [`Less discount ${rupee(item.discountAmount)}`] : []),
    ...(item.cessAmount > 0 ? [`CESS ${rupee(item.cessAmount)}`] : []),
  ];
  const hasTax = columns.some((c) => c.key === "cgst" || c.key === "igst");
  const height = Math.max(name.length * 4 + extras.length * 3.4 + 3.4, hasTax ? 11 : 7.6);
  const amount = (item.taxableAmount || 0) + (item.cgstAmount || 0) + (item.sgstAmount || 0) +
    (item.igstAmount || 0) + (item.cessAmount || 0);
  return { item, index, name, extras, height, amount, rate: unitRate(item, invoice) };
}

function drawItem({ write, box, rule, accent }, style, columns, row, top, shaded) {
  const { item, index, name, extras, height, amount, rate } = row;
  if (style === "elegant" && shaded) box(LEFT, top, WIDTH, height, tint(accent, 0.05));
  const y = top + 5;
  const values = {
    index: String(index + 1),
    hsn: item.hsn,
    qty: `${round2(item.quantity)} ${String(item.unit || "").toUpperCase()}`,
    rate,
    taxable: money(item.taxableAmount),
    total: money(amount),
  };
  columns.forEach((c) => {
    if (c.key === "name") {
      name.forEach((line, i) => write(line, c.at, y + i * 4, { size: 8.4, bold: true }));
      extras.forEach((line, i) =>
        write(line, c.at, y + name.length * 4 + i * 3.4 - 0.3, { size: 7, colour: GREY, max: c.width - 3 }),
      );
      return;
    }
    const look = { size: 8, align: c.align, max: c.width - 2.4 };
    if (["cgst", "sgst", "igst"].includes(c.key)) {
      write(money(item[`${c.key}Amount`]), c.at, y, look);
      write(`${round2(item[`${c.key}Percent`])}%`, c.at, y + 3.6, { ...look, size: 6.8, colour: GREY });
      return;
    }
    write(values[c.key], c.at, y, { ...look, bold: c.key === "total", colour: c.key === "index" ? GREY : INK });
  });
  rule(top + height);
}

// ─── Totals, bank, terms and signature ───────────────────────────────────────
function summaryParts(brush, { invoice, seller, bank }) {
  const { wrap } = brush;
  const supply = invoice.invoiceType === "bill_of_supply";
  const itemsTotal = sum(invoice.items, (i) => i.totalAmount);
  const cess = sum(invoice.items, (i) => i.cessAmount);
  const discount = round2(invoice.discountAmount);
  const roundOff = round2(invoice.grandTotal - (itemsTotal - discount));
  const taxes = supply
    ? []
    : invoice.taxType === "igst"
      ? [["IGST", sum(invoice.items, (i) => i.igstAmount)]]
      : [
          ["CGST", sum(invoice.items, (i) => i.cgstAmount)],
          ["SGST", sum(invoice.items, (i) => i.sgstAmount)],
        ];
  const totals = [
    [supply ? "Amount" : "Taxable amount", rupee(invoice.subTotal)],
    ...(discount > 0 ? [["Discount", `- ${rupee(discount)}`]] : []),
    ...taxes.map(([label, value]) => [label, rupee(value)]),
    ...(cess > 0 ? [["CESS", rupee(cess)]] : []),
    ...(roundOff ? [["Round off", roundOff.toFixed(2)]] : []),
  ];

  const bankRows = [
    ["Account name", bank.holder],
    ["Account number", bank.account],
    ["IFSC", bank.ifsc],
    ["Bank", bank.name],
    ["Branch", bank.branch],
  ].filter(([, value]) => value);
  // A name alone is not enough to pay into
  const showBank = bank.account || bank.ifsc;

  const numbers = [
    ...(invoice.ewayBillNumber
      ? [`E-Way Bill No. : ${invoice.ewayBillNumber}${invoice.ewayBillDate ? `  (${formatBillDate(invoice.ewayBillDate)})` : ""}`]
      : []),
    ...(invoice.irn ? [`IRN : ${invoice.irn}`] : []),
    ...(invoice.ackNumber
      ? [`Ack No. : ${invoice.ackNumber}${invoice.ackDate ? `  (${formatBillDate(invoice.ackDate)})` : ""}`]
      : []),
  ];

  const leftWidth = 104;
  const words = wrap(amountInWords(invoice.grandTotal), leftWidth, 8.6, true).slice(0, 3);
  const terms = (invoice.terms || defaultTerms(seller.city))
    .split("\n")
    .flatMap((line) => wrap(line, leftWidth, 7.4))
    .slice(0, 12);

  const leftHeight = 10 + words.length * 4.3 + (showBank ? 8 + bankRows.length * 4.2 : 0) +
    8 + terms.length * 3.5 + numbers.length * 3.5;
  const rightHeight = totals.length * 5.6 + 13 + 40;
  return {
    quantity: round2(invoice.items.reduce((s, i) => s + (i.quantity || 0), 0)),
    totals, bankRows: showBank ? bankRows : [], numbers, words, terms, leftWidth,
    height: Math.max(leftHeight, rightHeight) + 6,
  };
}

function drawSummary(brush, style, parts, { invoice, seller, signature, top }) {
  const { write, box, rule, picture, accent } = brush;
  const x = LEFT + parts.leftWidth + 8;

  write(`Total quantity : ${parts.quantity}`, LEFT, top + 5, { size: 8, colour: GREY });

  // Right: the totals and the signature
  let y = top + 5;
  if (style === "elegant") box(x - 3, top + 0.6, RIGHT - x + 3, parts.totals.length * 5.6 + 2, tint(accent, 0.06), 2);
  parts.totals.forEach(([label, value]) => {
    write(label, x, y, { size: 8.4, colour: GREY });
    write(value, RIGHT - 2, y, { size: 8.4, align: "right", max: 42 });
    y += 5.6;
  });
  const grand = { size: 11.5, bold: true };
  if (style === "modern") {
    box(x - 3, y - 2, RIGHT - x + 3, 10, accent, 1.5);
    grand.colour = WHITE;
  } else if (style === "elegant") {
    box(x - 3, y - 2, RIGHT - x + 3, 10, tint(accent, 0.18), 1.5);
    grand.colour = accent;
  } else {
    rule(y - 2, { x1: x - 3, colour: accent, width: 0.7 });
    rule(y + 8, { x1: x - 3, colour: accent, width: 0.7 });
  }
  write("Total", x, y + 4.6, grand);
  write(rupee(invoice.grandTotal), RIGHT - 2, y + 4.6, { ...grand, align: "right", max: 46 });
  y += 16;

  const middle = (x - 3 + RIGHT) / 2;
  write(`For ${seller.name || ""}`, middle, y, { size: 8.8, bold: true, align: "center", max: RIGHT - x });
  if (signature?.data) picture(signature, "signature", middle - 24, y + 2, 48, 18);
  rule(y + 23, { x1: x + 4, x2: RIGHT - 7 });
  write("Authorised Signatory", middle, y + 27, { size: 7.6, colour: GREY, align: "center" });

  // Left: words, bank and terms
  let l = top + 12;
  write("Amount in words", LEFT, l, { size: 7.4, bold: true, colour: accent });
  parts.words.forEach((line, i) => write(line, LEFT, l + 4.6 + i * 4.3, { size: 8.6, bold: true }));
  l += 4.6 + parts.words.length * 4.3 + 2.5;
  if (parts.bankRows.length) {
    write("Bank details", LEFT, l, { size: 7.4, bold: true, colour: accent });
    parts.bankRows.forEach(([label, value], i) => {
      write(label, LEFT, l + 4.6 + i * 4.2, { size: 7.8, colour: GREY });
      write(value, LEFT + 30, l + 4.6 + i * 4.2, { size: 7.8, bold: true, max: parts.leftWidth - 30 });
    });
    l += 4.6 + parts.bankRows.length * 4.2 + 3;
  }
  write("Terms and conditions", LEFT, l, { size: 7.4, bold: true, colour: accent });
  parts.terms.forEach((line, i) => write(line, LEFT, l + 4.4 + i * 3.5, { size: 7.4, colour: GREY }));
  l += 4.4 + parts.terms.length * 3.5;
  parts.numbers.forEach((line, i) => write(line, LEFT, l + 1.5 + i * 3.5, { size: 6.6, max: parts.leftWidth }));
}

// The short heading on the second and later pages
function drawContinuation({ write, box, rule, accent }, style, { seller, invoice, title, copy }) {
  if (style === "modern") box(0, 0, PAGE_W, 5, accent);
  write(seller.name, LEFT, 15, { size: 11, bold: true, colour: style === "elegant" ? accent : INK, max: 110 });
  write(`${title}  ${invoice.invoiceNumber || ""}`, RIGHT, 15, { size: 9, bold: true, align: "right", max: 72 });
  write(copy.toUpperCase(), RIGHT, 19.4, { size: 6.8, colour: GREY, align: "right" });
  rule(22, { colour: accent, width: 0.5 });
  return 26;
}

export function renderThemed(doc, { invoice, supplier, logo, signature, title: heading, meta, template, color }) {
  const style = HEADERS[template] ? template : "modern";
  const accent = rgb(colorOf(color).hex);
  const brush = createBrush(doc, accent);
  const { seller, buyer, consignee, bank } = resolveParties(invoice, supplier);
  const title = heading || (invoice.invoiceType === "bill_of_supply" ? "BILL OF SUPPLY" : "TAX INVOICE");
  const wanted = invoice.printCopies?.length ? invoice.printCopies : ["recipient"];
  const chosen = COPY_LABELS.filter(([key]) => wanted.includes(key));
  const copies = chosen.length ? chosen : [COPY_LABELS[0]];
  const columns = columnsFor(invoice);
  const rows = invoice.items.map((item, i) => itemRow(brush.wrap, item, i, invoice, columns));
  const parts = summaryParts(brush, { invoice, seller, bank });

  let first = true;
  copies.forEach(([, copy]) => {
    const pages = [];
    const newPage = () => {
      if (!first) doc.addPage();
      first = false;
      pages.push(doc.getNumberOfPages());
    };

    newPage();
    let y = HEADERS[style](brush, { seller, logo, title, copy });
    y = drawDetails(brush, style, { invoice, seller, buyer, consignee, meta: meta?.(invoice, seller), top: y });
    y = drawTableHead(brush, style, columns, y);
    let onPage = 0;
    rows.forEach((row, i) => {
      if (onPage && y + row.height > BOTTOM) {
        newPage();
        y = drawContinuation(brush, style, { seller, invoice, title, copy });
        y = drawTableHead(brush, style, columns, y);
        onPage = 0;
      }
      drawItem(brush, style, columns, row, y, i % 2 === 1);
      y += row.height;
      onPage += 1;
    });
    if (y + parts.height > BOTTOM) {
      newPage();
      y = drawContinuation(brush, style, { seller, invoice, title, copy });
    }
    drawSummary(brush, style, parts, { invoice, seller, signature, top: y + 1 });

    if (pages.length > 1) {
      pages.forEach((number, i) => {
        doc.setPage(number);
        brush.write(`Page ${i + 1} of ${pages.length}`, RIGHT, PAGE_H - 7, { size: 7, colour: GREY, align: "right" });
      });
      doc.setPage(pages.at(-1));
    }
  });

  return doc;
}
