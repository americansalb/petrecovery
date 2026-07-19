/**
 * share_targets: the CommunityGroup directory must absorb repeat cases in the
 * same area (no search queries, no AI tokens), age out after
 * REFRESH_AFTER_DAYS, and mark dropped-out groups STALE only on a non-empty
 * fresh sweep.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    communityGroup: {
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
}));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  checkGlobalLimitAsync: jest.fn().mockResolvedValue({ success: true }),
}));

import prisma from '@/app/lib/prisma';
import {
  cityStateFromAddress,
  groupSlugFromUrl,
  isFreshFetch,
  runShareTargets,
  REFRESH_AFTER_DAYS,
} from '@/app/lib/cascade/actions/shareTargets';

const DAY = 24 * 60 * 60 * 1000;

function ctxFor(address = '1847 W Addison St, Chicago, IL 60613, United States') {
  return { case: { lastSeenAddress: address, petSpecies: 'DOG' } };
}

function dbRow(overrides = {}) {
  return {
    id: 'cg1',
    slug: 'chicagolostpets',
    name: 'Chicago Lost & Found Pets',
    url: 'https://www.facebook.com/groups/chicagolostpets',
    city: 'Chicago',
    state: 'IL',
    rank: 0,
    fetchedAt: new Date(),
    status: 'ACTIVE',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: empty directory reads and empty REMOVED-slug lookups; tests
  // queue specific directory rows with mockResolvedValueOnce.
  prisma.communityGroup.findMany.mockResolvedValue([]);
  prisma.communityGroup.updateMany.mockResolvedValue({ count: 0 });
  prisma.communityGroup.upsert.mockResolvedValue({});
  delete process.env.BRAVE_SEARCH_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  global.fetch = jest.fn();
});

afterAll(() => {
  delete global.fetch;
});

describe('cityStateFromAddress', () => {
  test('street address with zip and country', () => {
    expect(cityStateFromAddress('1847 W Addison St, Chicago, IL 60613, United States')).toEqual({
      city: 'Chicago',
      state: 'IL',
    });
  });

  test('city-first address', () => {
    expect(cityStateFromAddress('Elgin, Illinois, 60110')).toEqual({ city: 'Elgin', state: 'Illinois' });
  });

  test('empty input', () => {
    expect(cityStateFromAddress('')).toEqual({ city: '', state: '' });
  });
});

describe('groupSlugFromUrl / isFreshFetch', () => {
  test('extracts and lowercases the group slug', () => {
    expect(groupSlugFromUrl('https://www.facebook.com/groups/ChicagoLostPets/?ref=share')).toBe('chicagolostpets');
    expect(groupSlugFromUrl('https://example.com/nope')).toBeNull();
  });

  test('freshness flips at REFRESH_AFTER_DAYS', () => {
    const now = new Date('2026-07-19T00:00:00Z');
    expect(isFreshFetch(new Date(now - (REFRESH_AFTER_DAYS - 1) * DAY), now)).toBe(true);
    expect(isFreshFetch(new Date(now - (REFRESH_AFTER_DAYS + 1) * DAY), now)).toBe(false);
  });
});

describe('runShareTargets directory behavior', () => {
  test('fresh directory rows serve from cache with no search at all', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'k';
    prisma.communityGroup.findMany.mockResolvedValueOnce([dbRow()]);

    const { result } = await runShareTargets(ctxFor());

    expect(result.cached).toBe(true);
    expect(result.searched).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.targets.filter((t) => t.kind === 'facebook_group')).toHaveLength(1);
    // usage counter bumped for the served rows
    expect(prisma.communityGroup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { timesServed: { increment: 1 } } })
    );
  });

  test('aged rows trigger a re-sweep that upserts and stales dropped groups', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'k';
    prisma.communityGroup.findMany.mockResolvedValueOnce([
      dbRow({ fetchedAt: new Date(Date.now() - (REFRESH_AFTER_DAYS + 5) * DAY) }),
    ]);
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              title: 'Lost Dogs Chicago | Facebook',
              url: 'https://www.facebook.com/groups/lostdogschicago',
              description: 'Lost and found dogs in Chicago',
            },
          ],
        },
      }),
    });

    const { result } = await runShareTargets(ctxFor());

    expect(result.searched).toBe(true);
    expect(result.cached).toBe(false);
    expect(prisma.communityGroup.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'lostdogschicago' } })
    );
    // groups missing from the fresh sweep get marked STALE
    expect(prisma.communityGroup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ slug: { notIn: ['lostdogschicago'] }, status: 'ACTIVE' }),
        data: expect.objectContaining({ status: 'STALE' }),
      })
    );
    expect(result.targets[0]).toEqual(
      expect.objectContaining({ kind: 'facebook_group', name: 'Lost Dogs Chicago' })
    );
  });

  test('empty sweep serves aged rows and stales nothing', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'k';
    const aged = dbRow({ fetchedAt: new Date(Date.now() - (REFRESH_AFTER_DAYS + 5) * DAY) });
    prisma.communityGroup.findMany.mockResolvedValue([aged]);
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ web: { results: [] } }) });

    const { result } = await runShareTargets(ctxFor());

    expect(result.cached).toBe(true);
    expect(result.targets.filter((t) => t.kind === 'facebook_group')).toHaveLength(1);
    expect(prisma.communityGroup.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'STALE' }) })
    );
  });

  test('no search key still serves directory rows of any age', async () => {
    prisma.communityGroup.findMany.mockResolvedValueOnce([
      dbRow({ fetchedAt: new Date(Date.now() - 90 * DAY) }),
    ]);

    const { result } = await runShareTargets(ctxFor());

    expect(result.cached).toBe(true);
    expect(result.searched).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('unreachable table degrades to deep links only', async () => {
    prisma.communityGroup.findMany.mockRejectedValue(new Error('relation does not exist'));

    const { result } = await runShareTargets(ctxFor());

    expect(result.targets.filter((t) => t.kind === 'facebook_group')).toHaveLength(0);
    expect(result.targets.map((t) => t.kind)).toEqual(
      expect.arrayContaining(['facebook_search', 'nextdoor', 'reddit'])
    );
  });

  test('admin-REMOVED groups are never served or resurrected by a sweep', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'k';
    // Directory read: empty (default). REMOVED lookup inside the sweep write:
    // the found group is blocked.
    prisma.communityGroup.findMany
      .mockResolvedValueOnce([]) // readGroupDirectory
      .mockResolvedValueOnce([{ slug: 'lostdogschicago' }]); // REMOVED slugs
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              title: 'Lost Dogs Chicago | Facebook',
              url: 'https://www.facebook.com/groups/lostdogschicago',
              description: 'Lost and found dogs in Chicago',
            },
          ],
        },
      }),
    });

    const { result } = await runShareTargets(ctxFor());

    expect(prisma.communityGroup.upsert).not.toHaveBeenCalled();
    expect(result.targets.filter((t) => t.kind === 'facebook_group')).toHaveLength(0);
  });
});
