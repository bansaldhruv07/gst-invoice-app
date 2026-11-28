// Browser side of PDF generation: loads fonts and images, then saves or shares.
import api from "../api/axios";
import regularUrl from "dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url";
import boldUrl from "dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url";

let fontCache = null;

async function toBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load the invoice font");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function loadFonts() {
  if (!fontCache) {
    fontCache = Promise.all([toBase64(regularUrl), toBase64(boldUrl)])
      .then(([regular, bold]) => ({ regular, bold }))
      .catch((err) => {
        fontCache = null;
        throw err;
      });
  }
  return fontCache;
}

// Resolves to null when the image is missing or the host blocks cross-origin use.
function loadImage(url) {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        resolve({ data: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// The bill with the chosen copies, ready to preview, print or save
export async function makeInvoicePdf(invoice, copies) {
  return buildDocument(copies?.length ? { ...invoice, printCopies: copies } : invoice, {
    suffix: copies?.length > 1 ? "All" : { transporter: "Dup", supplier: "Tri" }[copies?.[0]] || "Org",
  });
}

async function buildDocument(record, options = {}) {
  const [{ data }, { default: jsPDF }, layout, fonts] = await Promise.all([
    api.get("/auth/supplier-info"),
    import("jspdf"),
    import("./invoiceLayout.js"),
    loadFonts(),
  ]);
  const supplier = data.supplier;
  const [logo, signature] = await Promise.all([
    loadImage(supplier.logoUrl),
    loadImage(record.signatureUrl || supplier.signatureUrl),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  layout.registerFonts(doc, fonts);
  layout.renderInvoice(doc, { invoice: record, supplier, logo, signature, ...options });

  return {
    doc,
    fileName: layout.invoiceFileName(record, options.suffix),
    logoMissing: Boolean(supplier.logoUrl) && !logo,
  };
}

const fetchRecord = async (value, path, key) =>
  typeof value === "string" ? (await api.get(`/${path}/${value}`)).data[key] : value;

function save({ doc, fileName, logoMissing }) {
  doc.save(fileName);
  // The caller warns when a saved logo did not load
  return { logoMissing };
}

export async function downloadInvoicePdf(invoiceOrId) {
  return save(await buildDocument(await fetchRecord(invoiceOrId, "invoices", "invoice")));
}

// Whether this device can hand a PDF to WhatsApp, email and so on
export function canSharePdf() {
  try {
    const probe = new File(["x"], "x.pdf", { type: "application/pdf" });
    return Boolean(navigator.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
}

export async function shareInvoicePdf(invoice, copies) {
  const { doc, fileName } = await makeInvoicePdf(invoice, copies);
  const file = new File([doc.output("blob")], fileName, { type: "application/pdf" });
  try {
    await navigator.share({ files: [file], title: invoice.invoiceNumber });
  } catch (err) {
    if (err.name !== "AbortError") throw err; // closing the share sheet is fine
  }
}

export async function downloadQuotationPdf(quotationOrId) {
  const quotation = await fetchRecord(quotationOrId, "quotations", "quotation");
  const { formatBillDate: date } = await import("./invoiceLayout.js");
  return save(
    await buildDocument(
      { ...quotation, printCopies: ["recipient"] },
      {
        title: "QUOTATION",
        suffix: "Quotation",
        meta: (q, seller) => ({
          left: [
            ["Quotation No.", q.invoiceNumber],
            ["Quotation Date", date(q.invoiceDate)],
            ["Valid Until", date(q.validUntil)],
            ["State", seller.state],
          ],
          right: [
            ["Challan No.", q.challanNumber],
            ["Vehicle No.", q.vehicleNumber],
            ["Date of Supply", date(q.dateOfSupply)],
            ["Place of Supply", q.placeOfSupply],
          ],
        }),
      },
    ),
  );
}

export async function downloadCreditNotePdf(note, invoice) {
  const { formatBillDate: date } = await import("./invoiceLayout.js");
  // Seller and bank details follow the invoice being credited
  const record = {
    ...invoice,
    items: note.items,
    invoiceNumber: note.number,
    invoiceDate: note.date,
    taxType: note.taxType,
    subTotal: note.subTotal,
    discountAmount: note.discountAmount,
    grandTotal: note.grandTotal,
    printCopies: ["recipient"],
    signatureUrl: invoice.signatureUrl,
    ewayBillNumber: "",
    irn: "",
    ackNumber: "",
  };
  return save(
    await buildDocument(record, {
      title: "CREDIT NOTE",
      suffix: "CreditNote",
      meta: (n, seller) => ({
        left: [
          ["Reverse Charge", "No"],
          ["Credit Note No.", n.invoiceNumber],
          ["Date", date(n.invoiceDate)],
          ["State", seller.state],
        ],
        right: [
          ["Against Invoice", invoice.invoiceNumber],
          ["Invoice Date", date(invoice.invoiceDate)],
          ["Reason", note.reason],
          ["Place of Supply", invoice.placeOfSupply],
        ],
      }),
    }),
  );
}
