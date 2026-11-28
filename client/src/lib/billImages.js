// Pictures of the sample bill in each design, printed by the app's own bill code.
const files = import.meta.glob("../assets/bills/*.webp", { eager: true, query: "?url", import: "default" });

export function billImage(template, color) {
  const name = template === "classic" ? "classic" : `${template}-${color}`;
  return files[`../assets/bills/${name}.webp`];
}

// The colour each design is first shown in
export const SHOWN_COLOR = { classic: "blue", modern: "blue", minimal: "teal", elegant: "maroon" };
