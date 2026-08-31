#!/usr/bin/env node
/**
 * Renders the rescueourfamily.org icon set into public/rasuwa/:
 * icon-64.png (browser tab), icon-192.png + icon-512.png (web manifest),
 * apple-icon-180.png (iOS), and favicon.ico (a 32px PNG in an ICO
 * container, for direct /favicon.ico requests on the family domain).
 *
 *   node scripts/build-rasuwa-icons.js
 *
 * The family domain must never show the ReunitePets dog: a pet-rescue
 * logo on a missing-person page reads as a wrong link. The mark is a
 * plain white R on the same civic blue as the share card, with the same
 * light top edge, so tab, card, and page read as one thing.
 */

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const FONT_DIR = path.join(__dirname, '..', 'app', 'lib', 'cascade', 'render', 'fonts');
const OUT_DIR = path.join(__dirname, '..', 'public', 'rasuwa');

// One 64-unit viewBox scaled to every size. Text metrics: Inter Bold "R"
// at 46 sits visually centered with the baseline at y=55.
const svg = `
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="12" fill="#1e3a8a"/>
  <rect x="12" y="0" width="40" height="4" fill="#93c5fd"/>
  <text x="32" y="52" text-anchor="middle" font-family="Inter" font-weight="700" font-size="46" fill="#ffffff">R</text>
</svg>`;

function renderPng(size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: {
      fontFiles: [path.join(FONT_DIR, 'Inter-Bold.ttf')],
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
    },
  });
  return resvg.render().asPng();
}

/** A valid single-image ICO whose payload is a PNG (fine in every modern browser). */
function wrapPngInIco(png, size) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  header.writeUInt8(size === 256 ? 0 : size, 6); // width
  header.writeUInt8(size === 256 ? 0 : size, 7); // height
  header.writeUInt8(0, 8); // palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // color planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14); // payload size
  header.writeUInt32LE(22, 18); // payload offset
  return Buffer.concat([header, png]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size] of [
  ['icon-64.png', 64],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-icon-180.png', 180],
]) {
  fs.writeFileSync(path.join(OUT_DIR, name), renderPng(size));
}
fs.writeFileSync(path.join(OUT_DIR, 'favicon.ico'), wrapPngInIco(renderPng(32), 32));
console.log(`Wrote 5 icons to ${OUT_DIR}`);
