/**
 * The game's own font bundle is what the link-preview card is drawn with.
 *
 * app/api/geo/og/route.js hands satori and resvg the two objects this
 * module exports. Neither library reads woff2 and neither may fetch a
 * font at render time, so a wrong path or a missing weight here is a
 * broken share card in every messenger, and nothing else would catch it:
 * the route imports the bundle dynamically, so the build stays green
 * either way.
 *
 * The render itself is not driven from here. satori's CommonJS build
 * imports its layout engine dynamically, which needs a Jest runner flag
 * this project does not set; the card is checked against the running
 * server instead (docs/GEO.md, local development).
 *
 * Guards phase 1.5 of docs/WANDERGUESSER_SPLIT.md.
 */

const fs = require('node:fs');
const path = require('node:path');

const FONT_DIR = path.join(__dirname, '..', '..', 'app', 'lib', 'geo', 'server', 'fonts');

describe("the game's fonts", () => {
  test('the vendored files are real TrueType, and their licence travels with them', () => {
    const files = ['Inter-Regular.ttf', 'Inter-Bold.ttf', 'Inter-Black.ttf'];
    for (const file of files) {
      const buffer = fs.readFileSync(path.join(FONT_DIR, file));
      expect(buffer.length).toBeGreaterThan(50000);
      // sfnt version 1.0: the four bytes every TrueType file opens with.
      expect([...buffer.subarray(0, 4)]).toEqual([0x00, 0x01, 0x00, 0x00]);
    }
    expect(fs.existsSync(path.join(FONT_DIR, 'LICENSE.txt'))).toBe(true);
  });

  test('the bundle offers every weight the card asks for', async () => {
    const fonts = await import('@/app/lib/geo/server/fonts/index.js');
    // ShareCard.jsx sets 400 for its body, 700 for the wordmark, 900 for the score.
    const inter = fonts.SATORI_FONTS.filter((f) => f.name === 'Inter');
    expect(inter.map((f) => f.weight).sort()).toEqual([400, 700, 900]);
    for (const face of inter) expect(Buffer.isBuffer(face.data)).toBe(true);
    expect(fonts.RESVG_FONT.loadSystemFonts).toBe(false);
    expect(fonts.RESVG_FONT.defaultFontFamily).toBe('Inter');
    expect(fonts.RESVG_FONT.fontBuffers).toHaveLength(3);
  });

});
