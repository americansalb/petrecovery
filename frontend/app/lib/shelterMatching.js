/**
 * Stray-vs-lost matching for shelter accounts.
 *
 * Two directions, one scorer:
 *  - a shelter logs a STRAY -> check it against ACTIVE LOST cases
 *  - a new LOST report -> check it against AVAILABLE shelter strays
 *
 * The stray is conceptually a FOUND record, and calculateMatchScore only
 * awards timing points when foundDate >= lostDate, so the stray ALWAYS
 * sits in the FIRST argument (see cascade/reverseMatch.js for the same
 * subtlety). Attribute scoring is the calibrated engine in lib/matching;
 * Claude vision runs only on the top few candidates with photos on both
 * sides and its verdict is advisory display only: pTrueMatch stays the
 * calibrated attribute value.
 *
 * THE PRODUCT INVARIANT: the shelter confirms first. Nothing in this
 * module contacts a case owner. Owner notification happens exclusively
 * in the confirm endpoint after a human said yes.
 */

import prisma from '@/app/lib/prisma';
import { calculateMatchScore, calculateDistance } from '@/app/lib/matching';
import { comparePetPhotos } from '@/app/lib/ai/comparePetPhotos';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendPushToUser } from '@/app/lib/push';
import { getShelterStaffUserIds } from '@/app/lib/shelterAuth';
import { logEvent } from '@/lib/logging';

const MIN_SCORE = 35;
const MAX_CANDIDATES_PER_RUN = 8;
// Vision is the expensive step: only this many pairs per run get photos
// compared, and a pair is never compared twice (verdict persists on the row).
const VISION_CANDIDATE_CAP = 4;
// How many cases/strays we even look at per run. Dense metros truncate
// silently at this window (newest first); acceptable for MVP.
const CANDIDATE_WINDOW = 300;

function chipMatch(a, b) {
  if (!a || !b) return false;
  const da = String(a).replace(/\D/g, '');
  return da === String(b).replace(/\D/g, '') && da.length > 0;
}

/**
 * Normalize a roster Pet (+ its Shelter) into the "found" shape the
 * matcher expects. Coords prefer the actual found spot, then the
 * shelter's location; dates prefer the intake date.
 */
export function strayAsFound(pet, shelter) {
  const lat = Number.isFinite(pet.intakeFoundLatitude) ? pet.intakeFoundLatitude : shelter?.latitude;
  const lng = Number.isFinite(pet.intakeFoundLongitude) ? pet.intakeFoundLongitude : shelter?.longitude;
  return {
    petSpecies: pet.species,
    petBreed: pet.breed || '',
    petColor: pet.color || '',
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lng) ? lng : undefined,
    foundAt: pet.intakeDate || pet.createdAt,
    createdAt: pet.createdAt,
  };
}

/**
 * Score one roster stray against a list of LOST cases. Pure; no IO.
 * Returns non-suppressed candidates, best first, capped.
 */
export function scoreStrayAgainstCases(pet, shelter, lostCases, {
  minScore = MIN_SCORE,
  maxResults = MAX_CANDIDATES_PER_RUN,
} = {}) {
  const found = strayAsFound(pet, shelter);
  return lostCases
    .map((lostCase) => {
      const matchSource = chipMatch(pet.microchipId, lostCase.pet?.microchipId)
        ? 'microchip'
        : 'attribute';
      const r = calculateMatchScore(found, lostCase, { matchSource });
      let distance = null;
      if ([found.latitude, found.longitude, lostCase.lastSeenLatitude, lostCase.lastSeenLongitude]
        .every((n) => typeof n === 'number')) {
        distance = calculateDistance(
          found.latitude, found.longitude,
          lostCase.lastSeenLatitude, lostCase.lastSeenLongitude
        );
      }
      return { case: lostCase, distance, ...r };
    })
    .filter((m) => m.band !== 'suppress' && ((m.eligible && m.score >= minScore) || m.band === 'actionable'))
    .sort((a, b) => b.pTrueMatch - a.pTrueMatch || b.score - a.score)
    .slice(0, maxResults);
}

function strayPhoto(pet) {
  return pet.primaryPhotoUrl || null;
}

function casePhoto(lostCase) {
  return lostCase.pet?.primaryPhotoUrl || lostCase.petPhotoUrl || null;
}

/**
 * Persist scored candidates as PENDING ShelterStrayMatch rows, running
 * vision on the top pairs that have photos. Human decisions are never
 * overwritten (CONFIRMED/DISMISSED rows are left alone) and a pair's
 * vision verdict is computed at most once, ever.
 * Returns the number of rows created or refreshed.
 */
async function persistMatches(pet, shelterId, scored, direction) {
  let written = 0;
  let visionBudget = VISION_CANDIDATE_CAP;

  for (const m of scored) {
    const caseId = m.case.id;
    const existing = await prisma.shelterStrayMatch.findUnique({
      where: { petId_caseId: { petId: pet.id, caseId } },
      select: { id: true, status: true, visualVerdict: true },
    });
    if (existing && existing.status !== 'PENDING') continue;

    let visual = null;
    const alreadyCompared = Boolean(existing?.visualVerdict);
    if (!alreadyCompared && visionBudget > 0) {
      const a = strayPhoto(pet);
      const b = casePhoto(m.case);
      if (a && b) {
        visionBudget -= 1;
        visual = await comparePetPhotos(a, b); // null on any failure
      }
    }

    const scoreFields = {
      shelterId,
      score: m.score,
      pTrueMatch: m.pTrueMatch,
      band: m.band,
      matchSource: m.matchSource,
      detailsJson: m.details ? JSON.stringify(m.details) : null,
      direction,
      ...(visual ? { visualVerdict: visual.verdict, visualConfidence: visual.confidence } : {}),
    };

    if (existing) {
      await prisma.shelterStrayMatch.update({
        where: { id: existing.id },
        data: scoreFields,
      });
    } else {
      await prisma.shelterStrayMatch.create({
        data: { petId: pet.id, caseId, ...scoreFields },
      });
    }
    written += 1;
  }
  return written;
}

/** Notify the shelter's people that matches await review. Never the owner. */
async function notifyShelter(shelterId, count) {
  if (!count) return 0;
  const userIds = await getShelterStaffUserIds(shelterId);
  let reached = 0;
  for (const userId of userIds) {
    try {
      await createInAppNotification({
        userId,
        type: 'SHELTER_STRAY_MATCH',
        title: 'Possible owner match',
        message: count === 1
          ? 'An animal in your care may match a lost-pet report. Review the photos to confirm.'
          : `${count} animals in your care may match lost-pet reports. Review the photos to confirm.`,
        actionUrl: '/shelter/dashboard',
      });
      await sendPushToUser(prisma, userId, {
        title: 'Possible owner match',
        body: 'Review the photos on your shelter dashboard to confirm.',
        url: '/shelter/dashboard',
        type: 'SHELTER_STRAY_MATCH',
      });
      reached += 1;
    } catch (err) {
      // one person failing must not sink the rest
      console.error('[shelter-match] shelter notify failed:', err.message);
    }
  }
  return reached > 0 ? 1 : 0;
}

/**
 * Direction 1: a shelter just logged (or re-tagged) a STRAY.
 * Loads the pet, scores nearby ACTIVE LOST cases, persists, notifies staff.
 */
export async function runStrayIntakeMatch(petId) {
  const pet = await prisma.pet.findUnique({
    where: { id: petId, isDeleted: false },
    include: { managedByShelter: true },
  });
  if (!pet || !pet.managedByShelterId || pet.intakeType !== 'STRAY') {
    return { candidates: 0, written: 0 };
  }

  const lostCases = await prisma.case.findMany({
    where: {
      reportType: 'LOST',
      status: 'ACTIVE',
      OR: [
        { petSpecies: pet.species },
        ...(pet.microchipId ? [{ pet: { microchipId: pet.microchipId } }] : []),
      ],
    },
    include: { pet: true },
    take: CANDIDATE_WINDOW,
    orderBy: { createdAt: 'desc' },
  });

  const scored = scoreStrayAgainstCases(pet, pet.managedByShelter, lostCases);
  const written = await persistMatches(pet, pet.managedByShelterId, scored, 'STRAY_INTAKE');
  await notifyShelter(pet.managedByShelterId, written);
  return { candidates: scored.length, written };
}

/**
 * Direction 2: a new LOST report just came in (cascade action).
 * Scores it against AVAILABLE shelter strays; the stray still goes FIRST.
 */
export async function runShelterStrayCheck(lostCase) {
  const strays = await prisma.pet.findMany({
    where: {
      isDeleted: false,
      managedByShelterId: { not: null },
      shelterStatus: 'AVAILABLE',
      intakeType: 'STRAY',
      OR: [
        { species: lostCase.petSpecies },
        ...(lostCase.pet?.microchipId ? [{ microchipId: lostCase.pet.microchipId }] : []),
      ],
    },
    include: { managedByShelter: true },
    take: CANDIDATE_WINDOW,
    orderBy: { createdAt: 'desc' },
  });

  let written = 0;
  const touchedShelters = new Map(); // shelterId -> rows written
  for (const pet of strays) {
    const scored = scoreStrayAgainstCases(pet, pet.managedByShelter, [lostCase], { maxResults: 1 });
    if (!scored.length) continue;
    const n = await persistMatches(pet, pet.managedByShelterId, scored, 'LOST_REPORT');
    if (n > 0) {
      written += n;
      touchedShelters.set(pet.managedByShelterId, (touchedShelters.get(pet.managedByShelterId) || 0) + n);
    }
  }

  let sheltersNotified = 0;
  for (const [shelterId, count] of touchedShelters) {
    sheltersNotified += await notifyShelter(shelterId, count);
  }
  return { candidates: strays.length, written, sheltersNotified };
}

/**
 * Fire-and-forget wrapper for the intake direction, same shape as
 * enqueueCascade: the app is a long-lived Node server, so post-response
 * work is sanctioned. The pet-create response never waits on matching.
 */
export function enqueueStrayIntakeMatch(petId) {
  Promise.resolve()
    .then(() => runStrayIntakeMatch(petId))
    .catch((err) => {
      console.error('[shelter-match] intake match failed:', err?.message);
      logEvent({
        event_type: 'shelter.stray_match.failed',
        resource_type: 'pet',
        resource_id: petId,
        action: 'read',
        result: 'failure',
      }).catch(() => {});
    });
}
