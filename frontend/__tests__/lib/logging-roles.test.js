/**
 * logEvent must never reject a role, action or result that real code hands it.
 *
 * logEvent runs after the action it records, and many callers await it, so a
 * value it refuses turns a saved change into a 500. Three UserRole values -
 * GUEST, PATROL, MODERATOR - were missing from its allow-list, so a moderator
 * opening a case, or a guest volunteer whose route logged their role, got a
 * 500 after the work was already done. A few call sites also passed literal
 * action/result values the validator refuses ('blocked', 'test', 'bulk').
 *
 * Part 1 reads the UserRole enum from the schema and proves logEvent accepts
 * every value the session can carry. Part 2 reads the source and proves every
 * literal action/result/actor_role passed to logEvent is one the validator
 * allows, so a bad literal fails CI instead of production.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { eventLog: { create: jest.fn().mockResolvedValue({}) } },
}));
// Jest cannot load uuid's ESM build; logging.js only needs an id generator.
jest.mock('uuid', () => ({ __esModule: true, v4: () => '00000000-0000-4000-8000-000000000000' }));

import fs from 'fs';
import path from 'path';
import { logEvent } from '@/lib/logging';

const ROOT = path.join(__dirname, '../..');

const ACTIONS = new Set(['create', 'update', 'delete', 'read', 'transition', 'search']);
const RESULTS = new Set(['success', 'failure', 'pending']);
// Domain/actor roles logEvent allows on top of the UserRole enum.
const DOMAIN_ROLES = ['OWNER', 'VOLUNTEER', 'SHELTER_ADMIN', 'SYSTEM'];

function userRoles() {
  const schema = fs.readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8');
  const block = schema.match(/enum UserRole \{([^}]*)\}/);
  return block[1]
    .split('\n')
    .map((line) => line.replace(/\/\/.*/, '').trim())
    .filter(Boolean);
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

function logEventBodies(src) {
  const bodies = [];
  const re = /logEvent\(\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) break;
    }
    bodies.push({ body: src.slice(m.index, i + 1), line: src.slice(0, m.index).split('\n').length });
  }
  return bodies;
}

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  console.log.mockRestore();
  console.error.mockRestore();
  console.warn.mockRestore();
});

describe('logEvent accepts every role a session can carry', () => {
  const roles = userRoles();

  test('the schema still has a UserRole enum with values', () => {
    expect(roles).toEqual(expect.arrayContaining(['USER', 'GUEST', 'PATROL', 'MODERATOR', 'ADMIN']));
  });

  test.each(roles)('actor_role %s is accepted', async (role) => {
    await expect(
      logEvent({ event_type: 'test.event', resource_type: 'test', action: 'read', result: 'success', actor_role: role })
    ).resolves.toBeTruthy();
  });
});

test('every literal action, result and actor_role passed to logEvent is valid', () => {
  const roles = new Set([...userRoles(), ...DOMAIN_ROLES]);
  const bad = [];
  for (const dir of ['app', 'lib', 'components']) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of sourceFiles(abs)) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      for (const { body, line } of logEventBodies(fs.readFileSync(file, 'utf8'))) {
        const action = body.match(/\baction:\s*'([^']*)'/);
        const result = body.match(/\bresult:\s*'([^']*)'/);
        const role = body.match(/\bactor_role:\s*'([^']*)'/);
        if (action && !ACTIONS.has(action[1])) bad.push(`${rel}:${line} action='${action[1]}'`);
        if (result && !RESULTS.has(result[1])) bad.push(`${rel}:${line} result='${result[1]}'`);
        if (role && !roles.has(role[1])) bad.push(`${rel}:${line} actor_role='${role[1]}'`);
      }
    }
  }
  expect(bad).toEqual([]);
});
