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
    hasCollar: legacyConfig.hasCollar !== false,
    hasVisibleTags: legacyConfig.hasCollar !== false,
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
 * Convert emergent simulation results to legacy format
 */
function convertResultToLegacy(emergentResult, legacyConfig) {
  const legacyOutcome = mapEmergentOutcomeToLegacy(emergentResult.outcome);
  const isFound = emergentResult.outcomeCategory === 'REUNITED';

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
    outcome: legacyOutcome,
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
    searcherPaths: [],
    events: emergentResult.events,
    terrain: null,
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

  // Calculate legacy statistics
  let returnedHomeCount = 0;
  let foundBySearcherCount = 0;
  let foundViaShelterCount = 0;
  let foundViaSocialCount = 0;
  let timeoutCount = 0;

  legacyResults.forEach(r => {
    switch (r.outcome) {
      case LEGACY_OUTCOMES.RETURNED_HOME:
        returnedHomeCount++;
        break;
      case LEGACY_OUTCOMES.FOUND_BY_SEARCHER:
        foundBySearcherCount++;
        break;
      case LEGACY_OUTCOMES.FOUND_VIA_SHELTER:
        foundViaShelterCount++;
        break;
      case LEGACY_OUTCOMES.FOUND_VIA_SOCIAL:
        foundViaSocialCount++;
        break;
      default:
        timeoutCount++;
    }
  });

  const successCount = returnedHomeCount + foundBySearcherCount + foundViaShelterCount + foundViaSocialCount;
  const foundResults = legacyResults.filter(r => r.foundAtMinute !== null);
  const avgTimeToFind = foundResults.length > 0
    ? foundResults.reduce((sum, r) => sum + r.foundAtMinute, 0) / foundResults.length
    : null;

  return {
    totalRuns: count,
    successRate: (successCount / count) * 100,
    avgTimeToFindMins: avgTimeToFind,
    avgPetDistanceMiles: batchResult.displacementMedian,
    returnedHomeCount,
    foundBySearcherCount,
    foundViaShelterCount,
    foundViaSocialCount,
    foundViaPlatformCount: 0,
    timeoutSearchingCount: timeoutCount,
    timeoutShelteredCount: 0,
    results: legacyResults,
    emergentStats: {
      displacementMedian: batchResult.displacementMedian,
      recoveryRate: batchResult.recoveryRate,
      selfReturnRate: batchResult.selfReturnRate,
      executionTimeSeconds: batchResult.executionTimeSeconds,
    },
  };
}
