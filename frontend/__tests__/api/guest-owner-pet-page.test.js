/**
 * Someone who reported a lost pet without signing in is the owner on the pet's
 * page too, not only in Mission Control.
 *
 * The browser that sends a report made without an account keeps the owner's key
 * to that one search (app/lib/ownerKey.js), and Mission Control has treated it as
 * the owner ever since (searcherFor, app/lib/searcher.js). The pet's page asked
 * for a signed-in session instead, so the guest owner saw the stranger's view: no
 * "Mark as reunited", no better photo, no details, although the page after
 * posting says "your tools live there".
 *
 * What is held here: the page's data calls the person the owner by exactly the
 * rule Mission Control uses (the account the report was filed to, or the good
 * key to this one search); a wrong, old or other report's key, or no key, is
 * nobody's owner; the key and its hash never leave the server; and the owner's
 * status on the panel (POST /api/mission/[id]/owner) takes the same key.
 */

import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn() },
    missionControl: { findUnique: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: jest.fn(),
  RateLimitPresets: {},
}));
jest.mock('@/app/lib/missionControl/ownerHub', () => ({
  __esModule: true,
  getOwnerView: jest.fn(),
  updateOwnerStatus: jest.fn(),
  uploadVoiceClip: jest.fn(),
  triggerCallMode: jest.fn(),
  stopCallMode: jest.fn(),
  sendThankYou: jest.fn(),
  getFilteredSightings: jest.fn(),
}));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { mintOwnerKey, OWNER_KEY_DAYS } from '@/app/lib/ownerKey';
import { updateOwnerStatus, getOwnerView } from '@/app/lib/missionControl/ownerHub';
import { GET as getPublicCase } from '@/app/api/public/missions/[caseNumber]/route';
import { GET as getOwner, POST as postOwner } from '@/app/api/mission/[missionId]/owner/route';

const DAY = 24 * 60 * 60 * 1000;
const mine = mintOwnerKey();

const PET = {
  id: 'case-1',
  caseNumber: 'AUS-2026-0001',
  createdAt: new Date(),
  updatedAt: new Date(),
  petName: 'Mia',
  petSpecies: 'CAT',
  petBreed: 'Unknown',
  petColor: 'Grey',
  petSize: null,
  petPhotoUrl: null,
  petDescription: null,
  details: null,
  lastSeenLatitude: 30.27,
  lastSeenLongitude: -97.74,
  lastSeenAddress: 'Congress Avenue, Austin, Travis County, Texas, 78701, United States',
  lastSeenAt: new Date(),
  searchRadius: 1,
  status: 'ACTIVE',
  priority: 'NORMAL',
  reportType: 'LOST',
  resolution: null,
  resolvedAt: null,
  reporterId: 'guest-account',
  ownerName: 'Sam',
  ownerPhone: '512-555-0100',
  ownerKeyHash: mine.hash,
  ownerKeyAt: new Date(Date.now() - DAY),
  viewCount: 0,
  shareCount: 0,
  activeSearchers: 0,
  sightings: [],
  updates: [],
};

const withCookie = (url, cookie, init = {}) => new NextRequest(url, { ...init, headers: { ...(init.headers || {}), ...(cookie ? { cookie } : {}) } });
const pageData = async (cookie) => {
  const res = await getPublicCase(withCookie('http://localhost:3000/api/public/missions/AUS-2026-0001', cookie), { params: { caseNumber: 'AUS-2026-0001' } });
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue(null);
  prisma.case.findUnique.mockResolvedValue(PET);
  prisma.missionControl.findUnique.mockResolvedValue({ id: 'mc-1' });
  updateOwnerStatus.mockResolvedValue({ success: true });
  getOwnerView.mockResolvedValue({ owner: true });
});

describe("the pet's page data says who the owner is, by Mission Control's rule", () => {
  test('the browser holding the owner\'s key is the owner, with no session', async () => {
    const { status, body } = await pageData(`rp_owner_case-1=${mine.key}`);
    expect(status).toBe(200);
    expect(body.viewerIsOwner).toBe(true);
  });

  test('a wrong key, another report\'s cookie, an old key or no key is nobody\'s owner', async () => {
    expect((await pageData(`rp_owner_case-1=${mintOwnerKey().key}`)).body.viewerIsOwner).toBe(false);
    expect((await pageData(`rp_owner_case-2=${mine.key}`)).body.viewerIsOwner).toBe(false);
    expect((await pageData('')).body.viewerIsOwner).toBe(false);
    prisma.case.findUnique.mockResolvedValue({ ...PET, ownerKeyAt: new Date(Date.now() - (OWNER_KEY_DAYS + 1) * DAY) });
    expect((await pageData(`rp_owner_case-1=${mine.key}`)).body.viewerIsOwner).toBe(false);
    prisma.case.findUnique.mockResolvedValue({ ...PET, ownerKeyHash: null, ownerKeyAt: null });
    expect((await pageData(`rp_owner_case-1=${mine.key}`)).body.viewerIsOwner).toBe(false);
  });

  test('signed in, the account the report was filed to is the owner and anyone else is not', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'guest-account' } });
    expect((await pageData('')).body.viewerIsOwner).toBe(true);
    getServerSession.mockResolvedValue({ user: { id: 'a-neighbour' } });
    expect((await pageData('')).body.viewerIsOwner).toBe(false);
    // Signed in as someone else on the browser the report was sent from: the key is the owner's, as on the search.
    expect((await pageData(`rp_owner_case-1=${mine.key}`)).body.viewerIsOwner).toBe(true);
  });

  test('the key, its hash and the owner\'s account id never leave the server', async () => {
    const { body } = await pageData(`rp_owner_case-1=${mine.key}`);
    const sent = JSON.stringify(body);
    expect(sent).not.toContain(mine.key);
    expect(sent).not.toContain(mine.hash);
    expect(sent).not.toContain('guest-account');
    expect(body).not.toHaveProperty('ownerKeyHash');
    expect(body).not.toHaveProperty('ownerKeyAt');
    expect(body).not.toHaveProperty('reporterId');
  });
});

describe("the owner's status on the panel takes the same key", () => {
  const post = (cookie, body = { action: 'UPDATE_STATUS', activity: 'SEARCHING' }) =>
    postOwner(
      withCookie('http://localhost:3000/api/mission/case-1/owner', cookie, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      { params: { missionId: 'case-1' } }
    );

  test('with the key and no session, it is saved as the owner of that one search', async () => {
    const res = await post(`rp_owner_case-1=${mine.key}`);
    expect(res.status).toBe(200);
    expect(updateOwnerStatus).toHaveBeenCalledWith('mc-1', 'guest-account', { location: undefined, activity: 'SEARCHING', broadcast: undefined });
  });

  test('a wrong key, another report\'s key or no key is refused before anything is saved', async () => {
    for (const cookie of [`rp_owner_case-1=${mintOwnerKey().key}`, `rp_owner_case-2=${mine.key}`, '']) {
      const res = await post(cookie);
      expect(res.status).toBe(401);
    }
    expect(updateOwnerStatus).not.toHaveBeenCalled();
  });

  test('signed in, the session is who is asking, and the owner check stays with the report', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'a-neighbour' } });
    updateOwnerStatus.mockResolvedValue({ success: false, error: 'Unauthorized' });
    const res = await post('');
    expect(res.status).toBe(400);
    expect(updateOwnerStatus).toHaveBeenCalledWith('mc-1', 'a-neighbour', expect.any(Object));
  });

  test('the owner view reads the same way', async () => {
    const res = await getOwner(withCookie('http://localhost:3000/api/mission/case-1/owner', `rp_owner_case-1=${mine.key}`), { params: { missionId: 'case-1' } });
    expect(res.status).toBe(200);
    expect(getOwnerView).toHaveBeenCalledWith('mc-1', 'guest-account');
    const nobody = await getOwner(withCookie('http://localhost:3000/api/mission/case-1/owner', ''), { params: { missionId: 'case-1' } });
    expect(nobody.status).toBe(401);
  });
});

describe("the pet's page", () => {
  const page = fs.readFileSync(path.join(__dirname, '../../app/cases/[caseNumber]/CasePageClient.js'), 'utf8');

  test('shows the owner panel to whoever the page data calls the owner, signed in or not', () => {
    expect(page).toMatch(/const isOwner = c\.viewerIsOwner === true;/);
    expect(page).toMatch(/\{isOwner && open && \(\s*<OwnerPanel/);
  });

  test('marking the pet home uses the status route, which takes the owner\'s key', () => {
    expect(page).toMatch(/\/api\/missions\/\$\{encodeURIComponent\(c\.id\)\}\/status/);
    const status = fs.readFileSync(path.join(__dirname, '../../app/api/missions/[missionId]/status/route.js'), 'utf8');
    expect(status).toMatch(/ownerByKey\(request, /);
  });
});
