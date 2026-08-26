/**
 * Human labels for pin-only locations.
 *
 * When every geocoder fails (or the reporter just taps "use my location"),
 * the wizard stores raw "30.2992, -97.7333" as the last-seen address, and
 * the public poster then says LAST SEEN: 30.2992. These helpers keep that
 * from reaching a reader: detect a coordinate-shaped string, and try once,
 * server-side, to turn coordinates into "Neighborhood, City, ST".
 */

const COORDS_RE = /^\s*-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?\s*$/;

export function looksLikeCoordinates(text) {
  return typeof text === 'string' && COORDS_RE.test(text);
}

/** What a reader sees when only a pin exists. */
export const PIN_ONLY_LABEL = 'Near the pinned spot';

/**
 * Reverse geocode to a short place label, or null. Fail-soft and bounded:
 * a slow or down geocoder must never block posting a report.
 */
export async function reverseGeocodeLabel(lat, lng, { timeoutMs = 3500 } = {}) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
      addressdetails: '1',
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      {
        headers: { 'User-Agent': 'ReunitePets/1.0 (reunitepets.org)' },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const a = data?.address || {};
    const area = a.suburb || a.neighbourhood || a.quarter || a.hamlet || null;
    const city = a.city || a.town || a.village || a.county || null;
    const state = a.state || null;
    const parts = [area, city, state].filter(Boolean);
    return parts.length ? parts.join(', ') : data?.display_name || null;
  } catch {
    return null;
  }
}
