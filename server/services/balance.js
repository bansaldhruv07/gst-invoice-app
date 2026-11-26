const { round2, sum } = require("./common");

const AUTO_PAID_NOTE = "Marked as paid";

// Recomputes what is still owed from payments and credit notes. Cancelled
// invoices keep their status.
function refreshBalance(invoice) {
  const paid = sum(invoice.paymentHistory, (p) => p.amount);
  const credited = round2(invoice.creditedAmount);
  invoice.paidAmount = paid;
  invoice.balanceAmount = Math.max(0, round2(invoice.grandTotal - paid - credited));
  if (invoice.status !== "cancelled") {
    invoice.status =
      invoice.balanceAmount === 0 ? "paid" : paid > 0 || credited > 0 ? "partial" : "unpaid";
  }
  return invoice;
}

module.exports = { refreshBalance, AUTO_PAID_NOTE };
