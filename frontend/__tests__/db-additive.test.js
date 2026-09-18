/**
 * The schema repair may add. It may never destroy.
 *
 * `prisma db push` applies a schema whole or not at all. When one change
 * would lose data Prisma refuses, correctly, and nothing lands: every new
 * table and every new column behind that one change stays missing, on that
 * deploy and on every deploy after it. That is not hypothetical here.
 * `GeoProfile.accountId` went missing that way and stayed missing across
 * every deploy since, and the only symptom was /api/geo/profile answering
 * 500 while the rest of the site looked fine.
 *
 * So scripts/db-additive.js applies the safe half by hand. It runs against
 * a live database that is shared with the rest of the site, which makes
 * "additive only" the entire safety argument. This is where that argument
 * is checked, and it is checked the paranoid way round: the list below is
 * of things that must NEVER be executed, and a single one of them reaching
 * the apply list fails the suite.
 *
 * This lives outside __tests__/geo on purpose. The repair guards the whole
 * database - lost pets, shelters, the Hub - and the game is only where its
 * absence was noticed first.
 */

const fs = require('fs');
const path = require('path');
const { additiveOnly, splitTop, statements } = require('../scripts/db-additive');

const read = (name) => fs.readFileSync(path.resolve(__dirname, '../scripts', name), 'utf8');

/** Anything that can lose data, a schema, or a constraint somebody relies on. */
const DESTRUCTIVE = [
  'DROP TABLE "GeoProfile"',
  'DROP TABLE IF EXISTS "GeoProfile" CASCADE',
  'DROP SCHEMA public CASCADE',
  'DROP DATABASE petrecovery',
  'DROP INDEX "GeoProfile_tokenHash_key"',
  'DROP TYPE "Species"',
  'TRUNCATE TABLE "Case"',
  'DELETE FROM "Case"',
  'UPDATE "Case" SET "status" = \'closed\'',
  'ALTER TABLE "GeoProfile" DROP COLUMN "accountId"',
  'ALTER TABLE "GeoProfile" DROP CONSTRAINT "GeoProfile_pkey"',
  'ALTER TABLE "GeoProfile" RENAME COLUMN "name" TO "handle"',
  'ALTER TABLE "GeoProfile" RENAME TO "GeoPlayer"',
  'ALTER TABLE "GeoProfile" ALTER COLUMN "name" SET NOT NULL',
  'ALTER TABLE "GeoProfile" ALTER COLUMN "points" SET DATA TYPE TEXT',
  'ALTER TABLE "Case" ALTER COLUMN "status" DROP DEFAULT',
  // An enum can be added to, and nothing else.
  'ALTER TYPE "UserRole" RENAME TO "Role"',
  'ALTER TYPE "UserRole" RENAME VALUE \'GUEST\' TO \'VISITOR\'',
  'ALTER TYPE "Species" DROP ATTRIBUTE "legs"',
];

describe('the schema repair is additive or it is nothing', () => {
  test.each(DESTRUCTIVE)('never runs: %s', (sql) => {
    const { apply, skip } = additiveOnly(`${sql};`);
    expect(apply).toEqual([]);
    expect(skip.length).toBe(1);
  });

  test('runs the additions, which cannot lose anything', () => {
    const { apply, skip } = additiveOnly([
      'CREATE TABLE "GeoRoom" ("id" TEXT NOT NULL, CONSTRAINT "GeoRoom_pkey" PRIMARY KEY ("id"));',
      'CREATE UNIQUE INDEX "GeoRoom_code_key" ON "GeoRoom"("code");',
      'CREATE INDEX "GeoRoomPlayer_roomId_idx" ON "GeoRoomPlayer"("roomId");',
      'ALTER TABLE "GeoProfile" ADD COLUMN "accountId" TEXT;',
      'ALTER TABLE "GeoProfile" ADD CONSTRAINT "GeoProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GeoAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;',
    ].join('\n'));
    expect(skip).toEqual([]);
    expect(apply.length).toBe(5);
  });

  test('keeps the additions out of a statement that also destroys, and names only the rest', () => {
    // This is the exact shape Prisma emits for production today: the one
    // column the site needs, in the same breath as a column it wants gone.
    // Throwing the statement away for the company it keeps is what left
    // accountId missing; running it whole is what would lose the other.
    const { apply, skip } = additiveOnly(
      'ALTER TABLE "GeoProfile" DROP COLUMN "legacyNickname",\nADD COLUMN     "accountId" TEXT;'
    );
    expect(apply).toEqual(['ALTER TABLE "GeoProfile" ADD COLUMN IF NOT EXISTS "accountId" TEXT']);
    // And the log says only what was left, so a deploy log cannot be read
    // as "the addition was skipped too" when it was applied three lines up.
    expect(skip).toEqual(['ALTER TABLE "GeoProfile" DROP COLUMN "legacyNickname"']);
  });

  test('adds a new enum member, which a refused push leaves behind like any other addition', () => {
    // The repo ships exactly this in
    // prisma/migrations/20260610_add_pet_shares_and_guest_role. Skipping
    // it leaves every write using the new value failing after the repair
    // has reported the safe half applied.
    const { apply, skip } = additiveOnly(`ALTER TYPE "UserRole" ADD VALUE 'GUEST';`);
    expect(skip).toEqual([]);
    expect(apply).toEqual([`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GUEST'`]);
    // And twice through does not stack the guard.
    expect(additiveOnly(`${apply[0]};`).apply[0]).toBe(apply[0]);
  });

  test('a comma inside a Postgres array default does not cut the statement in half', () => {
    // A scalar list with a default arrives as
    // `ADD COLUMN "tags" TEXT[] DEFAULT ARRAY['a', 'b']`, and that comma
    // is inside neither quotes nor parentheses. Splitting there executed
    // the truncated front of it and left the column missing.
    const { apply, skip } = additiveOnly(`ALTER TABLE "Pet" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY['a', 'b'];`);
    expect(skip).toEqual([]);
    expect(apply).toEqual([`ALTER TABLE "Pet" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY['a', 'b']`]);
    expect(splitTop(`a[1, 2], b`, ',')).toEqual(['a[1, 2]', ' b']);
  });

  test('adds IF NOT EXISTS, so a second boot is a no-op rather than an error', () => {
    const { apply } = additiveOnly('ALTER TABLE "GeoProfile" ADD COLUMN "accountId" TEXT;');
    expect(apply[0]).toContain('ADD COLUMN IF NOT EXISTS');
    // Twice through does not stack it.
    expect(additiveOnly(`${apply[0]};`).apply[0]).toBe(apply[0]);
  });

  test('a comma inside brackets or quotes does not split a statement in half', () => {
    expect(splitTop('a, b(1, 2), c', ',')).toEqual(['a', ' b(1, 2)', ' c']);
    expect(splitTop("a, 'one, two', c", ',')).toEqual(['a', " 'one, two'", ' c']);
    // A semicolon inside a default used to end the statement early.
    expect(statements("CREATE TABLE \"T\" (\"a\" TEXT DEFAULT 'x;y');")).toEqual([
      'CREATE TABLE "T" ("a" TEXT DEFAULT \'x;y\')',
    ]);
  });

  test('comments are not mistaken for statements', () => {
    expect(statements('-- Warnings:\n--   - dropping something\nCREATE INDEX "i" ON "T"("c");')).toEqual([
      'CREATE INDEX "i" ON "T"("c")',
    ]);
  });

  test('anything it does not recognise is skipped, never guessed at', () => {
    const { apply, skip } = additiveOnly('VACUUM FULL;\nGRANT ALL ON "Case" TO PUBLIC;');
    expect(apply).toEqual([]);
    expect(skip.length).toBe(2);
  });
});

describe('nothing in the deploy ever asks Prisma to lose data', () => {
  test.each(['db-additive.js', 'db-sync.js', 'boot.js'])('%s never passes --accept-data-loss', (name) => {
    // Named in a comment in two of these, in order to say it is never
    // passed, so match the argument lists rather than the whole file.
    const source = read(name);
    for (const args of source.match(/\[[^[\]]*'prisma'[^[\]]*\]/g) || []) {
      expect(args).not.toContain('accept-data-loss');
    }
  });

  test('both the build and the boot repair what the refused push left behind', () => {
    // The build does not always have the database the server will talk
    // to; the boot does, by definition. Losing either is how a column
    // stays missing for weeks without anybody seeing a broken deploy.
    expect(read('db-sync.js')).toContain("require('./db-additive')");
    expect(read('boot.js')).toContain("require('./db-additive')");
  });
});
test('phone accounts can relax only the game email requirement without removing data', () => {
  const { additiveOnly } = require('../scripts/db-additive');
  expect(additiveOnly('ALTER TABLE "GeoAccount" ALTER COLUMN "email" DROP NOT NULL;')).toEqual({ apply: ['ALTER TABLE "GeoAccount" ALTER COLUMN "email" DROP NOT NULL'], skip: [] });
  for (const sql of ['ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;', 'ALTER TABLE "GeoAccount" DROP COLUMN "email";', 'ALTER TABLE "GeoAccount" ALTER COLUMN "role" DROP NOT NULL;']) {
    expect(additiveOnly(sql).apply).toEqual([]);
  }
});
