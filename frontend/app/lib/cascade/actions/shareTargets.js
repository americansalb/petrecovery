/**
 * share_targets action (tier 1) — find the LOCAL places to post this case.
 *
 * Groups are a directory, not a per-case lookup: the first case in an area
 * pays for one web search (+ optional Haiku rank), and the results live in
 * the CommunityGroup table like shelters do. Every later case in that
 * city/state serves straight from the DB at zero search/token cost until the
 * rows age past REFRESH_AFTER_DAYS, when the next case triggers a re-sweep.
 * Groups that a fresh sweep no longer finds are marked STALE and never
 * served again (kept for audit).
 *
 * Discovery layers, best available wins:
 *  1. Claude web search (ANTHROPIC_API_KEY, the same key that already writes
 *     the flyer copy): one Haiku request with the server-side web_search tool
 *     searches for `site:facebook.com/groups {city} lost found pets` and
 *     ranks the hits in the same call. Search engines index public group
 *     pages, so this finds real local groups without touching Facebook.
 *     Only URLs that actually appeared in the search results are trusted;
 *     a deterministic keyword filter over those results is the fallback if
 *     the model's answer is unusable.
 *  2. Always-working deep links (no keys required): Facebook's own group
 *     search pre-filled with the city, Nextdoor, and a Reddit search.
 *
 * The owner sees these under "Share the case link everywhere local" with
 * their pre-written caption one tap away. Never SCRAPES Facebook; only
 * search-engine results and public URLs.
 */

import prisma from '@/app/lib/prisma';
import { checkGlobalLimitAsync } from '@/app/lib/rateLimit';
import { normalizeState } from '@/app/lib/usStates';

const SPECIES_WORD = { DOG: 'dog', CAT: 'cat', BIRD: 'bird', RABBIT: 'rabbit', OTHER: 'pet' };
// The server-side search loop (a few searches + ranking) takes longer than a
// plain completion; the admin route caps at maxDuration 30.
const SWEEP_TIMEOUT_MS = 25000;
const MAX_GROUPS = 8;
const MAX_SEARCHES_PER_SWEEP = 4;
const CATEGORIES = ['LOST_PET', 'COMMUNITY'];
export const REFRESH_AFTER_DAYS = 30;

/** City + state tokens from a stored address ("1847 W Addison St, Chicago,
 *  IL 60613, United States" -> { city: "Chicago", state: "IL" }). */
export function cityStateFromAddress(address) {
  let parts = String(address || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1 && /^(united states( of america)?|usa|u\.s\.a?\.?|canada|m[eé]xico)$/i.test(parts[parts.length - 1])) {
    parts = parts.slice(0, -1);
  }
  if (parts.length > 1 && /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) parts = parts.slice(0, -1);
  const hasStreet = parts.length > 1 && /\d/.test(parts[0]);
  const city = (hasStreet ? parts[1] : parts[0]) || '';
  const stateRaw = (hasStreet ? parts[2] : parts[1]) || '';
  // Normalize "Illinois" and "IL" to the same token so the group directory
  // keys one area per city, however the geocoder spelled the state.
  const state = normalizeState(stateRaw.replace(/\d{5}(-\d{4})?/, ''));
  return { city: city.replace(/\d/g, '').trim(), state };
}

function isGroupUrl(url) {
  return /facebook\.com\/groups\/[^/?#]+/i.test(url) && !/facebook\.com\/groups\/search/i.test(url);
}

export function groupSlugFromUrl(url) {
  return String(url).match(/facebook\.com\/groups\/([^/?#]+)/i)?.[1]?.toLowerCase() || null;
}

/** Fresh enough to serve without a re-sweep? */
export function isFreshFetch(fetchedAt, now = new Date()) {
  const age = now.getTime() - new Date(fetchedAt).getTime();
  return age < REFRESH_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/** Serveable groups for an area, newest sweep first. Null if the table is
 *  unreachable (schema not pushed yet, DB down) so callers fall through to a
 *  live search instead of failing the step. */
async function readGroupDirectory(city, state) {
  try {
    return await prisma.communityGroup.findMany({
      where: { city, state, status: 'ACTIVE' },
      orderBy: [{ rank: 'asc' }, { fetchedAt: 'desc' }],
      take: MAX_GROUPS,
    });
  } catch {
    return null;
  }
}

/** Persist a completed sweep: upsert kept groups (rank = serve order) and
 *  mark the area's previously ACTIVE rows that dropped out of a NON-EMPTY
 *  fresh sweep as STALE. Admin-REMOVED groups are never touched, so a block
 *  survives every future sweep. Best-effort; discovery still returns its
 *  results when the DB write fails. Returns the slugs it skipped as blocked
 *  so the caller can drop them from what it serves. */
async function writeGroupDirectory(city, state, kept, geo = null) {
  const now = new Date();
  const blocked = new Set();
  const areaLat = Number.isFinite(geo?.lat) ? geo.lat : null;
  const areaLng = Number.isFinite(geo?.lng) ? geo.lng : null;
  try {
    const allSlugs = kept.map((g) => groupSlugFromUrl(g.url)).filter(Boolean);
    const removedRows = await prisma.communityGroup.findMany({
      where: { slug: { in: allSlugs }, status: 'REMOVED' },
      select: { slug: true },
    });
    for (const r of removedRows) blocked.add(r.slug);

    const slugs = [];
    for (let i = 0; i < kept.length; i++) {
      const slug = groupSlugFromUrl(kept[i].url);
      if (!slug || blocked.has(slug)) continue;
      slugs.push(slug);
      const category = CATEGORIES.includes(kept[i].category) ? kept[i].category : 'LOST_PET';
      const detail = {
        category,
        coverage: kept[i].coverage || '',
        cities: JSON.stringify(kept[i].cities || []),
        ...(areaLat != null && areaLng != null ? { areaLat, areaLng } : {}),
      };
      await prisma.communityGroup.upsert({
        where: { slug },
        update: {
          name: kept[i].name,
          url: kept[i].url,
          city,
          state,
          ...detail,
          rank: i,
          fetchedAt: now,
          status: 'ACTIVE',
          staleAt: null,
          source: 'CLAUDE_WEB_SEARCH',
        },
        create: { slug, name: kept[i].name, url: kept[i].url, city, state, ...detail, rank: i, source: 'CLAUDE_WEB_SEARCH' },
      });
    }
    if (slugs.length > 0) {
      await prisma.communityGroup.updateMany({
        where: { city, state, status: 'ACTIVE', slug: { notIn: slugs } },
        data: { status: 'STALE', staleAt: now },
      });
    }
  } catch (err) {
    console.error('[share_targets] directory write failed:', err.message);
  }
  return blocked;
}

/** Deterministic relevance filter: lost/found language + pet language. */
function keywordFilter(candidates) {
  return candidates.filter(
    (c) => /lost|found|missing/i.test(c.title) && /pet|dog|cat|animal/i.test(c.title)
  );
}

/** Every unique Facebook group the web_search tool actually surfaced, pulled
 *  from the response's web_search_tool_result blocks. This is the trust
 *  boundary: the model may only keep URLs that appear here. */
function candidatesFromSearchResults(content) {
  const seen = new Set();
  const out = [];
  for (const block of content || []) {
    if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue;
    for (const r of block.content) {
      if (r.type !== 'web_search_result') continue;
      const url = String(r.url || '');
      if (!isGroupUrl(url)) continue;
      const slug = groupSlugFromUrl(url);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push({ title: String(r.title || '').slice(0, 120), url });
    }
  }
  return out;
}

/** Best-effort city coordinates for the coverage map when the caller has
 *  none (free-typed admin searches, pre-coordinate rows being re-swept). */
async function geocodeCity(city, state) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const params = new URLSearchParams({
      q: [city, state].filter(Boolean).join(', '),
      format: 'json',
      limit: '1',
      countrycodes: 'us',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ReunitePets/1.0 (area geocoder)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const lat = parseFloat(data?.[0]?.lat);
    const lng = parseFloat(data?.[0]?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The model's final answer, tolerant of prose around the JSON. */
function parseKeepList(content) {
  const text = (content || []).filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('\n');
  if (!text) return null;
  const raw = text.match(/\{[\s\S]*\}/)?.[0];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.keep) ? parsed.keep : null;
  } catch {
    return null;
  }
}

/** One full discovery sweep for an area: a single Haiku request with the
 *  server-side web_search tool searches for public Facebook lost-pet groups
 *  and ranks them in the same call, then the winners are persisted. Shared by
 *  the cascade (on a cache miss) and the admin's manual "run a search"
 *  button. Returns the serveable groups (admin-REMOVED ones already dropped)
 *  plus how many raw candidates the search surfaced. */
export async function sweepArea(city, rawState, geo = null) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: 'ANTHROPIC_API_KEY is not configured', groups: [], candidates: 0 };
  if (!city) return { ok: false, reason: 'City is required', groups: [], candidates: 0 };
  const state = normalizeState(rawState);

  try {
    const ceiling = await checkGlobalLimitAsync('cascade:share-targets', {
      windowMs: 60000,
      maxRequests: 60,
      blockDurationMs: 60000,
    });
    if (!ceiling.success) return { ok: false, reason: 'Rate limited, try again in a minute', groups: [], candidates: 0 };
  } catch {
    // Limiter down: proceed; the 30-day cache already bounds sweep volume.
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SWEEP_TIMEOUT_MS);
  let data;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: MAX_SEARCHES_PER_SWEEP,
            allowed_domains: ['facebook.com', 'www.facebook.com'],
          },
        ],
        system:
          'You find public Facebook groups where an owner can post a lost-pet case for a given area. ' +
          'Search the web with queries like "site:facebook.com/groups <city> lost found pets" and ' +
          '"site:facebook.com/groups <city> community" (try the city alone and with its state). ' +
          'Keep two kinds of groups, with DIFFERENT geographic bars: ' +
          'lost_pet groups (lost-and-found or pet groups) may serve the town, its immediate ' +
          'neighbors, or its county/region, since dedicated lost-pet groups are usually county-wide ' +
          'and their members live everywhere in it. ' +
          'community groups (town chatter, community boards, neighborhood groups) must be for the ' +
          'town itself or a directly adjacent community only; a general group for a town even a few ' +
          'miles away is noise, so when in doubt leave it out. ' +
          'Drop groups for unrelated areas and generic national groups. Clean each kept name ' +
          '(no "| Facebook" suffixes). Order lost_pet groups first, then community, most local ' +
          `first, maximum ${MAX_GROUPS}. Only include URLs that appeared in your search results. ` +
          'For each kept group also report the area it serves, judged from its name and listing: ' +
          '"coverage" is a short label ("Kane County, IL" or "Algonquin, LITH, Huntley, Dundee") ' +
          'and "cities" lists the individual towns it names or clearly implies (empty if unclear). ' +
          'Reply with ONLY this JSON, nothing else: ' +
          '{"keep": [{"name": "...", "url": "...", "category": "lost_pet" | "community", ' +
          '"coverage": "...", "cities": ["..."]}]}',
        messages: [{ role: 'user', content: `Area: ${city}, ${state}` }],
      }),
    });
    if (!res.ok) {
      return { ok: false, reason: `Search request failed (${res.status})`, groups: [], candidates: 0 };
    }
    data = await res.json();
  } catch {
    return { ok: false, reason: 'Search timed out', groups: [], candidates: 0 };
  } finally {
    clearTimeout(timer);
  }

  const groupCandidates = candidatesFromSearchResults(data.content);
  const allowed = new Set(groupCandidates.map((c) => groupSlugFromUrl(c.url)));

  const kept = (parseKeepList(data.content) || [])
    .filter((k) => k?.url && allowed.has(groupSlugFromUrl(k.url)))
    .map((k) => ({
      name: String(k.name || '').slice(0, 120),
      url: String(k.url),
      category: String(k.category || '').toUpperCase() === 'COMMUNITY' ? 'COMMUNITY' : 'LOST_PET',
      coverage: String(k.coverage || '').slice(0, 160),
      cities: Array.isArray(k.cities)
        ? k.cities
            .filter((s) => typeof s === 'string')
            .map((s) => s.trim().slice(0, 40))
            .filter(Boolean)
            .slice(0, 12)
        : [],
    }));

  const ranked = (
    kept.length > 0
      ? kept
      : keywordFilter(groupCandidates).map((r) => ({
          name: r.title.replace(/\s*[|·-]\s*Facebook\s*$/i, ''),
          url: r.url,
          category: 'LOST_PET',
          coverage: '',
          cities: [],
        }))
  ).slice(0, MAX_GROUPS);

  if (ranked.length === 0) return { ok: true, groups: [], candidates: groupCandidates.length };

  // No coordinates from the caller: geocode the city so the coverage map can
  // always place this area (also heals pre-coordinate rows on re-sweep).
  const resolvedGeo =
    Number.isFinite(geo?.lat) && Number.isFinite(geo?.lng) ? geo : await geocodeCity(city, state);

  const blocked = await writeGroupDirectory(city, state, ranked, resolvedGeo);
  const groups = ranked.filter((g) => {
    const slug = groupSlugFromUrl(g.url);
    return !(slug && blocked.has(slug));
  });
  return { ok: true, groups, candidates: groupCandidates.length };
}

export async function runShareTargets(ctx) {
  const c = ctx.case;
  const { city, state } = cityStateFromAddress(c.lastSeenAddress);
  const speciesWord = SPECIES_WORD[c.petSpecies] || 'pet';
  const area = city || state || 'your area';

  const targets = [];
  let searched = false;
  let cached = false;

  // Layer 1a: the group directory. Fresh rows for this area mean a previous
  // case already paid for discovery; serve them and spend nothing.
  const directory = city ? await readGroupDirectory(city, state) : null;
  const directoryFresh = directory?.length > 0 && directory.every((g) => isFreshFetch(g.fetchedAt));
  if (directoryFresh) {
    cached = true;
    for (const g of directory) targets.push({ kind: 'facebook_group', name: g.name, url: g.url, category: g.category || 'LOST_PET', coverage: g.coverage || '' });
    prisma.communityGroup
      .updateMany({ where: { id: { in: directory.map((g) => g.id) } }, data: { timesServed: { increment: 1 } } })
      .catch(() => {});
  }

  // Layer 1b: live discovery when the directory has nothing fresh and the
  // Anthropic key is configured. Results are written back so the next case
  // here is free.
  const key = process.env.ANTHROPIC_API_KEY;
  if (!cached && key && city) {
    searched = true;
    const sweep = await sweepArea(city, state, { lat: c.lastSeenLatitude, lng: c.lastSeenLongitude });
    if (sweep.groups.length > 0) {
      for (const g of sweep.groups) targets.push({ kind: 'facebook_group', name: g.name, url: g.url, category: g.category || 'LOST_PET', coverage: g.coverage || '' });
    } else if (directory?.length > 0) {
      // Sweep came back empty (API hiccup or thin results): aged rows beat
      // nothing, and we don't stale anything on an empty sweep.
      cached = true;
      for (const g of directory) targets.push({ kind: 'facebook_group', name: g.name, url: g.url, category: g.category || 'LOST_PET', coverage: g.coverage || '' });
    }
  } else if (!cached && directory?.length > 0) {
    // No search key: serve whatever the directory has, regardless of age.
    cached = true;
    for (const g of directory) targets.push({ kind: 'facebook_group', name: g.name, url: g.url, category: g.category || 'LOST_PET', coverage: g.coverage || '' });
  }

  // Layer 2: deep links that always work, no keys, no scraping.
  targets.push({
    kind: 'facebook_search',
    name: `Search Facebook groups: "${area} lost & found pets"`,
    url: `https://www.facebook.com/groups/search/?q=${encodeURIComponent(`${area} lost found pets`)}`,
  });
  targets.push({
    kind: 'nextdoor',
    name: 'Post to your Nextdoor neighborhood',
    url: 'https://nextdoor.com/',
  });
  targets.push({
    kind: 'reddit',
    name: `Search Reddit for ${area} communities`,
    url: `https://www.reddit.com/search/?q=${encodeURIComponent(`${area} lost ${speciesWord}`)}`,
  });

  const groupCount = targets.filter((t) => t.kind === 'facebook_group').length;
  return {
    count: groupCount || targets.length,
    result: { targets, searched, cached, groups: groupCount },
  };
}
