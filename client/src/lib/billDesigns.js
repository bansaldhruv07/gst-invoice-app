// The bill designs a business may choose. The server accepts the same ids
// (server/services/billDesigns.js).
export const TEMPLATES = [
  { id: "classic", name: "Classic", note: "The traditional black and white GST format", coloured: false },
  { id: "modern", name: "Modern", note: "A bold colour band and a clean table", coloured: true },
  { id: "minimal", name: "Minimal", note: "Light, spacious and easy to read", coloured: true },
  { id: "elegant", name: "Elegant", note: "Centred heading with soft shaded boxes", coloured: true },
];

export const COLORS = [
  { id: "blue", name: "Blue", hex: "#2856f0" },
  { id: "green", name: "Green", hex: "#15803d" },
  { id: "teal", name: "Teal", hex: "#0f766e" },
  { id: "maroon", name: "Maroon", hex: "#9f1239" },
  { id: "orange", name: "Orange", hex: "#c2410c" },
  { id: "slate", name: "Slate", hex: "#334155" },
];

export const templateOf = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
export const colorOf = (id) => COLORS.find((c) => c.id === id) || COLORS[0];
