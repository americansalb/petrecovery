/**
 * The centre of a US ZIP code, for giving a Rescue Force division an area.
 * Uses api.zippopotam.us, the same lookup the Rescue Forces search uses.
 * Returns null for anything that is not a known 5-digit ZIP.
 */

export async function zipCenter(zip) {
  if (!/^\d{5}$/.test(String(zip || ''))) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const place = (await res.json())?.places?.[0];
    if (!place) return null;
    const lat = parseFloat(place.latitude);
    const lng = parseFloat(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: [place['place name'], place['state abbreviation']].filter(Boolean).join(', ') };
  } catch {
    return null;
  }
}

/** A division radius in miles: 1 to 25, default 3. */
export function divisionRadius(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 25 ? n : 3;
}
