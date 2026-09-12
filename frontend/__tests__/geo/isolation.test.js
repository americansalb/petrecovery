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
// Empty, and it should stay empty. The last entry was '@/app/lib/auth',
// cut in phase 1.7 once the founder decided (2026-09-10) that a
// standalone account means one not connected to ReunitePets: the game
// answers "who is this request" itself now, in
// app/lib/geo/server/identity.js.
const ALLOWED = {};

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

/**
 * Static imports, dynamic imports, requires and bare side-effect
 * imports, in source order.
 *
 * The last shape is the one this walk used to miss. `import
 * '@/app/lib/auth';` has no `from`, no parentheses and no `require`, so
 * a wire back to the pet site could be added without failing the test
 * that exists to forbid it, while the docstring claimed every import
 * was checked (found in the deep audit).
 */
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

  test('there are no wires left, and none may be added', () => {
    // Phase 1.7 emptied this and it stays empty. If you are here
    // because a test failed after you added an import, cut the wire
    // instead of listing it: the game is now a file move away from its
    // own repository and this list is what keeps it that way.
    expect(Object.keys(ALLOWED)).toEqual([]);
  });

  test('the game does not read the pet site\'s session, in any form', () => {
    // next-auth is an npm package, so the import walk above lets it
    // through, but useSession() and getServerSession(authOptions) are
    // the same wire wearing a different hat: they make a WanderGuesser
    // player a ReunitePets user. The founder's answer to D1 was that a
    // standalone account is not connected to ReunitePets, so both go.
    // Built at runtime rather than written out, so this file does not
    // match its own search and report itself.
    const pet = ['next', 'auth'].join('-');
    // from, require(, import( and a bare side-effect import. The
    // dynamic form used to be missing, so a destructured await of the
    // package went straight through this guard.
    const importing = new RegExp(`(from|require\\(|import\\(|import)\\s*['"]${pet}`);
    const offenders = [];
    for (const dir of GAME_DIRS) {
      for (const file of walk(dir)) {
        if (importing.test(fs.readFileSync(path.join(ROOT, file), 'utf8'))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the pet site names the game in one place, not fourteen', () => {
    // Phase 2 of the split. The wires that point INWARD used to be a
    // dozen rate-limit lines, three lists of map hosts and a table of
    // short paths in middleware.js, plus a hard-coded route list in
    // navChrome.js. They are all constants in app/lib/geo/site.js now,
    // so pulling the game out is deleting two imports rather than
    // hunting through the pet site for mentions of it.
    const middleware = fs.readFileSync(path.join(ROOT, 'middleware.js'), 'utf8');
    const chrome = fs.readFileSync(path.join(ROOT, 'app/lib/navChrome.js'), 'utf8');

    // No geo API path may appear as a rate-limit key. '/api/geocode' is
    // a pet route that merely starts the same way, so it is allowed.
    const keys = [...middleware.matchAll(/'(\/api\/geo[^']*)':/g)].map((m) => m[1]).filter((key) => key !== '/api/geocode');
    expect(keys).toEqual([]);

    // No game route may be hard-coded into the pet site's chrome.
    expect([...chrome.matchAll(/'(\/geo[^']*)'/g)].map((m) => m[1])).toEqual([]);

    // Both read the game's module instead.
    expect(middleware).toContain("from '@/app/lib/geo/site'");
    expect(chrome).toContain("from '@/app/lib/geo/site'");
  });

  test('the game owns a replacement for every pet module it used to import', () => {
    for (const own of [
      'app/lib/geo/server/db.js',
      'app/lib/geo/server/limiter.js',
      'app/lib/geo/server/fonts/index.js',
      'app/lib/geo/meta.js',
      'app/lib/geo/server/identity.js',
      'app/lib/geo/site.js',
      'app/geo/lib/appleMapKit.js',
    ]) {
      expect(fs.existsSync(path.join(ROOT, own))).toBe(true);
    }
  });
});
