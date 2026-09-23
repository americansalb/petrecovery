/**
 * The game must be named where the commitments live.
 *
 * Found in the deep audit: /privacy and /legal/terms contained not one
 * word about Probably Earth. Not the geo_session cookie, not email-only
 * accounts, not hashed-IP metering, not retention, and there was no
 * account-deletion path at all. Every personal-data column in the Geo
 * models is enumerated here, the same shape as link-previews.test.js,
 * so a new one cannot be added without the page being updated too.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const privacy = read('app/privacy/page.js');
const gamePrivacy = read('app/geo/privacy/page.js');
const terms = read('app/legal/terms/page.js');
const schema = read('prisma/schema.prisma');

/**
 * What the game stores about a person, and the phrase the page has to
 * carry for it. Not the column name: a policy is written for a reader.
 */
const PERSONAL_DATA = {
  'GeoAccount.email': 'email address',
  'GeoAccount.phone': 'phone number',
  'GeoAccount.savedGame': 'saved-game checkpoint',
  'GeoLoginToken.email': 'link sent to that address',
  'GeoLoginToken.codeHash': 'six-digit code',
  'GeoProfile.name': 'display name',
  'GeoUsage.subject': 'hash of your IP address',
  'GeoBadge.countryCode': 'badges',
  'GeoLedger.amount': 'points',
  'GeoRating.rating': 'ratings',
};

describe('the privacy page covers Probably Earth', () => {
  test('the standalone game policy stays within game routing and covers account data', () => {
    expect(read('app/geo/components/GeoFooter.js')).toContain('href="/geo/privacy"');
    for (const phrase of Object.values(PERSONAL_DATA)) expect(gamePrivacy).toContain(phrase);
    for (const phrase of ['geo_session', 'geo_signed_in', '90 days', '120 days', '14 days', 'href="/geo/me"']) expect(gamePrivacy).toContain(phrase);
  });
  test('it names the game and where it lives', () => {
    expect(privacy).toContain('Probably Earth');
    expect(privacy).toContain('reunitepets.org/geo');
  });

  test('every personal-data field the game holds is described', () => {
    const missing = Object.entries(PERSONAL_DATA)
      .filter(([column]) => schema.includes(column.split('.')[1]))
      .filter(([, phrase]) => !privacy.includes(phrase))
      .map(([column, phrase]) => `${column}: "${phrase}"`);
    expect(missing).toEqual([]);
  });

  test('both cookie names appear, because a reader cannot look them up', () => {
    expect(privacy).toContain('geo_session');
    expect(privacy).toContain('geo_signed_in');
  });

  test('retention is stated, not implied', () => {
    const { RETENTION } = require('@/app/lib/geo/server/sweep');
    expect(privacy).toContain(`${RETENTION.usageDays} days`);
    expect(privacy).toContain(`${RETENTION.finishedRoomDays} days`);
  });

  test('the deletion path is named and exists', () => {
    expect(privacy).toContain('reunitepets.org/geo/me');
    expect(fs.existsSync(path.join(ROOT, 'app/api/geo/auth/delete/route.js'))).toBe(true);
    expect(read('app/geo/components/SignInCard.js')).toContain('/api/geo/auth/delete');
  });

  test('the terms say a game account is not a pet account', () => {
    expect(terms).toContain('Probably Earth');
    expect(terms).toMatch(/separate from a ReunitePets account/);
  });

  test('the game is in the sitemap, live games are out of the index, and what unfurls stays fetchable', () => {
    expect(read('app/api/sitemap/route.js')).toContain("url: '/geo'");
    const robots = read('app/api/robots/route.js');
    expect(robots).toContain('Disallow: /geo/play');
    expect(robots).toContain('Disallow: /geo/me');
    // A room and a share page are pasted into chat, and the bots that
    // draw the card honour robots.txt; both carry noindex in their own
    // metadata instead.
    expect(robots).not.toContain('Disallow: /geo/room');
    expect(robots).not.toContain('Disallow: /geo/share');
    expect(read('app/geo/room/[code]/page.js')).toMatch(/index:\s*false/);
    expect(read('app/geo/share/page.js')).toMatch(/index:\s*false/);
  });
});
