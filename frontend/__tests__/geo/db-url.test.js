/**
 * Which connection string the game hands Prisma.
 *
 * The cap has to reach the fallback. GEO_DB_POOL exists for the phase 1
 * arrangement where the game has no database of its own yet and its pool
 * points at DATABASE_URL alongside the pet app's, so a version that read
 * only GEO_DATABASE_URL would leave the setting dead in exactly the
 * deployment it was added for (docs/WANDERGUESSER_SPLIT.md, phase 1.1).
 */

jest.mock('@prisma/client', () => ({ PrismaClient: class {} }));

const { connectionUrl } = require('@/app/lib/geo/server/db');

const SHARED = 'postgresql://user:pw@db.example:5432/petrecovery';
const OWN = 'postgresql://user:pw@geo.example:5432/wanderguesser';

describe('the connection string', () => {
  test('says nothing when there is nothing to say, so Prisma reads the environment', () => {
    expect(connectionUrl({ DATABASE_URL: SHARED })).toBe('');
    expect(connectionUrl({})).toBe('');
  });

  test('the pool cap applies to the shared database, which is the whole point of it', () => {
    const url = connectionUrl({ DATABASE_URL: SHARED, GEO_DB_POOL: '5' });
    expect(url).toContain('connection_limit=5');
    expect(url).toContain('db.example');
  });

  test("the game's own database wins, capped or not", () => {
    expect(connectionUrl({ DATABASE_URL: SHARED, GEO_DATABASE_URL: OWN })).toBe(OWN);
    expect(connectionUrl({ DATABASE_URL: SHARED, GEO_DATABASE_URL: OWN, GEO_DB_POOL: '9' })).toContain('geo.example');
    expect(connectionUrl({ GEO_DATABASE_URL: OWN, GEO_DB_POOL: '9' })).toContain('connection_limit=9');
  });

  test('a limit already in the string is left alone', () => {
    const pinned = `${SHARED}?connection_limit=3`;
    expect(connectionUrl({ DATABASE_URL: pinned, GEO_DB_POOL: '20' })).toContain('connection_limit=3');
    expect(connectionUrl({ DATABASE_URL: pinned, GEO_DB_POOL: '20' })).not.toContain('connection_limit=20');
  });

  test('a string Prisma will have to reject is passed through, not mangled', () => {
    expect(connectionUrl({ DATABASE_URL: 'not a url', GEO_DB_POOL: '5' })).toBe('not a url');
  });
});
