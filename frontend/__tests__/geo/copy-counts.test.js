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
  const scripts = Object.keys(SCRIPTS).length;
  expect(scripts).toBe(25);
  const layout = read('app/geo/script/layout.js');
  expect(layout).toContain(`${LANGUAGES.length === 76 ? 'Seventy-six' : LANGUAGES.length} languages`);
  expect(layout).toContain('twenty-five writing systems');
  expect(read('app/geo/components/GeoLobby.js')).toContain(`across ${scripts} writing systems`);
});

test('every ladder description that counts scripts counts the right number', () => {
  const wrong = [];
  for (const [id, ladder] of Object.entries(LADDERS)) {
    const languages = languagesForLadder(id);
    const scripts = new Set(languages.map((l) => l.script)).size;
    const match = /(\w+) scripts/.exec(ladder.description || '');
    if (!match) continue;
    if (match[1].toLowerCase() !== spelled(scripts)) wrong.push(`${id}: says ${match[1]}, has ${scripts}`);
  }
  expect(wrong).toEqual([]);
});

test('City streets names the size of the pool it actually draws from', () => {
  const pool = citiesFor('google').length;
  expect(MODES.cities.description).toContain(String(pool));
});

test('the launch doc counts the modes there are', () => {
  const launch = fs.readFileSync(path.join(REPO, 'docs/WANDERGUESSER_LAUNCH.md'), 'utf8');
  const count = Object.keys(MODES).length;
  expect(launch).toContain(`The game itself: ${spelled(count)} modes`);
  expect(launch).toContain(`${LANGUAGES.length} languages, ${Object.keys(SCRIPTS).length} writing systems`);
});
