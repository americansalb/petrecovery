/**
 * Emergent Monte Carlo Simulation Engine
 *
 * This is the main simulation loop that orchestrates:
 * - Pet agent updates (physiology, fear, state transitions, movement)
 * - Searcher agent updates
 * - Interaction checks (pet-searcher, pet-stranger, pet-environment)
 * - Outcome determination
 *
 * DESIGN PRINCIPLE: No outcome probabilities are hardcoded.
 * All outcomes emerge from the interaction of agents and environment.
 */

import { PetAgent } from './petAgent.js';
import { OutcomeTracker, OUTCOME } from './outcomes.js';
import {
  BEHAVIOR_STATE,
  BEHAVIORAL_PARAMS,
  SPECIES,
} from './config.js';
import { seededRandom } from '../utils.js';

// =============================================================================
// SIMULATION ENGINE
// =============================================================================

export class EmergentSimulationEngine {
  constructor(petConfig, searcherConfig, environmentConfig, seed = null) {
    // Store configs
    this.petConfig = petConfig;
    this.searcherConfig = searcherConfig;
    this.environmentConfig = environmentConfig;

    // Initialize random number generator
    this.seed = seed ?? Math.floor(Math.random() * 1000000);
    this.random = seededRandom(this.seed);

    // Initialize pet agent
    this.pet = new PetAgent(petConfig, this.random);

    // Initialize outcome tracker
    this.outcomes = new OutcomeTracker();

    // Initialize environment (simplified for now)
    this.environment = this.initializeEnvironment(environmentConfig);

    // Simulation state
    this.currentMinute = 0;
    this.maxMinutes = environmentConfig.maxSimulationHours * 60;
    this.timeStepMinutes = environmentConfig.timeStepMinutes || 5;

    // Search timing
    this.searchStartMinute = (searcherConfig.searchStartDelayHours || 2) * 60;
    this.searchHoursStart = searcherConfig.searchHoursStart || 7;
    this.searchHoursEnd = searcherConfig.searchHoursEnd || 21;

    // Path recording
    this.petPath = [];
    this.events = [];
  }

  /**
   * Initialize environment (simplified placeholder)
   * In full implementation, this would load terrain from OSM
   */
  initializeEnvironment(config) {
    return {
      terrainType: config.terrainType,
      searchRadiusMiles: config.searchRadiusMiles,
      timeStepMinutes: config.timeStepMinutes || 5,

      // Placeholder methods - would be replaced with real terrain data
      getPassabilityAt: (lat, lng) => {
        // Simplified: assume passable everywhere
        return 0.9;
      },

      getConcealmentAt: (lat, lng) => {
        // Simplified: moderate concealment everywhere
        return 0.5;
      },

      getHumanDensityAt: (lat, lng, hour) => {
        // Simplified: varies by time of day
        const baseByTerrain = {
          URBAN: 0.003,
          SUBURBAN: 0.001,
          RURAL: 0.0002,
          WOODED: 0.0001,
        };

        const base = baseByTerrain[config.terrainType] || 0.001;

        // Time of day modifier
        let timeMod = 1.0;
        if (hour >= 7 && hour <= 9) timeMod = 1.5;     // Morning rush
        else if (hour >= 11 && hour <= 13) timeMod = 1.2; // Lunch
        else if (hour >= 17 && hour <= 19) timeMod = 1.8; // Evening rush
        else if (hour >= 22 || hour <= 5) timeMod = 0.1;  // Night

        return base * timeMod;
      },

      getBestTerrainDirection: (lat, lng) => {
        // Simplified: no preference
        return null;
      },

      getTrafficHazardAt: (lat, lng, hour) => {
        // Simplified: based on terrain and time
        const baseByTerrain = {
          URBAN: 0.0005,
          SUBURBAN: 0.0002,
          RURAL: 0.00005,
          WOODED: 0.00001,
        };

        const base = baseByTerrain[config.terrainType] || 0.0002;

        // Rush hour is more dangerous
        let timeMod = 1.0;
        if (hour >= 7 && hour <= 9) timeMod = 2.0;
        else if (hour >= 17 && hour <= 19) timeMod = 2.0;
        else if (hour >= 22 || hour <= 5) timeMod = 0.3;

        return base * timeMod;
      },
    };
  }

  /**
   * Run the simulation
   */
  run() {
    // Record initial position
    this.recordPosition();

    // Main simulation loop
    while (this.currentMinute < this.maxMinutes && !this.outcomes.isTerminal()) {
      this.tick();
      this.currentMinute += this.timeStepMinutes;
    }

    // Set final outcome if not already set
    if (!this.outcomes.outcome) {
      this.outcomes.setOutcome('STILL_MISSING', this.currentMinute);
    }

    return this.getResults();
  }

  /**
   * Execute one simulation tick
   */
  tick() {
    const currentHour = this.getCurrentHour();

    // 1. Update pet physiology
    this.pet.updatePhysiology(this.timeStepMinutes, this.environment);

    // 2. Update pet fear
    this.pet.updateFear(this.timeStepMinutes, this.currentMinute);

    // 3. Check pet state transitions
    this.pet.checkStateTransitions(this.currentMinute, currentHour, this.environment);

    // 4. Move pet
    this.pet.move(this.timeStepMinutes, this.currentMinute, this.environment);

    // 5. Record position
    this.recordPosition();

    // 6. Check for self-return
    if (this.checkSelfReturn()) {
      return;
    }

    // 7. Check environment hazards
    if (this.checkEnvironmentHazards(currentHour)) {
      return;
    }

    // 8. Check physiological death
    if (this.checkPhysiologicalDeath()) {
      return;
    }

    // 9. Check stranger encounters
    if (this.checkStrangerEncounter(currentHour)) {
      return;
    }

    // 10. Check searcher interactions (if search has started)
    if (this.currentMinute >= this.searchStartMinute) {
      if (this.isWithinSearchHours(currentHour)) {
        if (this.checkSearcherDetection(currentHour)) {
          return;
        }
      }
    }
  }

  /**
   * Get current hour of day
   */
  getCurrentHour() {
    // Assuming simulation starts at time specified in escape datetime
    // For simplicity, using a fixed start hour (can be enhanced)
    const startHour = 12;  // Default: noon
    const elapsedHours = Math.floor(this.currentMinute / 60);
    return (startHour + elapsedHours) % 24;
  }

  /**
   * Check if within search hours
   */
  isWithinSearchHours(currentHour) {
    return currentHour >= this.searchHoursStart && currentHour < this.searchHoursEnd;
  }

  /**
   * Record current pet position
   */
  recordPosition() {
    this.petPath.push({
      minute: this.currentMinute,
      lat: this.pet.lat,
      lng: this.pet.lng,
      state: this.pet.behaviorState,
      fear: this.pet.fear,
      energy: this.pet.energy,
      hunger: this.pet.hunger,
      thirst: this.pet.thirst,
    });
  }

  /**
   * Log an event
   */
  logEvent(type, data) {
    this.events.push({
      minute: this.currentMinute,
      type,
      data,
    });
  }

  // ===========================================================================
  // OUTCOME CHECKS
  // ===========================================================================

  /**
   * Check for self-return
   * Pet must: reach home, recognize it, and decide to stay
   */
  checkSelfReturn() {
    // Must be in TRAVELING state to return home
    // (FORAGING near home doesn't count as "returning")
    if (this.pet.behaviorState !== BEHAVIOR_STATE.TRAVELING) {
      return false;
    }

    // Check if at home
    if (!this.pet.isAtHome()) {
      return false;
    }

    // Must have been away first
    if (this.pet.maxDistanceFromHome < 0.03) {  // Less than ~50m doesn't count
      return false;
    }

    // Calculate stay probability based on pet's internal state
    const stayProb = this.pet.calculateStayProbability();

    if (this.random() < stayProb) {
      this.outcomes.setOutcome('REUNITED_SELF_RETURN', this.currentMinute, {
        distanceTraveled: this.pet.totalDistanceTraveled,
        maxDistanceFromHome: this.pet.maxDistanceFromHome,
      });

      this.logEvent('SELF_RETURN', {
        lat: this.pet.lat,
        lng: this.pet.lng,
        stayProbability: stayProb,
      });

      return true;
    }

    return false;
  }

  /**
   * Check for environment hazards (traffic, etc.)
   */
  checkEnvironmentHazards(currentHour) {
    // Traffic hazard
    const trafficHazard = this.environment.getTrafficHazardAt(
      this.pet.lat, this.pet.lng, currentHour
    );

    // Higher risk when fleeing (less aware)
    const awarenessMod = this.pet.behaviorState === BEHAVIOR_STATE.FLEEING ? 2.0 : 1.0;

    // Size affects survival
    const sizeMod = this.pet.sizeModifiers.predator_vulnerability;

    const deathProb = trafficHazard * awarenessMod * sizeMod;

    if (this.random() < deathProb) {
      this.outcomes.setOutcome('DECEASED_TRAFFIC', this.currentMinute, {
        lat: this.pet.lat,
        lng: this.pet.lng,
      });

      this.logEvent('TRAFFIC_DEATH', {
        lat: this.pet.lat,
        lng: this.pet.lng,
      });

      return true;
    }

    return false;
  }

  /**
   * Check for physiological death (dehydration, starvation)
   */
  checkPhysiologicalDeath() {
    const params = BEHAVIORAL_PARAMS;

    // Track consecutive ticks at max thirst/hunger
    if (this.pet.thirst >= 0.99) {
      this.outcomes.consecutiveTicksAtMaxThirst++;
    } else {
      this.outcomes.consecutiveTicksAtMaxThirst = 0;
    }

    if (this.pet.hunger >= 0.99) {
      this.outcomes.consecutiveTicksAtMaxHunger++;
    } else {
      this.outcomes.consecutiveTicksAtMaxHunger = 0;
    }

    // Death from dehydration: 48 hours at max thirst
    const dehydrationThresholdTicks = (48 * 60) / this.timeStepMinutes;
    if (this.outcomes.consecutiveTicksAtMaxThirst >= dehydrationThresholdTicks) {
      this.outcomes.setOutcome('DECEASED_DEHYDRATION', this.currentMinute);
      this.logEvent('DEHYDRATION_DEATH', {});
      return true;
    }

    // Death from starvation: 7 days at max hunger
    const starvationThresholdTicks = (7 * 24 * 60) / this.timeStepMinutes;
    if (this.outcomes.consecutiveTicksAtMaxHunger >= starvationThresholdTicks) {
      this.outcomes.setOutcome('DECEASED_STARVATION', this.currentMinute);
      this.logEvent('STARVATION_DEATH', {});
      return true;
    }

    return false;
  }

  /**
   * Check for stranger encounter
   * Probability based on: location, time, pet visibility
   */
  checkStrangerEncounter(currentHour) {
    // Pet must be somewhat visible
    const visibility = this.pet.getVisibility(this.environment, currentHour);

    if (visibility < 0.05) {
      return false;  // Too hidden for strangers to see
    }

    // Human density at location
    const humanDensity = this.environment.getHumanDensityAt(
      this.pet.lat, this.pet.lng, currentHour
    );

    // Encounter probability
    const encounterProb = humanDensity * visibility * this.timeStepMinutes;

    if (this.random() < encounterProb) {
      // Stranger encountered the pet!
      return this.handleStrangerEncounter(currentHour);
    }

    return false;
  }

  /**
   * Handle a stranger encounter
   * Determines what the stranger does and what the pet does
   */
  handleStrangerEncounter(currentHour) {
    const tempMods = this.pet.temperamentModifiers;

    // Does the pet approach the stranger?
    const approachProb = tempMods.stranger_approach_prob * (1 - this.pet.fear);

    if (this.random() < approachProb) {
      // Pet approaches - capture likely
      const captureProb = tempMods.stranger_capture_success;

      if (this.random() < captureProb) {
        // Stranger captured the pet
        return this.handleStrangerCapture();
      }
    }

    // Pet didn't approach or escaped
    // This counts as a sighting
    this.outcomes.recordSighting(
      this.pet.lat, this.pet.lng, this.currentMinute,
      'MEDIUM', 'STRANGER'
    );

    // Will the stranger REPORT the sighting?
    // Higher visibility score = more likely they recognize "this is someone's lost pet"
    const visibilityScore = this.searcherConfig.visibilityScore || 0.1;

    // Reporting probability based on:
    // - Base 20% of people will post about a loose pet anyway
    // - +visibility_score * 60% if owner has posted flyers/social media
    // - Collar increases likelihood (+30%)
    const baseReportProb = 0.20;
    const visibilityBoost = visibilityScore * 0.60;
    const collarBoost = this.pet.hasCollar ? 0.30 : 0;
    const reportProb = Math.min(1, baseReportProb + visibilityBoost + collarBoost);

    if (this.random() < reportProb) {
      // Sighting is reported to search team / posted online
      this.outcomes.recordReportedSighting(
        this.pet.lat, this.pet.lng, this.currentMinute,
        'STRANGER', visibilityScore
      );

      this.logEvent('SIGHTING_REPORTED', {
        lat: this.pet.lat,
        lng: this.pet.lng,
        source: 'STRANGER',
        reportProbability: reportProb,
      });
    }

    // Pet may flee from the encounter
    const fleeProb = tempMods.flee_from_searcher_prob * this.pet.fear;
    if (this.random() < fleeProb) {
      // Spike fear and flee
      this.pet.spikeFear(this.pet.lat, this.pet.lng, this.currentMinute, 0.5);
      this.pet.transitionTo(BEHAVIOR_STATE.FLEEING, this.currentMinute);

      this.logEvent('PET_FLED_FROM_STRANGER', {
        lat: this.pet.lat,
        lng: this.pet.lng,
        fearLevel: this.pet.fear,
      });
    }

    this.logEvent('STRANGER_ENCOUNTER_ESCAPE', {
      lat: this.pet.lat,
      lng: this.pet.lng,
      wasReported: this.random() < reportProb,
    });

    return false;
  }

  /**
   * Handle stranger capture - determine what happens next
   *
   * VISIBILITY SCORE EFFECT:
   * If owner posted on social media/flyers, strangers are more likely to:
   * 1. Recognize the pet and contact owner directly
   * 2. See owner's post when they post "found pet"
   *
   * visibility_score comes from searcher config and is based on:
   * - Posted on social media (+25%)
   * - Posted flyers (+20%)
   * - Contacted shelters (+15%)
   * - Listed on pet recovery platform (+15%)
   */
  handleStrangerCapture() {
    // Get visibility score from searcher config
    const visibilityScore = this.searcherConfig.visibilityScore || 0.1;

    // If pet has visible tags, high chance of direct contact
    if (this.pet.hasVisibleTags) {
      const callsOwner = this.random() < 0.8;  // 80% call owner

      if (callsOwner) {
        this.outcomes.setOutcome('REUNITED_STRANGER_DIRECT', this.currentMinute, {
          lat: this.pet.lat,
          lng: this.pet.lng,
          method: 'tags',
        });

        this.logEvent('STRANGER_CALLED_OWNER', {
          lat: this.pet.lat,
          lng: this.pet.lng,
        });

        return true;
      }
    }

    // No tags or didn't call - what happens?
    // Visibility score affects whether stranger recognizes pet from postings
    const recognizedFromPostings = this.random() < visibilityScore;

    if (recognizedFromPostings) {
      // Stranger saw owner's social media post / flyer
      this.outcomes.setOutcome('REUNITED_STRANGER_DIRECT', this.currentMinute, {
        lat: this.pet.lat,
        lng: this.pet.lng,
        method: 'social_media',
      });

      this.logEvent('STRANGER_RECOGNIZED_FROM_POSTING', {
        visibilityScore,
      });

      return true;
    }

    // Stranger didn't recognize pet - what do they do?
    const roll = this.random();

    if (roll < 0.4) {
      // Takes to shelter
      this.outcomes.isAtShelter = true;
      this.outcomes.shelterIntakeMinute = this.currentMinute;

      // Check microchip immediately (shelters scan on intake)
      return this.handleShelterIntake();

    } else if (roll < 0.7) {
      // Posts online / keeps temporarily
      this.outcomes.isWithStranger = true;
      this.outcomes.strangerCaptureMinute = this.currentMinute;

      // Does owner see the stranger's "found pet" post?
      // Higher visibility = higher chance owner is monitoring platforms
      const ownerSeesPost = this.random() < (0.3 + visibilityScore * 0.5);

      if (ownerSeesPost) {
        this.outcomes.setOutcome('REUNITED_STRANGER_POST', this.currentMinute, {
          lat: this.pet.lat,
          lng: this.pet.lng,
        });

        this.logEvent('OWNER_SAW_FOUND_POST', { visibilityScore });

        return true;
      } else {
        // Owner didn't see post - pet stays with stranger
        this.outcomes.setOutcome('WITH_STRANGER_PENDING', this.currentMinute, {
          lat: this.pet.lat,
          lng: this.pet.lng,
        });

        this.logEvent('STRANGER_POSTED_BUT_NO_MATCH', {});

        return true;
      }

    } else {
      // Keeps pet (no contact attempt)
      this.outcomes.setOutcome('ADOPTED_BY_FINDER', this.currentMinute, {
        lat: this.pet.lat,
        lng: this.pet.lng,
      });

      this.logEvent('STRANGER_KEPT_PET', {});

      return true;
    }
  }

  /**
   * Handle shelter intake
   */
  handleShelterIntake() {
    // Check microchip
    if (this.pet.hasMicrochip && this.pet.microchipRegistered) {
      // Shelter scans and finds registered chip
      const scanDelay = BEHAVIORAL_PARAMS.shelter_scan_delay_hours * 60;

      // For simplicity, assume scan happens and reunion occurs
      // (full version would model delay and owner response)
      this.outcomes.setOutcome('REUNITED_SHELTER', this.currentMinute + scanDelay, {
        lat: this.pet.lat,
        lng: this.pet.lng,
        method: 'microchip',
      });

      this.logEvent('SHELTER_MICROCHIP_SCAN', {});

      return true;
    }

    // No microchip or not registered - depends on owner checking shelter
    // For now, set intermediate outcome
    this.outcomes.setOutcome('AT_SHELTER_PENDING', this.currentMinute, {
      lat: this.pet.lat,
      lng: this.pet.lng,
    });

    this.logEvent('SHELTER_INTAKE_NO_CHIP', {});

    return true;
  }

  /**
   * Check for searcher detection
   */
  checkSearcherDetection(currentHour) {
    // Simplified: use config's searcher count
    const searcherCount = this.searcherConfig.searcherCount || 1;

    // For each searcher, check detection
    for (let i = 0; i < searcherCount; i++) {
      if (this.checkSingleSearcherDetection(i, currentHour)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a single searcher detects the pet
   *
   * SIGHTING FOCUS MECHANIC:
   * If there's a reported sighting, searchers focus on that area.
   * Detection probability is boosted if pet is near a reported sighting location.
   */
  checkSingleSearcherDetection(searcherId, currentHour) {
    // Base detection probability per tick
    let baseDetectionRate = 0.0001;  // Very low per tick

    // Check if there's a reported sighting to focus on
    const focusLocation = this.outcomes.getSearchFocusLocation();

    if (focusLocation) {
      // Calculate distance from pet to last reported sighting
      const distToSighting = this.calculateDistance(
        this.pet.lat, this.pet.lng,
        focusLocation.lat, focusLocation.lng
      );

      // Time since sighting (minutes)
      const timeSinceSighting = this.currentMinute - focusLocation.minute;

      // Sighting focus boost decays over time (24 hours = 1440 minutes)
      // Max boost is 10x if pet is within 0.1 miles of sighting location
      if (distToSighting < 0.5) {  // Within 0.5 miles of reported sighting
        const proximityBoost = Math.max(1, 10 - (distToSighting * 18));  // 10x at 0, 1x at 0.5mi
        const timeDecay = Math.exp(-timeSinceSighting / 720);  // Half-life of 12 hours
        const sightingBoost = proximityBoost * timeDecay;

        baseDetectionRate *= sightingBoost;

        this.logEvent('SEARCH_FOCUS_BOOST', {
          distToSighting,
          timeSinceSighting,
          sightingBoost,
        });
      }
    }

    // Pet visibility
    const visibility = this.pet.getVisibility(this.environment, currentHour);

    // Terrain modifier
    const terrainMod = {
      URBAN: 0.5,
      SUBURBAN: 1.0,
      RURAL: 1.5,
      WOODED: 0.3,
    }[this.environmentConfig.terrainType] || 1.0;

    // Light modifier
    const isNight = currentHour < 6 || currentHour > 20;
    const lightMod = isNight ? 0.2 : 1.0;

    // Detection probability
    const detectionProb = baseDetectionRate * visibility * terrainMod * lightMod;

    if (this.random() < detectionProb) {
      // Detected! Can we capture?
      return this.handleSearcherDetection(searcherId, currentHour);
    }

    return false;
  }

  /**
   * Calculate distance between two points in miles (Haversine formula)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959;  // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Handle searcher detection
   */
  handleSearcherDetection(searcherId, currentHour) {
    const tempMods = this.pet.temperamentModifiers;

    // Record sighting
    this.outcomes.recordSighting(
      this.pet.lat, this.pet.lng, this.currentMinute,
      'HIGH', 'SEARCHER'
    );

    // Does pet approach or flee?
    // For owner (searcherId = 0), use recall training
    const isOwner = searcherId === 0;

    let approachProb;
    if (isOwner) {
      // Owner calling - use recall training
      approachProb = this.pet.recallTraining * (1 - this.pet.fear * 0.5);
    } else {
      // Stranger searcher
      approachProb = tempMods.stranger_approach_prob * (1 - this.pet.fear);
    }

    // Gregarious pets are more likely to approach
    if (this.random() < approachProb) {
      // Pet approached - capture!
      const outcomeCode = isOwner ? 'REUNITED_OWNER_SEARCH' : 'REUNITED_SEARCH_TEAM';

      this.outcomes.setOutcome(outcomeCode, this.currentMinute, {
        lat: this.pet.lat,
        lng: this.pet.lng,
        searcherId,
      });

      this.logEvent('SEARCHER_CAPTURE', {
        lat: this.pet.lat,
        lng: this.pet.lng,
        searcherId,
        isOwner,
      });

      return true;
    }

    // Pet fled
    const fleeProb = tempMods.flee_from_searcher_prob;
    if (this.random() < fleeProb) {
      this.pet.spikeFear(this.pet.lat, this.pet.lng, this.currentMinute, 0.3);
      this.pet.transitionTo(BEHAVIOR_STATE.FLEEING, this.currentMinute);
    }

    this.logEvent('SEARCHER_SIGHTING_ESCAPED', {
      lat: this.pet.lat,
      lng: this.pet.lng,
      searcherId,
    });

    // Update sighting to confirmed
    this.outcomes.setOutcome('SIGHTED_NOT_CAPTURED', this.currentMinute, {
      lat: this.pet.lat,
      lng: this.pet.lng,
    });

    return false;  // Not terminal - search continues
  }

  // ===========================================================================
  // RESULTS
  // ===========================================================================

  /**
   * Get simulation results
   */
  getResults() {
    const outcomeSummary = this.outcomes.getSummary();

    // Calculate displacement statistics
    const displacements = this.petPath.map(p => {
      const R = 3959;
      const dLat = (p.lat - this.pet.homeLat) * Math.PI / 180;
      const dLng = (p.lng - this.pet.homeLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(this.pet.homeLat * Math.PI / 180) * Math.cos(p.lat * Math.PI / 180) *
                Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    });

    const maxDisplacement = Math.max(...displacements);
    const finalDisplacement = displacements[displacements.length - 1];

    // Truncate path at outcome time
    let effectivePath = this.petPath;
    if (outcomeSummary.outcomeMinute !== null) {
      const outcomeIndex = this.petPath.findIndex(p => p.minute >= outcomeSummary.outcomeMinute);
      if (outcomeIndex > 0) {
        effectivePath = this.petPath.slice(0, outcomeIndex + 1);
      }
    }

    return {
      seed: this.seed,

      // Outcome
      outcome: outcomeSummary.outcome,
      outcomeCategory: outcomeSummary.category,
      outcomeDescription: outcomeSummary.description,
      outcomeMinute: outcomeSummary.outcomeMinute,
      outcomeHours: outcomeSummary.outcomeHours,
      outcomeDetails: outcomeSummary.outcomeDetails,

      // Displacement
      maxDisplacementMiles: maxDisplacement,
      finalDisplacementMiles: finalDisplacement,
      totalDistanceTraveled: this.pet.totalDistanceTraveled,

      // Pet final state
      finalPetState: this.pet.behaviorState,
      finalEnergy: this.pet.energy,
      finalHunger: this.pet.hunger,
      finalThirst: this.pet.thirst,
      finalFear: this.pet.fear,

      // State transitions
      stateTransitionCount: this.pet.stateTransitionCount,

      // Sightings
      sightings: outcomeSummary.sightings,
      reportedSightings: this.outcomes.reportedSightings,
      sightingCount: outcomeSummary.sightingCount,
      reportedSightingCount: this.outcomes.reportedSightings.length,

      // Path (for visualization)
      petPath: effectivePath,
      events: this.events,

      // Config info (for analysis)
      species: this.pet.species,
      temperament: this.pet.temperament,
      isIndoorOnly: this.pet.isIndoorOnly,
    };
  }
}

// =============================================================================
// BATCH RUNNER
// =============================================================================

/**
 * Run a batch of simulations
 */
export async function runEmergentBatch(petConfig, searcherConfig, environmentConfig, count, onProgress) {
  const results = [];
  const outcomeCounts = {};
  let totalTimeToFind = 0;
  let foundCount = 0;
  const displacements = [];

  const startTime = Date.now();

  for (let i = 0; i < count; i++) {
    const engine = new EmergentSimulationEngine(petConfig, searcherConfig, environmentConfig);
    const result = engine.run();

    results.push(result);

    // Aggregate outcomes
    outcomeCounts[result.outcome] = (outcomeCounts[result.outcome] || 0) + 1;

    // Track time to find
    if (result.outcomeCategory === 'REUNITED') {
      totalTimeToFind += result.outcomeMinute;
      foundCount++;
    }

    // Track displacement
    displacements.push(result.maxDisplacementMiles);

    // Progress callback
    if (onProgress) {
      onProgress(i + 1, count);
    }

    // Yield to prevent blocking
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Calculate aggregate statistics
  displacements.sort((a, b) => a - b);
  const medianDisplacement = displacements[Math.floor(displacements.length / 2)];

  // Recovery rate
  const reunionCount = Object.entries(outcomeCounts)
    .filter(([k, v]) => k.startsWith('REUNITED'))
    .reduce((sum, [k, v]) => sum + v, 0);

  const selfReturnCount = outcomeCounts['REUNITED_SELF_RETURN'] || 0;

  const totalTime = (Date.now() - startTime) / 1000;

  return {
    totalRuns: count,
    executionTimeSeconds: totalTime,

    // Recovery statistics
    recoveryRate: reunionCount / count,
    selfReturnRate: selfReturnCount / count,
    avgTimeToFindMinutes: foundCount > 0 ? totalTimeToFind / foundCount : null,

    // Displacement
    displacementMedian: medianDisplacement,
    displacementMax: Math.max(...displacements),

    // Outcome distribution
    outcomeCounts,
    outcomeRates: Object.fromEntries(
      Object.entries(outcomeCounts).map(([k, v]) => [k, v / count])
    ),

    // For validation
    species: petConfig.species,
    isIndoorOnly: petConfig.isIndoorOnly,

    // Individual results (for detailed analysis)
    results,
  };
}
