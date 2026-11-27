// A UPI payment link, understood by every UPI app in India.
export function upiLink({ upiId, name, amount, note }) {
  const params = [
    ["pa", upiId],
    ["pn", name],
    ["am", Number(amount).toFixed(2)],
    ["cu", "INR"],
    ["tn", note],
  ]
    .filter(([, value]) => value)
    // Spaces must be %20, and the @ in a UPI ID is expected as it is
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%40/g, "@")}`);
  return `upi://pay?${params.join("&")}`;
}
