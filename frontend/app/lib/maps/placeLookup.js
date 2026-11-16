/**
 * Looking up a typed place in several geocoders at once, for the place
 * picker (app/components/report/LocationPicker.js): Apple MapKit, Photon
 * and Nominatim, best first.
 *
 * Each one is given a few seconds. One that never answers must not keep
 * back what the others found: after Apple MapKit's script failed to load,
 * every search from the second on waited for it for ever, while Nominatim
 * had already answered (2026-11-16). And the answer says whether any of
 * them answered at all, so the picker can tell "no matches" from "the
 * lookup did not work just now" (a 503, a rate limit, no signal).
 *
 * Pure: no window, no fetch. The sources are handed in.
 */

/** How long one geocoder is waited for, in milliseconds. */
export const LOOKUP_TIMEOUT_MS = 6000;
/** How many places the list shows. */
export const RESULTS_MAX = 8;

/** The promise, or a failure once `ms` have passed without an answer. */
export function within(promise, ms = LOOKUP_TIMEOUT_MS) {
  let timer = null;
  const late = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('No answer in time')), ms);
  });
  return Promise.race([Promise.resolve(promise), late]).finally(() => clearTimeout(timer));
}

/** One spot once: by its point to four places (about 10 m), or by its words where it has no point yet. */
function spotKey(place) {
  const lat = Number(place?.latitude);
  const lng = Number(place?.longitude);
  if (place?.latitude != null && place?.longitude != null && Number.isFinite(lat) && Number.isFinite(lng)) return `${lat.toFixed(4)},${lng.toFixed(4)}`;
  return `words:${place?.name || ''}|${place?.address || ''}`;
}

/**
 * `sources` are promises of [{ name, address, latitude, longitude }], in
 * the order their places are listed. Resolves, never rejects, to
 * { results, answered }: up to RESULTS_MAX places, each spot once, and
 * whether any source answered (with places or with none). A source that
 * fails or does not answer in `timeoutMs` adds nothing and holds nothing up.
 */
export async function lookUpPlaces(sources = [], { timeoutMs = LOOKUP_TIMEOUT_MS, max = RESULTS_MAX } = {}) {
  const settled = await Promise.allSettled(sources.map((source) => within(source, timeoutMs)));
  const results = [];
  const seen = new Set();
  for (const answer of settled) {
    if (answer.status !== 'fulfilled' || !Array.isArray(answer.value)) continue;
    for (const place of answer.value) {
      if (!place || results.length >= max) continue;
      const key = spotKey(place);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(place);
    }
  }
  return { results, answered: settled.some((answer) => answer.status === 'fulfilled' && Array.isArray(answer.value)) };
}
