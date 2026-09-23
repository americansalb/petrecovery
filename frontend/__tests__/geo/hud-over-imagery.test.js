/**
 * Everything in the round HUD sits on a photograph, so everything in it
 * needs its own background.
 *
 * The look-around hint did not have one. It was `text-sand-300/80` with
 * nothing behind it - styled against the dark mock every other screen
 * is, then shown over whatever Apple returns. Photographed on the live
 * site: a sunlit concrete pavement, which is a great deal of Look
 * Around, and the line was very nearly invisible on it while the
 * buttons an inch away stayed perfectly readable, because they carry
 * the `pill` backing and it did not.
 *
 * scripts/geo-contrast.js cannot catch this. It composites translucent
 * layers down to the opaque background underneath, and under the HUD
 * there is no knowing what colour that will be - it is a photograph of
 * somewhere on Earth. So the rule is structural instead: text drawn
 * over the imagery carries a background, and this is what holds it.
 */
const fs = require('fs');
const path = require('path');

const hud = fs.readFileSync(
  path.resolve(__dirname, '../../app/geo/components/GameHud.js'),
  'utf8',
);

/** The one shared backing every floating control in the HUD uses. */
test('the pill backing is what the HUD floats things on', () => {
  // Dark glass: the canvas colour, mostly opaque (theme.css tokens).
  expect(hud).toMatch(/const pill =\s*\n?\s*'pe-hud-pill[^']*bg-pe-canvas\/[6-9]\d/);
});

test('the look-around hint is backed, not bare text on a photograph', () => {
  const hint = hud.slice(
    hud.indexOf('Drag to look around') - 600,
    hud.indexOf('Drag to look around'),
  );
  // The element that carries the line has to bring the backing with it.
  expect(hint).toMatch(/\$\{pill\}/);
  // And the colour it was: light warm grey at 80%, over a white kerb.
  expect(hint).not.toMatch(/text-sand-300\/80/);
});

test('both formats say their line through the same element', () => {
  // The NMPZ wording is the same element, so a fix to one is a fix to
  // both. If they are ever split, this is the reminder to back the
  // second one too.
  const start = hud.indexOf('Drag to look around');
  const around = hud.slice(start - 200, start + 260);
  expect(around).toMatch(/One view, no looking around/);
  expect((around.match(/<p /g) || []).length).toBeLessThanOrEqual(1);
});
