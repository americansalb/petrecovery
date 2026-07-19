/**
 * share_targets: the CommunityGroup directory must absorb repeat cases in the
 * same area (no searches, no extra tokens), age out after REFRESH_AFTER_DAYS,
 * and mark dropped-out groups STALE only on a non-empty fresh sweep.
 * Discovery runs through Claude's server-side web_search tool on the
 * ANTHROPIC_API_KEY; only URLs that appeared in real search results may be
 * kept.
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
  sweepArea,
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

/** A messages-API response whose web_search tool surfaced `results` and whose
 *  final text keeps `keep` (defaults to keeping everything surfaced). */
function anthropicResponse(results, keep) {
  const kept =
    keep ??
    results.map((r) => ({ name: r.title.replace(/\s*\|\s*Facebook\s*$/i, ''), url: r.url }));
  return {
    ok: true,
    json: async () => ({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'web_search_tool_result',
          content: results.map((r) => ({ type: 'web_search_result', title: r.title, url: r.url })),
        },
        { type: 'text', text: JSON.stringify({ keep: kept }) },
      ],
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: empty directory reads and empty REMOVED-slug lookups; tests
  // queue specific directory rows with mockResolvedValueOnce.
  prisma.communityGroup.findMany.mockResolvedValue([]);
  prisma.communityGroup.updateMany.mockResolvedValue({ count: 0 });
  prisma.communityGroup.upsert.mockResolvedValue({});
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

  test('city-first address normalizes the state name to its USPS code', () => {
    expect(cityStateFromAddress('Elgin, Illinois, 60110')).toEqual({ city: 'Elgin', state: 'IL' });
  });

  test('"Illinois" and "IL" addresses key the same directory area', () => {
    expect(cityStateFromAddress('Elgin, Illinois, 60110')).toEqual(
      cityStateFromAddress('12 Main St, Elgin, IL 60120')
    );
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
    process.env.ANTHROPIC_API_KEY = 'k';
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
    process.env.ANTHROPIC_API_KEY = 'k';
    prisma.communityGroup.findMany.mockResolvedValueOnce([
      dbRow({ fetchedAt: new Date(Date.now() - (REFRESH_AFTER_DAYS + 5) * DAY) }),
    ]);
    global.fetch.mockResolvedValue(
      anthropicResponse([
        { title: 'Lost Dogs Chicago | Facebook', url: 'https://www.facebook.com/groups/lostdogschicago' },
      ])
    );

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
    process.env.ANTHROPIC_API_KEY = 'k';
    const aged = dbRow({ fetchedAt: new Date(Date.now() - (REFRESH_AFTER_DAYS + 5) * DAY) });
    prisma.communityGroup.findMany.mockResolvedValue([aged]);
    global.fetch.mockResolvedValue(anthropicResponse([]));

    const { result } = await runShareTargets(ctxFor());

    expect(result.cached).toBe(true);
    expect(result.targets.filter((t) => t.kind === 'facebook_group')).toHaveLength(1);
    expect(prisma.communityGroup.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'STALE' }) })
    );
  });

  test('no API key still serves directory rows of any age', async () => {
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
    process.env.ANTHROPIC_API_KEY = 'k';
    // Directory read: empty (default). REMOVED lookup inside the sweep write:
    // the found group is blocked.
    prisma.communityGroup.findMany
      .mockResolvedValueOnce([]) // readGroupDirectory
      .mockResolvedValueOnce([{ slug: 'lostdogschicago' }]); // REMOVED slugs
    global.fetch.mockResolvedValue(
      anthropicResponse([
        { title: 'Lost Dogs Chicago | Facebook', url: 'https://www.facebook.com/groups/lostdogschicago' },
      ])
    );

    const { result } = await runShareTargets(ctxFor());

    expect(prisma.communityGroup.upsert).not.toHaveBeenCalled();
    expect(result.targets.filter((t) => t.kind === 'facebook_group')).toHaveLength(0);
  });
});

describe('sweepArea (manual admin search)', () => {
  test('reports not-ok without the Anthropic key', async () => {
    const sweep = await sweepArea('Elgin', 'IL');
    expect(sweep.ok).toBe(false);
    expect(sweep.reason).toMatch(/ANTHROPIC_API_KEY/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('searches, persists, and returns kept groups with categories, coverage, and area coords', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    global.fetch.mockResolvedValue(
      anthropicResponse(
        [
          { title: 'Lost Pets of Elgin | Facebook', url: 'https://www.facebook.com/groups/lostpetselgin' },
          { title: 'Elgin Community Board | Facebook', url: 'https://www.facebook.com/groups/elgincommunity' },
        ],
        [
          {
            name: 'Lost Pets of Elgin',
            url: 'https://www.facebook.com/groups/lostpetselgin',
            category: 'lost_pet',
            coverage: 'Kane County, IL',
            cities: ['Elgin', 'South Elgin'],
          },
          {
            name: 'Elgin Community Board',
            url: 'https://www.facebook.com/groups/elgincommunity',
            category: 'community',
            coverage: 'Elgin',
            cities: ['Elgin'],
          },
        ]
      )
    );

    const sweep = await sweepArea('Elgin', 'IL', { lat: 42.04, lng: -88.28 });

    expect(sweep.ok).toBe(true);
    expect(sweep.candidates).toBe(2);
    expect(sweep.groups).toEqual([
      expect.objectContaining({
        url: 'https://www.facebook.com/groups/lostpetselgin',
        category: 'LOST_PET',
        coverage: 'Kane County, IL',
      }),
      expect.objectContaining({ url: 'https://www.facebook.com/groups/elgincommunity', category: 'COMMUNITY' }),
    ]);
    // persisted with category, coverage detail, area coords, and honest source
    expect(prisma.communityGroup.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'lostpetselgin' },
        create: expect.objectContaining({
          category: 'LOST_PET',
          coverage: 'Kane County, IL',
          cities: JSON.stringify(['Elgin', 'South Elgin']),
          areaLat: 42.04,
          areaLng: -88.28,
          source: 'CLAUDE_WEB_SEARCH',
        }),
      })
    );
    // the request went to the Anthropic API with the web_search tool declared
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toContain('api.anthropic.com');
    expect(JSON.parse(init.body).tools[0].type).toBe('web_search_20250305');
  });

  test('model answers with URLs not in the search results are dropped, keyword fallback applies', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    global.fetch.mockResolvedValue(
      anthropicResponse(
        [{ title: 'Lost Pets of Elgin | Facebook', url: 'https://www.facebook.com/groups/lostpetselgin' }],
        [{ name: 'Fake Group', url: 'https://www.facebook.com/groups/hallucinated' }]
      )
    );

    const sweep = await sweepArea('Elgin', 'IL');

    // hallucinated URL rejected; deterministic filter keeps the real result
    expect(sweep.groups).toEqual([
      expect.objectContaining({ url: 'https://www.facebook.com/groups/lostpetselgin' }),
    ]);
  });
});
