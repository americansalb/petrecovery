/**
 * What a member can ask for when adding a need for a pet (the "Add a need"
 * sheet on the pet's page): the places the pet has been, the shelters near
 * it, and ready-made needs for them, the usual steps for a lost pet. Most
 * people tap one of those; the rest change the details or write their own.
 * Creating the need is createNeed in app/lib/forceNeeds.js, which checks
 * what is sent against these same places and shelters.
 *
 * A place is named without a house number: a need's title is public, and a
 * pet's last-seen address is often the family's own.
 */

import prisma from '@/app/lib/prisma';
import { caseTitle, timeAgo } from '@/app/lib/caseLabels';
import { looksLikeCoordinates } from '@/app/lib/maps/reverseLabel';
import { parsePlace } from '@/app/lib/placeLabel';
import { milesBetween } from '@/app/lib/maps/forceArea';

/** The kinds of need, what each is called, and how many people it asks for at first. */
export const NEED_KINDS = {
  area: { taskType: 'search_area', type: 'SEARCH_AREA', people: 4, score: 75 },
  doors: { taskType: 'knock_doors', type: 'SEARCH_AREA', people: 2, score: 70 },
  flyers: { taskType: 'post_flyers', type: 'POSTER_DISTRIBUTION', people: 3, score: 65 },
  shelter: { taskType: 'contact_shelters', type: 'SHELTER_CHECK', people: 1, score: 85 },
  other: { taskType: 'other', type: 'OTHER', people: 1, score: 50 },
};

export const NEED_WHENS = { today: 'Today', tonight: 'Tonight', tomorrow: 'Tomorrow', weekend: 'This weekend' };

const SIGHTINGS_USED = 3;
const SHELTERS_SHOWN = 3;
const SHELTER_MILES = 30;

/** "Zilker Park" from "Zilker Park, Austin, TX"; the street without its number from "6701 Burnet Rd, ...". */
export function placeName(address) {
  if (!address || looksLikeCoordinates(address)) return '';
  const first = address.split(',')[0].trim().replace(/^near\s+/i, '').replace(/^\d+[a-z]?\s+/i, '');
  if (first && !/^\d/.test(first)) return first;
  return parsePlace(address)?.label || '';
}

/** The title a need of this kind gets for a place or a shelter. */
export function needTitle(kind, { place, shelter } = {}) {
  if (kind === 'shelter') return shelter ? `Check ${shelter.name}` : '';
  const near = place ? `near ${place.label}` : '';
  if (!near) return '';
  if (kind === 'area') return `Search ${near}`;
  if (kind === 'doors') return `Knock on doors ${near}`;
  if (kind === 'flyers') return `Put up flyers ${near}`;
  return '';
}

/** Where the pet was last seen, then its latest sightings: each place once. */
export function petPlaces(pet, sightings = []) {
  const name = caseTitle(pet);
  const out = [];
  const add = (id, address, lat, lng, why) => {
    const label = placeName(address);
    if (!label || out.some((p) => p.label.toLowerCase() === label.toLowerCase())) return;
    out.push({ id, label, why, lat: lat ?? null, lng: lng ?? null });
  };
  add('lastseen', pet.lastSeenAddress, pet.lastSeenLatitude, pet.lastSeenLongitude, `Where ${name} was last seen`);
  sightings.slice(0, SIGHTINGS_USED).forEach((s) => {
    const when = timeAgo(s.sightedAt);
    add(`sighting:${s.id}`, s.address, s.latitude, s.longitude, when ? `Seen here ${when}` : 'Seen here');
  });
  return out;
}

/** Shelters near the pet, nearest first, with how far each is. */
export async function sheltersNear(point, { take = SHELTERS_SHOWN } = {}) {
  if (point?.lat == null || point?.lng == null) return [];
  const box = SHELTER_MILES / 69;
  const rows = await prisma.shelter.findMany({
    where: {
      isActive: true,
      type: { in: ['SHELTER', 'ANIMAL_CONTROL'] },
      latitude: { gte: point.lat - box, lte: point.lat + box },
      longitude: { gte: point.lng - box * 1.5, lte: point.lng + box * 1.5 },
    },
    select: { id: true, name: true, latitude: true, longitude: true },
    take: 50,
  });
  return rows
    .map((s) => ({ ...s, miles: milesBetween(point, { lat: s.latitude, lng: s.longitude }) }))
    .filter((s) => s.miles <= SHELTER_MILES)
    .sort((a, b) => a.miles - b.miles)
    .slice(0, take)
    .map((s) => ({ id: s.id, name: s.name, why: s.miles < 1 ? 'Under a mile away' : `${Math.round(s.miles)} miles away` }));
}

/** An open need already covering this kind and place (or shelter), if any. */
export function sameNeed(needs, { kind, title, shelterId }) {
  return (
    needs.find((n) =>
      kind === 'shelter' && shelterId ? n.shelterId === shelterId : n.title.trim().toLowerCase() === String(title).trim().toLowerCase()
    ) || null
  );
}

/**
 * The ready-made needs for a pet: search where it was seen last, check the
 * nearest shelter, knock on doors and put up flyers where it went missing.
 * `needs` are the pet's open needs ({ title, shelterId }); a suggestion
 * already asked for says so.
 */
export function suggestNeeds(pet, places, shelters, needs = []) {
  const name = caseTitle(pet);
  const lastSeen = places.find((p) => p.id === 'lastseen') || places[0] || null;
  const latest = places.find((p) => p.id.startsWith('sighting:')) || lastSeen;
  const list = [];
  if (latest) list.push({ kind: 'area', placeId: latest.id, when: 'today', why: latest.why });
  if (shelters[0]) list.push({ kind: 'shelter', shelterId: shelters[0].id, when: 'today', why: 'Lost pets are often taken to a shelter' });
  if (lastSeen) list.push({ kind: 'doors', placeId: lastSeen.id, when: 'tonight', why: `Neighbors may have seen ${name}` });
  if (lastSeen) list.push({ kind: 'flyers', placeId: lastSeen.id, when: 'today', why: `Where ${name} was last seen` });

  return list.map((s) => {
    const place = s.placeId ? places.find((p) => p.id === s.placeId) : null;
    const shelter = s.shelterId ? shelters.find((x) => x.id === s.shelterId) : null;
    const title = needTitle(s.kind, { place, shelter });
    return { ...s, people: NEED_KINDS[s.kind].people, title, added: Boolean(sameNeed(needs, { kind: s.kind, title, shelterId: s.shelterId })) };
  });
}

/** Everything the sheet shows for one pet of the force: places, shelters and suggestions. */
export async function needOptions(pet, needs = []) {
  const sightings = await prisma.caseSighting.findMany({
    where: { missionId: pet.id },
    orderBy: { sightedAt: 'desc' },
    take: SIGHTINGS_USED,
    select: { id: true, sightedAt: true, latitude: true, longitude: true, address: true },
  });
  const places = petPlaces(pet, sightings);
  const shelters = await sheltersNear({ lat: pet.lastSeenLatitude, lng: pet.lastSeenLongitude });
  return { places, shelters, suggestions: suggestNeeds(pet, places, shelters, needs), whens: NEED_WHENS };
}
