/**
 * A missing table must say so, and say which one.
 *
 * Twice now a geo endpoint has 500ed for every visitor on the live site
 * while working perfectly in development, because the deploy built a
 * Prisma client that knew the schema against a database that did not
 * have it. Both times the answer was "internal", which is unanswerable
 * from outside. The second time (the profile endpoint, 2026-09-16) cost
 * a round of guessing that the table name would have ended instantly.
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
