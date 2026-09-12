/**
 * Files read from disk at runtime must be traced into the standalone
 * build, or they simply are not there.
 *
 * Found in the deep audit. app/lib/geo/server/fonts/index.js reads its
 * three Inter faces with readFileSync from process.cwd() at import
 * time, and next.config.js traced the pet site's font directory but not
 * the game's. The Dockerfile copies only .next/standalone and runs
 * server.js from it, so in the deployed image the directory held
 * index.js and no .ttf at all: the import threw ENOENT, the OG route's
 * catch swallowed it, and every WanderGuesser share preview was the
 * site logo. That is exactly what CLAUDE.md's link-preview rule
 * forbids, and og-card.test.js was green throughout because it reads
 * the fonts through __dirname.
 *
 * So this walks app/lib for the pattern that causes it.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG = require(path.join(ROOT, 'next.config.js'));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Every join(process.cwd(), 'a', 'b', ...) in app/lib, as a relative path. */
function cwdDirectories() {
  const found = new Set();
  for (const file of walk(path.join(ROOT, 'app', 'lib'))) {
    const src = fs.readFileSync(file, 'utf8');
    const pattern = /join\(\s*process\.cwd\(\)\s*,\s*([^)]*)\)/g;
    let match;
    while ((match = pattern.exec(src))) {
      const parts = match[1]
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => (/^'[^']*'$/.test(p) || /^"[^"]*"$/.test(p) ? p.slice(1, -1) : null));
      if (parts.some((p) => p === null)) continue;
      found.add(parts.join('/'));
    }
  }
  return [...found];
}

const includes = Object.values(CONFIG.experimental?.outputFileTracingIncludes || {}).flat();

// The Dockerfile copies these whole trees beside the standalone server
// (public/ and prisma/), so a read from them needs no tracing entry.
const COPIED_WHOLE = ['public/', 'prisma/'];

test('every directory read from process.cwd() at runtime is traced into the build', () => {
  const dirs = cwdDirectories();
  expect(dirs.length).toBeGreaterThan(0);
  const missing = dirs
    .filter((dir) => !COPIED_WHOLE.some((prefix) => `${dir}/`.startsWith(prefix)))
    .filter((dir) => !includes.some((entry) => entry.replace(/^\.\//, '').startsWith(dir)));
  expect(missing).toEqual([]);
});

test('the game has its own fonts named, and the files are really there', () => {
  expect(includes).toContain('./app/lib/geo/server/fonts/**');
  const dir = path.join(ROOT, 'app', 'lib', 'geo', 'server', 'fonts');
  for (const file of ['Inter-Regular.ttf', 'Inter-Bold.ttf', 'Inter-Black.ttf']) {
    expect(fs.existsSync(path.join(dir, file))).toBe(true);
  }
});
