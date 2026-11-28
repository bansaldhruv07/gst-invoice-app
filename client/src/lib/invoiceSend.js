// Ways of getting a bill to the buyer or the printer.
import { makeInvoicePdf, canSharePdf, shareInvoicePdf } from "./invoicePdf";
import { money, shortDate, whatsappReminder } from "./format";

const warnLogo = (result, toast) => {
  if (result.logoMissing) toast.error("Your logo could not be loaded. Upload it again in Settings.");
};

export async function downloadBill(invoice, copies, toast) {
  const result = await makeInvoicePdf(invoice, copies);
  result.doc.save(result.fileName);
  warnLogo(result, toast);
}

// Computers print from a hidden frame. Phones open the PDF, whose viewer prints.
export async function printBill(invoice, copies) {
  const phone = window.matchMedia("(pointer: coarse)").matches;
  // Opened before any waiting, or the browser blocks it
  const tab = phone ? window.open("", "_blank") : null;
  const { doc } = await makeInvoicePdf(invoice, copies);
  const url = URL.createObjectURL(doc.output("blob"));
  if (phone) {
    if (tab) tab.location.href = url;
    else window.location.href = url;
    return;
  }
  document.getElementById("print-frame")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "print-frame";
  frame.title = "Printing";
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  frame.onload = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };
  frame.src = url;
  document.body.appendChild(frame);
}

export async function shareBill(invoice, copies, toast) {
  if (canSharePdf()) return shareInvoicePdf(invoice, copies);
  await downloadBill(invoice, copies, toast);
  toast("The PDF was downloaded. Attach it where you want to send it.");
}

const mailLink = (invoice, subject, body) =>
  `mailto:${encodeURIComponent(invoice.buyer?.email || "").replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

// Phones hand the PDF to the mail app. Computers cannot attach it for you.
export async function emailBill(invoice, business, toast) {
  if (canSharePdf() && window.matchMedia("(pointer: coarse)").matches) return shareInvoicePdf(invoice);
  await downloadBill(invoice, ["recipient"], toast);
  const body = [
    `Dear ${invoice.buyer?.name || "Sir/Madam"},`,
    `Please find invoice ${invoice.invoiceNumber} dated ${shortDate(invoice.invoiceDate)} for ${money(invoice.grandTotal)}.`,
    business ? `Thank you,\n${business}` : "Thank you.",
  ].join("\n\n");
  window.location.href = mailLink(invoice, `Invoice ${invoice.invoiceNumber}${business ? ` from ${business}` : ""}`, body);
  toast("The PDF was downloaded. Attach it to the email that opens.");
}

// WhatsApp when there is a mobile number, otherwise email
export function remindBuyer(invoice, business, toast) {
  const details = {
    mobile: invoice.buyer?.mobile, buyer: invoice.buyer?.name, invoiceNumber: invoice.invoiceNumber,
    balance: invoice.balanceAmount, dueDate: invoice.dueDate, business,
  };
  const whatsapp = whatsappReminder(details);
  if (whatsapp) return window.open(whatsapp, "_blank", "noopener");
  if (invoice.buyer?.email) {
    window.location.href = mailLink(
      invoice,
      `Payment reminder for ${invoice.invoiceNumber}`,
      `Dear ${invoice.buyer.name},\n\n${money(invoice.balanceAmount)} is pending on invoice ${invoice.invoiceNumber}. Kindly arrange the payment.\n\n${business || ""}`,
    );
    return;
  }
  toast.error("Add the buyer's mobile number or email to send a reminder");
}
