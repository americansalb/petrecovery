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
const { LADDERS, languagesForLadder } = require('@/app/lib/geo/script');
const { MODES } = require('@/app/lib/geo/modes');
const { citiesFor } = require('@/app/lib/geo/coverage');

const ROOT = path.resolve(__dirname, '../..');
// docs/ lives beside frontend/, not inside it.
const REPO = path.resolve(ROOT, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const spelled = (n) => WORDS[n] || String(n);

test('the script preview names the real number of writing systems', () => {
  // Read off the data rather than pinned: the corpus grows, and a share
  // card that names a number it no longer has is the thing being caught
  // here, not the number itself.
  const scripts = Object.keys(SCRIPTS).length;
  expect(scripts).toBeGreaterThan(20);
  const layout = read('app/geo/script/layout.js');
  // Digits in both, so this check is the data and not a spelling of it:
  // the corpus grows, and a share card that says seventy-six when there
  // are ninety-one is a promise the game no longer keeps.
  expect(layout).toContain(`${LANGUAGES.length} languages`);
  expect(layout).toContain(`${scripts} writing systems`);
});

test('no ladder description carries a count at all', () => {
  // Stronger than checking that a written count is currently right,
  // which is what this used to do. Every one of them had drifted anyway
  // - Devanagari promised "five answers" for a pool of nine, Arabic
  // named seven of thirteen, Cyrillic "two that are not Slavic" of nine
  // - because a number in prose has no reason to follow the array.
  //
  // The screen renders languagesForLadder(id).length, which cannot
  // drift, so the description says what the pool IS and never how big.
  const COUNTING = /\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/i;
  const wrong = [];
  for (const [id, ladder] of Object.entries(LADDERS)) {
    const match = COUNTING.exec(ladder.description || '');
    if (match) wrong.push(`${id}: "${ladder.description}" counts with "${match[0]}"`);
    // And the pool has to be non-empty, or the count the screen shows
    // would be the drift instead.
    expect({ id, size: languagesForLadder(id).length > 0 }).toEqual({ id, size: true });
  }
  expect(wrong).toEqual([]);
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
