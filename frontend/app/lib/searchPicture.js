/**
 * The picture of one pet's search: what the search screen (Mission
 * Control) shows above and around the map. The pet, where and when it was
 * lost, how to reach the owner, each sighting and what has happened to it
 * since, how many people are out, and who is looking at it.
 *
 * It is open to anyone holding the pet's link and carries nothing the
 * pet's public page does not: the owner's first name and number, the
 * last-seen point, the sightings. It never carries a helper's name,
 * number or position. What only the owner should see (how many neighbors
 * were alerted, who reported a sighting) is added for the owner alone.
 *
 * The streets and who is on them are the board's (app/lib/searchBoard.js,
 * GET /api/mission/[id]/board); this is everything else.
 */
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { isCaseOpen } from '@/app/lib/caseStatus';
import { casePhone } from '@/app/lib/caseLabels';
import { finderGuide } from '@/app/lib/caseDetails';
import { zoneFor } from '@/app/lib/caseZone';
import { placeName } from '@/app/lib/needOptions';
import { normalizePhotoUrl } from '@/app/lib/utils';
import { forcesOf } from '@/app/lib/forceFeed';

/** A sighting this fresh re-anchors the search: every screen leads with it. */
export const HOT_SIGHTING_MS = 60 * 60 * 1000;
/** Someone who finished a street this recently still counts as out looking. */
const LOOKING_WINDOW_MS = 2 * 60 * 60 * 1000;

const PICTURE_SELECT = {
  id: true,
  caseNumber: true,
  status: true,
  reportType: true,
  resolvedAt: true,
  petName: true,
  petSpecies: true,
  petBreed: true,
  petColor: true,
  petPhotoUrl: true,
  petDescription: true,
  details: true,
  escapeScenario: true,
  lastSeenLatitude: true,
  lastSeenLongitude: true,
  lastSeenAddress: true,
  lastSeenAt: true,
  reporterId: true,
  ownerName: true,
  ownerPhone: true,
  sightings: {
    orderBy: { sightedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      sightedAt: true,
      latitude: true,
      longitude: true,
      address: true,
      description: true,
      certaintyLevel: true,
      reporterName: true,
      reportedBy: { select: { firstName: true } },
      direction: true,
      towardName: true,
      witnessState: true,
      witnessStateAt: true,
      ownerSeenAt: true,
      ownerGoingAt: true,
      ownerEtaMinutes: true,
      holdAskedAt: true,
      holdEndedAt: true,
      holdAskedByName: true,
    },
  },
};

/** The words the owner's ask puts in front of the helpers. One place, so the owner is shown exactly what goes out in their name. */
export function holdAskText(petName) {
  return `Please stay back while I go to ${petName || 'the pet'}.`;
}

function sightingOut(s, { withNames }) {
  const place = s.address && s.address !== 'Marked on the map' ? placeName(s.address) || s.address : null;
  const named = s.reporterName || (s.reportedBy?.firstName && s.reportedBy.firstName !== 'Deleted' ? s.reportedBy.firstName : null);
  return {
    id: s.id,
    at: s.sightedAt,
    lat: s.latitude,
    lng: s.longitude,
    place,
    direction: s.direction,
    toward: s.towardName,
    sure: s.certaintyLevel,
    state: s.witnessState,
    stateAt: s.witnessStateAt,
    ownerSeenAt: s.ownerSeenAt,
    ownerGoingAt: s.ownerGoingAt,
    etaMinutes: s.ownerEtaMinutes,
    ...(withNames ? { by: named, note: s.description } : {}),
  };
}

/** How many people are out, from the board: holding a street now, or finished one in the last two hours. */
async function peopleLooking(caseId, now) {
  const since = new Date(now - LOOKING_WINDOW_MS);
  const [streets, grid] = await Promise.all([
    prisma.searchStreet.findMany({
      where: { caseId, OR: [{ status: 'IN_PROGRESS' }, { searchedAt: { gte: since } }] },
      select: { status: true, claimedById: true, searchedById: true },
    }),
    prisma.searchGrid.findUnique({
      where: { caseId },
      select: {
        cells: {
          where: { OR: [{ status: 'IN_PROGRESS' }, { searchedAt: { gte: since } }] },
          select: { status: true, claimedById: true, searchedById: true, searchedByKey: true },
        },
      },
    }),
  ]);
  const people = new Set();
  for (const row of [...streets, ...(grid?.cells || [])]) {
    if (row.status === 'IN_PROGRESS' && row.claimedById) people.add(row.claimedById);
    else if (row.searchedByKey || row.searchedById) people.add(row.searchedByKey || row.searchedById);
  }
  return people;
}

/**
 * The picture for `caseParam` (a case id or number), as `searcher` may
 * see it (app/lib/searcher.js; null for someone only looking). Returns
 * null when no pet matches.
 */
export async function searchPicture(caseParam, { searcher = null, now = Date.now() } = {}) {
  const pet = await prisma.case.findFirst({ where: missionWhere(caseParam), select: PICTURE_SELECT });
  if (!pet) return null;
  const isOwner = Boolean(searcher?.isOwner);
  const withNames = Boolean(searcher?.seesNames);
  const name = pet.petName || 'the pet';
  const open = isCaseOpen(pet.status);
  const sightings = (pet.sightings || []).map((s) => sightingOut(s, { withNames }));

  // The ask to stay back. It stands from when a person sends it until
  // they end it, the sighting it was sent on is an hour old or was taken
  // back by its witness, or the search closes. A newer sighting does not
  // end it: anyone can send a sighting, and only the person who asked
  // can call the ask off. It goes out under the name of whoever sent it:
  // the owner, or the person leading the search for them.
  const ownerFirst = String(pet.ownerName || '').trim().split(/\s+/)[0] || null;
  const held = open
    ? (pet.sightings || []).find(
        (s) => s.witnessState !== 'NOT_THE_PET' && s.holdAskedAt && !s.holdEndedAt && now - new Date(s.sightedAt).getTime() <= HOT_SIGHTING_MS
      ) || null
    : null;
  const ask = held ? { sightingId: held.id, from: held.holdAskedByName || ownerFirst, text: holdAskText(name) } : null;

  const looking = pet.reportType === 'FOUND' ? new Set() : await peopleLooking(pet.id, now);
  // Whether a Rescue Force is looking for the pet: its members see what the owner sees, and the join screen says so.
  const forces = await forcesOf(pet.id).catch(() => []);

  const phone = casePhone({ contact: { phone: pet.ownerPhone } }) ? String(pet.ownerPhone).trim() : null;
  const guide = finderGuide(pet.details, { name: pet.petName || 'this pet', species: pet.petSpecies });

  let neighbors = null;
  let searched = null;
  if (isOwner) {
    const [told, answered] = await Promise.all([
      prisma.alert.count({ where: { caseId: pet.id } }),
      prisma.alert.count({ where: { caseId: pet.id, respondedAt: { not: null } } }),
    ]);
    neighbors = { told, answered };
  }
  if (!open) {
    // The thank-you screen: how much ground was covered, and whether some of it was this person's.
    // Streets where the board had them, squares where it did not, and both where the streets came late.
    const [streets, grid] = await Promise.all([
      prisma.searchStreet.findMany({ where: { caseId: pet.id, searchCount: { gt: 0 } }, select: { searchedById: true } }),
      prisma.searchGrid.findUnique({
        where: { caseId: pet.id },
        select: { cells: { where: { searchCount: { gt: 0 } }, select: { searchedById: true, searchedByKey: true } } },
      }),
    ]);
    const blocks = grid?.cells || [];
    const who = [...streets.map((s) => s.searchedById), ...blocks.map((b) => b.searchedByKey || b.searchedById)].filter(Boolean);
    searched = {
      streets: streets.length,
      blocks: blocks.length,
      people: new Set(who).size,
      mine: Boolean(searcher && who.includes(searcher.id)),
    };
  }

  return {
    id: pet.id,
    caseNumber: pet.caseNumber,
    reportType: pet.reportType,
    open,
    reunited: pet.status === 'REUNITED',
    resolvedAt: pet.resolvedAt,
    timeZone: zoneFor(pet),
    pet: {
      name: pet.petName,
      species: pet.petSpecies,
      breed: pet.petBreed,
      color: pet.petColor,
      photoUrl: normalizePhotoUrl(pet.petPhotoUrl),
      description: pet.petDescription,
      howOut: pet.escapeScenario,
    },
    // What the owner said about approaching this pet, as the pet's page words it (app/lib/caseDetails.js).
    approach: guide.approach || '',
    lastSeen: {
      lat: pet.lastSeenLatitude,
      lng: pet.lastSeenLongitude,
      at: pet.lastSeenAt,
      // The street, never the house number.
      place: placeName(pet.lastSeenAddress) || null,
    },
    owner: { firstName: ownerFirst, phone },
    sightings,
    ask,
    looking: { helpers: [...looking].filter((id) => id !== pet.reporterId).length },
    forces: forces.length,
    neighbors,
    searched,
    viewer: searcher
      ? { kind: searcher.kind, firstName: searcher.firstName, isOwner, seesNames: withNames, leads: Boolean(searcher.leads), waiver: searcher.waiver, signedIn: searcher.kind === 'user' }
      : null,
  };
}
