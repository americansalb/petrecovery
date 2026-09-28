/**
 * Starting a Rescue Force wherever the town is already known: the
 * directory's "No Rescue Force near Waco yet" card (one tap starts Waco
 * Rescue Force), and the Start page, which a signed-out person is sent
 * through (sign in, and the force is started for them). One request, POST
 * /api/rescue-forces, and its outcomes in one place so both pages handle
 * them the same way: done, signed out, the volunteer waiver, a town that
 * already has a force, or an error in words.
 *
 * A town is what TownPicker picks: { city, state_id, country, zips?, lat?,
 * lng? }. It travels to the Start page in the URL (townParams,
 * townFromParams), so the sign-in and waiver pages can send the person back
 * with it; `start=1` asks the Start page to start the force on arrival.
 */

export const CREATE_PATH = '/rescue-forces/create';

const placed = (town) => town?.lat != null && town?.lng != null && Number.isFinite(Number(town.lat)) && Number.isFinite(Number(town.lng));

/** The town as URL parameters for the Start page. */
export function townParams(town) {
  const p = new URLSearchParams();
  if (!town?.city) return p;
  p.set('city', town.city);
  if (town.state_id) p.set('state', town.state_id);
  if (town.country && town.country !== 'US') p.set('country', town.country);
  if (town.zips?.[0]) p.set('zip', String(town.zips[0]));
  if (placed(town)) {
    p.set('lat', String(town.lat));
    p.set('lng', String(town.lng));
  }
  return p;
}

/** The town from the Start page's URL (a string or URLSearchParams), or null. */
export function townFromParams(search) {
  const p = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');
  const city = (p.get('city') || '').trim().slice(0, 80);
  if (!city) return null;
  const lat = Number(p.get('lat'));
  const lng = Number(p.get('lng'));
  const zip = (p.get('zip') || '').trim().slice(0, 10);
  return {
    city,
    state_id: (p.get('state') || '').trim().slice(0, 40),
    country: ((p.get('country') || 'US').trim().slice(0, 2) || 'US').toUpperCase(),
    zips: zip ? [zip] : [],
    ...(p.has('lat') && p.has('lng') && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
  };
}

/** The Start page's URL for a town; with `start`, it starts the force on arrival. */
export function createHref(town, { start = false } = {}) {
  const params = townParams(town);
  if (start && params.has('city')) params.set('start', '1');
  const qs = params.toString();
  return qs ? `${CREATE_PATH}?${qs}` : CREATE_PATH;
}

/** What POST /api/rescue-forces is sent for a town. */
export function forceBody(town) {
  const international = Boolean(town.country) && town.country !== 'US';
  return {
    city: town.city,
    state: town.state_id,
    country: town.country || 'US',
    zipCode: !international && town.zips?.length ? town.zips[0] : undefined,
    ...(placed(town) ? { lat: Number(town.lat), lng: Number(town.lng) } : {}),
  };
}

/**
 * Start the force. Resolves to { ok: true, forceId }, or { ok: false, kind }
 * with kind 'signin' (not signed in), 'waiver' (the volunteer waiver comes
 * first), 'exists' (with the forceId the town already has) or 'error'
 * (with a message in words). Never throws.
 */
export async function startForce(town) {
  let res;
  let data = {};
  try {
    res = await fetch('/api/rescue-forces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forceBody(town)),
    });
    data = await res.json().catch(() => ({}));
  } catch {
    return { ok: false, kind: 'error', message: 'The request did not go through. Check your connection and try again.' };
  }
  if (res.ok && data.squad?.id) return { ok: true, forceId: data.squad.id };
  if (res.status === 401) return { ok: false, kind: 'signin' };
  if (res.status === 403 && (data.code === 'WAIVER_NOT_ACCEPTED' || data.redirectTo)) return { ok: false, kind: 'waiver' };
  if (data.code === 'FORCE_EXISTS') return { ok: false, kind: 'exists', forceId: data.existingForceId || null };
  return { ok: false, kind: 'error', message: data.error || 'The force could not be started. Try again in a moment.' };
}

/**
 * Where an outcome sends the person: the new force, the force the town
 * already has, or sign-in or the waiver and then back to the Start page,
 * which starts the force for them. Null for an error (shown where they are).
 */
export function outcomeHref(outcome, town) {
  if (outcome.ok) return `/rescue-forces/${outcome.forceId}?created=true`;
  const back = createHref(town, { start: true });
  if (outcome.kind === 'signin') return `/login?callbackUrl=${encodeURIComponent(back)}`;
  if (outcome.kind === 'waiver') return `/legal/consent?returnUrl=${encodeURIComponent(back)}`;
  if (outcome.kind === 'exists' && outcome.forceId) return `/rescue-forces/${outcome.forceId}`;
  return null;
}
