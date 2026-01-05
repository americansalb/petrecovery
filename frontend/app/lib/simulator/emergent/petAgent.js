/**
 * Emergent Pet Agent
 *
 * A pet agent with internal state that drives behavior.
 * All outcomes emerge from the interaction of:
 *   - Physiological state (energy, hunger, thirst)
 *   - Psychological state (fear)
 *   - Environmental factors
 *   - Behavioral mechanics
 *
 * NO outcome probabilities are encoded. The simulation does not know
 * what the "right answer" is. Outcomes emerge from mechanics.
 */

import {
  SPECIES,
  BEHAVIOR_STATE,
  BEHAVIORAL_PARAMS,
  TEMPERAMENT_MODIFIERS,
} from './config.js';

// =============================================================================
// PET AGENT CLASS
// =============================================================================

export class PetAgent {
  constructor(config, random) {
    this.config = config;
    this.random = random;

    // ----- FIXED ATTRIBUTES (set at initialization, don't change) -----
    this.species = config.species;
    this.size = config.size;
    this.ageCategory = config.ageCategory;
    this.temperament = config.temperament;
    this.recallTraining = config.recallTraining;
    this.foodMotivation = config.foodMotivation;
    this.territoryFamiliarity = config.territoryFamiliarity;
    this.isIndoorOnly = config.isIndoorOnly;

    // Identification
    this.hasCollar = config.hasCollar;
    this.hasVisibleTags = config.hasVisibleTags;
    this.hasMicrochip = config.hasMicrochip;
    this.microchipRegistered = config.microchipRegistered;

    // Pre-computed modifiers
    this.sizeModifiers = config.sizeModifiers;
    this.ageModifiers = config.ageModifiers;
    this.temperamentModifiers = config.temperamentModifiers;
    this.speciesDefaults = config.speciesDefaults;

    // ----- DYNAMIC STATE (changes every tick) -----

    // Position
    this.lat = config.escapeLatitude;
    this.lng = config.escapeLongitude;
    this.homeLat = config.escapeLatitude;
    this.homeLng = config.escapeLongitude;
    this.heading = config.escapeDirection ?? this.random() * 360;

    // Behavioral state
    this.behaviorState = config.initialBehaviorState;
    this.timeInCurrentState = 0;  // minutes
    this.stateTransitionCount = 0;

    // Physiological state (all 0-1)
    this.energy = 1.0;
    this.hunger = 0.1;  // Slightly hungry at start
    this.thirst = 0.1;  // Slightly thirsty at start

    // Psychological state
    this.fear = config.initialFear;

    // Threat memory
    this.lastThreatLat = null;
    this.lastThreatLng = null;
    this.lastThreatTime = null;  // minutes since simulation start

    // Movement tracking
    this.totalDistanceTraveled = 0;
    this.maxDistanceFromHome = 0;

    // Resource memory (for v2, keeping structure)
    this.knownResources = [];

    // ----- DERIVED VALUES -----
    this.familiarRange = this.calculateFamiliarRange();
  }

  // ===========================================================================
  // FAMILIAR RANGE CALCULATION
  // ===========================================================================

  /**
   * Calculate how far from home the pet "knows" the area
   * Beyond this range, home attraction weakens dramatically
   */
  calculateFamiliarRange() {
    // Base ranges in miles
    const baseRanges = {
      INDOOR_ONLY: 0.025,       // ~40m - matches Huang 2018 indoor-only cat median
      MOSTLY_INDOOR: 0.1,      // ~160m
      INDOOR_OUTDOOR: 0.3,     // ~480m
      OUTDOOR_PRIMARILY: 0.6,  // ~1km
    };

    let category;
    if (this.isIndoorOnly) {
      category = 'INDOOR_ONLY';
    } else if (this.territoryFamiliarity < 0.4) {
      category = 'MOSTLY_INDOOR';
    } else if (this.territoryFamiliarity < 0.7) {
      category = 'INDOOR_OUTDOOR';
    } else {
      category = 'OUTDOOR_PRIMARILY';
    }

    // Dogs generally have larger territories
    const speciesMultiplier = this.species === SPECIES.DOG ? 2.0 : 1.0;

    return baseRanges[category] * speciesMultiplier * (0.8 + this.random() * 0.4);
  }

  // ===========================================================================
  // PHYSIOLOGICAL DYNAMICS
  // ===========================================================================

  /**
   * Update physiological state (energy, hunger, thirst)
   * Called every tick
   *
   * CALIBRATION NOTE: Indoor-only cats exhaust faster during fleeing
   * to produce realistic displacement distributions (Huang 2018).
   */
  updatePhysiology(deltaMinutes, environment) {
    const params = BEHAVIORAL_PARAMS;
    const state = this.behaviorState;

    // ----- ENERGY DYNAMICS -----
    const activityMultipliers = {
      [BEHAVIOR_STATE.FLEEING]: 2.0,      // Fleeing is exhausting
      [BEHAVIOR_STATE.TRAVELING]: 1.0,
      [BEHAVIOR_STATE.FORAGING]: 0.8,
      [BEHAVIOR_STATE.HIDING]: -0.3,      // Negative = recovery
      [BEHAVIOR_STATE.SHELTERING]: -0.4,  // Better recovery in shelter
    };

    let activityMult = activityMultipliers[state] ?? 0;
    const ageDecayMult = this.ageModifiers.energy_decay_multiplier;

    // Indoor/outdoor conditioning affects exhaustion rate
    if (state === BEHAVIOR_STATE.FLEEING) {
      if (this.isIndoorOnly) {
        activityMult *= 2.5;  // Indoor-only cats exhaust very fast
      } else {
        activityMult *= 0.7;  // Indoor-outdoor cats are more athletic
      }
    }

    if (activityMult >= 0) {
      // Depleting energy
      this.energy -= this.speciesDefaults.energy_decay_rate * activityMult * ageDecayMult * deltaMinutes;
    } else {
      // Recovering energy
      this.energy -= this.speciesDefaults.energy_decay_rate * activityMult * deltaMinutes;  // Negative = gain
    }
    this.energy = Math.max(0, Math.min(1, this.energy));

    // ----- HUNGER DYNAMICS -----
    const hungerActivityMult = {
      [BEHAVIOR_STATE.FLEEING]: 1.5,
      [BEHAVIOR_STATE.TRAVELING]: 1.2,
      [BEHAVIOR_STATE.FORAGING]: 0.5,  // Eating reduces increase
      [BEHAVIOR_STATE.HIDING]: 0.8,
      [BEHAVIOR_STATE.SHELTERING]: 0.7,
    };

    this.hunger += this.speciesDefaults.hunger_rate *
                   (hungerActivityMult[state] ?? 1.0) *
                   deltaMinutes;
    this.hunger = Math.max(0, Math.min(1, this.hunger));

    // ----- THIRST DYNAMICS (more urgent than hunger) -----
    // Temperature effect (if we have environment data)
    const tempFactor = 1.0;  // TODO: Add temperature from environment

    this.thirst += this.speciesDefaults.thirst_rate *
                   (hungerActivityMult[state] ?? 1.0) *
                   tempFactor *
                   deltaMinutes;
    this.thirst = Math.max(0, Math.min(1, this.thirst));

    // ----- INCIDENTAL RESOURCE FINDING (while hiding) -----
    if (state === BEHAVIOR_STATE.HIDING || state === BEHAVIOR_STATE.SHELTERING) {
      // Small chance of finding water while hiding
      const dailyProb = params.incidental_water_find_prob_per_day;
      const tickProb = dailyProb * (deltaMinutes / (24 * 60));

      if (this.random() < tickProb) {
        this.thirst = Math.max(0, this.thirst - params.incidental_water_relief);
      }
    }
  }

  // ===========================================================================
  // FEAR DYNAMICS
  // ===========================================================================

  /**
   * Update fear level (exponential decay)
   * Called every tick
   */
  updateFear(deltaMinutes, currentMinute) {
    const params = BEHAVIORAL_PARAMS;

    // Exponential decay
    // fear(t) = fear(0) * e^(-λt)
    // half-life = ln(2) / λ ≈ 40 hours when λ = 0.0003/min
    const decayRate = params.fear_decay_rate * this.ageModifiers.fear_decay_multiplier;
    this.fear *= Math.exp(-decayRate * deltaMinutes);

    // Clamp
    this.fear = Math.max(0, Math.min(1, this.fear));
  }

  /**
   * Spike fear in response to a threat
   */
  spikeFear(threatLat, threatLng, currentMinute, severity = 1.0) {
    const params = BEHAVIORAL_PARAMS;

    // Record threat
    this.lastThreatLat = threatLat;
    this.lastThreatLng = threatLng;
    this.lastThreatTime = currentMinute;

    // Increase fear
    const spike = params.fear_spike_on_threat * severity;
    this.fear = Math.min(1.0, this.fear + spike);

    // Xenophobic pets have stronger fear response
    if (this.temperament === 'XENOPHOBIC') {
      this.fear = Math.min(1.0, this.fear + spike * 0.3);
    }
  }

  // ===========================================================================
  // STATE TRANSITIONS
  // ===========================================================================

  /**
   * Check and execute state transitions
   * Transitions are driven by internal state, not random probabilities
   */
  checkStateTransitions(currentMinute, currentHour, environment) {
    const params = BEHAVIORAL_PARAMS;
    const state = this.behaviorState;

    // Time in current state
    this.timeInCurrentState += environment.timeStepMinutes;

    switch (state) {
      case BEHAVIOR_STATE.FLEEING:
        this.checkFleeingTransitions(currentMinute, currentHour, environment);
        break;

      case BEHAVIOR_STATE.HIDING:
        this.checkHidingTransitions(currentMinute, currentHour, environment);
        break;

      case BEHAVIOR_STATE.FORAGING:
        this.checkForagingTransitions(currentMinute, currentHour, environment);
        break;

      case BEHAVIOR_STATE.TRAVELING:
        this.checkTravelingTransitions(currentMinute, currentHour, environment);
        break;

      case BEHAVIOR_STATE.SHELTERING:
        this.checkShelteringTransitions(currentMinute, currentHour, environment);
        break;
    }
  }

  /**
   * FLEEING state transitions
   * Exits to HIDING when: exhausted OR found good concealment after min flee time
   *
   * CALIBRATION NOTE: Indoor-only cats should transition quickly to produce
   * displacement distributions matching Huang 2018 (~39m median for indoor-only).
   */
  checkFleeingTransitions(currentMinute, currentHour, environment) {
    const params = BEHAVIORAL_PARAMS;

    // Calculate min flee duration (species + individual variation)
    // Key calibration for Huang 2018 displacement data:
    // - Indoor-only cats: median 39m → short flee, slow
    // - Indoor-outdoor cats: median 300m → longer flee, faster
    let baseDuration = this.speciesDefaults.flee_duration_base_minutes;
    if (this.isIndoorOnly) {
      baseDuration *= 0.3;  // Indoor-only cats flee briefly (scared, unfamiliar)
    } else {
      baseDuration *= 2.5;  // Indoor-outdoor cats flee longer (more athletic, confident)
    }
    const variance = baseDuration * 0.3;
    const minFleeDuration = Math.max(1, baseDuration + (this.random() - 0.5) * variance);

    // Force transition if exhausted
    if (this.energy < params.energy_exhaustion_threshold) {
      this.transitionTo(BEHAVIOR_STATE.HIDING, currentMinute);
      return;
    }

    // Check if min time has passed
    if (this.timeInCurrentState < minFleeDuration) {
      return;  // Keep fleeing
    }

    // After min time, probability of transitioning increases rapidly
    // Indoor-only cats transition faster (scared, want to hide immediately)
    const concealmentQuality = environment.getConcealmentAt?.(this.lat, this.lng) ?? 0.5;
    const energyFactor = 1 - this.energy;
    const timeFactor = Math.min(1, this.timeInCurrentState / (minFleeDuration * 2));

    // Base transition probability
    let transitionProb = (energyFactor * 0.5 + concealmentQuality * 0.3 + timeFactor * 0.2);

    // Indoor-only cats are more eager to hide
    if (this.isIndoorOnly) {
      transitionProb *= 1.5;
    }

    // Use configurable transition rate (calibrated for Huang 2018)
    const transitionRate = params.flee_transition_rate || 0.4;
    if (this.random() < transitionProb * transitionRate) {
      this.transitionTo(BEHAVIOR_STATE.HIDING, currentMinute);
    }
  }

  /**
   * HIDING state transitions
   * Exits to FORAGING when: physiological drive overcomes fear threshold
   */
  checkHidingTransitions(currentMinute, currentHour, environment) {
    const params = BEHAVIORAL_PARAMS;

    // Calculate drive level (thirst is more urgent)
    const driveLevel = Math.max(
      this.hunger,
      this.thirst * params.thirst_urgency_multiplier
    );

    // Calculate fear threshold
    const baseThreshold = this.speciesDefaults.base_fear_threshold;
    const temperamentMod = this.temperamentModifiers.fear_threshold_multiplier;

    // Time since last threat reduces threshold (fear fades)
    let timeMod = 1.0;
    if (this.lastThreatTime !== null) {
      const minutesSinceThreat = currentMinute - this.lastThreatTime;
      timeMod = Math.exp(-0.001 * minutesSinceThreat);  // Fades over ~16 hours
    }

    const fearThreshold = baseThreshold * temperamentMod * timeMod;

    // Sigmoid transition probability
    // P = 1 / (1 + exp(-(drive - threshold) * steepness))
    const steepness = 10;
    const sigmoid = 1 / (1 + Math.exp(-(driveLevel - fearThreshold) * steepness));

    // Time-of-day appropriateness
    let timeAppropriateness = 1.0;
    if (this.species === SPECIES.CAT) {
      const isCrepuscular = params.crepuscular_hours.includes(currentHour);
      if (isCrepuscular) {
        timeAppropriateness = params.cat_crepuscular_activity_bonus;
      } else {
        timeAppropriateness = params.cat_daylight_activity_penalty;
      }
    }

    // Xenophobic pets are more time-restricted
    timeAppropriateness *= this.temperamentModifiers.time_appropriateness_override;

    // Final transition probability (per tick)
    const transitionProb = sigmoid * timeAppropriateness * 0.05;

    if (this.random() < transitionProb) {
      this.transitionTo(BEHAVIOR_STATE.FORAGING, currentMinute);
    }
  }

  /**
   * FORAGING state transitions
   * Exits to:
   *   - HIDING: if threatened or needs satisfied or wrong time
   *   - TRAVELING: if confident and motivated to relocate
   */
  checkForagingTransitions(currentMinute, currentHour, environment) {
    const params = BEHAVIORAL_PARAMS;

    // Check if needs are satisfied
    const needsSatisfied = this.hunger < 0.3 && this.thirst < 0.3;

    if (needsSatisfied) {
      // Return to hiding with moderate probability
      if (this.random() < 0.3) {
        this.transitionTo(BEHAVIOR_STATE.HIDING, currentMinute);
        return;
      }
    }

    // Time-of-day check for cats
    if (this.species === SPECIES.CAT) {
      const isCrepuscular = params.crepuscular_hours.includes(currentHour);
      if (!isCrepuscular && this.random() < 0.1) {
        this.transitionTo(BEHAVIOR_STATE.HIDING, currentMinute);
        return;
      }
    }

    // Check for transition to TRAVELING (heading home)
    // Probability increases when: close to home, low fear, good energy, strong homing instinct
    const distanceFromHome = this.getDistanceTo(this.homeLat, this.homeLng);
    const isWithinFamiliarRange = distanceFromHome < this.familiarRange;

    // Base probability to head home
    // Higher when: within familiar range, low fear, good energy
    if (this.fear < 0.5 && this.energy > 0.3) {
      // Calculate home attraction
      const homeAttraction = this.speciesDefaults.homing_instinct *
                             this.territoryFamiliarity *
                             (1 - this.fear);

      // Distance factor - higher chance when closer to home
      // Even far away pets have some chance (they can still smell/remember home direction)
      const distanceFactor = isWithinFamiliarRange
        ? 1.0                                              // Full attraction within familiar range
        : Math.exp(-distanceFromHome / (this.familiarRange * 5));  // Decays with distance but doesn't vanish

      // Probability per tick to transition to TRAVELING
      // For a dog with homing_instinct 0.6, territoryFamiliarity 0.7, fear 0.2:
      // homeAttraction = 0.6 * 0.7 * 0.8 = 0.336
      // If within familiar range: prob = 0.336 * 1.0 * 0.05 = 1.68% per tick
      // Over 72 hours (864 ticks), expected transitions = ~14.5 times
      const travelProbability = homeAttraction * distanceFactor * 0.05;

      if (this.random() < travelProbability) {
        this.transitionTo(BEHAVIOR_STATE.TRAVELING, currentMinute);
      }
    }
  }

  /**
   * TRAVELING state transitions
   * Exits to:
   *   - HIDING: if threatened or exhausted
   *   - HOME arrival checked in main simulation loop (outcome, not state)
   */
  checkTravelingTransitions(currentMinute, currentHour, environment) {
    const params = BEHAVIORAL_PARAMS;

    // Check exhaustion
    if (this.energy < params.energy_exhaustion_threshold) {
      this.transitionTo(BEHAVIOR_STATE.HIDING, currentMinute);
      return;
    }

    // Check fear level
    if (this.fear > 0.7) {
      this.transitionTo(BEHAVIOR_STATE.HIDING, currentMinute);
      return;
    }

    // May find a good sheltering spot
    const concealmentQuality = environment.getConcealmentAt?.(this.lat, this.lng) ?? 0.5;
    if (concealmentQuality > 0.8 && this.energy < 0.4) {
      if (this.random() < 0.1) {
        this.transitionTo(BEHAVIOR_STATE.SHELTERING, currentMinute);
      }
    }
  }

  /**
   * SHELTERING state transitions
   * Similar to HIDING but with better conditions
   */
  checkShelteringTransitions(currentMinute, currentHour, environment) {
    // Same as hiding, but with slightly easier emergence
    // (better shelter = more comfortable = can wait longer, but also less urgent)
    this.checkHidingTransitions(currentMinute, currentHour, environment);
  }

  /**
   * Execute a state transition
   */
  transitionTo(newState, currentMinute) {
    this.behaviorState = newState;
    this.timeInCurrentState = 0;
    this.stateTransitionCount++;
  }

  // ===========================================================================
  // MOVEMENT
  // ===========================================================================

  /**
   * Move the pet based on current behavioral state
   */
  move(deltaMinutes, currentMinute, environment) {
    // Only move in active states
    if (this.behaviorState === BEHAVIOR_STATE.HIDING ||
        this.behaviorState === BEHAVIOR_STATE.SHELTERING) {
      return;
    }

    // Calculate direction
    const direction = this.calculateDirection(currentMinute, environment);

    // Calculate speed
    const speed = this.calculateSpeed(environment);

    // Calculate displacement
    const distanceMiles = speed * deltaMinutes;

    // Convert to lat/lng change
    const latChange = distanceMiles * Math.cos(direction * Math.PI / 180) / 69.0;
    const lngChange = distanceMiles * Math.sin(direction * Math.PI / 180) /
                      (69.0 * Math.cos(this.lat * Math.PI / 180));

    // Proposed new position
    let newLat = this.lat + latChange;
    let newLng = this.lng + lngChange;

    // Check terrain constraints
    const passability = environment.getPassabilityAt?.(newLat, newLng) ?? 1.0;

    if (passability < 0.1) {
      // Blocked - try deflection
      const deflections = [-30, 30, -60, 60, -90, 90];
      let moved = false;

      for (const deflection of deflections) {
        const testDirection = direction + deflection;
        const testLatChange = distanceMiles * Math.cos(testDirection * Math.PI / 180) / 69.0;
        const testLngChange = distanceMiles * Math.sin(testDirection * Math.PI / 180) /
                              (69.0 * Math.cos(this.lat * Math.PI / 180));

        const testLat = this.lat + testLatChange;
        const testLng = this.lng + testLngChange;
        const testPassability = environment.getPassabilityAt?.(testLat, testLng) ?? 1.0;

        if (testPassability >= 0.1) {
          newLat = testLat;
          newLng = testLng;
          this.heading = testDirection;
          moved = true;
          break;
        }
      }

      if (!moved) {
        // Completely blocked - stay in place
        return;
      }
    }

    // Update position
    const distanceTraveled = this.getDistanceTo(newLat, newLng);
    this.lat = newLat;
    this.lng = newLng;
    this.heading = direction;

    // Update tracking
    this.totalDistanceTraveled += distanceTraveled;
    const distanceFromHome = this.getDistanceTo(this.homeLat, this.homeLng);
    this.maxDistanceFromHome = Math.max(this.maxDistanceFromHome, distanceFromHome);
  }

  /**
   * Calculate movement direction using weighted influences
   */
  calculateDirection(currentMinute, environment) {
    const params = BEHAVIORAL_PARAMS;
    const influences = [];

    // 1. INERTIA - tendency to continue same direction
    const persistenceWeights = {
      [BEHAVIOR_STATE.FLEEING]: 0.7,
      [BEHAVIOR_STATE.FORAGING]: 0.2,
      [BEHAVIOR_STATE.TRAVELING]: 0.5,
    };
    const persistence = persistenceWeights[this.behaviorState] ?? 0.3;

    influences.push({
      angle: this.heading,
      weight: persistence * params.direction_inertia_weight,
    });

    // 2. AWAY FROM THREAT (during/after FLEEING)
    if (this.lastThreatLat !== null && this.lastThreatTime !== null) {
      const minutesSinceThreat = currentMinute - this.lastThreatTime;

      if (minutesSinceThreat < 60) {
        const threatAngle = this.getDirectionTo(this.lastThreatLat, this.lastThreatLng);
        const awayAngle = (threatAngle + 180) % 360;
        const recencyWeight = Math.exp(-minutesSinceThreat / 30);

        influences.push({
          angle: awayAngle,
          weight: this.fear * recencyWeight * params.direction_threat_avoidance_weight,
        });
      }
    }

    // 3. HOME ATTRACTION
    const distanceFromHome = this.getDistanceTo(this.homeLat, this.homeLng);
    const homeAngle = this.getDirectionTo(this.homeLat, this.homeLng);

    // Attraction weakens dramatically beyond familiar range
    const distanceFactor = Math.exp(-distanceFromHome / this.familiarRange);

    let homeAttractionStrength;
    if (this.behaviorState === BEHAVIOR_STATE.TRAVELING) {
      homeAttractionStrength = 0.6;
    } else if (this.behaviorState === BEHAVIOR_STATE.FORAGING) {
      homeAttractionStrength = 0.2;
    } else {
      homeAttractionStrength = 0.1;
    }

    const homeWeight = homeAttractionStrength *
                       distanceFactor *
                       (1 - this.fear) *
                       this.speciesDefaults.homing_instinct;

    influences.push({
      angle: homeAngle,
      weight: homeWeight * params.direction_home_attraction_weight,
    });

    // 4. TERRAIN PREFERENCE (prefer easier paths)
    // Simplified: assume environment provides best terrain direction
    const terrainAngle = environment.getBestTerrainDirection?.(this.lat, this.lng) ?? this.heading;
    influences.push({
      angle: terrainAngle,
      weight: params.direction_terrain_preference_weight,
    });

    // Combine influences using vector addition
    let xSum = 0;
    let ySum = 0;

    for (const influence of influences) {
      const rad = influence.angle * Math.PI / 180;
      xSum += influence.weight * Math.cos(rad);
      ySum += influence.weight * Math.sin(rad);
    }

    let baseDirection = Math.atan2(ySum, xSum) * 180 / Math.PI;
    baseDirection = (baseDirection + 360) % 360;

    // Add noise based on state
    const noiseStddev = {
      [BEHAVIOR_STATE.FLEEING]: 15,
      [BEHAVIOR_STATE.FORAGING]: 45,
      [BEHAVIOR_STATE.TRAVELING]: 20,
    };
    const noise = this.gaussianRandom() * (noiseStddev[this.behaviorState] ?? 20);

    return (baseDirection + noise + 360) % 360;
  }

  /**
   * Calculate movement speed
   *
   * CALIBRATION NOTE: Indoor-outdoor cats should move faster than indoor-only
   * to produce realistic displacement ratios (Huang 2018: 300m vs 39m median).
   */
  calculateSpeed(environment) {
    const params = BEHAVIORAL_PARAMS;

    // Base speed
    let speed = params.base_speed_miles_per_tick;

    // State multiplier
    const stateMultipliers = {
      [BEHAVIOR_STATE.FLEEING]: params.flee_speed_multiplier,
      [BEHAVIOR_STATE.FORAGING]: params.forage_speed_multiplier,
      [BEHAVIOR_STATE.TRAVELING]: params.travel_speed_multiplier,
    };
    speed *= stateMultipliers[this.behaviorState] ?? 1.0;

    // Species multiplier
    speed *= this.species === SPECIES.DOG ? 1.1 : 0.9;

    // Indoor-outdoor cats are faster, more athletic
    if (this.species === SPECIES.CAT && !this.isIndoorOnly) {
      speed *= 1.8;  // 80% faster than indoor-only
    }

    // Size multiplier
    speed *= this.sizeModifiers.speed_multiplier;

    // Age multiplier
    speed *= this.ageModifiers.speed_multiplier;

    // Condition: energy and injury
    speed *= this.energy;

    // Terrain
    const passability = environment.getPassabilityAt?.(this.lat, this.lng) ?? 1.0;
    speed *= Math.max(0.3, passability);

    // Random variation
    speed *= 0.7 + this.random() * 0.6;

    return speed;
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Get distance to a point in miles
   */
  getDistanceTo(targetLat, targetLng) {
    const R = 3959;  // Earth's radius in miles
    const dLat = (targetLat - this.lat) * Math.PI / 180;
    const dLng = (targetLng - this.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(this.lat * Math.PI / 180) * Math.cos(targetLat * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get direction to a point in degrees
   */
  getDirectionTo(targetLat, targetLng) {
    const dLng = targetLng - this.lng;
    const dLat = targetLat - this.lat;
    const angle = Math.atan2(dLng, dLat) * 180 / Math.PI;
    return (angle + 360) % 360;
  }

  /**
   * Generate a Gaussian random number using Box-Muller transform
   */
  gaussianRandom() {
    let u1, u2;
    do {
      u1 = this.random();
    } while (u1 === 0);
    u2 = this.random();

    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * Check if pet is at home (within recognition radius)
   */
  isAtHome() {
    const params = BEHAVIORAL_PARAMS;
    const distanceFromHome = this.getDistanceTo(this.homeLat, this.homeLng);
    return distanceFromHome < params.home_recognition_radius_miles;
  }

  /**
   * Calculate probability of staying if at home
   *
   * ============================================================================
   * PURELY EMERGENT - NO CALIBRATED OUTCOME TARGETING
   * ============================================================================
   *
   * This is based ONLY on the pet's internal state and behavioral logic:
   * - How tired/hungry/thirsty is the pet? (physiological needs)
   * - How scared is the pet? (psychological state)
   * - Does the pet recognize home? (familiarity)
   * - Has it left before? (behavioral pattern)
   *
   * The outcome rates are NOT targeted - they EMERGE from these mechanics.
   * If the emergent rates differ from published research, that's information
   * about our behavioral model, not something to "fix" by adjusting rates.
   */
  calculateStayProbability() {
    // Track home visits
    if (this.homeVisitCount === undefined) {
      this.homeVisitCount = 0;
    }
    this.homeVisitCount++;

    // PHYSIOLOGICAL NEEDS - exhausted/hungry/thirsty pets want to stay
    // These are the PRIMARY drivers of staying home
    const exhaustionFactor = 1 - this.energy;  // 0-1, higher = more tired
    const hungerFactor = this.hunger;           // 0-1, higher = more hungry
    const thirstFactor = this.thirst;           // 0-1, higher = more thirsty

    // Needs urgency: how desperately does pet need to stay?
    const needsUrgency = (exhaustionFactor * 0.4) + (hungerFactor * 0.3) + (thirstFactor * 0.3);

    // FEAR - scared pets don't settle, they keep moving
    // This is the PRIMARY driver of NOT staying
    const fearFactor = this.fear;  // 0-1, higher = more scared

    // FAMILIARITY - does pet recognize this as home?
    // Indoor-only pets have stronger home recognition
    const homeRecognition = this.isIndoorOnly ? 0.9 : 0.6;

    // TERRITORIAL - cats are more territorial than dogs
    const territorialBond = this.species === 'CAT' ? 0.7 : 0.4;

    // BEHAVIORAL PATTERN - pet that has left home before is more likely to leave again
    // First visit: no penalty. Each subsequent visit: reduced likelihood of staying
    const commitmentDecay = Math.pow(0.7, this.homeVisitCount - 1);

    // COMBINE: Probability emerges from state
    // High needs + low fear + high familiarity = likely to stay
    // Low needs + high fear + unfamiliar = likely to leave
    const stayProb = Math.max(0, Math.min(1,
      (needsUrgency * 0.5 + homeRecognition * 0.25 + territorialBond * 0.25)
      * (1 - fearFactor * 0.8)  // Fear strongly reduces staying
      * commitmentDecay         // Prior departures reduce staying
    ));

    return stayProb;
  }

  /**
   * Get current visibility (how visible is the pet to searchers/strangers)
   */
  getVisibility(environment, currentHour) {
    // Base visibility from state
    const stateVisibility = {
      [BEHAVIOR_STATE.FLEEING]: 0.7,   // Moving fast, visible
      [BEHAVIOR_STATE.HIDING]: 0.05,   // Concealed
      [BEHAVIOR_STATE.FORAGING]: 0.5,  // Moving but cautious
      [BEHAVIOR_STATE.TRAVELING]: 0.8, // Moving, visible
      [BEHAVIOR_STATE.SHELTERING]: 0.1, // Concealed in shelter
    };

    let visibility = stateVisibility[this.behaviorState] ?? 0.5;

    // Size modifier
    visibility *= this.sizeModifiers.visibility_multiplier;

    // Species: dogs more visible than cats
    visibility *= this.species === SPECIES.DOG ? 1.2 : 0.7;

    // Time of day (simplified)
    const isNight = currentHour < 6 || currentHour > 20;
    if (isNight) {
      visibility *= 0.3;
    }

    // Terrain concealment
    const concealment = environment.getConcealmentAt?.(this.lat, this.lng) ?? 0.5;
    visibility *= (1 - concealment * 0.5);

    return Math.max(0, Math.min(1, visibility));
  }

  /**
   * Get snapshot of current state for logging/tracking
   */
  getStateSnapshot() {
    return {
      lat: this.lat,
      lng: this.lng,
      heading: this.heading,
      behaviorState: this.behaviorState,
      energy: this.energy,
      hunger: this.hunger,
      thirst: this.thirst,
      fear: this.fear,
      distanceFromHome: this.getDistanceTo(this.homeLat, this.homeLng),
      totalDistanceTraveled: this.totalDistanceTraveled,
    };
  }
}
