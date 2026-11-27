export const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

// Whole rupees, for headline figures
export const rupees = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export const shortDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

// Opens WhatsApp with a message ready to send; nothing is sent automatically.
// Returns null when there is no usable mobile number.
export function whatsappReminder({ mobile, buyer, invoiceNumber, balance, dueDate, business }) {
  let digits = String(mobile || "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11) return null;
  const text = [
    `Dear ${buyer},`,
    `This is a reminder that ${money(balance)} is pending on invoice ${invoiceNumber}` +
      (dueDate ? `, due on ${shortDate(dueDate)}.` : "."),
    "Kindly arrange the payment. Please ignore this if you have already paid.",
    business ? `Thank you,\n${business}` : "Thank you.",
  ].join("\n\n");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
