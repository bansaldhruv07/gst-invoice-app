// Indian numbering system (crore / lakh / thousand).
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function belowThousand(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ");
  return [`${ONES[Math.floor(n / 100)]} Hundred`, belowThousand(n % 100)]
    .filter(Boolean)
    .join(" ");
}

function toWords(n) {
  if (n === 0) return "Zero";
  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${toWords(crore)} Crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

// 23250 -> "Twenty Three Thousand Two Hundred Fifty Rupees Only"
export function amountInWords(amount) {
  const totalPaise = Math.round(Math.abs(Number(amount) || 0) * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const tail = paise ? ` and ${toWords(paise)} Paise` : "";
  return `${toWords(rupees)} Rupees${tail} Only`;
}
