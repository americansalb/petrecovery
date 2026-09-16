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
 * So it lives in one place, and it names the table: Prisma puts it in
 * error.meta.table, and a table name is not a secret. Knowing it is the
 * difference between a one-line fix and an afternoon.
 */

/** Is this Prisma saying the table does not exist? */
export function isSchemaMissing(error) {
  return (
    error?.code === 'P2021' ||
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
  const table = error?.meta?.table || '';
  return {
    error: table
      ? `This server's database is missing the ${table} table. The schema has not been applied: run \`npm run db:push\` against it, or check the [db-sync] banner in the deploy log.`
      : "This server's database has not had the schema applied: run `npm run db:push` against it, or check the [db-sync] banner in the deploy log.",
    code: 'schema_missing',
    table: table || undefined,
    cause: error?.code || undefined,
  };
}
