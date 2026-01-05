/**
 * Adapter to bridge old config format to new emergent simulation
 *
 * This adapter allows the existing frontend and API routes to use the
 * new emergent Monte Carlo simulation without changing their interfaces.
 */

import {
  SPECIES,
  SIZE,
  AGE_CATEGORY,
  TEMPERAMENT,
  ESCAPE_TYPE,
  TERRAIN_TYPE,
  buildPetConfig,
  buildSearcherConfig,
  buildEnvironmentConfig,
} from './config.js';
import { EmergentSimulationEngine, runEmergentBatch } from './engine.js';
import { OUTCOME, OUTCOME_CATEGORY } from './outcomes.js';

// Map old outcomes to new outcome codes
const LEGACY_OUTCOMES = {
  FOUND_BY_SEARCHER: 'FOUND_BY_SEARCHER',
  RETURNED_HOME: 'RETURNED_HOME',
  FOUND_VIA_SHELTER: 'FOUND_VIA_SHELTER',
  FOUND_VIA_SOCIAL: 'FOUND_VIA_SOCIAL',
  FOUND_VIA_PLATFORM: 'FOUND_VIA_PLATFORM',
  TIMEOUT_SEARCHING: 'TIMEOUT_SEARCHING',
  TIMEOUT_SHELTERED: 'TIMEOUT_SHELTERED',
};

// Map new emergent outcomes to legacy outcomes
function mapEmergentOutcomeToLegacy(emergentOutcome) {
  const mapping = {
    // Self returns
    'REUNITED_SELF_RETURN': LEGACY_OUTCOMES.RETURNED_HOME,

    // Searcher finds
    'REUNITED_OWNER_SEARCH': LEGACY_OUTCOMES.FOUND_BY_SEARCHER,
    'REUNITED_SEARCH_TEAM': LEGACY_OUTCOMES.FOUND_BY_SEARCHER,
    'REUNITED_CALLED': LEGACY_OUTCOMES.FOUND_BY_SEARCHER,
    'REUNITED_TRAP': LEGACY_OUTCOMES.FOUND_BY_SEARCHER,

    // Stranger finds
    'REUNITED_STRANGER_DIRECT': LEGACY_OUTCOMES.FOUND_VIA_SOCIAL,
    'REUNITED_STRANGER_POST': LEGACY_OUTCOMES.FOUND_VIA_SOCIAL,

    // Shelter
    'REUNITED_SHELTER': LEGACY_OUTCOMES.FOUND_VIA_SHELTER,
    'AT_SHELTER_PENDING': LEGACY_OUTCOMES.TIMEOUT_SHELTERED,
    'ADOPTED_FROM_SHELTER': LEGACY_OUTCOMES.TIMEOUT_SHELTERED,

    // Deceased (map to timeout for now)
    'DECEASED_TRAFFIC': LEGACY_OUTCOMES.TIMEOUT_SEARCHING,
    'DECEASED_PREDATOR': LEGACY_OUTCOMES.TIMEOUT_SEARCHING,
    'DECEASED_EXPOSURE': LEGACY_OUTCOMES.TIMEOUT_SEARCHING,
    'DECEASED_DEHYDRATION': LEGACY_OUTCOMES.TIMEOUT_SEARCHING,
    'DECEASED_STARVATION': LEGACY_OUTCOMES.TIMEOUT_SEARCHING,
    'DECEASED_INJURY': LEGACY_OUTCOMES.TIMEOUT_SEARCHING,
    'DECEASED_EUTHANIZED': LEGACY_OUTCOMES.TIMEOUT_SHELTERED,

    // Still missing
    'STILL_MISSING': LEGACY_OUTCOMES.TIMEOUT_SEARCHING,
    'SIGHTED_NOT_CAPTURED': LEGACY_OUTCOMES.TIMEOUT_SEARCHING,
    'WITH_STRANGER_PENDING': LEGACY_OUTCOMES.TIMEOUT_SEARCHING,

    // Others
    'ADOPTED_BY_FINDER': LEGACY_OUTCOMES.TIMEOUT_SEARCHING,
    'FERAL_PERMANENTLY': LEGACY_OUTCOMES.TIMEOUT_SEARCHING,
  };

  return mapping[emergentOutcome] || LEGACY_OUTCOMES.TIMEOUT_SEARCHING;
}

// Map old size names to new SIZE enum
function mapSize(oldSize) {
  const mapping = {
    'TINY': SIZE.TINY,
    'SMALL': SIZE.SMALL,
    'MEDIUM': SIZE.MEDIUM,
    'LARGE': SIZE.LARGE,
    'GIANT': SIZE.GIANT,
  };
  return mapping[oldSize?.toUpperCase()] || SIZE.MEDIUM;
}

// Map old personality to new TEMPERAMENT
function mapPersonality(personality) {
  const mapping = {
    'FRIENDLY': TEMPERAMENT.GREGARIOUS,
    'NEUTRAL': TEMPERAMENT.ALOOF,
    'SHY': TEMPERAMENT.XENOPHOBIC,
    'GREGARIOUS': TEMPERAMENT.GREGARIOUS,
    'ALOOF': TEMPERAMENT.ALOOF,
    'XENOPHOBIC': TEMPERAMENT.XENOPHOBIC,
  };
  return mapping[personality?.toUpperCase()] || TEMPERAMENT.ALOOF;
}

// Map old terrain type to new TERRAIN_TYPE
function mapTerrainType(terrain) {
  const mapping = {
    'URBAN': TERRAIN_TYPE.URBAN,
    'SUBURBAN': TERRAIN_TYPE.SUBURBAN,
    'RURAL': TERRAIN_TYPE.RURAL,
    'WOODED': TERRAIN_TYPE.WOODED,
  };
  return mapping[terrain?.toUpperCase()] || TERRAIN_TYPE.SUBURBAN;
}

// Map escape type from frontend to emergent escape type
function mapEscapeType(escapeType) {
  const mapping = {
    'DOOR_DASH': ESCAPE_TYPE.DOOR_DASH,
    'GATE_LEFT_OPEN': ESCAPE_TYPE.GATE_LEFT_OPEN,
    'CHASED_BY_ANIMAL': ESCAPE_TYPE.CHASED_BY_ANIMAL,
    'CHASED_BY_HUMAN': ESCAPE_TYPE.CHASED_BY_HUMAN,
    'LOUD_NOISE_STARTLE': ESCAPE_TYPE.LOUD_NOISE_STARTLE,
    'DISASTER': ESCAPE_TYPE.DISASTER,
    'FELL_FROM_VEHICLE': ESCAPE_TYPE.FELL_FROM_VEHICLE,
    'WANDERED': ESCAPE_TYPE.WANDERED,
  };
  return mapping[escapeType?.toUpperCase()] || ESCAPE_TYPE.DOOR_DASH;
}

/**
 * Convert old config format to new emergent config format
 */
export function convertLegacyConfig(legacyConfig) {
  const species = legacyConfig.petSpecies?.toUpperCase() === 'CAT' ? SPECIES.CAT : SPECIES.DOG;

  // FIXED: Don't default collar/tags to true - use explicit values
  // Previously defaulted to true, which caused 80% reunion rate on stranger capture
  const hasCollar = legacyConfig.hasCollar === true;
  const hasVisibleTags = legacyConfig.hasVisibleTags === true ||
    (hasCollar && legacyConfig.hasVisibleTags !== false);  // Only if collar AND tags not explicitly false

  const petConfig = buildPetConfig({
    species,
    escapeLatitude: legacyConfig.centerLatitude,
    escapeLongitude: legacyConfig.centerLongitude,
    escapeDatetime: new Date().toISOString(),
    size: mapSize(legacyConfig.petSize),
    ageCategory: AGE_CATEGORY.ADULT,
    temperament: mapPersonality(legacyConfig.petPersonality),
    isIndoorOnly: legacyConfig.isIndoorPet === true,
    escapeType: mapEscapeType(legacyConfig.escapeType),
    hasCollar: hasCollar,
    hasVisibleTags: hasVisibleTags,
    hasMicrochip: legacyConfig.hasMicrochip === true,
    microchipRegistered: legacyConfig.hasMicrochip === true,
  });

  const searcherConfig = buildSearcherConfig({
    searcherCount: legacyConfig.searcherCount || 5,
    searchStartDelayHours: legacyConfig.searchStartDelayHours || 2,
    searchHoursStart: legacyConfig.searchHoursStart || 7,
    searchHoursEnd: legacyConfig.searchHoursEnd || 21,
    // Outreach/visibility options - affect stranger return probability
    postedOnSocialMedia: legacyConfig.postedOnSocialMedia === true,
    postedFlyers: legacyConfig.postedFlyers === true,
    contactedShelters: legacyConfig.contactedShelters === true,
    listedOnPetRecoveryPlatform: legacyConfig.listedOnPetRecoveryPlatform === true,
  });

  const environmentConfig = buildEnvironmentConfig({
    terrainType: mapTerrainType(legacyConfig.terrainType),
    searchRadiusMiles: legacyConfig.searchRadiusMiles || 2.0,
    maxSimulationHours: legacyConfig.maxSimulationHours || 72,
    timeStepMinutes: legacyConfig.timeStepMinutes || 5,
  });

  return { petConfig, searcherConfig, environmentConfig };
}

/**
 * Get human-readable description for emergent outcome
 */
function getOutcomeDescription(outcome) {
  const descriptions = {
    // REUNITED outcomes (pet recovered)
    'REUNITED_SELF_RETURN': 'Came home on their own',
    'REUNITED_OWNER_SEARCH': 'Found by owner during search',
    'REUNITED_SEARCH_TEAM': 'Found by search team/volunteers',
    'REUNITED_CALLED': 'Came when called by owner',
    'REUNITED_TRAP': 'Captured via humane trap',
    'REUNITED_STRANGER_DIRECT': 'Stranger found and contacted owner',
    'REUNITED_STRANGER_POST': 'Stranger posted online, owner saw',
    'REUNITED_SHELTER': 'Recovered from animal shelter',

    // NOT FOUND outcomes
    'AT_SHELTER_PENDING': 'At shelter, not yet claimed',
    'ADOPTED_FROM_SHELTER': 'Adopted from shelter by another family',
    'WITH_STRANGER_PENDING': 'With stranger, no contact made',
    'ADOPTED_BY_FINDER': 'Kept by finder',
    'STILL_MISSING': 'Still missing, location unknown',
    'SIGHTED_NOT_CAPTURED': 'Sighted but not captured',
    'FERAL_PERMANENTLY': 'Became feral, cannot be caught',

    // DECEASED outcomes
    'DECEASED_TRAFFIC': 'Hit by vehicle',
    'DECEASED_PREDATOR': 'Killed by predator',
    'DECEASED_EXPOSURE': 'Died from exposure/weather',
    'DECEASED_DEHYDRATION': 'Died from dehydration',
    'DECEASED_STARVATION': 'Died from starvation',
    'DECEASED_INJURY': 'Died from injury',
    'DECEASED_EUTHANIZED': 'Euthanized at shelter',
  };
  return descriptions[outcome] || outcome;
}

/**
 * Categorize outcome for UI display
 */
function getOutcomeCategory(outcome) {
  if (outcome.startsWith('REUNITED_')) return 'FOUND';
  if (outcome.startsWith('DECEASED_')) return 'DECEASED';
  if (outcome === 'AT_SHELTER_PENDING' || outcome === 'WITH_STRANGER_PENDING') return 'RECOVERABLE';
  return 'NOT_FOUND';
}

/**
 * Convert flat searcherPaths to grouped format expected by UI
 *
 * Emergent engine outputs: [{ id, minute, lat, lng, isOwner }, ...]
 * UI expects: [{ searcherId: 0, isOwner: true, path: [{ minute, lat, lng }, ...] }, ...]
 */
function groupSearcherPaths(flatPaths) {
  if (!flatPaths || flatPaths.length === 0) return [];

  // Group by searcher ID
  const grouped = {};
  flatPaths.forEach(point => {
    const id = point.id;
    if (!grouped[id]) {
      grouped[id] = {
        searcherId: Object.keys(grouped).length,
        id: id,
        isOwner: point.isOwner,
        path: [],
      };
    }
    grouped[id].path.push({
      minute: point.minute,
      lat: point.lat,
      lng: point.lng,
    });
  });

  // Sort paths by minute for proper interpolation
  Object.values(grouped).forEach(searcher => {
    searcher.path.sort((a, b) => a.minute - b.minute);
  });

  return Object.values(grouped);
}

/**
 * Convert emergent simulation results to unified format
 *
 * IMPORTANT: We now preserve the granular emergent outcomes instead of
 * mapping to legacy 7-outcome format. This provides:
 * - Full detail on HOW pet was found (search vs stranger vs self-return)
 * - Death outcomes visible (traffic, dehydration, etc.)
 * - Intermediate states (at shelter but unclaimed, with stranger but no contact)
 */
function convertResultToLegacy(emergentResult, legacyConfig) {
  const legacyOutcome = mapEmergentOutcomeToLegacy(emergentResult.outcome);
  const isFound = emergentResult.outcomeCategory === 'REUNITED';
  const isDeceased = emergentResult.outcome.startsWith('DECEASED_');

  // Convert path format
  const petPath = emergentResult.petPath.map(p => ({
    minute: p.minute,
    lat: p.lat,
    lng: p.lng,
    state: p.state,
  }));

  // Find where pet was found (last position in effective path)
  const lastPos = petPath[petPath.length - 1];

  return {
    seed: emergentResult.seed,

    // PRIMARY: Use the granular emergent outcome
    outcome: emergentResult.outcome,
    outcomeCategory: getOutcomeCategory(emergentResult.outcome),
    outcomeDescription: getOutcomeDescription(emergentResult.outcome),

    // DEPRECATED: Legacy outcome for old UI components
    legacyOutcome: legacyOutcome,

    foundAtMinute: isFound ? emergentResult.outcomeMinute : null,
    foundBySearcher: legacyOutcome === LEGACY_OUTCOMES.FOUND_BY_SEARCHER ? 0 : null,
    foundLatitude: isFound ? lastPos?.lat : null,
    foundLongitude: isFound ? lastPos?.lng : null,
    wasTransported: false,
    transportedAtMinute: null,
    petDistanceMiles: emergentResult.maxDisplacementMiles,
    searcherDistanceMiles: 0,
    finalPetState: emergentResult.finalPetState,
    petPath,
    searcherPaths: groupSearcherPaths(emergentResult.searcherPaths),
    events: emergentResult.events,
    terrain: null,

    // Detailed outcome info
    isFound,
    isDeceased,
    isRecoverable: emergentResult.outcome === 'AT_SHELTER_PENDING' || emergentResult.outcome === 'WITH_STRANGER_PENDING',

    // Research/debug info
    research: {
      emergentOutcome: emergentResult.outcome,
      outcomeCategory: emergentResult.outcomeCategory,
      species: emergentResult.species,
      temperament: emergentResult.temperament,
      isIndoorOnly: emergentResult.isIndoorOnly,
    },
  };
}

/**
 * Emergent Simulation Engine with legacy interface
 *
 * Drop-in replacement for the old SimulationEngine class
 */
export class LegacyEmergentSimulationEngine {
  constructor(legacyConfig, seed = null) {
    this.legacyConfig = legacyConfig;
    this.providedSeed = seed;

    // Convert to emergent config
    const { petConfig, searcherConfig, environmentConfig } = convertLegacyConfig(legacyConfig);

    // Create emergent engine
    this.engine = new EmergentSimulationEngine(
      petConfig,
      searcherConfig,
      environmentConfig,
      seed
    );
  }

  /**
   * Run the simulation (same interface as old engine)
   */
  run() {
    const result = this.engine.run();
    return convertResultToLegacy(result, this.legacyConfig);
  }
}

// Export the legacy outcomes for compatibility
export { LEGACY_OUTCOMES as OUTCOMES };

// Terrain loading stub (real implementation in terrain.js)
export async function loadTerrain(lat, lng, radiusMiles) {
  // Return minimal terrain info - the emergent simulation uses simplified terrain
  return {
    loaded: false,
    message: 'Emergent simulation uses simplified terrain model',
    lat,
    lng,
    radiusMiles,
  };
}

/**
 * Run emergent batch with legacy interface
 */
export async function runLegacyEmergentBatch(legacyConfig, count, onProgress) {
  const { petConfig, searcherConfig, environmentConfig } = convertLegacyConfig(legacyConfig);
  const batchResult = await runEmergentBatch(petConfig, searcherConfig, environmentConfig, count, onProgress);

  // Convert results to legacy format
  const legacyResults = batchResult.results.map(r => convertResultToLegacy(r, legacyConfig));

  // Calculate outcome counts using new clearer categories
  // FOUND outcomes (pet reunited with owner)
  let returnedHomeCount = 0;      // Came home on own
  let foundBySearcherCount = 0;   // You found them
  let foundViaShelterCount = 0;   // Recovered from shelter
  let strangerReturnedCount = 0;  // Stranger returned to you

  // NOT FOUND outcomes
  let stillMissingCount = 0;        // Still missing
  let atShelterUnclaimedCount = 0;  // At shelter, unclaimed
  let withStrangerCount = 0;        // Stranger has pet, no contact

  // DECEASED outcomes (granular breakdown)
  let deceasedTrafficCount = 0;
  let deceasedPredatorCount = 0;
  let deceasedExposureCount = 0;
  let deceasedDehydrationCount = 0;
  let deceasedStarvationCount = 0;
  let deceasedInjuryCount = 0;
  let deceasedEuthanizedCount = 0;

  // Track times to find for confidence interval calculation
  const timesToFind = [];

  // Count based on emergent outcome codes
  batchResult.results.forEach(r => {
    // Track time to find for CI calculation
    if (r.outcomeCategory === 'REUNITED' && r.outcomeMinute) {
      timesToFind.push(r.outcomeMinute);
    }

    switch (r.outcome) {
      // FOUND - came home on own
      case 'REUNITED_SELF_RETURN':
        returnedHomeCount++;
        break;

      // FOUND - you found them (owner/searcher search)
      case 'REUNITED_OWNER_SEARCH':
      case 'REUNITED_SEARCH_TEAM':
      case 'REUNITED_CALLED':
      case 'REUNITED_TRAP':
        foundBySearcherCount++;
        break;

      // FOUND - recovered from shelter
      case 'REUNITED_SHELTER':
        foundViaShelterCount++;
        break;

      // FOUND - stranger returned to you
      case 'REUNITED_STRANGER_DIRECT':
      case 'REUNITED_STRANGER_POST':
        strangerReturnedCount++;
        break;

      // NOT FOUND - at shelter unclaimed
      case 'AT_SHELTER_PENDING':
      case 'ADOPTED_FROM_SHELTER':
        atShelterUnclaimedCount++;
        break;

      // NOT FOUND - stranger has pet, no contact
      case 'WITH_STRANGER_PENDING':
      case 'ADOPTED_BY_FINDER':
        withStrangerCount++;
        break;

      // DECEASED - granular tracking
      case 'DECEASED_TRAFFIC':
        deceasedTrafficCount++;
        break;
      case 'DECEASED_PREDATOR':
        deceasedPredatorCount++;
        break;
      case 'DECEASED_EXPOSURE':
        deceasedExposureCount++;
        break;
      case 'DECEASED_DEHYDRATION':
        deceasedDehydrationCount++;
        break;
      case 'DECEASED_STARVATION':
        deceasedStarvationCount++;
        break;
      case 'DECEASED_INJURY':
        deceasedInjuryCount++;
        break;
      case 'DECEASED_EUTHANIZED':
        deceasedEuthanizedCount++;
        break;

      // NOT FOUND - still missing
      case 'STILL_MISSING':
      case 'SIGHTED_NOT_CAPTURED':
      case 'FERAL_PERMANENTLY':
      default:
        stillMissingCount++;
    }
  });

  const deceasedCount = deceasedTrafficCount + deceasedPredatorCount + deceasedExposureCount +
    deceasedDehydrationCount + deceasedStarvationCount + deceasedInjuryCount + deceasedEuthanizedCount;

  const successCount = returnedHomeCount + foundBySearcherCount + foundViaShelterCount + strangerReturnedCount;
  const foundResults = legacyResults.filter(r => r.foundAtMinute !== null);
  const avgTimeToFind = foundResults.length > 0
    ? foundResults.reduce((sum, r) => sum + r.foundAtMinute, 0) / foundResults.length
    : null;

  // Calculate confidence intervals using Wilson score interval for proportions
  // This is more accurate than normal approximation for small samples or extreme proportions
  function wilsonConfidenceInterval(successes, total, confidence = 0.95) {
    if (total === 0) return { lower: 0, upper: 0, point: 0 };

    const z = 1.96; // 95% confidence
    const p = successes / total;
    const n = total;

    const denominator = 1 + z * z / n;
    const center = (p + z * z / (2 * n)) / denominator;
    const margin = (z / denominator) * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));

    return {
      lower: Math.max(0, (center - margin) * 100),
      upper: Math.min(100, (center + margin) * 100),
      point: p * 100,
    };
  }

  // Calculate median and quartiles for time to find
  function calculateTimeStats(times) {
    if (times.length === 0) return null;

    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    const q25 = times[Math.floor(times.length * 0.25)];
    const q75 = times[Math.floor(times.length * 0.75)];

    return { median, q25, q75 };
  }

  const successRateCI = wilsonConfidenceInterval(successCount, count);
  const timeStats = calculateTimeStats(timesToFind);

  return {
    totalRuns: count,
    successRate: (successCount / count) * 100,
    avgTimeToFindMins: avgTimeToFind,
    avgPetDistanceMiles: batchResult.displacementMedian,

    // Confidence intervals (for batch analysis display)
    confidenceIntervals: {
      successRate: successRateCI,
      selfReturnRate: wilsonConfidenceInterval(returnedHomeCount, count),
      searcherFoundRate: wilsonConfidenceInterval(foundBySearcherCount, count),
      strangerReturnRate: wilsonConfidenceInterval(strangerReturnedCount, count),
      deceasedRate: wilsonConfidenceInterval(deceasedCount, count),
    },

    // Time to find statistics (for display)
    timeToFindStats: timeStats ? {
      medianMinutes: timeStats.median,
      medianHours: (timeStats.median / 60).toFixed(1),
      q25Minutes: timeStats.q25,
      q75Minutes: timeStats.q75,
    } : null,

    // FOUND outcomes (new clearer names)
    returnedHomeCount,       // Came home on own
    foundBySearcherCount,    // You found them
    foundViaShelterCount,    // Recovered from shelter
    strangerReturnedCount,   // Stranger returned to you

    // NOT FOUND outcomes (new clearer names)
    stillMissingCount,         // Still missing
    atShelterUnclaimedCount,   // At shelter, unclaimed
    withStrangerCount,         // Stranger has pet, no contact
    deceasedCount,             // Total deceased

    // DECEASED breakdown (granular)
    deceasedBreakdown: {
      traffic: deceasedTrafficCount,
      predator: deceasedPredatorCount,
      exposure: deceasedExposureCount,
      dehydration: deceasedDehydrationCount,
      starvation: deceasedStarvationCount,
      injury: deceasedInjuryCount,
      euthanized: deceasedEuthanizedCount,
    },

    // Legacy keys for backward compatibility (deprecated)
    foundViaSocialCount: strangerReturnedCount,
    timeoutSearchingCount: stillMissingCount + deceasedCount,
    timeoutShelteredCount: atShelterUnclaimedCount,
    foundViaPlatformCount: 0,

    results: legacyResults,
    emergentStats: {
      displacementMedian: batchResult.displacementMedian,
      recoveryRate: batchResult.recoveryRate,
      selfReturnRate: batchResult.selfReturnRate,
      executionTimeSeconds: batchResult.executionTimeSeconds,
    },
  };
}
