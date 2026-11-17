/**
 * The coat colours the report forms offer, by the names a stranger would
 * use, with the swatch each is drawn with. Pure, so the forms (client) and
 * the questionnaire (app/lib/caseDetails.js, server and client) share one
 * list.
 */

export const COAT_COLORS = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'Dark Gray', hex: '#4a4a4a' },
  { name: 'Gray', hex: '#808080' },
  { name: 'Light Gray', hex: '#c0c0c0', border: true },
  { name: 'White', hex: '#ffffff', border: true },
  { name: 'Dark Brown', hex: '#3d2314' },
  { name: 'Brown', hex: '#8b4513' },
  { name: 'Light Brown', hex: '#a67b5b' },
  { name: 'Tan', hex: '#d2b48c' },
  { name: 'Beige', hex: '#e8dcc8', border: true },
  { name: 'Cream', hex: '#fffdd0', border: true },
  { name: 'Golden', hex: '#daa520' },
  { name: 'Orange', hex: '#ff8c00' },
  { name: 'Red', hex: '#b22222' },
  { name: 'Ginger', hex: '#b06500' },
];

export const COAT_COLOR_NAMES = COAT_COLORS.map((c) => c.name);

/** The palette's own spelling of a colour a photo reading gave ("dark brown" -> "Dark Brown"), or ''. */
export function coatColorName(word) {
  const w = String(word || '').trim().toLowerCase();
  if (!w) return '';
  const grey = w.replace(/grey/g, 'gray');
  return COAT_COLOR_NAMES.find((n) => n.toLowerCase() === grey) || '';
}
