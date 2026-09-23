/**
 * No em dashes in what the game says (CLAUDE.md, "Site copy is written
 * plain"). One was in the front page's title, the line a search result
 * and a shared link show before anything else.
 *
 * Comments are left alone: the rule is about copy, and this only reads
 * what is outside them.
 */
const fs = require('fs');
const path = require('path');

const app = path.resolve(__dirname, '../../app');
// The screens, and the server code whose messages the screens show.
const roots = ['geo', 'lib/geo', 'api/geo'].map((dir) => path.join(app, dir));

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

function withoutComments(source) {
  return source
    // Block comments, JSX comments included; newlines kept so lines still count.
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ''))
    // Line comments that start a line or follow whitespace, so a URL's
    // "//" inside a string is not one.
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

test('game copy has no em dashes', () => {
  const found = [];
  for (const file of roots.flatMap(files)) {
    withoutComments(fs.readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
      if (line.includes('—')) found.push(`${path.relative(app, file)}:${i + 1}: ${line.trim()}`);
    });
  }
  expect(found).toEqual([]);
});
