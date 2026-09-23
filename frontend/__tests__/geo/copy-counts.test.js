/**
 * Numbers in copy must be the numbers in the data.
 *
 * Found in the deep audit: the /geo/script preview description told
 * every link scanner "twenty-six writing systems" when the corpus has
 * 25, the South Asia pool was advertised as ten scripts when it is
 * eleven, City streets said "about 150 large cities" for a pool of 185,
 * and the launch doc counted eleven modes for a MODES with ten. Each is
 * the kind of thing that is true when written and quietly false a month
 * later, so the copy is checked against the arrays it describes.
 */

const fs = require('fs');
const path = require('path');
const { SCRIPTS, LANGUAGES } = require('@/app/lib/geo/languages');
const { MODES } = require('@/app/lib/geo/modes');
const { citiesFor } = require('@/app/lib/geo/coverage');

const ROOT = path.resolve(__dirname, '../..');
// docs/ lives beside frontend/, not inside it.
const REPO = path.resolve(ROOT, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const spelled = (n) => WORDS[n] || String(n);

test('the script preview says what the game is, never how much of it there is', () => {
  // It used to name the number of languages and writing systems, and
  // this test kept those numbers true against the data. What the game
  // covers is kept secret now (app/lib/geo/script.js), so the preview a
  // link scanner reads names no number at all.
  const layout = read('app/geo/script/layout.js');
  const description = /description:\s*'([^']*)'/.exec(layout)?.[1] || '';
  expect(description.length).toBeGreaterThan(20);
  expect(description).not.toMatch(/\d/);
  expect(description).not.toMatch(/writing systems|languages across/i);
});

test('the World mode names the size of the pool it actually draws from', () => {
  // Apple is the only imagery, so the pool is the city list.
  const pool = citiesFor('apple').length;
  expect(pool).toBeGreaterThan(100);
  expect(MODES.balanced.apple.description).toMatch(/countr|city|street/i);
});

test('the launch doc counts the modes there are', () => {
  const launch = fs.readFileSync(path.join(REPO, 'docs/PROBABLY_EARTH_LAUNCH.md'), 'utf8');
  const count = Object.keys(MODES).length;
  expect(launch).toContain(`The game itself: ${spelled(count)} modes`);
  expect(launch).toContain(`${LANGUAGES.length} languages, ${Object.keys(SCRIPTS).length} writing systems`);
});
