// Keep in sync with server/services/units.js
export const UNIT_LABELS = {
  pcs: "Pieces",
  nos: "Numbers",
  kg: "Kilogram",
  ton: "Tonne",
  ltr: "Litre",
  mtr: "Metre",
  sqft: "Square foot",
  box: "Box",
  bag: "Bag",
  bundle: "Bundle",
  carton: "Carton",
  roll: "Roll",
  set: "Set",
  pair: "Pair",
  dozen: "Dozen",
  hrs: "Hours",
  other: "Other",
};

export const UNITS = Object.keys(UNIT_LABELS);

// Keep in sync with server/services/gst.js
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];
