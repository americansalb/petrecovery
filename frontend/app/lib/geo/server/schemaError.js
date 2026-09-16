/**
 * Say when a route failed because the table is not there.
 *
 * A deploy whose build only runs `prisma generate` builds a client that
 * knows the schema and a database that does not have it, so everything
 * touching a newer table answers Prisma's P2021. Reported as "internal"
 * that is unanswerable from outside: it looks like a bug in the code,
 * it works perfectly in development, and the only way in is guessing.
 *
 * It has cost two afternoons now. Sign-in 500ing was GeoLoginToken
 * having never been created (hence scripts/db-sync.js), and the profile
 * endpoint 500ing for every visitor on 2026-09-16 was the same thing
 * again, in a route that had not been given this treatment.
 *
 * So it lives in one place, and it names what is missing: Prisma puts
 * it in error.meta, and a table or column name is not a secret. Knowing
 * it is the difference between a one-line fix and an afternoon.
 *
 * A missing COLUMN (P2022) matters as much as a missing table and is
 * harder to spot, because it does not take the whole table down with
 * it. A deploy whose schema sync was refused keeps serving every query
 * that does not name the new column, so reads of an empty table go on
 * answering 200 while the one endpoint that writes a row 500s. That is
 * exactly the shape of it: scripts/db-sync.js never passes
 * --accept-data-loss, and Prisma refuses the WHOLE push if any single
 * change in it would lose data, so one unrelated refusal leaves every
 * safe addition unapplied too.
 */

/** Is this Prisma saying the schema on the database is behind the code? */
export function isSchemaMissing(error) {
  return (
    error?.code === 'P2021' || // the table does not exist
    error?.code === 'P2022' || // the column does not exist
    /does not exist in the current database/i.test(error?.message || '')
  );
}

/**
 * The body and status for a caught error, given what this route would
 * otherwise have said. `fallback` is the ordinary message.
 */
export function schemaErrorBody(error, fallback) {
  if (!isSchemaMissing(error)) {
    return { error: fallback, code: 'internal' };
  }
  // P2021 names a table, P2022 names a column as "Model.column".
  const table = error?.meta?.table || error?.meta?.modelName || '';
  const column = error?.meta?.column || '';
  const what = column ? `the ${column} column` : table ? `the ${table} table` : '';
  const fix =
    'The schema on it is behind the code: run `npm run db:push` against it, or read the [db-sync] banner in the deploy log, which prints every change the database is still missing.';
  return {
    error: what ? `This server's database is missing ${what}. ${fix}` : `This server's database has not had the schema applied. ${fix}`,
    code: 'schema_missing',
    table: table || undefined,
    column: column || undefined,
    cause: error?.code || undefined,
  };
}
