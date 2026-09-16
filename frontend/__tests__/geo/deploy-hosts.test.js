/**
 * The deploy has to recognise the host it is running on.
 *
 * Both of these were written against Vercel and named it literally, so
 * moving the site to Render turned them off without a word: the schema
 * sync skipped every build, leaving a database missing whatever the
 * last hand-run of `db push` had not created, and MapKit refused to
 * sign for any preview hostname. Both failures look exactly like a
 * working deploy until something asks for the table or the map.
 *
 * So the rule is a list, and this is the test that keeps it one.
 */

const fs = require('fs');
const path = require('path');
const { mayMintFor } = require('@/app/lib/geo/server/mapKitToken');

const dbSync = fs.readFileSync(path.resolve(__dirname, '../../scripts/db-sync.js'), 'utf8');

describe('the deploy knows where it is running', () => {
  test('the schema sync runs on every host that deploys this, not just one', () => {
    for (const variable of ['VERCEL', 'RENDER']) {
      expect({ variable, named: dbSync.includes(`'${variable}'`) }).toEqual({ variable, named: true });
    }
  });

  test('and still refuses to touch a database from a laptop or from CI', () => {
    // The escape hatch stays, because a deploy from somewhere else has
    // to be possible; what it must not be is the default.
    expect(dbSync).toContain('FORCE_DB_PUSH');
    expect(dbSync).toContain('SKIP_DB_PUSH');
    // And the command it actually runs never asks Prisma to drop
    // anything. Matched on the argument list rather than on the file,
    // because the comment above it names the flag in order to say it is
    // never passed, and a whole-file search cannot tell those apart.
    const args = dbSync.slice(dbSync.indexOf('spawnSync('), dbSync.indexOf('spawnSync(') + 120);
    expect(args).toContain("['prisma', 'db', 'push', '--skip-generate']");
    expect(args).not.toContain('accept-data-loss');
  });

  test('preview hostnames get a MapKit token on either host', () => {
    for (const host of ['petrecovery-git-abc123.vercel.app', 'probablyearth.onrender.com', 'probablyearth-pr-7.onrender.com']) {
      expect({ host, allowed: mayMintFor(host) }).toEqual({ host, allowed: true });
    }
  });

  test('but a lookalike suffix still gets nothing', () => {
    for (const host of ['vercel.app.evil.example', 'onrender.com.evil.example', 'notonrender.com', 'evil-onrender.com']) {
      expect({ host, allowed: mayMintFor(host) }).toEqual({ host, allowed: false });
    }
  });
});
