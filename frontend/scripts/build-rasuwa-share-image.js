#!/usr/bin/env node
/**
 * Renders public/rasuwa-share.png, the link-preview card image for the
 * Rasuwa letter tool and the rescueourfamily.org sign page.
 *
 *   node scripts/build-rasuwa-share-image.js
 *
 * A link to these pages travels through family group chats; before this
 * image existed the card fell back to the ReunitePets pet-rescue logo,
 * which reads as a wrong link on a missing-person page. Plain text on a
 * plain ground on purpose: no imagery belongs on this card. Uses the
 * vendored Inter faces and the same resvg stack as the flyer renderer.
 */

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const FONT_DIR = path.join(__dirname, '..', 'app', 'lib', 'cascade', 'render', 'fonts');
const OUT_PATH = path.join(__dirname, '..', 'public', 'rasuwa-share.png');

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#1e3a8a"/>
  <rect x="0" y="0" width="1200" height="6" fill="#93c5fd"/>
  <text x="96" y="240" font-family="Inter" font-weight="700" font-size="64" fill="#ffffff">Missing in the Rasuwa flood</text>
  <text x="96" y="330" font-family="Inter" font-weight="400" font-size="40" fill="#dbeafe">Write to your representatives with your</text>
  <text x="96" y="384" font-family="Inter" font-weight="400" font-size="40" fill="#dbeafe">family member's details, and sign the families' letter.</text>
  <text x="96" y="540" font-family="Inter" font-weight="600" font-size="34" fill="#93c5fd">rescueourfamily.org</text>
</svg>`;

const resvg = new Resvg(svg, {
  font: {
    fontFiles: [
      path.join(FONT_DIR, 'Inter-Regular.ttf'),
      path.join(FONT_DIR, 'Inter-SemiBold.ttf'),
      path.join(FONT_DIR, 'Inter-Bold.ttf'),
    ],
    loadSystemFonts: false,
    defaultFontFamily: 'Inter',
  },
});

fs.writeFileSync(OUT_PATH, resvg.render().asPng());
console.log(`Wrote ${OUT_PATH}`);
