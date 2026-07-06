/**
 * Reverse matcher — cross-check a NEW lost report against existing FOUND
 * reports. The forward matcher (found -> lost) and findMatches both put the
 * TARGET in calculateMatchScore's first "found" argument, and timing points are
 * only awarded when foundDate >= lostDate. For the reverse direction the new
 * record is the LOST case and MUST sit in the SECOND "lost" argument — so we
 * call calculateMatchScore(foundCandidate, newLostCase) directly and never
 * route the new lost case through findMatches as the target, which would
 * silently zero the timing score.
 */

import { calculateMatchScore, calculateDistance } from '@/app/lib/matching';

function chipMatch(a, b) {
  if (!a || !b) return false;
  return String(a).replace(/\D/g, '') === String(b).replace(/\D/g, '') && String(a).replace(/\D/g, '').length > 0;
}

/** Coarse, PII-free region string (mirrors found-pet / reports[id]). */
export function coarseArea(address, distanceMiles) {
  let region = 'Nearby area';
  if (typeof address === 'string' && address.includes(',')) {
    const rest = address.split(',').slice(1).join(',').trim();
    if (rest) region = rest;
  }
  let proximity = '';
  if (typeof distanceMiles === 'number' && Number.isFinite(distanceMiles)) {
    const bucket = distanceMiles <= 1 ? '~1 mi' : distanceMiles <= 3 ? '~3 mi' : distanceMiles <= 6 ? '~6 mi' : '~10+ mi';
    proximity = ` · within ${bucket}`;
  }
  return `${region}${proximity}`;
}

/**
 * @param {object} newLostCase the just-created LOST Case (may include .pet)
 * @param {object[]} foundCandidates ACTIVE FOUND Cases (may include .pet)
 * @param {object} options { minScore, maxResults }
 * @returns {Array} scored matches (case + match fields), best first, no 'suppress'
 */
export function reverseMatch(newLostCase, foundCandidates, { minScore = 35, maxResults = 8 } = {}) {
  const lostChip = newLostCase.pet?.microchipId || newLostCase.microchipId || null;

  return foundCandidates
    .map((fc) => {
      const foundChip = fc.pet?.microchipId || fc.microchipId || null;
      const matchSource = chipMatch(lostChip, foundChip) ? 'microchip' : 'attribute';
      const r = calculateMatchScore(fc, newLostCase, { matchSource });
      let distance = null;
      const fLat = fc.lastSeenLatitude;
      const fLon = fc.lastSeenLongitude;
      if ([fLat, fLon, newLostCase.lastSeenLatitude, newLostCase.lastSeenLongitude].every((n) => typeof n === 'number')) {
        distance = calculateDistance(fLat, fLon, newLostCase.lastSeenLatitude, newLostCase.lastSeenLongitude);
      }
      return { case: fc, distance, ...r };
    })
    .filter((m) => m.band !== 'suppress' && ((m.eligible && m.score >= minScore) || m.band === 'actionable'))
    .sort((a, b) => b.pTrueMatch - a.pTrueMatch || b.score - a.score)
    .slice(0, maxResults);
}

/** Format a match into the PII-free shape the shared MatchCard renders. */
export function formatMatch(m) {
  const c = m.case;
  return {
    reportId: c.id,
    caseNumber: c.caseNumber,
    petName: c.petName,
    petSpecies: c.petSpecies,
    petBreed: c.petBreed,
    petColor: c.petColor,
    petPhoto: c.pet?.primaryPhotoUrl || c.petPhotoUrl || '',
    coarseArea: coarseArea(c.lastSeenAddress, m.distance),
    pTrueMatch: m.pTrueMatch,
    matchSource: m.matchSource,
    band: m.band,
    canConnect: m.band === 'actionable',
  };
}
