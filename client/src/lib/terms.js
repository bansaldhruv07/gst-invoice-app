// The two standard lines printed when a business has not written its own terms
export function defaultTerms(city) {
  const place = (city || "").trim().toUpperCase();
  const lines = ["1. This is an electronically generated document."];
  if (place) lines.push(`2. All disputes are subject to ${place} jurisdiction`);
  return lines.join("\n");
}
