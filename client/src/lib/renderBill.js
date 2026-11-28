// Draws a bill in the chosen design.
import { renderInvoice } from "./invoiceLayout.js";
import { renderThemed } from "./themedLayout.js";

export function renderBill(doc, { template, color, ...options }) {
  return !template || template === "classic"
    ? renderInvoice(doc, options)
    : renderThemed(doc, { ...options, template, color });
}
