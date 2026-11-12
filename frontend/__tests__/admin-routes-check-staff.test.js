/**
 * Every handler under /api/admin checks for staff itself.
 *
 * middleware.js turns away anyone whose sign-in cookie does not say ADMIN,
 * but it reads the role out of the cookie as it stands: it cannot ask the
 * database. So a cookie that says ADMIN and should not (one minted while
 * the role could be written into it, or one kept from before a role was
 * taken away) gets past the middleware. What it must not get past is the
 * handler. Two routes had no check of their own and trusted the middleware
 * alone.
 *
 * This reads the source: each exported handler in each admin route file
 * has to compare a role with ADMIN, call `isAdmin`, or call a helper in
 * the same file that does.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../app/api/admin');
const CHECK = /isAdmin\(|role\s*[!=]==\s*'ADMIN'/;

function routeFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return /^route\.(js|ts)$/.test(entry.name) ? [full] : [];
  });
}

/** The exported handlers of a route file, each with its own source. */
function handlers(source) {
  const parts = source.split(/^export (?:async )?function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/m);
  const found = [];
  for (let i = 1; i < parts.length; i += 2) found.push({ method: parts[i], body: parts[i + 1] });
  return found;
}

/** Names of functions in the file whose own source checks for staff. */
function checkingHelpers(source) {
  const names = [...source.matchAll(/^(?:async )?function (\w+)\s*\(/gm)].map((m) => m[1]);
  return names.filter((name) => {
    const own = source.match(new RegExp(`^(?:async )?function ${name}\\s*\\([\\s\\S]*?\\n\\}`, 'm'));
    return own && CHECK.test(own[0]);
  });
}

const files = routeFiles(ROOT);

test('there are admin routes to read', () => {
  expect(files.length).toBeGreaterThan(30);
});

test.each(files.map((file) => [path.relative(path.join(__dirname, '..'), file), file]))('%s checks for staff in every handler', (_name, file) => {
  const source = fs.readFileSync(file, 'utf8');
  // A handler exported as a constant would slip past the reading below.
  expect(source).not.toMatch(/^export const (GET|POST|PUT|PATCH|DELETE)\b/m);
  const found = handlers(source);
  expect(found.length).toBeGreaterThan(0);
  const helpers = checkingHelpers(source);
  const unchecked = found
    .filter(({ body }) => !CHECK.test(body) && !helpers.some((name) => new RegExp(`\\b${name}\\(`).test(body)))
    .map(({ method }) => method);
  expect(unchecked).toEqual([]);
});
