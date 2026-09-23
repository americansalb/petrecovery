/**
 * What the game covers is kept secret (founder decision, 2026-09-23:
 * players should not know what could come up).
 *
 * It got out two ways, and this checks both:
 *
 * - The screens said so. Script's page listed seven sets of languages
 *   with a count beside each, its link preview said "159 languages
 *   across 34 writing systems", the reveal said "In this pool, Odia is
 *   written for Odia and nothing else", and the hints said what else
 *   was "here".
 * - The browser was sent it. The module the browser shares with the
 *   server imported the language list to build those sets, so every
 *   page that could start a Script game, the front page included,
 *   shipped every language and where each is spoken to anybody who
 *   opened the page's code.
 *
 * The second is the one a read of the copy cannot see, so it is checked
 * as a graph: nothing a 'use client' file imports, directly or through
 * other modules, may reach the data.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** What the game covers, which only the server may hold. */
const SECRET_FILES = ['app/lib/geo/languages.js', 'app/lib/geo/data/language-regions.json'];

const CODE = /\.(js|jsx|mjs)$/;

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, found);
    else if (CODE.test(entry.name)) found.push(rel);
  }
  return found;
}

function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ''))
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

function importsIn(source) {
  const specifiers = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /(?:^|[;\n])\s*import\s+['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

/** A specifier to a file in the repo, or null for a package. */
function resolve(from, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = specifier.slice(2);
  else if (specifier.startsWith('.')) base = path.join(path.dirname(from), specifier);
  else return null;
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}.json`, path.join(base, 'index.js')]) {
    const abs = path.join(ROOT, candidate);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return path.normalize(candidate);
  }
  return null;
}

const isClient = (source) => /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(source);

describe('the browser is never sent what the game covers', () => {
  const entries = walk('app/geo').filter((rel) => isClient(read(rel)));

  test('there are client screens to check', () => {
    expect(entries.length).toBeGreaterThan(20);
    expect(entries).toContain(path.normalize('app/geo/components/script/ScriptLobby.js'));
    expect(entries).toContain(path.normalize('app/geo/components/home/GameMenu.js'));
  });

  test('no client screen reaches the coverage data, however far down', () => {
    const reached = new Map();
    const queue = entries.map((rel) => [rel, rel]);
    while (queue.length) {
      const [rel, entry] = queue.shift();
      if (reached.has(rel)) continue;
      reached.set(rel, entry);
      if (!CODE.test(rel)) continue;
      for (const specifier of importsIn(read(rel))) {
        const next = resolve(rel, specifier);
        if (next && !reached.has(next)) queue.push([next, entry]);
      }
    }
    const leaks = SECRET_FILES.map(path.normalize)
      .filter((secret) => reached.has(secret))
      .map((secret) => `${secret}, reached from ${reached.get(secret)}`);
    expect(leaks).toEqual([]);
  });
});

describe('no screen says what the game covers', () => {
  const COUNTS = [
    /\b\d+\s+languages\b/i,
    /\$\{[^}]+\}\s+languages\b/i,
    /\bwriting systems\b/i,
    /\bin this pool\b/i,
    /All Script languages/,
    /\bchoose (?:other )?languages\b/i,
  ];

  test('no count of languages or writing systems in the game\'s copy', () => {
    const found = [];
    for (const rel of walk('app/geo')) {
      withoutComments(read(rel)).split('\n').forEach((line, i) => {
        for (const pattern of COUNTS) if (pattern.test(line)) found.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(found).toEqual([]);
  });

  test('no hint describes the rest of the pool', () => {
    // "No other language here does this" tells a player what else could
    // come up, and "the only other language here" names it. A hint
    // compares with named languages, or says what is true anywhere.
    const { MARKERS } = require('@/app/lib/geo/server/markers');
    // "Here" alone is often the word on screen ("a nasal vowel here
    // that Bengali writes differently"), so only the pool's own phrasings
    // are caught.
    const POOL = /\bpool\b|\b(?:else|language|languages|alphabet)\s+here\b|\bin this script does\b/i;
    const found = [];
    for (const [code, markers] of Object.entries(MARKERS)) {
      for (const marker of markers) if (POOL.test(marker.note)) found.push(`${code}: ${marker.note}`);
    }
    expect(found).toEqual([]);
  });
});
