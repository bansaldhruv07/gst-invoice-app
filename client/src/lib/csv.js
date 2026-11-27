// Cells that start with these characters can run as formulas in spreadsheet apps
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value) {
  if (typeof value === "number") return String(value);
  let text = String(value ?? "");
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(fileName, rows) {
  const body = rows.map((row) => row.map(cell).join(",")).join("\r\n");
  // The byte-order mark makes Excel read ₹ and Hindi text correctly
  const url = URL.createObjectURL(new Blob(["\uFEFF", body], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// Reads CSV text into objects keyed by the headings, lower-cased with spaces
// removed. Handles quoted cells, doubled quotes and line breaks inside quotes.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  // Excel in some regions separates with semicolons or tabs
  const firstLine = input.split(/\r?\n/, 1)[0];
  const separator = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) {
      row.push(value);
      value = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else value += ch;
  }
  if (value || row.length) rows.push([...row, value]);

  const filled = rows.filter((r) => r.some((c) => c.trim()));
  if (filled.length < 2) return [];
  const headings = filled[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return filled.slice(1).map((r) => Object.fromEntries(headings.map((h, i) => [h, (r[i] ?? "").trim()])));
}
