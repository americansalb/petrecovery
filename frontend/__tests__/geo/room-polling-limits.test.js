/**
 * A full room must not rate-limit itself.
 *
 * Rooms hold twelve players and poll their state every 1.5 seconds
 * while a game is on. That is 40 requests a minute EACH, against a
 * bucket of 180 a minute. Keyed on the address alone, as it was, the
 * arithmetic is four and a half people: five housemates, five
 * colleagues on one office connection, or any five players behind one
 * carrier NAT, and the fifth one's room silently stops updating.
 *
 * Nobody would have seen it in testing. The harness runs two browsers
 * from one address and never comes close.
 *
 * So the bucket is keyed by address AND player now. The player token is
 * client supplied, which is why the address still has a ceiling: a
 * forged token buys its own bucket and nothing more.
 */

const fs = require('fs');
const path = require('path');
const { GAME_RATE_LIMITS } = require('@/app/lib/geo/site');
const { MAX_PLAYERS } = require('@/app/lib/geo/rooms');

const middleware = fs.readFileSync(path.resolve(__dirname, '../../middleware.js'), 'utf8');
const useRoom = fs.readFileSync(path.resolve(__dirname, '../../app/geo/lib/useRoom.js'), 'utf8');

/** The poll interval the client actually uses while a game is on. */
function busyPollMs() {
  const match = /busy\s*\?\s*(\d+)\s*:\s*(\d+)/.exec(useRoom);
  return match ? Number(match[1]) : null;
}

describe('a full room fits inside its own rate limit', () => {
  test('the client still polls on the interval this test assumes', () => {
    // If somebody speeds the poll up, the arithmetic below changes and
    // this test should be the thing that notices.
    expect(busyPollMs()).toBe(1500);
  });

  test('one player alone is nowhere near the limit', () => {
    const perMinute = 60000 / busyPollMs();
    expect(perMinute).toBeLessThan(GAME_RATE_LIMITS['/api/geo/rooms'].maxRequests);
  });

  test('a full room on one address would blow an address-only bucket', () => {
    // This is the bug, written down: the reason the key had to change.
    const perMinute = (60000 / busyPollMs()) * MAX_PLAYERS;
    expect(perMinute).toBeGreaterThan(GAME_RATE_LIMITS['/api/geo/rooms'].maxRequests);
  });

  test('so the bucket is keyed by player as well as address', () => {
    expect(middleware).toContain('function playerKey(request)');
    expect(middleware).toContain("request.headers.get('x-geo-player')");
    // The key itself, not just the helper.
    expect(middleware).toMatch(/\$\{clientIp\}:\$\{actor\}:/);
  });

  test('and a forged token cannot buy an unlimited address', () => {
    // The token is client supplied. Without a ceiling on the address,
    // rotating fake tokens would mint unlimited buckets, which is worse
    // than the bug being fixed.
    expect(middleware).toContain('ADDRESS_CEILING_FACTOR');
    expect(middleware).toContain('__all');
    const factor = Number(/const ADDRESS_CEILING_FACTOR = (\d+)/.exec(middleware)?.[1]);
    expect(factor).toBeGreaterThanOrEqual(MAX_PLAYERS);
  });

  test('the ceiling still holds a full room of co-located players', () => {
    const factor = Number(/const ADDRESS_CEILING_FACTOR = (\d+)/.exec(middleware)?.[1]);
    const allowed = GAME_RATE_LIMITS['/api/geo/rooms'].maxRequests * factor;
    const fullRoom = (60000 / busyPollMs()) * MAX_PLAYERS;
    // Twice the headroom a full room needs, so guesses and reactions
    // fit alongside the polling.
    expect(allowed).toBeGreaterThan(fullRoom * 2);
  });

  test('a request with no player identity keeps the old behaviour exactly', () => {
    // playerKey returns '' there, and the ceiling check is skipped, so
    // nothing outside the game changes.
    expect(middleware).toContain("return token ? token.slice(0, 32) : '';");
    expect(middleware).toContain('if (rateLimit.allowed && actor)');
  });
});
