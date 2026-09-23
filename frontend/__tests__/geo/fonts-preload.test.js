/**
 * next/font preloads every family a route's modules declare, whether or
 * not the page draws a word in it. The Script module declares twenty-
 * eight, and the game's layout imports it, so every game page (the front
 * door and the rankings included) asked for all of them at once: 2.6 MB
 * of fonts on a phone's first visit, measured on the live site, ahead of
 * the game's own code. None is preloaded now; each loads when a sentence
 * in its script is on screen.
 */
const fs = require('fs');
const path = require('path');

test("the Script families are not preloaded on every game page", () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../app/geo/script/fonts.js'), 'utf8');
  const calls = source.match(/\(\{ display: 'swap'[^)]*\}\)/g) || [];
  expect(calls.length).toBeGreaterThan(20);
  for (const call of calls) expect(call).toContain('preload: false');
});
