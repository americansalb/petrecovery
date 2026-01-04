/**
 * SimulationEngine - Core Monte Carlo simulation logic
 *
 * ============================================================================
 * DEPRECATION NOTICE
 * ============================================================================
 *
 * This legacy engine is DEPRECATED. Use the emergent engine instead:
 *
 *   import { LegacyEmergentSimulationEngine } from './emergent/adapter.js';
 *   const engine = new LegacyEmergentSimulationEngine(config);
 *   const result = engine.run();
 *
 * The emergent engine provides:
 * - Granular outcomes (15+ types vs 7 legacy types)
 * - Death tracking (traffic, dehydration, predator, etc.)
 * - Confidence intervals for batch results
 * - Better calibrated to Weiss 2012 research data
 *
 * This file is kept for reference and testing compatibility.
 *
 * ============================================================================
 *
 * EMERGENT OUTCOME ARCHITECTURE:
 * This engine uses physics-based simulation where recovery outcomes
 * EMERGE from the mechanics, not pre-determined from statistics.
 *
 * HOW IT WORKS:
 * 1. Pet moves according to behavioral model (speed, hiding, territory)
 * 2. Searchers move according to search strategy
 * 3. Detection happens when searcher is close enough to pet (Koopman POD)
 * 4. Self-return happens when pet's behavior leads it home
 * 5. Recovery rate EMERGES from these mechanics
 *
 * VALIDATION:
 * - Compare emergent recovery rates against Weiss 2012 data
 * - If rates don't match, adjust behavioral parameters (not outcomes)
 *
 * KEY TIMING VARIABLES:
 * - searchStartDelayHours: Time between pet lost and search begins
 * - searchHoursStart/End: Volunteers only search during these hours
 * - volunteerRampUpHours: Time to reach full volunteer count
 * - initialVolunteerPercent: Starting percentage of volunteers
 *
 * See: researchConfig.js for verified parameters
 *      displacement.js for behavioral movement parameters
 */

import { PetAgent } from './petBehavior';
import { SearcherAgent } from './searcherBehavior';
import { calculateDetectionProbability } from './detection';
import { seededRandom } from './utils';
import { getTerrainCache, resetTerrainCache, getTerrainStatus } from './terrain';

// Research-backed modules (for behavioral parameters, NOT pre-determined outcomes)
import { sampleDisplacement, getProbabilityZones } from './displacement.js';
import { processShelterIntake } from './shelter.js';

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
    // EMERGENT OUTCOME ARCHITECTURE
    // No pre-determined outcomes - recovery emerges from simulation mechanics
    // =========================================================================

    const species = this.config.petSpecies?.toLowerCase() || 'dog';

    // Sample displacement parameters for behavioral guidance (NOT a destination)
    // This informs how far the pet TENDS to roam, not where it WILL end up
    const lifestyle = this.config.isIndoorPet ? 'indoorOnly' : 'indoorOutdoor';
    this.displacementParams = sampleDisplacement(species, lifestyle, this.random);

    // Set pet's roaming tendency based on research (affects behavior, not destination)
    this.pet.setRoamingTendency(this.displacementParams.distanceMiles);

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

    // Outcome tracking - all outcomes are EMERGENT, not pre-determined
    this.outcome = null;
    this.foundAtMinute = null;
    this.foundBySearcher = null;
    this.wasTransported = false;
    this.transportedAtMinute = null;

    // Track if pet has been detected by a stranger (for potential stranger return)
    this.encounteredByStranger = false;
    this.strangerEncounterMinute = null;

    // Log initialization
    const simId = this.seed.toString().slice(-4);
    simLog(simId, `🎲 EMERGENT simulation initialized:`);
    simLog(simId, `   Roaming tendency: ${this.displacementParams.distanceMiles.toFixed(3)}mi`);
    simLog(simId, `   Outcomes will EMERGE from mechanics, not pre-determined`);
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
   * EMERGENT OUTCOME ARCHITECTURE:
   * - Pet moves according to behavioral model
   * - Searchers move according to search strategy
   * - Detection happens based on actual proximity (Koopman POD)
   * - Self-return happens when pet behavior leads it home
   * - ALL outcomes emerge from these mechanics
   */
  tick() {
    const currentHour = (this.config.startHourOfDay + Math.floor(this.minute / 60)) % 24;

    // =========================================================================
    // PET BEHAVIOR SIMULATION
    // =========================================================================

    // 1. Update pet internal state (energy, hunger)
    this.pet.updateInternalState(this.minute, currentHour);

    // 2. Check for pet state transitions
    this.pet.checkStateTransitions(this.minute, currentHour);

    // 3. Move pet according to current state
    if (this.pet.state !== 'SHELTERED') {
      this.pet.move(this.minute, currentHour);
    }

    // =========================================================================
    // EMERGENT RECOVERY CHECKS
    // =========================================================================

    // Check 1: Self-return (pet made it home on its own)
    if (!this.outcome) {
      const selfReturn = this.checkSelfReturn();
      if (selfReturn) {
        this.outcome = OUTCOMES.RETURNED_HOME;
        this.foundAtMinute = this.minute;
        this.logEvent('SELF_RETURN', {
          minute: this.minute,
          location: { lat: this.pet.lat, lng: this.pet.lng }
        });
        this.recordPositions();
        return;
      }
    }

    // Check 2: Shelter intake (pet entered a shelter zone)
    if (!this.outcome && this.pet.state === 'SHELTERED') {
      if (!this.wasTransported) {
        this.wasTransported = true;
        this.transportedAtMinute = this.minute;
        this.logEvent('SHELTER_INTAKE', { minute: this.minute });
      }

      // Check shelter reunion pathways
      const shelterResult = this.checkShelteredReunion();
      if (shelterResult) {
        this.outcome = shelterResult;
        this.foundAtMinute = this.minute;
        this.recordPositions();
        return;
      }
    }

    // Check 3: Stranger encounter (pet is visible and a stranger might help)
    if (!this.outcome && !this.encounteredByStranger) {
      const strangerEncounter = this.checkStrangerEncounter(currentHour);
      if (strangerEncounter) {
        this.encounteredByStranger = true;
        this.strangerEncounterMinute = this.minute;
        this.logEvent('STRANGER_ENCOUNTER', { minute: this.minute });
      }
    }

    // Check 4: Stranger return (stranger who found pet contacts owner)
    if (!this.outcome && this.encounteredByStranger) {
      const strangerReturn = this.checkStrangerReturn();
      if (strangerReturn) {
        this.outcome = OUTCOMES.FOUND_VIA_SOCIAL;
        this.foundAtMinute = this.minute;
        this.logEvent('STRANGER_RETURN', { minute: this.minute });
        this.recordPositions();
        return;
      }
    }

    // =========================================================================
    // SEARCHER MOVEMENT AND DETECTION
    // =========================================================================

    const searchActive = this.isSearchActive() && this.isWithinSearchHours(currentHour);
    const activeSearcherCount = searchActive ? this.getActiveSearcherCount() : 0;

    if (searchActive && !this.outcome) {
      for (let i = 0; i < activeSearcherCount; i++) {
        const searcher = this.searchers[i];
        searcher.move(this.minute, currentHour);
        searcher.updateFatigue(this.minute);

        // Check detection against ACTUAL pet position
        const detected = this.checkDetection(searcher, currentHour);
        if (detected) {
          this.outcome = OUTCOMES.FOUND_BY_SEARCHER;
          this.foundAtMinute = this.minute;
          this.foundBySearcher = i;
          this.logEvent('FOUND_BY_SEARCHER', {
            minute: this.minute,
            searcherId: i,
            location: { lat: this.pet.lat, lng: this.pet.lng }
          });
          this.recordPositions();
          return;
        }
      }
    }

    // Record positions for playback
    this.recordPositions();
  }

  /**
   * Check if pet has returned home (EMERGENT self-return)
   *
   * Pet returns home when:
   * - It has first moved away from home (at least 0.05 miles)
   * - It's within a small radius of home (physically there)
   * - AND it has motivation to stay (hungry, tired, or familiar territory pull)
   *
   * FIXED: We now use a DECAYING probability model to prevent compounding.
   * Each home visit reduces the stay probability, modeling that a pet which
   * has already left home multiple times is less likely to settle.
   *
   * Target rates (Weiss 2012): Dogs 15%, Cats 59% self-return
   */
  checkSelfReturn() {
    const distanceFromHome = this.calculateDistance(
      this.pet.lat, this.pet.lng,
      this.pet.homeLat, this.pet.homeLng
    );

    // Track maximum distance from home to prevent immediate "return"
    if (this.maxDistanceFromHome === undefined) {
      this.maxDistanceFromHome = 0;
    }
    this.maxDistanceFromHome = Math.max(this.maxDistanceFromHome, distanceFromHome);

    // Pet must have moved away at least 0.05 miles before it can "return"
    // This prevents immediate "returned home" on first tick when pet starts at home
    if (this.maxDistanceFromHome < 0.05) {
      return false;
    }

    // Pet must be very close to home (within ~50 meters = 0.03 miles)
    const homeRadius = 0.03;
    const isInHomeZone = distanceFromHome <= homeRadius;

    // Track whether pet was in home zone last tick
    const wasInHomeZone = this.wasInHomeZone || false;
    this.wasInHomeZone = isInHomeZone;

    // Not in home zone
    if (!isInHomeZone) {
      return false;
    }

    // Only check on FIRST tick of each visit (not every tick while in zone)
    if (wasInHomeZone) {
      return false;
    }

    // Initialize home visit counter
    if (this.homeVisitCount === undefined) {
      this.homeVisitCount = 0;
    }
    this.homeVisitCount++;

    // DECAYING PROBABILITY MODEL
    // First visit: full probability based on pet state
    // Subsequent visits: exponentially decaying (pet that left once is likely to leave again)
    //
    // Base probability calibrated to match Weiss 2012:
    // - Dogs: 15% overall self-return (lower base, more active)
    // - Cats: 59% overall self-return (higher base, more territorial)
    const species = this.config.petSpecies?.toLowerCase() || 'dog';
    const baseStayProb = species === 'cat' ? 0.45 : 0.12;

    // Motivation modifiers: hungry/tired pets more likely to stay
    const hungerBoost = this.pet.hunger * 0.15;
    const fatigueBoost = (1 - this.pet.energy) * 0.10;

    // Decay factor: each previous visit that didn't result in staying
    // reduces probability by 60% (pet is "committed" to being lost)
    const decayFactor = Math.pow(0.4, this.homeVisitCount - 1);

    const stayProbability = (baseStayProb + hungerBoost + fatigueBoost) * decayFactor;

    return this.random() < stayProbability;
  }

  /**
   * Check if a stranger encounters the pet (EMERGENT stranger encounter)
   *
   * Strangers can encounter the pet when:
   * - Pet is in an active/visible state (not hiding)
   * - It's during daytime hours (more people around)
   * - Pet is in a populated area
   *
   * CALIBRATED to match Weiss 2012 stranger recovery rates:
   * - Dogs: 26% found by strangers
   * - Cats: ~9% found by strangers (included in "other" category)
   *
   * Working backwards:
   * - ~50% of encounters lead to successful return (collar + social)
   * - Over 72 hours with ~350 effective visibility ticks
   * - Target ~50% encounter rate for dogs → 0.2% base rate
   * - Cats hide more, so lower effective rate
   */
  checkStrangerEncounter(currentHour) {
    // Pet must be visible (not hiding)
    if (this.pet.state === 'HIDING' || this.pet.state === 'RESTING') {
      return false;
    }

    // Time of day affects pedestrian density
    // Peak: morning commute, lunch, evening commute
    // Low: early morning, late night
    let timeMultiplier;
    if (currentHour >= 7 && currentHour < 9) {
      timeMultiplier = 1.2;  // Morning commute
    } else if (currentHour >= 11 && currentHour < 14) {
      timeMultiplier = 1.0;  // Lunch/midday
    } else if (currentHour >= 17 && currentHour < 19) {
      timeMultiplier = 1.5;  // Evening - people walking dogs, coming home
    } else if (currentHour >= 9 && currentHour < 17) {
      timeMultiplier = 0.6;  // Workday - fewer people around
    } else if (currentHour >= 19 && currentHour < 22) {
      timeMultiplier = 0.4;  // Evening wind-down
    } else {
      timeMultiplier = 0.05; // Night (10pm-7am) - very few people
    }

    // CALIBRATED base rate: 0.2% per 5-minute tick (was 1%, now 5x lower)
    // This produces ~50% encounter over 72 hours when pet is visible
    const baseEncounterRate = 0.002;

    // Terrain affects population density
    const terrainMultiplier = {
      'urban': 2.0,      // Dense city - lots of foot traffic
      'suburban': 1.0,   // Baseline
      'rural': 0.3,      // Few people around
      'wooded': 0.15,    // Very isolated
    }[this.config.terrainType?.toLowerCase()] || 1.0;

    // Friendly pets are more likely to be noticed and approached
    const personalityMultiplier = this.config.petPersonality === 'friendly' ? 1.5
      : this.config.petPersonality === 'timid' ? 0.4
      : 1.0;

    // Dogs more visible than cats (size + behavior)
    const speciesMultiplier = this.config.petSpecies?.toLowerCase() === 'dog' ? 1.3 : 0.5;

    const encounterProbability = baseEncounterRate * timeMultiplier * terrainMultiplier * personalityMultiplier * speciesMultiplier;

    return this.random() < encounterProbability;
  }

  /**
   * Check if a stranger who found the pet returns it (EMERGENT stranger return)
   *
   * After a stranger encounter, there's a chance they:
   * - Check collar/tags and call owner
   * - Post on social media
   * - Take to shelter
   * - Keep the pet or do nothing
   */
  checkStrangerReturn() {
    if (!this.encounteredByStranger) return false;

    // Only check once per simulated hour (not every 5-minute tick)
    if (this.minute % 60 !== 0) return false;

    const hoursSinceEncounter = (this.minute - this.strangerEncounterMinute) / 60;

    // Collar/tag return is fastest (within hours)
    if (this.config.hasCollar && hoursSinceEncounter >= 1 && hoursSinceEncounter < 24) {
      const collarReturnProb = 0.15; // 15% chance per hour
      if (this.random() < collarReturnProb) return true;
    }

    // Social media takes longer (12-72 hours)
    if (hoursSinceEncounter >= 12) {
      const socialMediaProb = 0.02; // 2% chance per hour
      if (this.random() < socialMediaProb) return true;
    }

    return false;
  }

  /**
   * Check if a searcher detects the pet at its ACTUAL position
   *
   * Uses Koopman POD detection model with SAR-derived sweep widths.
   * Detection probability depends on actual distance, pet state, terrain, etc.
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
    // Truncate paths to foundAtMinute if pet was found (saves memory and matches reality)
    let effectivePetPath = this.petPath;
    let effectiveSearcherPaths = this.searcherPaths;

    if (this.foundAtMinute != null && !this.outcome?.startsWith('TIMEOUT')) {
      // Find the index where the pet was found
      const foundIndex = this.petPath.findIndex(p => p.minute >= this.foundAtMinute);
      if (foundIndex > 0) {
        effectivePetPath = this.petPath.slice(0, foundIndex + 1);
        effectiveSearcherPaths = this.searcherPaths.map(s => ({
          ...s,
          path: s.path.slice(0, foundIndex + 1)
        }));
      }
    }

    // Calculate total distances from truncated paths
    const petDistance = this.calculateTotalDistance(effectivePetPath);
    const searcherDistance = effectiveSearcherPaths.reduce((total, s) => {
      return total + this.calculateTotalDistance(s.path);
    }, 0);

    // Get terrain data for display
    const terrain = getTerrainCache();
    const terrainData = terrain.loaded ? {
      barriers: terrain.getBarriersForDisplay(),
      zones: terrain.getZonesForDisplay(),
    } : null;

    // Use actual pet position for found location (emergent outcome)
    const wasFound = this.outcome && !this.outcome.startsWith('TIMEOUT');
    const lastPosition = effectivePetPath[effectivePetPath.length - 1];
    const foundLat = wasFound ? lastPosition?.lat : null;
    const foundLng = wasFound ? lastPosition?.lng : null;

    // Get terrain status for warnings
    const terrainStatus = getTerrainStatus();

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
      petPath: effectivePetPath,
      searcherPaths: effectiveSearcherPaths,
      events: this.events,
      terrain: terrainData,
      terrainStatus: terrainStatus,  // Include status for UI warnings

      // Behavioral parameters (for reference, NOT pre-determined outcomes)
      behavioralParams: {
        roamingTendencyMiles: this.displacementParams.distanceMiles,
        roamingTendencyMeters: this.displacementParams.distance,
        distributionParams: this.displacementParams.params,
      },

      // Warnings for user
      warnings: [
        ...(terrainStatus.warning ? [terrainStatus.warning] : []),
      ],
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
