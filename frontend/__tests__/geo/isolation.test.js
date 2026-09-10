/**
 * The game imports nothing from the pet site.
 *
 * This is the enforcement behind phase 1 of docs/WANDERGUESSER_SPLIT.md.
 * The game is being made standalone, and the way that stays true while
 * other work carries on is a test that fails the moment a new wire is
 * added. Every import in the game's five directories has to resolve to
 * one of three things: an npm package, a Node builtin, or a file inside
 * the game.
 *
 * ALLOWED is what is left to cut, and it only ever shrinks. Adding to it
 * is not a fix; cutting the wire is. When it reaches zero, the game is a
 * file move away from its own repository, so leave the empty list in
 * place to keep it that way.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

/** Everything that moves out when the game leaves. */
const GAME_DIRS = [
  'app/geo',
  'app/lib/geo',
  'app/api/geo',
  'scripts/geo-e2e',
  '__tests__/geo',
];

/**
 * Wires still standing, with the pull request that cuts each one.
 * Phase 1.7 empties this; nothing may be added.
 */
const ALLOWED = {
  '@/app/lib/auth': 'phase 1.7, gated on decision D1 (what an account is on the standalone site)',
};

const CODE = /\.(js|jsx|mjs|cjs|ts|tsx)$/;

function walk(dir, found = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return found;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, found);
    else if (CODE.test(entry.name)) found.push(rel);
  }
  return found;
}

/** Static imports, dynamic imports and requires, in source order. */
function importsIn(source) {
  const specifiers = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

/** Where a specifier points, as a repo-relative path, or null for a package. */
function resolveInRepo(specifier, fromFile) {
  if (specifier.startsWith('@/')) return specifier.slice(2);
  if (specifier.startsWith('.')) {
    return path.normalize(path.join(path.dirname(fromFile), specifier));
  }
  return null; // an npm package or a Node builtin
}

const insideGame = (p) => GAME_DIRS.some((dir) => p === dir || p.startsWith(`${dir}/`));

describe('the game stands alone', () => {
  const files = GAME_DIRS.flatMap((dir) => walk(dir));

  test('the game has files to check', () => {
    // A rename that silently emptied the walk would make every test
    // below pass without checking anything.
    expect(files.length).toBeGreaterThan(80);
  });

  test('nothing in the game imports the pet site', () => {
    const wires = [];
    for (const file of files) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      for (const specifier of importsIn(source)) {
        const target = resolveInRepo(specifier, file);
        if (target === null || insideGame(target)) continue;
        if (specifier in ALLOWED) continue;
        wires.push(`${file} imports ${specifier}`);
      }
    }
    expect(wires).toEqual([]);
  });

  test('the list of wires still standing only shrinks', () => {
    // Phase 1.7 empties this. If you are here because a test failed
    // after you added an import, cut the wire instead of listing it.
    expect(Object.keys(ALLOWED)).toEqual(['@/app/lib/auth']);
  });

  test('the game owns a replacement for every pet module it used to import', () => {
    for (const own of [
      'app/lib/geo/server/db.js',
      'app/lib/geo/server/limiter.js',
      'app/lib/geo/server/fonts/index.js',
      'app/lib/geo/meta.js',
      'app/lib/geo/site.js',
      'app/geo/lib/appleMapKit.js',
    ]) {
      expect(fs.existsSync(path.join(ROOT, own))).toBe(true);
    }
  });
});
