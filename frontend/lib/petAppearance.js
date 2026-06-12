/**
 * Canonical pet appearance vocabulary — structured, tappable choices instead
 * of free text, so every profile carries ACCURATE, matchable data (flyers,
 * lost/found matching, finder identification all consume this).
 *
 * The Pet.color column stays a string for compatibility; we compose it from
 * these canonical tokens (e.g. "Golden & White · Spotted").
 */

// Coat colors with real swatches. `css` is the swatch background.
export const COAT_COLORS = [
  { value: 'Black',    css: '#1c1917' },
  { value: 'White',    css: '#fafaf9', border: true },
  { value: 'Cream',    css: '#f3e5c8' },
  { value: 'Golden',   css: '#d3a24b' },
  { value: 'Tan',      css: '#c8a06a' },
  { value: 'Brown',    css: '#6f4a2c' },
  { value: 'Red',      css: '#9a4a22' },
  { value: 'Orange',   css: '#e0762e' },
  { value: 'Gray',     css: '#8b96a5' },
  { value: 'Silver',   css: '#cfd6dd', border: true },
  { value: 'Brindle',  css: 'repeating-linear-gradient(45deg, #6f4a2c 0 6px, #2b2014 6px 10px)' },
  { value: 'Merle',    css: 'radial-gradient(circle at 30% 30%, #50565e 0 18%, transparent 19%), radial-gradient(circle at 68% 62%, #3a3f46 0 14%, transparent 15%), #aeb6bf' },
  { value: 'Tricolor', css: 'conic-gradient(#1c1917 0 33%, #fafaf9 33% 66%, #6f4a2c 66%)' },
];

export const MAX_COAT_COLORS = 3;

// Coat patterns (optional, single choice). Solid is the implicit default.
export const COAT_PATTERNS = [
  'Solid', 'Tabby / striped', 'Spotted', 'Patched', 'Tuxedo', 'Speckled',
];

/** Compose the canonical color string stored in Pet.color. */
export function composeColor(colors, pattern) {
  const base = (colors || []).join(' & ');
  if (!base) return '';
  if (pattern && pattern !== 'Solid') {
    // "Tabby / striped" -> "Tabby"
    const short = pattern.split('/')[0].trim();
    return `${base} · ${short}`;
  }
  return base;
}

/**
 * Inverse of composeColor, for prefilling edit flows.
 *
 * Unknown tokens are KEPT as custom colors/patterns (title-cased), not
 * dropped: owners can describe coats the swatches don't cover ("Blue",
 * "Chocolate", "Lilac") and the value must survive every save/load
 * round trip.
 */
export function parseColor(value) {
  const result = { colors: [], pattern: null };
  if (!value) return result;
  const [base, patternPart] = value.split('·').map((s) => s.trim());
  const known = new Map(COAT_COLORS.map((c) => [c.value.toLowerCase(), c.value]));
  result.colors = (base || '')
    .split('&')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => known.get(s.toLowerCase()) || titleCase(s));
  if (patternPart) {
    const match = COAT_PATTERNS.find((p) => p.toLowerCase().startsWith(patternPart.toLowerCase()));
    result.pattern = match || titleCase(patternPart);
  }
  return result;
}

function titleCase(s) {
  return s
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

// Custom coat colors/patterns: short, plain words a stranger could read
// aloud. Returns the normalized Title Case label, or null if invalid.
export const CUSTOM_COAT_MAX = 16;
export function normalizeCoatLabel(raw) {
  const trimmed = (raw || '').trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > CUSTOM_COAT_MAX) return null;
  if (!/^[a-zA-Z][a-zA-Z\s-]*$/.test(trimmed)) return null;
  return titleCase(trimmed);
}

// Microchips: AVID 9, Trovan/others 10, ISO 11784/11785 15 digits.
// Letters allowed for a few legacy formats.
export const MICROCHIP_REGEX = /^[0-9A-Za-z]{9,15}$/;

export function normalizeMicrochip(raw) {
  return (raw || '').replace(/[\s-]/g, '');
}

export function validateMicrochip(raw) {
  const chip = normalizeMicrochip(raw);
  if (!chip) return { ok: true, value: null };
  if (!MICROCHIP_REGEX.test(chip)) {
    return { ok: false, error: 'Microchip IDs are 9–15 digits (no spaces) — check the vet paperwork' };
  }
  return { ok: true, value: chip };
}
