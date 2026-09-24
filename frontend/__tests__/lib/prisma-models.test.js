/**
 * Every prisma.<model> call names a model that exists in prisma/schema.prisma.
 *
 * Rescue Force division create, edit and delete answered 500 on every request
 * for months: they called prisma.squadMembership, a model that was renamed
 * (it is RescueForceMember) and no longer exists, so the accessor is
 * undefined and the route throws before doing anything. Mocked Prisma in unit
 * tests cannot notice, because the mock has whatever accessors the test gives
 * it. This reads the source instead.
 *
 * KNOWN_BROKEN lists the files that still make such a call. None has a page
 * that calls it today. Remove a file from the list when it is fixed; never
 * add one.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');

const KNOWN_BROKEN = {
  'app/api/mapping/track/route.js': ['gpsBreadcrumb'],
  'app/api/patrol/database/route.js': ['lostReport'],
  'app/api/volunteers/schedule/route.js': ['shiftSignup'],
  'app/api/rescue-forces/[id]/broadcast/route.js': ['squadMembership'],
  'app/lib/volunteer/engagement.js': ['squadMembership'],
  'app/lib/volunteer/leadership.js': ['squadMembership'],
  'app/lib/volunteer/priorityMode.js': ['squadMembership'],
};

function modelAccessors() {
  const schema = fs.readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8');
  return new Set([...schema.matchAll(/^model (\w+) \{/gm)].map(([, name]) => name[0].toLowerCase() + name.slice(1)));
}

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '__tests__'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(js|jsx|ts|tsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const CALL = /\b(?:prisma|tx|db)\.([a-zA-Z_]\w*)\.(?:find|create|update|delete|upsert|count|aggregate|groupBy)/g;

test('prisma calls name models that exist', () => {
  const models = modelAccessors();
  expect(models.has('rescueForceMember')).toBe(true);

  const found = {};
  for (const dir of ['app', 'lib', 'components']) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of sourceFiles(abs)) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      for (const [, name] of fs.readFileSync(file, 'utf8').matchAll(CALL)) {
        if (!models.has(name)) (found[rel] ||= new Set()).add(name);
      }
    }
  }

  const unexpected = Object.entries(found)
    .map(([file, names]) => [file, [...names].filter((n) => !(KNOWN_BROKEN[file] || []).includes(n))])
    .filter(([, names]) => names.length > 0);
  expect(unexpected).toEqual([]);
});

test('the known-broken list only names files that are still broken', () => {
  const models = modelAccessors();
  const stale = Object.entries(KNOWN_BROKEN).filter(([file, names]) => {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) return true;
    const used = new Set([...fs.readFileSync(abs, 'utf8').matchAll(CALL)].map(([, n]) => n));
    return !names.some((n) => used.has(n) && !models.has(n));
  });
  expect(stale.map(([file]) => file)).toEqual([]);
});
