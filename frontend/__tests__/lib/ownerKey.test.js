/**
 * The owner's key (app/lib/ownerKey.js): how someone who reported a lost
 * pet without signing in runs their own search.
 *
 * Before it, a report made without an account signed nobody in, so the
 * person whose pet had just gone missing opened Mission Control as a
 * visitor. The founder found it on his own search: nothing to mark an
 * area searched, widen the circle or write a message.
 *
 * What is held here: the key is long and random, only its hash is kept,
 * it is compared in constant time, it is good for one report and for
 * sixty days, the cookie that carries it cannot be read by a script or
 * sent by another site, and nothing is looked up for a request that
 * carries no key.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { case: { findUnique: jest.fn(), findMany: jest.fn() } },
}));

import prisma from '@/app/lib/prisma';
import {
  OWNER_KEY_DAYS, ownerCookieName, madeCookieName, madeCookie, hashOwnerKey, mintOwnerKey, keyMatches, keyIsFresh, cookiesOf, ownerKeyFrom, ownerCookie, holdsOwnerKey, ownerByKey, casesHeldBy,
} from '@/app/lib/ownerKey';

const NOW = new Date('2026-11-12T20:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const request = (cookie = '') => new Request('http://localhost/api/mission/case-1/board', { headers: cookie ? { cookie } : {} });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findUnique.mockResolvedValue(null);
  prisma.case.findMany.mockResolvedValue([]);
});

describe('the key', () => {
  test('is long and random, and only its hash is kept', () => {
    const a = mintOwnerKey();
    const b = mintOwnerKey();
    expect(a.key).not.toBe(b.key);
    // 32 random bytes, in letters a link can carry.
    expect(a.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(hashOwnerKey(a.key));
    expect(a.hash).not.toContain(a.key);
  });

  test('matches its own hash and no other', () => {
    const { key, hash } = mintOwnerKey();
    expect(keyMatches(key, hash)).toBe(true);
    expect(keyMatches(mintOwnerKey().key, hash)).toBe(false);
    expect(keyMatches(`${key}x`, hash)).toBe(false);
  });

  test('nothing that is not a key matches, and nothing throws', () => {
    const { hash } = mintOwnerKey();
    for (const bad of [null, undefined, '', 'short', 12345, {}, [], 'x'.repeat(500)]) expect(keyMatches(bad, hash)).toBe(false);
    for (const bad of [null, undefined, '', 'nothex', 'abc', 12345]) expect(keyMatches(mintOwnerKey().key, bad)).toBe(false);
  });

  test('is good for sixty days from the report', () => {
    expect(OWNER_KEY_DAYS).toBe(60);
    expect(keyIsFresh(new Date(NOW - 59 * DAY), NOW)).toBe(true);
    expect(keyIsFresh(new Date(NOW - 61 * DAY), NOW)).toBe(false);
    expect(keyIsFresh(null, NOW)).toBe(false);
    // A date in the future is not a key that was minted.
    expect(keyIsFresh(new Date(NOW + DAY), NOW)).toBe(false);
  });
});

describe('the cookie that carries it', () => {
  test('is named for the one report it opens', () => {
    expect(ownerCookieName('case-1')).toBe('rp_owner_case-1');
  });

  test('cannot be read by a script or sent by another site, and lasts as long as the key', () => {
    const kept = ownerCookie('case-1', 'the-key');
    expect(kept).toMatchObject({ name: 'rp_owner_case-1', value: 'the-key' });
    expect(kept.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 24 * 60 * 60 });
    const was = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(ownerCookie('case-1', 'the-key').options.secure).toBe(true);
    process.env.NODE_ENV = was;
  });

  test('a request\'s cookies are read as they are sent, and a broken one is nobody\'s key', () => {
    const jar = cookiesOf(request('a=1; rp_owner_case-1=abc%2Bdef; broken=%E0%A4%A; empty=; b = 2'));
    expect(jar.get('a')).toBe('1');
    expect(jar.get('rp_owner_case-1')).toBe('abc+def');
    expect(jar.has('broken')).toBe(false);
    expect(jar.get('b')).toBe('2');
    expect(cookiesOf(request()).size).toBe(0);
    expect(cookiesOf(null).size).toBe(0);
    expect(ownerKeyFrom(request('rp_owner_case-1=k1; rp_owner_case-2=k2'), 'case-2')).toBe('k2');
    expect(ownerKeyFrom(request('rp_owner_case-1=k1'), 'case-9')).toBeNull();
    expect(ownerKeyFrom(request('rp_owner_case-1=k1'), null)).toBeNull();
  });
});

describe('holding the key to a search', () => {
  const { key, hash } = mintOwnerKey();
  const pet = { id: 'case-1', reporterId: 'user-avery', ownerKeyHash: hash, ownerKeyAt: new Date(NOW - DAY) };

  test('the right key, for that report, while it is good', () => {
    expect(holdsOwnerKey(request(`rp_owner_case-1=${key}`), pet, NOW)).toBe(true);
    // Another report's cookie carrying this key opens nothing here.
    expect(holdsOwnerKey(request(`rp_owner_case-2=${key}`), pet, NOW)).toBe(false);
    expect(holdsOwnerKey(request(`rp_owner_case-1=${mintOwnerKey().key}`), pet, NOW)).toBe(false);
    expect(holdsOwnerKey(request(), pet, NOW)).toBe(false);
  });

  test('not once it is too old, and not for a report that never had one', () => {
    expect(holdsOwnerKey(request(`rp_owner_case-1=${key}`), { ...pet, ownerKeyAt: new Date(NOW - 61 * DAY) }, NOW)).toBe(false);
    expect(holdsOwnerKey(request(`rp_owner_case-1=${key}`), { ...pet, ownerKeyHash: null }, NOW)).toBe(false);
    expect(holdsOwnerKey(request(`rp_owner_case-1=${key}`), null, NOW)).toBe(false);
  });

  test('the owner by key is the account the report was filed to, and nothing is looked up without a key', async () => {
    expect(await ownerByKey(request(), 'case-1', NOW)).toBeNull();
    expect(await ownerByKey(request('other=1'), 'case-1', NOW)).toBeNull();
    expect(prisma.case.findUnique).not.toHaveBeenCalled();
    prisma.case.findUnique.mockResolvedValue(pet);
    expect(await ownerByKey(request(`rp_owner_case-1=${key}`), 'case-1', NOW)).toEqual({ userId: 'user-avery' });
    // Only what the check needs is read.
    expect(prisma.case.findUnique).toHaveBeenCalledWith({ where: { id: 'case-1' }, select: { id: true, reporterId: true, ownerKeyHash: true, ownerKeyAt: true } });
    expect(await ownerByKey(request(`rp_owner_case-1=${mintOwnerKey().key}`), 'case-1', NOW)).toBeNull();
    prisma.case.findUnique.mockRejectedValue(new Error('down'));
    expect(await ownerByKey(request(`rp_owner_case-1=${key}`), 'case-1', NOW)).toBeNull();
  });
});

describe('the searches a browser holds', () => {
  test('are the ones whose keys it really has: a made-up cookie is not a search', async () => {
    const mine = mintOwnerKey();
    const old = mintOwnerKey();
    prisma.case.findMany.mockResolvedValue([
      { id: 'case-1', caseNumber: 'AUS-1', petName: 'Max', status: 'ACTIVE', reportType: 'LOST', ownerKeyHash: mine.hash, ownerKeyAt: new Date(NOW - DAY) },
      { id: 'case-2', caseNumber: 'AUS-2', petName: 'Bo', status: 'ACTIVE', reportType: 'LOST', ownerKeyHash: mintOwnerKey().hash, ownerKeyAt: new Date(NOW - DAY) },
      { id: 'case-3', caseNumber: 'AUS-3', petName: 'Kit', status: 'ACTIVE', reportType: 'LOST', ownerKeyHash: old.hash, ownerKeyAt: new Date(NOW - 90 * DAY) },
    ]);
    const held = await casesHeldBy(request(`rp_owner_case-1=${mine.key}; rp_owner_case-2=guess; rp_owner_case-3=${old.key}; session=x`), { now: NOW });
    expect(held).toEqual([{ id: 'case-1', caseNumber: 'AUS-1', petName: 'Max', status: 'ACTIVE', reportType: 'LOST', expiresAt: null }]);
    // The hash never leaves this file.
    expect(JSON.stringify(held)).not.toMatch(/ownerKey/);
    expect(prisma.case.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['case-1', 'case-2', 'case-3'] } });
  });

  test('none without a key cookie, with no lookup; and a pile of cookies is not read without end', async () => {
    expect(await casesHeldBy(request('session=x'), { now: NOW })).toEqual([]);
    expect(prisma.case.findMany).not.toHaveBeenCalled();
    const many = Array.from({ length: 40 }, (_, i) => `rp_owner_c${i}=k${i}`).join('; ');
    await casesHeldBy(request(many), { now: NOW });
    expect(prisma.case.findMany.mock.calls[0][0].where.id.in).toHaveLength(12);
  });

  test('the ones this browser made itself: a key that arrived in a link is the owner\'s, and is not a search of this browser\'s own', async () => {
    // Someone is sent the link to another person\'s search and opens it. They hold its key. If that counted as
    // their own open search, they could not report their own pet.
    const theirs = mintOwnerKey();
    const mine = mintOwnerKey();
    const rows = [
      { id: 'case-1', caseNumber: 'AUS-1', petName: 'Max', status: 'ACTIVE', reportType: 'LOST', expiresAt: null, ownerKeyHash: theirs.hash, ownerKeyAt: new Date(NOW - DAY) },
      { id: 'case-2', caseNumber: 'AUS-2', petName: 'Bo', status: 'ACTIVE', reportType: 'LOST', expiresAt: null, ownerKeyHash: mine.hash, ownerKeyAt: new Date(NOW - DAY) },
    ];
    prisma.case.findMany.mockImplementation(async ({ where }) => rows.filter((r) => where.id.in.includes(r.id)));
    const cookie = `rp_owner_case-1=${theirs.key}; rp_owner_case-2=${mine.key}; rp_made_case-2=1`;
    expect((await casesHeldBy(request(cookie), { now: NOW })).map((c) => c.id)).toEqual(['case-1', 'case-2']);
    expect((await casesHeldBy(request(cookie), { madeHere: true, now: NOW })).map((c) => c.id)).toEqual(['case-2']);
    // The mark alone, without the key, is nothing.
    expect(await casesHeldBy(request('rp_made_case-2=1'), { madeHere: true, now: NOW })).toEqual([]);
    expect(madeCookieName('case-2')).toBe('rp_made_case-2');
    expect(madeCookie('case-2')).toMatchObject({ name: 'rp_made_case-2', value: '1', options: { httpOnly: true, sameSite: 'lax', path: '/' } });
  });
});
