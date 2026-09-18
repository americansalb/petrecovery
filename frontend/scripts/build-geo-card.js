#!/usr/bin/env node
/**
 * Render public/geo-card.svg to public/geo-card.png.
 *
 * The fallback share card has to be a PNG. Facebook, Slack, iMessage,
 * WhatsApp, X and LinkedIn all decline an SVG og:image, so the card that
 * every Probably Earth page without one of its own falls back to was
 * unfurling as no picture at all - on the lobby, which is the URL people
 * actually paste.
 *
 * It is rendered here and committed rather than drawn per request:
 * /api/geo/og already draws a real card for a shared result, and making
 * the *fallback* a render too would put satori and resvg in the path of
 * every preview crawl, on the 256 MiB heap that this deployment shares
 * with the pet site.
 *
 * Run after editing the SVG:  node scripts/build-geo-card.js
 * __tests__/link-previews.test.js asserts the PNG exists and that no
 * share card points at an SVG.
 */
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'public', 'geo-card.svg');
const OUT = join(ROOT, 'public', 'geo-card.png');
const FONTS = join(ROOT, 'app', 'lib', 'geo', 'server', 'fonts');
const WIDTH = 1200;

function main() {
  const { Resvg } = require('@resvg/resvg-js');
  const svg = readFileSync(SRC, 'utf8');

  // The SVG asks for system-ui; this deployment renders with no system
  // fonts at all, so the vendored Inter stands in for it deliberately.
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: {
      fontBuffers: [
        readFileSync(join(FONTS, 'Inter-Regular.ttf')),
        readFileSync(join(FONTS, 'Inter-Bold.ttf')),
        readFileSync(join(FONTS, 'Inter-Black.ttf')),
      ],
      defaultFontFamily: 'Inter',
      loadSystemFonts: false,
    },
  })
    .render()
    .asPng();

  writeFileSync(OUT, png);
  console.log(`geo-card.png written: ${png.length} bytes`);
}

main();
