/**
 * SimulationEngine - Core Monte Carlo simulation logic
 *
 * This engine simulates lost pet behavior and search team movements
 * to generate probability distributions for where pets are likely to be found.
 */

import { PetAgent } from './petBehavior';
import { SearcherAgent } from './searcherBehavior';
import { calculateDetectionProbability } from './detection';
import { seededRandom } from './utils';
import { getTerrainCache, resetTerrainCache } from './terrain';

// Simulation outcomes
export const OUTCOMES = {
  FOUND_BY_SEARCHER: 'FOUND_BY_SEARCHER',
  RETURNED_HOME: 'RETURNED_HOME',
  FOUND_VIA_SHELTER: 'FOUND_VIA_SHELTER',
  FOUND_VIA_SOCIAL: 'FOUND_VIA_SOCIAL',
  FOUND_VIA_PLATFORM: 'FOUND_VIA_PLATFORM',
  TIMEOUT_SEARCHING: 'TIMEOUT_SEARCHING',
  TIMEOUT_SHELTERED: 'TIMEOUT_SHELTERED',
};

/**
 * Main simulation engine class
 */
export class SimulationEngine {
  constructor(config, seed = null) {
    this.config = config;
    this.seed = seed ?? Math.floor(Math.random() * 1000000);
    this.random = seededRandom(this.seed);

    // Initialize agents
    this.pet = new PetAgent(config, this.random);
    this.searchers = this.initializeSearchers(config);

    // State tracking
    this.minute = 0;
    this.events = [];
    this.petPath = [];
    this.searcherPaths = this.searchers.map((s, i) => ({
      searcherId: i,
      path: [],
    }));

    // Outcome tracking
    this.outcome = null;
    this.foundAtMinute = null;
    this.foundBySearcher = null;
    this.wasTransported = false;
    this.transportedAtMinute = null;
  }

  /**
   * Initialize searcher agents based on config
   */
  initializeSearchers(config) {
    const searchers = [];
    for (let i = 0; i < config.searcherCount; i++) {
      searchers.push(new SearcherAgent(i, config, this.random));
    }
    return searchers;
  }

  /**
   * Run the full simulation
   */
  run() {
    const maxMinutes = this.config.maxSimulationHours * 60;

    // Record initial positions
    this.recordPositions();

    while (this.minute < maxMinutes && !this.outcome) {
      this.tick();
      this.minute += this.config.timeStepMinutes;
    }

    // Determine final outcome if not already set
    if (!this.outcome) {
      if (this.pet.state === 'SHELTERED') {
        this.outcome = OUTCOMES.TIMEOUT_SHELTERED;
      } else {
        this.outcome = OUTCOMES.TIMEOUT_SEARCHING;
      }
    }

    return this.getResults();
  }

  /**
   * Execute one simulation tick
   */
  tick() {
    const currentHour = (this.config.startHourOfDay + Math.floor(this.minute / 60)) % 24;

    // 1. Update pet internal state (energy, hunger)
    this.pet.updateInternalState(this.minute, currentHour);

    // 2. Check for pet state transitions
    this.pet.checkStateTransitions(this.minute, currentHour);

    // 3. Move pet according to current state
    if (this.pet.state !== 'SHELTERED') {
      this.pet.move(this.minute, currentHour);

      // 4. Check for homing (returned home)
      if (this.pet.checkHoming()) {
        this.outcome = OUTCOMES.RETURNED_HOME;
        this.foundAtMinute = this.minute;
        this.logEvent('RETURNED_HOME', { minute: this.minute });
        return;
      }

      // 5. Check for human transport event (friendly dogs)
      if (this.pet.checkTransportEvent(currentHour, this.random)) {
        this.wasTransported = true;
        this.transportedAtMinute = this.minute;
        this.logEvent('TRANSPORTED', {
          minute: this.minute,
          pickupLocation: { lat: this.pet.lat, lng: this.pet.lng },
        });
        // Pet is now sheltered - check shelter reunion pathways
        this.pet.state = 'SHELTERED';
      }
    }

    // 6. Handle sheltered pet reunion checks
    if (this.pet.state === 'SHELTERED') {
      const shelterOutcome = this.checkShelteredReunion();
      if (shelterOutcome) {
        this.outcome = shelterOutcome;
        this.foundAtMinute = this.minute;
        return;
      }
    }

    // 7. Move searchers
    for (let i = 0; i < this.searchers.length; i++) {
      const searcher = this.searchers[i];
      searcher.move(this.minute, currentHour);
      searcher.updateFatigue(this.minute);
    }

    // 8. Check for detection (only if pet not sheltered)
    if (this.pet.state !== 'SHELTERED') {
      for (let i = 0; i < this.searchers.length; i++) {
        const searcher = this.searchers[i];
        const detected = this.checkDetection(searcher, currentHour);

        if (detected) {
          this.outcome = OUTCOMES.FOUND_BY_SEARCHER;
          this.foundAtMinute = this.minute;
          this.foundBySearcher = i;
          this.logEvent('FOUND', {
            minute: this.minute,
            searcherId: i,
            location: { lat: this.pet.lat, lng: this.pet.lng },
          });
          return;
        }
      }
    }

    // 9. Record positions for playback
    this.recordPositions();
  }

  /**
   * Check if a searcher detects the pet
   */
  checkDetection(searcher, currentHour) {
    const distance = this.calculateDistance(
      this.pet.lat, this.pet.lng,
      searcher.lat, searcher.lng
    );

    // Detection probability based on all factors
    const probability = calculateDetectionProbability({
      distance,
      petState: this.pet.state,
      petPersonality: this.config.petPersonality,
      terrainType: this.config.terrainType,
      currentHour,
      searcherFatigueHours: searcher.hoursSearching,
    });

    return this.random() < probability;
  }

  /**
   * Check shelter reunion pathways for transported pets
   */
  checkShelteredReunion() {
    // Only check once per simulated hour
    if (this.minute % 60 !== 0) return null;

    const hoursSheltered = (this.minute - this.transportedAtMinute) / 60;

    // Microchip reunion (if applicable)
    if (this.config.hasMicrochip) {
      // P(reunion) = 0.7 × microchip × scan_rate × time_factor
      // Shelters typically scan within 24 hours
      const scanProbability = Math.min(hoursSheltered / 24, 1) * 0.9;
      const reunionProbability = 0.7 * scanProbability;

      if (this.random() < reunionProbability) {
        this.logEvent('MICROCHIP_SCAN', { minute: this.minute });
        return OUTCOMES.FOUND_VIA_SHELTER;
      }
    }

    // Social media reunion (finder posts online)
    // P increases over first 48 hours as finder tries to find owner
    if (hoursSheltered > 2) {
      const socialProbability = 0.3 * 0.6 * 0.8 * Math.min(hoursSheltered / 48, 1);
      if (this.random() < socialProbability / 24) { // Per hour
        this.logEvent('SOCIAL_MEDIA_MATCH', { minute: this.minute });
        return OUTCOMES.FOUND_VIA_SOCIAL;
      }
    }

    // Platform listing match
    if (hoursSheltered > 4) {
      const platformProbability = 0.4 * 1.0 * 0.3 * Math.min(hoursSheltered / 72, 1);
      if (this.random() < platformProbability / 24) { // Per hour
        this.logEvent('PLATFORM_MATCH', { minute: this.minute });
        return OUTCOMES.FOUND_VIA_PLATFORM;
      }
    }

    return null;
  }

  /**
   * Record current positions for playback
   */
  recordPositions() {
    this.petPath.push({
      minute: this.minute,
      lat: this.pet.lat,
      lng: this.pet.lng,
      state: this.pet.state,
      energy: this.pet.energy,
      hunger: this.pet.hunger,
    });

    for (let i = 0; i < this.searchers.length; i++) {
      this.searcherPaths[i].path.push({
        minute: this.minute,
        lat: this.searchers[i].lat,
        lng: this.searchers[i].lng,
      });
    }
  }

  /**
   * Log an event for playback
   */
  logEvent(type, data) {
    this.events.push({
      minute: this.minute,
      type,
      data,
    });
  }

  /**
   * Calculate distance between two points in miles
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Get simulation results
   */
  getResults() {
    // Calculate total distances
    const petDistance = this.calculateTotalDistance(this.petPath);
    const searcherDistance = this.searcherPaths.reduce((total, s) => {
      return total + this.calculateTotalDistance(s.path);
    }, 0);

    // Get terrain data for display
    const terrain = getTerrainCache();
    const terrainData = terrain.loaded ? {
      barriers: terrain.getBarriersForDisplay(),
      zones: terrain.getZonesForDisplay(),
    } : null;

    return {
      seed: this.seed,
      outcome: this.outcome,
      foundAtMinute: this.foundAtMinute,
      foundBySearcher: this.foundBySearcher,
      foundLatitude: this.outcome?.startsWith('FOUND') ? this.pet.lat : null,
      foundLongitude: this.outcome?.startsWith('FOUND') ? this.pet.lng : null,
      wasTransported: this.wasTransported,
      transportedAtMinute: this.transportedAtMinute,
      petDistanceMiles: petDistance,
      searcherDistanceMiles: searcherDistance,
      finalPetState: this.pet.state,
      petPath: this.petPath,
      searcherPaths: this.searcherPaths,
      events: this.events,
      terrain: terrainData,
    };
  }

  /**
   * Calculate total distance traveled from path
   */
  calculateTotalDistance(path) {
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      total += this.calculateDistance(
        path[i - 1].lat, path[i - 1].lng,
        path[i].lat, path[i].lng
      );
    }
    return total;
  }
}

/**
 * Run a batch of simulations
 */
export async function runBatch(config, count, onProgress) {
  const results = [];

  for (let i = 0; i < count; i++) {
    const engine = new SimulationEngine(config);
    const result = engine.run();
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, count);
    }

    // Yield to prevent blocking
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return aggregateResults(results, count);
}

/**
 * Aggregate batch results into statistics
 */
function aggregateResults(results, total) {
  const outcomes = {};
  Object.values(OUTCOMES).forEach(o => outcomes[o] = 0);

  let totalTimeToFind = 0;
  let foundCount = 0;
  let totalPetDistance = 0;
  const timesToFind = [];

  for (const result of results) {
    outcomes[result.outcome]++;
    totalPetDistance += result.petDistanceMiles || 0;

    if (result.foundAtMinute && !result.outcome.startsWith('TIMEOUT')) {
      totalTimeToFind += result.foundAtMinute;
      foundCount++;
      timesToFind.push(result.foundAtMinute);
    }
  }

  // Calculate median
  timesToFind.sort((a, b) => a - b);
  const medianTimeToFind = timesToFind.length > 0
    ? timesToFind[Math.floor(timesToFind.length / 2)]
    : null;

  const successCount = total - outcomes[OUTCOMES.TIMEOUT_SEARCHING] - outcomes[OUTCOMES.TIMEOUT_SHELTERED];

  return {
    totalRuns: total,
    successRate: (successCount / total) * 100,
    avgTimeToFindMins: foundCount > 0 ? totalTimeToFind / foundCount : null,
    medianTimeToFindMins: medianTimeToFind,
    avgPetDistanceMiles: totalPetDistance / total,
    foundBySearcherCount: outcomes[OUTCOMES.FOUND_BY_SEARCHER],
    returnedHomeCount: outcomes[OUTCOMES.RETURNED_HOME],
    foundViaShelterCount: outcomes[OUTCOMES.FOUND_VIA_SHELTER],
    foundViaSocialCount: outcomes[OUTCOMES.FOUND_VIA_SOCIAL],
    foundViaPlatformCount: outcomes[OUTCOMES.FOUND_VIA_PLATFORM],
    timeoutSearchingCount: outcomes[OUTCOMES.TIMEOUT_SEARCHING],
    timeoutShelteredCount: outcomes[OUTCOMES.TIMEOUT_SHELTERED],
  };
}

/**
 * Load terrain data for simulation area
 * Call this before running simulations to enable barrier checking
 */
export async function loadTerrain(centerLat, centerLng, radiusMiles) {
  const terrain = getTerrainCache();
  await terrain.load(centerLat, centerLng, radiusMiles);
  return {
    loaded: terrain.loaded,
    error: terrain.error,
    barrierCount: terrain.barriers.length,
    zoneCount: terrain.zones.length,
  };
}

/**
 * Clear terrain cache (call when location changes significantly)
 */
export function clearTerrain() {
  resetTerrainCache();
}

/**
 * Check if terrain is loaded
 */
export function isTerrainLoaded() {
  const terrain = getTerrainCache();
  return terrain.loaded;
}
