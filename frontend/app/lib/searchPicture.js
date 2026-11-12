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
 * What was said through the search screen (app/lib/searchTalk.js) goes
 * only to the people it is for: `words` is what was written to this
 * person and what they wrote back, and `asked` the area they were asked
 * to search (the board has the area itself); `talk` is every message, for
 * whoever runs the search. Reading the picture marks nothing as seen.
 *
 * The areas of ground and who is on them are the board's
 * (app/lib/searchZones.js, GET /api/mission/[id]/board); this is
 * everything else.
 */
import prisma from '@/app/lib/prisma';
import { missionWhere } from '@/app/lib/shareMetadata';
import { isCaseOpen } from '@/app/lib/caseStatus';
import { casePhone } from '@/app/lib/caseLabels';
import { finderGuide } from '@/app/lib/caseDetails';
import { zoneFor } from '@/app/lib/caseZone';
import { placeOnly } from '@/app/lib/needOptions';
import { normalizePhotoUrl } from '@/app/lib/utils';
import { forcesOf } from '@/app/lib/forceFeed';
import { isMark } from '@/app/lib/searchBoard';
import { CLAIM_TTL_MS } from '@/app/lib/searchGrid';
import { wordsForDesk, wordsForPerson } from '@/app/lib/searchTalk';
import { zoneAskWaitingFor, zoneSearchersSince, zoneGroundCovered } from '@/app/lib/searchZones';

/**
 * Someone who finished an area this recently still counts as out looking:
 * they are most likely between areas. Half an hour, not longer, so the
 * screen does not go on saying people are out after they have gone home.
 */
const LOOKING_WINDOW_MS = 30 * 60 * 1000;

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
  // What the owner told everyone helping ("Tell everyone helping" on the pet's page), which that page also
  // shows. Read wider than it is sent: the lines other code writes into the same table are dropped below.
  updates: {
    where: { isUpdate: true },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true, content: true, createdAt: true, authorId: true },
  },
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
  // The street or the landmark. An address that will not give up its house number is left off.
  const place = s.address && s.address !== 'Marked on the map' ? placeOnly(s.address) || null : null;
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

/**
 * Lines other code writes into the updates table in a person's name: a
 * status change, a logged task, a search session, a sighting sent from an
 * older screen (which carries the address as typed). None is something a
 * person told everyone, and the search screen shows an update as the
 * owner's own words, so none of them is sent.
 * (__tests__/api/search-picture.test.js lists every route that writes an
 * update, so a new one cannot be added without being looked at here.)
 */
const WRITTEN_BY_CODE = [
  /^Status changed from /,
  /^Logged action: /,
  /^New sighting reported/,
  /^Task (created: )?"/,
  /^(✅|🗺️)/u,
  // "{first name} started searching": one name and the phrase, which is how the session routes write it. A
  // sentence of the owner's own that happens to end the same way ("Two neighbors started searching") is kept.
  /^(A volunteer|\S+) (started searching|paused their search|resumed searching)$/,
  /^(A volunteer|\S+) ended their search \(\d+ min\)$/,
];

/** What the owner told everyone helping: written by the owner, and by hand. Newest first. */
function ownerUpdates(rows = [], ownerId = null, take = 10) {
  return rows
    .filter((u) => ownerId && u.authorId === ownerId && typeof u.content === 'string' && !WRITTEN_BY_CODE.some((made) => made.test(u.content.trim())))
    .slice(0, take)
    .map((u) => ({ id: u.id, at: u.createdAt, text: u.content.trim().slice(0, 400) }));
}

/**
 * How many people are out, from the board: on an area of ground now, or
 * finished one in the last half hour. A search that was on streets or
 * squares before it was on areas still counts whoever took one of those
 * lately; nothing sweeps those any more, so one held longer than a claim
 * lasts is not someone out looking.
 */
async function peopleLooking(caseId, now) {
  const since = new Date(now - LOOKING_WINDOW_MS);
  const held = { status: 'IN_PROGRESS', claimedAt: { gte: new Date(now - CLAIM_TTL_MS) } };
  const [streets, grid, onAreas] = await Promise.all([
    prisma.searchStreet.findMany({
      where: { caseId, OR: [held, { searchedAt: { gte: since } }] },
      select: { status: true, claimedById: true, searchedById: true },
    }),
    prisma.searchGrid.findUnique({
      where: { caseId },
      select: {
        cells: {
          where: { OR: [held, { searchedAt: { gte: since } }] },
          select: { status: true, claimedById: true, searchedById: true, searchedByKey: true },
        },
      },
    }),
    zoneSearchersSince(caseId, since),
  ]);
  const people = new Set(onAreas);
  for (const row of [...streets, ...(grid?.cells || [])]) {
    if (row.status === 'IN_PROGRESS' && row.claimedById) people.add(row.claimedById);
    else if (row.searchedByKey || row.searchedById) people.add(row.searchedByKey || row.searchedById);
  }
  // A street put down as walked from the desk is ground covered, not a person out looking.
  return new Set([...people].filter((id) => !isMark(id)));
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
    // Areas of ground, and the streets and squares of a search that began before it was on areas.
    const [streets, grid, ground] = await Promise.all([
      prisma.searchStreet.findMany({ where: { caseId: pet.id, searchCount: { gt: 0 } }, select: { searchedById: true } }),
      prisma.searchGrid.findUnique({
        where: { caseId: pet.id },
        select: { cells: { where: { searchCount: { gt: 0 } }, select: { searchedById: true, searchedByKey: true } } },
      }),
      zoneGroundCovered(pet.id),
    ]);
    const blocks = grid?.cells || [];
    const who = [...ground.people, ...streets.map((s) => s.searchedById), ...blocks.map((b) => b.searchedByKey || b.searchedById)].filter((id) => id && !isMark(id));
    searched = {
      areas: ground.areas,
      streets: streets.length,
      blocks: blocks.length,
      people: new Set(who).size,
      mine: Boolean(searcher && who.includes(searcher.id)),
    };
  }

  // What was said to this person and what was asked of them. The owner is never written to here: what helpers
  // say reaches the owner in `talk`.
  let mineToRead = null;
  if (searcher && open && !isOwner && pet.reportType !== 'FOUND') {
    const [words, asked] = await Promise.all([
      wordsForPerson(pet.id, searcher.id, { ownerId: pet.reporterId, ownerName: ownerFirst }),
      zoneAskWaitingFor(pet.id, searcher.id),
    ]);
    mineToRead = { words, asked };
  }
  const talk = searcher?.leads && open && pet.reportType !== 'FOUND' ? await wordsForDesk(pet.id, { viewerId: searcher.id }) : null;

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
      place: placeOnly(pet.lastSeenAddress) || null,
    },
    owner: { firstName: ownerFirst, phone },
    sightings,
    looking: { helpers: [...looking].filter((id) => id !== pet.reporterId).length },
    forces: forces.length,
    // Newest first, and the owner's own: the screen shows each as what the owner told everyone.
    updates: ownerUpdates(pet.updates, pet.reporterId),
    neighbors,
    searched,
    ...(mineToRead || {}),
    ...(talk ? { talk } : {}),
    viewer: searcher
      ? { kind: searcher.kind, firstName: searcher.firstName, isOwner, seesNames: withNames, leads: Boolean(searcher.leads), waiver: searcher.waiver, signedIn: searcher.kind === 'user' }
      : null,
  };
}
