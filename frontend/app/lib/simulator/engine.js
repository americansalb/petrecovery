/**
 * SimulationEngine - Core Monte Carlo simulation logic
 *
 * HYBRID ARCHITECTURE:
 * This engine uses a hybrid approach that separates statistical outcomes
 * from visual animation:
 *
 * 1. FINAL DISPLACEMENT: Sampled from log-normal at simulation start
 *    - Guarantees outputs match Huang 2018 (cats) and Kremer 2021 (dogs)
 *    - Stored as finalPosition coordinates
 *
 * 2. RECOVERY MODE: Determined at simulation start from Weiss 2012 data
 *    - Self-return, owner search, shelter, or other
 *    - Mode determines HOW the pet is found (or if at all)
 *
 * 3. STEP-BY-STEP ANIMATION: Runs for visual interest
 *    - Pet gradually migrates toward final position
 *    - Detection checks against final position, not animated position
 *
 * KEY TIMING VARIABLES:
 * - searchStartDelayHours: Time between pet lost and search begins
 * - searchHoursStart/End: Volunteers only search during these hours
 * - volunteerRampUpHours: Time to reach full volunteer count
 * - initialVolunteerPercent: Starting percentage of volunteers
 *
 * See: researchConfig.js for verified parameters
 *      displacement.js for log-normal sampling
 *      recovery.js for recovery mode determination
 */

import { PetAgent } from './petBehavior';
import { SearcherAgent } from './searcherBehavior';
import { calculateDetectionProbability } from './detection';
import { seededRandom } from './utils';
import { getTerrainCache, resetTerrainCache } from './terrain';

// Research-backed modules
import { sampleDisplacement, getProbabilityZones } from './displacement.js';
import { determineRecoveryMode, sampleCatRecoveryDay, sampleDogRecoveryDay, RecoveryMode } from './recovery.js';
import { processShelterIntake } from './shelter.js';
import { RECOVERY_RATES } from './researchConfig.js';

// Logging control - set to true to see detailed simulation logs
const DEBUG_LOGGING = false; // Disabled for batch performance
const LOG_INTERVAL = 60; // Log every N minutes of simulation time

function simLog(simId, ...args) {
  if (DEBUG_LOGGING) {
    console.log(`[SIM ${simId}]`, ...args);
  }
}

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
    this.config = this.applyConfigDefaults(config);
    this.seed = seed ?? Math.floor(Math.random() * 1000000);
    this.random = seededRandom(this.seed);

    // Initialize agents
    this.pet = new PetAgent(this.config, this.random);
    this.searchers = this.initializeSearchers(this.config);

    // Calculate search start time in minutes
    this.searchStartMinute = (this.config.searchStartDelayHours || 0) * 60;

    // =========================================================================
    // RESEARCH-BACKED OUTCOME DETERMINATION
    // Statistical outcomes are locked in at simulation start
    // =========================================================================

    // 1. Determine recovery mode (Weiss 2012)
    const species = this.config.petSpecies?.toLowerCase() || 'dog';
    this.recoveryOutcome = determineRecoveryMode(species, this.random);

    // 2. Sample final displacement from log-normal distribution
    const lifestyle = this.config.isIndoorPet ? 'indoorOnly' : 'indoorOutdoor';
    this.displacementResult = sampleDisplacement(species, lifestyle, this.random);

    // 3. Calculate final position (where pet will be found if recovered)
    this.finalPosition = this.calculateFinalPosition(
      this.config.centerLatitude,
      this.config.centerLongitude,
      this.displacementResult.distanceMiles
    );

    // 4. Sample recovery day (for timeline-based recovery modes)
    if (this.recoveryOutcome.recovered) {
      this.recoveryDay = species === 'cat'
        ? sampleCatRecoveryDay(this.random)
        : sampleDogRecoveryDay(this.random);
      this.recoveryMinute = this.recoveryDay * 24 * 60;
    } else {
      this.recoveryDay = null;
      this.recoveryMinute = null;
    }

    // =========================================================================
    // STATE TRACKING
    // =========================================================================

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

    // Log research-backed initialization
    const simId = this.seed.toString().slice(-4);
    simLog(simId, `📊 Research-backed initialization:`);
    simLog(simId, `   Recovery mode: ${this.recoveryOutcome.mode} (${this.recoveryOutcome.recovered ? 'will recover' : 'will NOT recover'})`);
    simLog(simId, `   Final displacement: ${(this.displacementResult.distance).toFixed(0)}m (${this.displacementResult.distanceMiles.toFixed(3)}mi)`);
    simLog(simId, `   Expected recovery: ${this.recoveryDay ? `day ${this.recoveryDay}` : 'N/A'}`);
  }

  /**
   * Calculate final position from displacement distance
   * Uses terrain-aware direction selection to avoid barriers
   */
  calculateFinalPosition(centerLat, centerLng, distanceMiles) {
    // Pick a random direction, biased away from major barriers
    const terrain = getTerrainCache();
    let direction = this.random() * 360;

    // If terrain loaded, try to find a direction that avoids barriers
    if (terrain.loaded) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const testDir = (direction + attempt * 45) % 360;
        const testLat = centerLat + (distanceMiles / 69.0) * Math.cos(testDir * Math.PI / 180);
        const testLng = centerLng + (distanceMiles / (69.0 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(testDir * Math.PI / 180);

        const moveCheck = terrain.checkMovement(centerLat, centerLng, testLat, testLng, this.random);
        if (!moveCheck.blocked) {
          direction = testDir;
          break;
        }
      }
    }

    // Calculate final coordinates
    const latOffset = (distanceMiles / 69.0) * Math.cos(direction * Math.PI / 180);
    const lngOffset = (distanceMiles / (69.0 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(direction * Math.PI / 180);

    return {
      lat: centerLat + latOffset,
      lng: centerLng + lngOffset,
      direction,
      distanceMiles
    };
  }

  /**
   * Apply default values for new config options
   */
  applyConfigDefaults(config) {
    return {
      searchStartDelayHours: 2,
      searchHoursStart: 7,
      searchHoursEnd: 21,
      volunteerRampUpHours: 24,
      initialVolunteerPercent: 20,
      ...config,
    };
  }

  /**
   * Check if search has started (accounts for delay)
   */
  isSearchActive() {
    return this.minute >= this.searchStartMinute;
  }

  /**
   * Check if current hour is within volunteer search hours
   */
  isWithinSearchHours(currentHour) {
    const start = this.config.searchHoursStart;
    const end = this.config.searchHoursEnd;
    return currentHour >= start && currentHour < end;
  }

  /**
   * Get number of active searchers based on ramp-up
   */
  getActiveSearcherCount() {
    if (!this.isSearchActive()) return 0;

    const minutesSinceSearchStart = this.minute - this.searchStartMinute;
    const hoursSinceSearchStart = minutesSinceSearchStart / 60;
    const rampUpHours = this.config.volunteerRampUpHours || 24;
    const initialPercent = (this.config.initialVolunteerPercent || 20) / 100;

    // Linear ramp from initial to 100%
    const rampProgress = Math.min(1, hoursSinceSearchStart / rampUpHours);
    const activePercent = initialPercent + (1 - initialPercent) * rampProgress;

    return Math.max(1, Math.floor(this.config.searcherCount * activePercent));
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
    const simId = this.seed.toString().slice(-4);

    simLog(simId, `🚀 STARTING: ${this.config.petSpecies} (${this.config.petSize}, ${this.config.petPersonality})`);
    simLog(simId, `   Location: ${this.config.centerLatitude.toFixed(4)}, ${this.config.centerLongitude.toFixed(4)}`);
    simLog(simId, `   Searchers: ${this.config.searcherCount} (${this.config.searchStrategy})`);
    simLog(simId, `   Duration: ${this.config.maxSimulationHours}hrs, Terrain: ${this.config.terrainType}`);

    // Record initial positions
    this.recordPositions();

    let lastLogMinute = 0;

    while (this.minute < maxMinutes && !this.outcome) {
      this.tick();

      // Periodic logging
      if (this.minute - lastLogMinute >= LOG_INTERVAL) {
        const hours = Math.floor(this.minute / 60);
        const mins = this.minute % 60;
        const distFromHome = this.pet.getDistanceTo(this.pet.homeLat, this.pet.homeLng);
        simLog(simId, `⏱️  ${hours}h${mins}m | State: ${this.pet.state} | Dist: ${distFromHome.toFixed(2)}mi | Energy: ${(this.pet.energy*100).toFixed(0)}% | Hunger: ${(this.pet.hunger*100).toFixed(0)}%`);
        lastLogMinute = this.minute;
      }

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

    const totalHours = (this.foundAtMinute || this.minute) / 60;
    simLog(simId, `🏁 FINISHED: ${this.outcome} after ${totalHours.toFixed(1)}hrs`);
    simLog(simId, `   Pet traveled: ${this.calculateTotalDistance(this.petPath).toFixed(2)} miles`);
    simLog(simId, `   Final state: ${this.pet.state}`);
    simLog(simId, '---');

    return this.getResults();
  }

  /**
   * Execute one simulation tick
   *
   * HYBRID ARCHITECTURE:
   * - Step-by-step movement runs for animation
   * - Recovery is determined by pre-sampled research-backed outcomes
   * - Detection checks against final position, not animated position
   */
  tick() {
    const currentHour = (this.config.startHourOfDay + Math.floor(this.minute / 60)) % 24;

    // =========================================================================
    // ANIMATION: Pet behavior simulation (for visual interest)
    // =========================================================================

    // 1. Update pet internal state (energy, hunger)
    this.pet.updateInternalState(this.minute, currentHour);

    // 2. Check for pet state transitions
    this.pet.checkStateTransitions(this.minute, currentHour);

    // 3. Move pet according to current state (animation only)
    if (this.pet.state !== 'SHELTERED') {
      this.pet.move(this.minute, currentHour);
    }

    // =========================================================================
    // RESEARCH-BACKED RECOVERY: Check if recovery should occur
    // =========================================================================

    // Check recovery based on pre-determined mode (Weiss 2012)
    if (this.recoveryOutcome.recovered && !this.outcome) {
      const recoveryResult = this.checkResearchBackedRecovery(currentHour);
      if (recoveryResult) {
        this.outcome = recoveryResult.outcome;
        this.foundAtMinute = this.minute;
        this.foundBySearcher = recoveryResult.searcherId || null;
        this.logEvent(recoveryResult.eventType, {
          minute: this.minute,
          recoveryMode: this.recoveryOutcome.mode,
          location: { lat: this.finalPosition.lat, lng: this.finalPosition.lng },
          ...recoveryResult.eventData
        });
        return;
      }
    }

    // =========================================================================
    // ANIMATION: Searcher movement (for visual interest)
    // =========================================================================

    const searchActive = this.isSearchActive() && this.isWithinSearchHours(currentHour);
    const activeSearcherCount = searchActive ? this.getActiveSearcherCount() : 0;

    if (searchActive) {
      for (let i = 0; i < activeSearcherCount; i++) {
        const searcher = this.searchers[i];
        searcher.move(this.minute, currentHour);
        searcher.updateFatigue(this.minute);
      }
    }

    // 9. Record positions for playback
    this.recordPositions();
  }

  /**
   * Check if research-backed recovery should occur
   *
   * Recovery modes from Weiss 2012:
   * - SELF_RETURN: Pet returns home on its own (timeline-based)
   * - OWNER_SEARCH / ACTIVE_SEARCH: Found by searcher near final position
   * - SHELTER: Shelter pathway with microchip logic
   * - OTHER / STRANGER_RETURN: Random chance per hour
   */
  checkResearchBackedRecovery(currentHour) {
    const mode = this.recoveryOutcome.mode;
    const searchActive = this.isSearchActive() && this.isWithinSearchHours(currentHour);

    // Self-return modes: timeline-based (Huang 2018 for cats)
    if (mode === RecoveryMode.CAT_SELF_RETURN || mode === RecoveryMode.DOG_SELF_RETURN) {
      if (this.minute >= this.recoveryMinute) {
        return {
          outcome: OUTCOMES.RETURNED_HOME,
          eventType: 'SELF_RETURN',
          eventData: { recoveryDay: this.recoveryDay }
        };
      }
      return null;
    }

    // Search-based modes: searcher must be near final position
    if (mode === RecoveryMode.CAT_OWNER_SEARCH || mode === RecoveryMode.DOG_ACTIVE_SEARCH) {
      if (!searchActive) return null;

      // Check if any active searcher is near the final position
      const activeSearcherCount = this.getActiveSearcherCount();
      for (let i = 0; i < activeSearcherCount; i++) {
        const searcher = this.searchers[i];
        const detected = this.checkDetectionAtFinalPosition(searcher, currentHour);

        if (detected) {
          return {
            outcome: OUTCOMES.FOUND_BY_SEARCHER,
            eventType: 'FOUND_VIA_SEARCH',
            searcherId: i,
            eventData: { searcherId: i }
          };
        }
      }
      return null;
    }

    // Shelter modes: use research-backed shelter logic
    if (mode === RecoveryMode.CAT_SHELTER || mode === RecoveryMode.DOG_SHELTER) {
      // Pet must have been transported to shelter first
      // For simulation purposes, assume transport happens around recovery day
      if (this.minute >= this.recoveryMinute) {
        const species = this.config.petSpecies?.toLowerCase() || 'dog';
        const shelterResult = processShelterIntake({
          species,
          microchipped: this.config.hasMicrochip,
          hasCollar: this.config.hasCollar
        }, this.random);

        if (shelterResult.identified) {
          return {
            outcome: OUTCOMES.FOUND_VIA_SHELTER,
            eventType: 'SHELTER_REUNION',
            eventData: {
              method: shelterResult.method,
              rtoHours: shelterResult.timeToRTO
            }
          };
        }
      }
      return null;
    }

    // Stranger return / Other modes: probabilistic per hour
    if (mode === RecoveryMode.DOG_STRANGER_RETURN || mode === RecoveryMode.CAT_OTHER || mode === RecoveryMode.DOG_OTHER) {
      if (this.minute >= this.recoveryMinute) {
        // High probability once recovery time is reached
        if (this.random() < 0.3) {
          return {
            outcome: OUTCOMES.FOUND_VIA_SOCIAL,
            eventType: 'STRANGER_RETURN',
            eventData: {}
          };
        }
      }
      return null;
    }

    return null;
  }

  /**
   * Check if a searcher detects the pet at the FINAL position
   * (not the animated position)
   *
   * Uses the Koopman POD detection model with SAR-derived sweep widths.
   */
  checkDetectionAtFinalPosition(searcher, currentHour) {
    const distance = this.calculateDistance(
      this.finalPosition.lat, this.finalPosition.lng,
      searcher.lat, searcher.lng
    );

    // Detection probability using Koopman POD model
    const probability = calculateDetectionProbability({
      distance,
      petState: this.pet.state, // Use animated state for detection modifiers
      petPersonality: this.config.petPersonality,
      terrainType: this.config.terrainType,
      currentHour,
      searcherFatigueHours: searcher.hoursSearching,
      species: this.config.petSpecies?.toLowerCase() || 'dog',
      searcherStepDistance: 0.02, // ~100m per 5-minute step
    });

    return this.random() < probability;
  }

  /**
   * Check if a searcher detects the pet (legacy - uses animated position)
   */
  checkDetection(searcher, currentHour) {
    const distance = this.calculateDistance(
      this.pet.lat, this.pet.lng,
      searcher.lat, searcher.lng
    );

    // Detection probability using Koopman POD model
    const probability = calculateDetectionProbability({
      distance,
      petState: this.pet.state,
      petPersonality: this.config.petPersonality,
      terrainType: this.config.terrainType,
      currentHour,
      searcherFatigueHours: searcher.hoursSearching,
      species: this.config.petSpecies?.toLowerCase() || 'dog',
      searcherStepDistance: 0.02,
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

    // Use final position for found location (research-backed)
    const foundLat = this.outcome?.startsWith('FOUND') || this.outcome === OUTCOMES.RETURNED_HOME
      ? this.finalPosition.lat
      : null;
    const foundLng = this.outcome?.startsWith('FOUND') || this.outcome === OUTCOMES.RETURNED_HOME
      ? this.finalPosition.lng
      : null;

    return {
      seed: this.seed,
      outcome: this.outcome,
      foundAtMinute: this.foundAtMinute,
      foundBySearcher: this.foundBySearcher,
      foundLatitude: foundLat,
      foundLongitude: foundLng,
      wasTransported: this.wasTransported,
      transportedAtMinute: this.transportedAtMinute,
      petDistanceMiles: petDistance,
      searcherDistanceMiles: searcherDistance,
      finalPetState: this.pet.state,
      petPath: this.petPath,
      searcherPaths: this.searcherPaths,
      events: this.events,
      terrain: terrainData,

      // Research-backed outcome data
      research: {
        recoveryMode: this.recoveryOutcome.mode,
        recoveryModeDescription: this.recoveryOutcome.description,
        willRecover: this.recoveryOutcome.recovered,
        displacementMeters: this.displacementResult.distance,
        displacementMiles: this.displacementResult.distanceMiles,
        displacementParams: this.displacementResult.params,
        expectedRecoveryDay: this.recoveryDay,
        finalPosition: this.finalPosition,
      },
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
 *
 * MEMORY OPTIMIZATION: We aggregate results incrementally and do NOT store
 * full path data in memory. This prevents heap exhaustion on large batches.
 */
export async function runBatch(config, count, onProgress) {
  console.log('═'.repeat(60));
  console.log(`🎲 MONTE CARLO BATCH: ${count} simulations`);
  console.log(`   Species: ${config.petSpecies} | Size: ${config.petSize} | Personality: ${config.petPersonality}`);
  console.log(`   Terrain: ${config.terrainType} | Searchers: ${config.searcherCount} (${config.searchStrategy})`);
  console.log(`   Max Duration: ${config.maxSimulationHours} hours`);
  console.log('═'.repeat(60));

  // Incremental aggregation to avoid memory buildup
  const outcomes = {};
  Object.values(OUTCOMES).forEach(o => outcomes[o] = 0);
  let totalTimeToFind = 0;
  let foundCount = 0;
  let totalPetDistance = 0;
  const timesToFind = [];

  const startTime = Date.now();

  for (let i = 0; i < count; i++) {
    const engine = new SimulationEngine(config);
    const result = engine.run();

    // Aggregate incrementally (don't store full results)
    outcomes[result.outcome]++;
    totalPetDistance += result.petDistanceMiles || 0;

    if (result.foundAtMinute && !result.outcome.startsWith('TIMEOUT')) {
      totalTimeToFind += result.foundAtMinute;
      foundCount++;
      timesToFind.push(result.foundAtMinute);
    }

    if (onProgress) {
      onProgress(i + 1, count);
    }

    // Progress log every 10 simulations
    if ((i + 1) % 10 === 0 || i === count - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`📊 Progress: ${i + 1}/${count} (${elapsed}s) | Outcomes so far:`, { ...outcomes });
    }

    // Yield to prevent blocking and allow GC
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Calculate final statistics
  timesToFind.sort((a, b) => a - b);
  const medianTimeToFind = timesToFind.length > 0
    ? timesToFind[Math.floor(timesToFind.length / 2)]
    : null;

  const successCount = count - outcomes[OUTCOMES.TIMEOUT_SEARCHING] - outcomes[OUTCOMES.TIMEOUT_SHELTERED];

  const aggregated = {
    totalRuns: count,
    successRate: (successCount / count) * 100,
    avgTimeToFindMins: foundCount > 0 ? totalTimeToFind / foundCount : null,
    medianTimeToFindMins: medianTimeToFind,
    avgPetDistanceMiles: totalPetDistance / count,
    foundBySearcherCount: outcomes[OUTCOMES.FOUND_BY_SEARCHER],
    returnedHomeCount: outcomes[OUTCOMES.RETURNED_HOME],
    foundViaShelterCount: outcomes[OUTCOMES.FOUND_VIA_SHELTER],
    foundViaSocialCount: outcomes[OUTCOMES.FOUND_VIA_SOCIAL],
    foundViaPlatformCount: outcomes[OUTCOMES.FOUND_VIA_PLATFORM],
    timeoutSearchingCount: outcomes[OUTCOMES.TIMEOUT_SEARCHING],
    timeoutShelteredCount: outcomes[OUTCOMES.TIMEOUT_SHELTERED],
  };

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('═'.repeat(60));
  console.log(`✅ BATCH COMPLETE in ${totalTime}s`);
  console.log(`   Success Rate: ${aggregated.successRate.toFixed(1)}%`);
  console.log(`   Found by Searcher: ${aggregated.foundBySearcherCount}`);
  console.log(`   Returned Home: ${aggregated.returnedHomeCount}`);
  console.log(`   Via Shelter: ${aggregated.foundViaShelterCount}`);
  console.log(`   Via Social: ${aggregated.foundViaSocialCount}`);
  console.log(`   Via Platform: ${aggregated.foundViaPlatformCount}`);
  console.log(`   Timeout (Searching): ${aggregated.timeoutSearchingCount}`);
  console.log(`   Timeout (Sheltered): ${aggregated.timeoutShelteredCount}`);
  if (aggregated.avgTimeToFindMins) {
    console.log(`   Avg Time to Find: ${(aggregated.avgTimeToFindMins / 60).toFixed(1)} hours`);
  }
  console.log(`   Avg Pet Distance: ${aggregated.avgPetDistanceMiles.toFixed(2)} miles`);
  console.log('═'.repeat(60));

  return aggregated;
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
