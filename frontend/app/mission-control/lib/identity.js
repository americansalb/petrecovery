'use client';

/**
 * Who this phone is, for someone helping without an account.
 *
 * Joining a pet's search from its share link makes a volunteer on the
 * server and gives back its id. The id and the device key this browser
 * joined with are the pair the board asks for (app/lib/searcher.js), sent
 * as two headers. Both live only in this browser's storage. Which
 * sightings this phone sent is kept the same way, so coming back to the
 * page shows what the owner did about the last one.
 *
 * Storage can be missing or blocked (a private window): every read
 * answers null and every write is a no-op then, and the screen still
 * works for the visit.
 */
import { VOLUNTEER_ID_HEADER, VOLUNTEER_KEY_HEADER } from '@/app/lib/searcherHeaders';

const DEVICE_KEY = 'petrecovery_device_id';

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* no storage: this visit only */
  }
}

function readJson(key) {
  try {
    return JSON.parse(read(key) || 'null');
  } catch {
    return null;
  }
}

/** This browser's key, made once. Unguessable, unlike the old Math.random one, which is still honoured. */
export function deviceKey() {
  const existing = read(DEVICE_KEY);
  if (existing) return existing;
  let key;
  try {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    key = `dev_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    key = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
  write(DEVICE_KEY, key);
  return read(DEVICE_KEY) || key;
}

/** The volunteer this browser joined as for a pet: { id, name }, or null. */
export function readVolunteer({ caseId, caseNumber }) {
  const mine = readJson(`rp_search_${caseId}`);
  if (mine?.id) return mine;
  // Joined from the older share-link page, which kept only the id.
  const old = read(`mission_${caseNumber}_volunteer`) || read(`mission_${caseId}_volunteer`);
  return old ? { id: old, name: '' } : null;
}

export function saveVolunteer(caseId, volunteer) {
  write(`rp_search_${caseId}`, volunteer ? JSON.stringify(volunteer) : null);
}

/** The two headers that prove a helper without an account to the board. */
export function volunteerHeaders(volunteer) {
  if (!volunteer?.id) return {};
  return { [VOLUNTEER_ID_HEADER]: volunteer.id, [VOLUNTEER_KEY_HEADER]: deviceKey() };
}

/** The sightings this phone sent for a pet: [{ id, at, sentAt, place }], newest first. `at` is when the pet was seen. */
export function readMySightings(caseId) {
  const list = readJson(`rp_seen_${caseId}`);
  return Array.isArray(list) ? list.filter((s) => s && s.id).map(({ id, at, sentAt, place }) => ({ id, at, sentAt: sentAt || at, place })) : [];
}

export function saveMySighting(caseId, sighting) {
  const rest = readMySightings(caseId).filter((s) => s.id !== sighting.id);
  write(`rp_seen_${caseId}`, JSON.stringify([sighting, ...rest].slice(0, 10)));
}

/** Small per-pet notes this phone keeps, such as where a walk was started from. */
export function readNote(caseId, name) {
  return readJson(`rp_note_${caseId}_${name}`);
}

export function saveNote(caseId, name, value) {
  write(`rp_note_${caseId}_${name}`, value == null ? null : JSON.stringify(value));
}
