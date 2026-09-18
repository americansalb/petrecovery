const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../../app/geo/components/script/detective.css'), 'utf8');
const declaration = (selector, property) => {
  const block = css.slice(css.indexOf(`${selector}{`) + selector.length + 1).split('}')[0];
  return new RegExp(`(?:^|;)${property}:(#[a-f0-9]{6})(?:;|$)`).exec(block)?.[1];
};
const luminance = (hex) => {
  const [r, g, b] = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

test.each(['.pe-detective-primary', '.pe-detective-primary:not(:disabled):hover'])('%s has readable small button text', (selector) => {
  expect(contrast(declaration(selector, 'background'), declaration('.pe-detective-primary', 'color'))).toBeGreaterThanOrEqual(4.5);
});
test.each(['.pe-detective-sentence .pe-detective-eyebrow', '.pe-detective-clue .pe-detective-eyebrow', '.pe-detective-round-label'])('%s remains readable on the sentence card', (selector) => {
  expect(contrast(declaration(selector, 'color'), declaration('.pe-detective-sentence', 'background'))).toBeGreaterThanOrEqual(4.5);
});
