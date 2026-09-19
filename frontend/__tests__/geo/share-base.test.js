/**
 * A share card that resolves against localhost is a card nobody sees.
 *
 * This shipped: on the live site /geo/script, /geo/leaderboard and
 * /geo/rooms all served
 * `og:image="http://localhost:3000/geo-card.png"`, because they inherit
 * the layout's static metadataBase and that fell through
 * NEXT_PUBLIC_BASE_URL to a localhost default. Only /geo looked right,
 * and only because that one page wrote the domain out by hand.
 *
 * The format check in link-previews.test.js could not catch it: the card
 * was a PNG, it was present, and the tags validated. It was just hosted
 * on a machine nobody else can reach.
 */

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
  jest.resetModules();
});

const load = () => require('@/app/lib/geo/meta');

test('a production build never bases the game cards on localhost', () => {
  jest.resetModules();
  process.env.NODE_ENV = 'production';
  delete process.env.NEXT_PUBLIC_GEO_HOME_URL;
  // The pet site's base is the wrong answer for the game, and is the
  // value this used to fall through to.
  process.env.NEXT_PUBLIC_BASE_URL = 'https://www.reunitepets.org';
  const { shareMetadataBase } = load();
  const base = shareMetadataBase();
  expect(base.hostname).not.toMatch(/localhost|127\.0\.0\.1/);
  expect(base.protocol).toBe('https:');
  expect(base.hostname).toBe('probablyearth.com');
});

test('a deployment can still say where the game lives', () => {
  jest.resetModules();
  process.env.NODE_ENV = 'production';
  process.env.NEXT_PUBLIC_GEO_HOME_URL = 'https://elsewhere.example';
  const { shareMetadataBase } = load();
  expect(shareMetadataBase().hostname).toBe('elsewhere.example');
});

test('development still resolves against the dev server', () => {
  jest.resetModules();
  process.env.NODE_ENV = 'development';
  delete process.env.NEXT_PUBLIC_GEO_HOME_URL;
  delete process.env.NEXT_PUBLIC_BASE_URL;
  const { shareMetadataBase } = load();
  expect(shareMetadataBase().hostname).toBe('localhost');
});

test('a malformed override falls back to the game, not to localhost', () => {
  jest.resetModules();
  process.env.NODE_ENV = 'production';
  process.env.NEXT_PUBLIC_GEO_HOME_URL = 'not a url';
  const { shareMetadataBase } = load();
  expect(shareMetadataBase().hostname).toBe('probablyearth.com');
});

test('the lobby no longer carries its own copy of the domain', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../..', 'app/geo/page.js'), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  expect(code).not.toMatch(/new URL\(['"]https:\/\/probablyearth\.com/);
});
