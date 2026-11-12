/**
 * The picture of one pet's search: what the search screen (Mission
 * Control) shows above and around the map. The pet, where and when it was
 * lost, how to reach the owner, each sighting and whether the owner has
 * seen it or is on the way, how many people are out, and who is looking
 * at it.
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
    // A sighting its witness took back, while the screen still let them, stays off every screen.
    // Said as "no state, or a different one": a plain NOT drops every row whose state is empty, which is all the others.
    where: { OR: [{ witnessState: null }, { witnessState: { not: 'NOT_THE_PET' } }] },
    orderBy: { sightedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      sightedAt: true,
      createdAt: true,
      latitude: true,
      longitude: true,
      address: true,
      description: true,
      certaintyLevel: true,
      reporterName: true,
      reportedBy: { select: { firstName: true } },
      ownerSeenAt: true,
      ownerGoingAt: true,
      ownerEtaMinutes: true,
    },
  },
};

function sightingOut(s, { withNames, isOwner }) {
  const place = s.address && s.address !== 'Marked on the map' ? placeName(s.address) || s.address : null;
  const named = s.reporterName || (s.reportedBy?.firstName && s.reportedBy.firstName !== 'Deleted' ? s.reportedBy.firstName : null);
  return {
    id: s.id,
    at: s.sightedAt,
    lat: s.latitude,
    lng: s.longitude,
    place,
    sure: s.certaintyLevel,
    ownerSeenAt: s.ownerSeenAt,
    ownerGoingAt: s.ownerGoingAt,
    etaMinutes: s.ownerEtaMinutes,
    ...(withNames ? { by: named, note: s.description } : {}),
    // When it reached the owner, which can be long after the pet was seen: the owner's screen leads with news that is new to them.
    ...(isOwner ? { sentAt: s.createdAt } : {}),
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
  const open = isCaseOpen(pet.status);
  const sightings = (pet.sightings || []).map((s) => sightingOut(s, { withNames, isOwner }));

  const ownerFirst = String(pet.ownerName || '').trim().split(/\s+/)[0] || null;

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
    looking: { helpers: [...looking].filter((id) => id !== pet.reporterId).length },
    forces: forces.length,
    neighbors,
    searched,
    viewer: searcher
      ? { kind: searcher.kind, firstName: searcher.firstName, isOwner, seesNames: withNames, waiver: searcher.waiver, signedIn: searcher.kind === 'user' }
      : null,
  };
}
