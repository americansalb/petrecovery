#!/usr/bin/env node
/**
 * Regenerates app/rasuwa/pdf-font-coverage.json from the vendored letter
 * fonts, for the /rasuwa PDF's cannot-print warning (pdfText.js).
 *
 *   node scripts/build-rasuwa-pdf-coverage.js
 *
 * Run it whenever a font in public/rasuwa/fonts changes, and commit the
 * refreshed JSON. Generating the table from the font files themselves
 * keeps the warning honest: it can never disagree with what the fonts
 * actually hold.
 */

const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');

const FONTS_DIR = path.join(__dirname, '..', 'public', 'rasuwa', 'fonts');
const OUT_PATH = path.join(__dirname, '..', 'app', 'rasuwa', 'pdf-font-coverage.json');
const FONTS = ['NotoSerif-Regular.ttf', 'NotoSerifDevanagari-Regular.ttf'];

const cps = new Set([9, 10, 13]); // whitespace the letter text contains
for (const file of FONTS) {
  for (const cp of fontkit.openSync(path.join(FONTS_DIR, file)).characterSet) cps.add(cp);
}

const ranges = [];
for (const cp of [...cps].sort((a, b) => a - b)) {
  const last = ranges[ranges.length - 1];
  if (last && cp === last[1] + 1) last[1] = cp;
  else ranges.push([cp, cp]);
}

// The characters this tool exists for must be in any font we ever swap in.
const required = 'Poonam Thakkar Śrestha ṇāī पूनम ठक्कर।"()[]$0-';
const missing = [...required].filter((ch) => {
  const cp = ch.codePointAt(0);
  return !ranges.some(([a, b]) => cp >= a && cp <= b);
});
if (missing.length) {
  console.error(`Refusing to write coverage: fonts lost required characters: ${missing.join(' ')}`);
  process.exit(1);
}

fs.writeFileSync(OUT_PATH, JSON.stringify({
  fonts: FONTS.map((f) => f.replace(/\.ttf$/, '')),
  ranges,
}));
console.log(`Wrote ${OUT_PATH}: ${cps.size} codepoints in ${ranges.length} ranges.`);
