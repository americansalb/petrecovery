/**
 * A schema the database does not have must say so, and say what of it.
 *
 * Twice now a geo endpoint has 500ed for every visitor on the live site
 * while working perfectly in development, because the deploy built a
 * Prisma client that knew the schema against a database that did not
 * have it. Both times the answer was "internal", which is unanswerable
 * from outside. The second time (the profile endpoint, 2026-09-16) cost
 * a round of guessing that the table name would have ended instantly.
 *
 * A missing COLUMN is the harder half and the one this was rebuilt for.
 * It does not take its table down with it, so every read of an empty
 * table keeps answering 200 while the one endpoint that writes a row
 * 500s, and the site looks like it has one broken feature rather than a
 * database a whole deploy behind. Reproduced against a real Postgres on
 * 2026-09-16: drop GeoProfile.equipped and the profile endpoint answers
 * P2022 with meta.column set to "GeoProfile.equipped".
 */

const { isSchemaMissing, schemaErrorBody } = require('../../app/lib/geo/server/schemaError');

const missing = Object.assign(new Error('The table `public.GeoLedger` does not exist in the current database.'), {
  code: 'P2021',
  meta: { table: 'GeoLedger' },
});

describe('schema-missing reporting', () => {
  test('recognises Prisma P2021', () => {
    expect(isSchemaMissing(missing)).toBe(true);
  });

  test('recognises it from the message alone, without a code', () => {
    expect(isSchemaMissing(new Error('Table foo does not exist in the current database'))).toBe(true);
  });

  test('an ordinary error is not a schema problem', () => {
    expect(isSchemaMissing(new Error('boom'))).toBe(false);
    expect(schemaErrorBody(new Error('boom'), 'Could not load your profile')).toEqual({
      error: 'Could not load your profile',
      code: 'internal',
    });
  });

  test('names the table so the fix is one line rather than an afternoon', () => {
    const body = schemaErrorBody(missing, 'Could not load your profile');
    expect(body.code).toBe('schema_missing');
    expect(body.table).toBe('GeoLedger');
    expect(body.error).toMatch(/GeoLedger/);
    expect(body.error).toMatch(/db:push|db-sync/);
  });

  test('still answers when Prisma gives no table name', () => {
    const body = schemaErrorBody({ code: 'P2021', message: 'nope' }, 'fallback');
    expect(body.code).toBe('schema_missing');
    expect(body.table).toBeUndefined();
  });
});

const missingColumn = Object.assign(new Error('The column `GeoProfile.equipped` does not exist in the current database.'), {
  code: 'P2022',
  meta: { modelName: 'GeoProfile', column: 'GeoProfile.equipped' },
});

describe('a missing column, which is what a refused sync actually leaves', () => {
  test('counts as the schema being behind', () => {
    expect(isSchemaMissing(missingColumn)).toBe(true);
  });

  test('names the column, because that is the whole fix', () => {
    const body = schemaErrorBody(missingColumn, 'Could not load your profile');
    expect(body.code).toBe('schema_missing');
    expect(body.column).toBe('GeoProfile.equipped');
    expect(body.table).toBe('GeoProfile');
    expect(body.cause).toBe('P2022');
    expect(body.error).toContain('GeoProfile.equipped');
    expect(body.error).toContain('db:push');
  });

  test('a column error with no meta still says what to do', () => {
    const bare = Object.assign(new Error('boom'), { code: 'P2022' });
    const body = schemaErrorBody(bare, 'Could not load your profile');
    expect(body.code).toBe('schema_missing');
    expect(body.column).toBeUndefined();
    expect(body.error).toContain('db:push');
  });

  test('a connection failure is not a schema problem', () => {
    // P1001 is "cannot reach the database". Reporting that as
    // schema_missing would send an operator to run db:push at a server
    // that is simply down.
    for (const code of ['P1001', 'P1017', 'P2002']) {
      const other = Object.assign(new Error('nope'), { code });
      expect(isSchemaMissing(other)).toBe(false);
      expect(schemaErrorBody(other, 'Could not load your profile')).toEqual({ error: 'Could not load your profile', code: 'internal' });
    }
  });
});

describe('db-sync tells the operator what is still missing, not just what it refused', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../../scripts/db-sync.js'), 'utf8');
  // The reading and repairing moved into its own file once the boot
  // needed it too, so the gap is described across both.
  const additive = fs.readFileSync(path.join(__dirname, '../../scripts/db-additive.js'), 'utf8');

  test('it never asks for data loss', () => {
    // A deploy that silently drops a column is worse than a deploy that
    // stops. The flag is named in the prose, which is the rule; what
    // must never carry it is the command that actually runs.
    const push = /\['prisma', 'db', 'push'[^\]]*\]/.exec(src);
    expect(push).toBeTruthy();
    expect(push[0]).not.toContain('accept-data-loss');
  });

  test('a refused push prints the whole gap, because Prisma applies a push whole or not at all', () => {
    // One refusable change blocks every safe addition behind it, on
    // every deploy from then on, and the refusal names only the one
    // change. migrate diff names the rest. It is read-only.
    expect(src).toContain("require('./db-additive')");
    expect(additive).toContain("'migrate', 'diff'");
    expect(additive).toContain('--from-schema-datasource');
    expect(additive).toContain('--to-schema-datamodel');
  });

  test('and then applies the safe half of it, so the gap closes by itself', () => {
    // Printing the gap told an operator what to run. Nobody ran it, and
    // GeoProfile.accountId stayed missing for weeks. Additions cannot
    // lose anything, so the deploy applies them rather than reporting
    // them; __tests__/db-additive.test.js is where "additive" is proved.
    expect(src).toContain('repair(process.env)');
    expect(additive).toContain("'db', 'execute'");
    const execute = /\['prisma', 'db', 'execute'[^\]]*\]/.exec(additive);
    expect(execute).toBeTruthy();
    expect(execute[0]).not.toContain('accept-data-loss');
  });
});

describe('every route that can hit it says so', () => {
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.resolve(__dirname, '../..');

  // Each of these touches a table, and each answered "internal" when the
  // database was behind. The room routes are the ones that mattered most
  // on 2026-09-16: profiles named the column and rooms did not, which
  // made one cause look like two unrelated failures.
  const ROUTES = [
    'app/api/geo/profile/route.js',
    'app/api/geo/auth/request/route.js',
    'app/lib/geo/server/roomRoute.js',
    'app/api/geo/round/route.js',
    'app/api/geo/guess/route.js',
    'app/api/geo/shop/route.js',
    'app/api/geo/daily/route.js',
    'app/api/geo/cup/route.js',
    'app/api/geo/leaderboard/route.js',
  ];

  test.each(ROUTES)('%s reports a schema gap instead of "internal"', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(src).toContain('schemaErrorBody(');
    expect(src).toMatch(/from '[^']*schemaError'/);
  });

  test('a use without its import would not have built, so both are checked together', () => {
    // This was written the other way round once: the body was replaced
    // and the import skipped, because the guard looked for "schemaError"
    // in a file that now contained "schemaErrorBody".
    for (const rel of ROUTES) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      const uses = src.includes('schemaErrorBody(');
      const imports = /import \{[^}]*schemaErrorBody[^}]*\} from '[^']*schemaError'/.test(src);
      expect(`${rel} uses=${uses} imports=${imports}`).toBe(`${rel} uses=true imports=true`);
    }
  });
});
