/**
 * The Street View probe.
 *
 * Street View Static API metadata requests are free and unmetered, so
 * we can afford to test random points until one has official imagery
 * nearby. Each probe asks for the nearest outdoor panorama within a
 * radius; the copyright line tells official Google coverage apart from
 * user-uploaded photo spheres, which we skip.
 *
 * Server only: the key never reaches the browser.
 */

/** Overridable so a local mock can stand in for Google during development. */
const METADATA_URL = process.env.GEO_STREET_VIEW_METADATA_URL || 'https://maps.googleapis.com/maps/api/streetview/metadata';

/** Errors that mean "stop probing, the key or project is the problem". */
const FATAL_STATUSES = new Set(['REQUEST_DENIED', 'OVER_QUERY_LIMIT', 'INVALID_REQUEST']);

export function isOfficialCopyright(text) {
  return /google/i.test(String(text || ''));
}

/**
 * One metadata lookup.
 * Resolves to { status: 'hit', panoId, lat, lng, date, copyright }
 *          or { status: 'miss', reason }
 *          or { status: 'error', code, message, fatal }
 */
export async function probeStreetView({ lat, lng, radiusKm = 10, key, fetchImpl = globalThis.fetch, timeoutMs = 6000 }) {
  if (!key) return { status: 'error', code: 'no_key', message: 'No Street View key', fatal: true };
  const params = new URLSearchParams({
    location: `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`,
    radius: String(Math.max(50, Math.round(radiusKm * 1000))),
    source: 'outdoor',
    key,
  });
  let response;
  let data;
  try {
    const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
    response = await fetchImpl(`${METADATA_URL}?${params.toString()}`, { signal });
    data = await response.json();
  } catch (error) {
    return { status: 'error', code: 'network', message: error?.message || 'Request failed', fatal: false };
  }
  const status = data?.status;
  if (status === 'OK') {
    if (!isOfficialCopyright(data.copyright)) return { status: 'miss', reason: 'unofficial' };
    if (!data.pano_id || !data.location) return { status: 'miss', reason: 'incomplete' };
    return {
      status: 'hit',
      panoId: data.pano_id,
      lat: Number(data.location.lat),
      lng: Number(data.location.lng),
      date: data.date || '',
      copyright: data.copyright || '',
    };
  }
  if (status === 'ZERO_RESULTS' || status === 'NOT_FOUND') return { status: 'miss', reason: 'none' };
  return {
    status: 'error',
    code: status || `http_${response?.status || 0}`,
    message: data?.error_message || `Street View metadata returned ${status || response?.status}`,
    fatal: FATAL_STATUSES.has(status),
  };
}

/**
 * Probe candidates from `source.next()` in parallel batches until one
 * hits. Results are read in candidate order, so a seeded source gives
 * the same hit every time coverage is unchanged.
 */
export async function findPanorama({
  source,
  key,
  fetchImpl,
  maxProbes = 96,
  batchSize = 12,
  timeoutMs,
}) {
  const stats = { probes: 0, misses: 0, unofficial: 0, errors: 0, water: 0 };
  let lastError = null;
  for (let start = 0; start < maxProbes; start += batchSize) {
    const batch = [];
    for (let i = 0; i < batchSize && start + i < maxProbes; i++) {
      const candidate = source.next();
      if (!candidate) break;
      batch.push(candidate);
    }
    if (!batch.length) break;
    const results = await Promise.all(
      batch.map((c) =>
        probeStreetView({ lat: c.lat, lng: c.lng, radiusKm: c.radiusKm, key, fetchImpl, timeoutMs }).catch(
          (error) => ({ status: 'error', code: 'network', message: error?.message, fatal: false })
        )
      )
    );
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      stats.probes++;
      if (result.status === 'hit') {
        stats.water = source.stats?.skippedWater || 0;
        return { hit: result, candidate: batch[i], stats };
      }
      if (result.status === 'miss') {
        stats.misses++;
        if (result.reason === 'unofficial') stats.unofficial++;
        continue;
      }
      stats.errors++;
      lastError = result;
      if (result.fatal) {
        stats.water = source.stats?.skippedWater || 0;
        return { hit: null, candidate: null, stats, error: result };
      }
    }
  }
  stats.water = source.stats?.skippedWater || 0;
  const allErrors = stats.probes > 0 && stats.errors === stats.probes;
  return {
    hit: null,
    candidate: null,
    stats,
    error: allErrors && lastError ? lastError : { status: 'error', code: 'no_imagery', message: 'No imagery found', fatal: false },
  };
}
