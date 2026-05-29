/**
 * Pet Matching Algorithm - Phase 1.4
 *
 * Calculates match scores between lost and found pet cases.
 * Score breakdown:
 * - Species: 25 points (mandatory match)
 * - Location: 25 points (proximity-based)
 * - Breed: 20 points (fuzzy match)
 * - Color: 15 points (fuzzy match)
 * - Timing: 15 points (found after lost)
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the number of single-character edits needed
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Calculate string similarity (0 to 1)
 * Uses normalized Levenshtein distance
 */
export function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check for substring match (helpful for breed variants)
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.9;
  }

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return Math.max(0, 1 - (distance / maxLength));
}

/**
 * Calculate color similarity with awareness of common pet color terms
 */
export function calculateColorSimilarity(color1, color2) {
  if (!color1 || !color2) return 0;

  const c1 = color1.toLowerCase().trim();
  const c2 = color2.toLowerCase().trim();

  if (c1 === c2) return 1;

  // Common color groups
  const colorGroups = {
    black: ['black', 'dark', 'ebony', 'jet'],
    white: ['white', 'cream', 'ivory', 'snow'],
    brown: ['brown', 'chocolate', 'tan', 'mahogany', 'chestnut'],
    golden: ['golden', 'gold', 'yellow', 'blonde', 'cream', 'fawn'],
    gray: ['gray', 'grey', 'silver', 'charcoal', 'blue'],
    red: ['red', 'ginger', 'orange', 'rust', 'copper'],
    brindle: ['brindle', 'striped', 'tiger'],
    spotted: ['spotted', 'speckled', 'merle', 'dapple'],
    mixed: ['mixed', 'multicolor', 'multi', 'tricolor', 'bicolor'],
  };

  // Check if colors belong to same group
  for (const [, terms] of Object.entries(colorGroups)) {
    const c1Match = terms.some(t => c1.includes(t));
    const c2Match = terms.some(t => c2.includes(t));
    if (c1Match && c2Match) {
      return 0.85;
    }
  }

  // Check for partial word matches
  const c1Words = c1.split(/[\s,\/&]+/);
  const c2Words = c2.split(/[\s,\/&]+/);

  let matchCount = 0;
  for (const w1 of c1Words) {
    for (const w2 of c2Words) {
      if (w1 === w2 || calculateStringSimilarity(w1, w2) > 0.8) {
        matchCount++;
      }
    }
  }

  if (matchCount > 0) {
    return Math.min(0.75, matchCount * 0.25);
  }

  // Fall back to string similarity
  return calculateStringSimilarity(c1, c2) * 0.5;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;

  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Notification / CTA floor, defined in P(true-match) — NOT raw points.
 * The human question is "how sure before we give a distraught owner hope?",
 * answered in probability. These survive re-tuning of the raw scorer: when
 * matching.js changes, only scoreToProbability() is re-fit, never these floors.
 */
export const PUSH_FLOOR = 0.70; // auto-push to owner + actionable Confirm-&-Connect CTA
export const FEED_FLOOR = 0.40; // owner feed only — no alert, no CTA

/**
 * PROVISIONAL raw-score → P(true-match) mapping.
 *
 * ⚠️ PROVISIONAL — to be replaced by the calibrated curve from Probe A
 * (vision.md §6). Every consumer (owner-push gate, card CTA, tester H5) binds to
 * pTrueMatch, never to the raw score, so when the calibration curve lands ONLY
 * this function changes — no caller changes. The seed for Probe A MUST span the
 * 0.40–0.70 decision band (true non-matches, near-misses, partials) or the curve
 * is miscalibrated exactly where the floor lives.
 *
 * Anchors map the existing quality tiers onto the floor bands:
 *   raw ≥80 (Excellent) → ≥0.72  → push band
 *   raw 60–79 (Good)    → 0.47–0.60 → owner-feed band
 *   raw <52             → <0.40   → suppressed
 * matchSource 'microchip' is a deterministic identity match → 1.0 regardless of score.
 *
 * @param {number} score - raw 0–100 match score
 * @param {string} matchSource - 'attribute' | 'visual' | 'microchip'
 * @returns {number} P(true-match) in [0,1]
 */
export function scoreToProbability(score, matchSource = 'attribute') {
  if (matchSource === 'microchip') return 1; // deterministic identity, bypasses the floor
  const anchors = [
    [0, 0.0], [35, 0.20], [45, 0.30], [52, 0.40],
    [60, 0.47], [70, 0.60], [80, 0.72], [90, 0.85], [100, 0.95],
  ];
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (s <= x1) {
      const t = x1 === x0 ? 0 : (s - x0) / (x1 - x0);
      return Math.round((y0 + t * (y1 - y0)) * 1000) / 1000;
    }
  }
  return 0.95;
}

/**
 * Single source of truth for the notification / CTA band.
 * Both the match card and the server-side owner-notification gate call this,
 * so the floor can never drift between UI and backend.
 * @returns {'actionable'|'feed'|'suppress'}
 */
export function getConfidenceBand(pTrueMatch) {
  if (pTrueMatch >= PUSH_FLOOR) return 'actionable'; // push owner + show Confirm CTA
  if (pTrueMatch >= FEED_FLOOR) return 'feed';        // owner feed only, no alert/CTA
  return 'suppress';                                  // honest-status state only
}

/**
 * Main matching function
 * Calculates match score between a found pet and a lost pet case
 *
 * @param {Object} foundPet - The found pet report
 * @param {Object} lostCase - The lost pet case to compare against
 * @param {Object} options - Configuration options (incl. matchSource)
 * @returns {Object} - { score, pTrueMatch, matchSource, band, details, eligible }
 */
export function calculateMatchScore(foundPet, lostCase, options = {}) {
  const {
    maxDistanceMiles = 15,
    maxDaysApart = 60,
    minScore = 35,
    matchSource = 'attribute',
  } = options;

  const scores = {
    species: 0,
    location: 0,
    breed: 0,
    color: 0,
    timing: 0,
  };

  const details = {
    speciesMatch: false,
    distance: null,
    breedSimilarity: 0,
    colorSimilarity: 0,
    daysBetween: null,
  };

  // 1. Species (25 points) - MANDATORY
  const foundSpecies = (foundPet.petSpecies || foundPet.species || '').toUpperCase();
  const lostSpecies = (lostCase.petSpecies || lostCase.species || '').toUpperCase();

  if (foundSpecies !== lostSpecies) {
    return {
      score: 0,
      maxScore: 100,
      percentage: 0,
      pTrueMatch: 0,
      matchSource,
      band: 'suppress',
      details: { ...details, reason: 'Species mismatch' },
      eligible: false,
    };
  }

  scores.species = 25;
  details.speciesMatch = true;

  // 2. Location (25 points)
  const foundLat = foundPet.latitude || foundPet.lastSeenLatitude;
  const foundLon = foundPet.longitude || foundPet.lastSeenLongitude;
  const lostLat = lostCase.latitude || lostCase.lastSeenLatitude;
  const lostLon = lostCase.longitude || lostCase.lastSeenLongitude;

  if (foundLat && foundLon && lostLat && lostLon) {
    const distance = calculateDistance(foundLat, foundLon, lostLat, lostLon);
    details.distance = Math.round(distance * 10) / 10;

    if (distance <= maxDistanceMiles) {
      // Score decreases with distance
      const proximity = 1 - (distance / maxDistanceMiles);
      scores.location = Math.round(proximity * 25);
    }
  } else if (foundPet.city && lostCase.city) {
    // Fallback: Same city/state check
    const sameCity = foundPet.city?.toLowerCase() === lostCase.city?.toLowerCase();
    const sameState = foundPet.state?.toLowerCase() === lostCase.state?.toLowerCase();

    if (sameCity && sameState) {
      scores.location = 20;
      details.distance = 'Same city';
    } else if (sameState) {
      scores.location = 10;
      details.distance = 'Same state';
    }
  }

  // 3. Breed (20 points)
  const foundBreed = foundPet.petBreed || foundPet.breed || '';
  const lostBreed = lostCase.petBreed || lostCase.breed || '';

  if (foundBreed && lostBreed) {
    const breedSimilarity = calculateStringSimilarity(foundBreed, lostBreed);
    details.breedSimilarity = Math.round(breedSimilarity * 100);
    scores.breed = Math.round(breedSimilarity * 20);
  } else if (!foundBreed && !lostBreed) {
    // Both unknown - slight bonus
    scores.breed = 5;
  }

  // 4. Color (15 points)
  const foundColor = foundPet.petColor || foundPet.color || '';
  const lostColor = lostCase.petColor || lostCase.color || '';

  if (foundColor && lostColor) {
    const colorSimilarity = calculateColorSimilarity(foundColor, lostColor);
    details.colorSimilarity = Math.round(colorSimilarity * 100);
    scores.color = Math.round(colorSimilarity * 15);
  }

  // 5. Timing (15 points)
  const foundDate = foundPet.foundAt || foundPet.lastSeenAt || foundPet.createdAt;
  const lostDate = lostCase.lastSeenAt || lostCase.createdAt;

  if (foundDate && lostDate) {
    const foundTime = new Date(foundDate);
    const lostTime = new Date(lostDate);

    // Found must be after lost
    if (foundTime >= lostTime) {
      const daysBetween = (foundTime - lostTime) / (1000 * 60 * 60 * 24);
      details.daysBetween = Math.round(daysBetween);

      if (daysBetween <= maxDaysApart) {
        // More recent = higher score
        const recency = 1 - (daysBetween / maxDaysApart);
        scores.timing = Math.round(recency * 15);
      }
    } else {
      details.daysBetween = 'Found before lost';
    }
  }

  // Calculate total score
  const totalScore = scores.species + scores.location + scores.breed + scores.color + scores.timing;
  const pTrueMatch = scoreToProbability(totalScore, matchSource);

  return {
    score: totalScore,
    maxScore: 100,
    percentage: totalScore,
    pTrueMatch,            // calibrated probability — the contract for notification/CTA gating
    matchSource,
    band: getConfidenceBand(pTrueMatch), // 'actionable' | 'feed' | 'suppress'
    details: {
      ...details,
      scores,
    },
    eligible: totalScore >= minScore,
  };
}

/**
 * Find potential matches for a case
 *
 * @param {Object} targetCase - The case to find matches for
 * @param {Array} candidateCases - Array of cases to compare against
 * @param {Object} options - Matching options
 * @returns {Array} - Sorted array of matches with scores
 */
export function findMatches(targetCase, candidateCases, options = {}) {
  const {
    minScore = 35,
    maxResults = 10,
    ...scoreOptions
  } = options;

  const matches = candidateCases
    .map(candidate => {
      const matchResult = calculateMatchScore(targetCase, candidate, scoreOptions);
      return {
        case: candidate,
        ...matchResult,
      };
    })
    .filter(m => m.eligible && m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return matches;
}

/**
 * Get match quality label based on score
 */
export function getMatchQuality(score) {
  if (score >= 80) return { label: 'Excellent Match', color: '#16a34a', bg: '#dcfce7' };
  if (score >= 60) return { label: 'Good Match', color: '#2563eb', bg: '#dbeafe' };
  if (score >= 45) return { label: 'Possible Match', color: '#d97706', bg: '#fef3c7' };
  if (score >= 35) return { label: 'Weak Match', color: '#64748b', bg: '#f1f5f9' };
  return { label: 'Unlikely Match', color: '#dc2626', bg: '#fef2f2' };
}
