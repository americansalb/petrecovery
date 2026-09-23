/**
 * probablyearth.com served the pet site's robots.txt and sitemap.
 *
 * Seen on the live site: robots.txt began "# ReunitePets Robots.txt",
 * pointed at sitemaps on reunitepets.org, and disallowed /api/, which
 * covers the game's share-card image (/api/geo/og). X drops a card whose
 * image robots.txt blocks. The sitemap listed 57 reunitepets.org
 * addresses and none of the game's. Both now answer by host, from the
 * same list of the game's hostnames the middleware uses.
 */
jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: {
  case: { findMany: jest.fn(async () => []) },
  rescueForce: { findMany: jest.fn(async () => []) },
} }));

import { GET as robots } from '@/app/api/robots/route';
import { GET as sitemap } from '@/app/api/sitemap/route';
import { GAME_HOSTNAMES, isGameHost } from '@/app/lib/geo/site';
import { GEO_HOME_URL } from '@/app/lib/geo/meta';

const on = (host) => ({ headers: new Headers({ host }) });

test("the game's domain gets the game's robots.txt, with its share cards fetchable", async () => {
  for (const host of GAME_HOSTNAMES) {
    const text = await (await robots(on(host))).text();
    expect(text).toMatch(/^# Probably Earth/);
    expect(text).not.toMatch(/ReunitePets|reunitepets\.org/);
    expect(text).toContain('Allow: /api/geo/og');
    expect(text).toContain('Disallow: /geo/play');
    expect(text).toContain('Disallow: /geo/me');
    // A room and a share page unfurl in chat; the bots that draw the card honour this file.
    expect(text).not.toContain('Disallow: /geo/room');
    expect(text).not.toContain('Disallow: /geo/share');
    expect(text).toContain(`Sitemap: ${GEO_HOME_URL}/sitemap.xml`);
  }
});

test("the pet site keeps its robots.txt, and the game's share cards unfurl from it too", async () => {
  const text = await (await robots(on('www.reunitepets.org'))).text();
  expect(text).toMatch(/^# ReunitePets/);
  expect(text).toContain('Disallow: /api/');
  expect(text).toContain('Allow: /api/geo/og');
});

test("the game's domain gets a sitemap of the game's own pages", async () => {
  const xml = await (await sitemap(on('probablyearth.com'))).text();
  expect(xml).toContain(`<loc>${GEO_HOME_URL}/geo</loc>`);
  expect(xml).not.toMatch(/reunitepets\.org/);
});

test("the pet sitemap no longer lists the game's pages, which are canonical on the game's domain", async () => {
  const xml = await (await sitemap(on('www.reunitepets.org'))).text();
  expect(xml).toContain('<loc>');
  expect(xml).not.toContain('/geo');
});

test('the game host list is the one the middleware asks', () => {
  expect(isGameHost('probablyearth.com')).toBe(true);
  expect(isGameHost('www.probablyearth.com:443')).toBe(true);
  expect(isGameHost('PROBABLYEARTH.COM')).toBe(true);
  expect(isGameHost('www.reunitepets.org')).toBe(false);
  expect(isGameHost('probablyearth.com.evil.test')).toBe(false);
  expect(isGameHost('staging.example', 'staging.example, other.example')).toBe(true);
  expect(isGameHost('')).toBe(false);
  const fs = require('fs');
  const path = require('path');
  const middleware = fs.readFileSync(path.resolve(__dirname, '../middleware.js'), 'utf8');
  expect(middleware).toContain('isGameHost(host)');
  expect(middleware).not.toContain("['probablyearth.com', 'www.probablyearth.com']");
});
