/**
 * PetAgent - Simulates lost pet behavior with state machine
 *
 * States: FLEEING, HIDING, FORAGING, WANDERING, TERRITORIAL, SHELTERED
 *
 * SPEED CALIBRATION (research-informed):
 * - Lost dogs typically stay within 1-2 miles (most within 1 city block)
 * - Lost cats typically stay within 0.1 miles (3-5 houses)
 * - Speeds reduced to produce realistic displacement over 72h simulations
 *
 * DISPLACEMENT RESEARCH (see researchConfig.js):
 * - Cats (indoor-only): median 39m, q75 137m (Huang 2018) - VERIFIED
 * - Cats (indoor-outdoor): median 300m, q75 1609m (Huang 2018) - VERIFIED
 * - Dogs: 42% within 122m, 70% within 1609m (Kremer 2021) - DERIVED
 *
 * See: researchConfig.js for verified parameters
 *      displacement.js for log-normal sampling
 *      sensitivity.js for UNVERIFIED parameter analysis
 */

import { getTerrainCache } from './terrain';
import { UNVERIFIED_PARAMS } from './researchConfig.js';

// Movement speeds by state (miles per 5 minutes)
// UNVERIFIED: These speeds are empirically tuned, not from peer-reviewed research
// Priority: HIGH for sensitivity analysis - see sensitivity.js
const STATE_SPEEDS = {
  FLEEING: UNVERIFIED_PARAMS.STATE_SPEEDS.FLEEING.value,     // ~0.48 mph - UNVERIFIED
  HIDING: UNVERIFIED_PARAMS.STATE_SPEEDS.HIDING.value,       // ~0.012 mph - UNVERIFIED
  FORAGING: UNVERIFIED_PARAMS.STATE_SPEEDS.FORAGING.value,   // ~0.1 mph - UNVERIFIED
  WANDERING: UNVERIFIED_PARAMS.STATE_SPEEDS.WANDERING.value, // ~0.18 mph - UNVERIFIED
  TERRITORIAL: UNVERIFIED_PARAMS.STATE_SPEEDS.TERRITORIAL.value, // ~0.06 mph - UNVERIFIED
  SHELTERED: 0.0,   // Stationary (at shelter/home)
};

// Base parameters by species
// UNVERIFIED: All values below are empirically tuned, not from peer-reviewed research
// Note: Dog self-return is 15% of recoveries (Weiss 2012) - VERIFIED
// Note: Cat self-return is 59% of recoveries (Weiss 2012) - VERIFIED
// However, the homingStrength parameter that produces these rates is UNVERIFIED
const SPECIES_PARAMS = {
  DOG: {
    homingStrength: 0.15,    // UNVERIFIED - tuned to produce ~15% self-return
    fleeingDuration: 120,    // minutes - UNVERIFIED
    energyDecayRate: 0.01,   // UNVERIFIED
    hungerIncreaseRate: 0.02, // UNVERIFIED
  },
  CAT: {
    homingStrength: 0.08,    // UNVERIFIED - tuned to produce ~59% self-return
    fleeingDuration: 60,     // UNVERIFIED
    energyDecayRate: 0.008,  // UNVERIFIED
    hungerIncreaseRate: 0.025, // UNVERIFIED
  },
  BIRD: {
    homingStrength: 0.4,     // UNVERIFIED
    fleeingDuration: 30,     // UNVERIFIED
    energyDecayRate: 0.02,   // UNVERIFIED
    hungerIncreaseRate: 0.03, // UNVERIFIED
  },
  OTHER: {
    homingStrength: 0.15,    // UNVERIFIED
    fleeingDuration: 90,     // UNVERIFIED
    energyDecayRate: 0.01,   // UNVERIFIED
    hungerIncreaseRate: 0.02, // UNVERIFIED
  },
};

// Size modifiers for movement speed
const SIZE_MODIFIERS = {
  TINY: 0.6,
  SMALL: 0.8,
  MEDIUM: 1.0,
  LARGE: 1.2,
  GIANT: 1.5,
};

// Species speed modifiers - dogs move faster than cats
// UNVERIFIED but based on obvious biological differences
const SPECIES_SPEED_MODIFIERS = {
  DOG: 1.4,    // Dogs are generally faster movers
  CAT: 0.7,    // Cats move more cautiously, shorter bursts
  BIRD: 0.3,   // Birds on ground move slowly (flight not simulated)
  OTHER: 1.0,  // Baseline
};

// Personality modifiers - affects BOTH detection AND behavior
const PERSONALITY_MODIFIERS = {
  FRIENDLY: {
    transportRisk: 2.0,      // More likely to be picked up by stranger
    homingBonus: 1.0,        // Normal homing
    hidingTendency: 0.5,     // Less likely to hide
    wanderingTendency: 1.5,  // More likely to wander (visible)
    fleeingDuration: 0.7,    // Calms down faster
  },
  NEUTRAL: {
    transportRisk: 1.0,
    homingBonus: 1.0,
    hidingTendency: 1.0,
    wanderingTendency: 1.0,
    fleeingDuration: 1.0,
  },
  SHY: {
    transportRisk: 0.2,      // Runs from strangers
    homingBonus: 0.8,        // Harder to navigate when scared
    hidingTendency: 2.0,     // Much more likely to hide
    wanderingTendency: 0.5,  // Stays hidden more
    fleeingDuration: 1.5,    // Stays panicked longer
  },
};

export class PetAgent {
  constructor(config, random) {
    this.config = config;
    this.random = random;

    // Position (start at center)
    this.lat = config.centerLatitude;
    this.lng = config.centerLongitude;
    this.homeLat = config.centerLatitude;
    this.homeLng = config.centerLongitude;

    // State
    this.state = config.initialState || 'FLEEING';
    this.previousState = null;

    // Internal state
    this.energy = 1.0;  // 0-1
    this.hunger = 0.0;  // 0-1

    // Movement tracking
    this.direction = this.random() * 360; // degrees
    this.lastStateChange = 0;

    // Species-specific params
    this.params = SPECIES_PARAMS[config.petSpecies] || SPECIES_PARAMS.OTHER;
    this.sizeModifier = SIZE_MODIFIERS[config.petSize] || 1.0;
    this.speciesSpeedMod = SPECIES_SPEED_MODIFIERS[config.petSpecies] || 1.0;
    this.personalityMods = PERSONALITY_MODIFIERS[config.petPersonality] || PERSONALITY_MODIFIERS.NEUTRAL;

    // Apply personality modifier to fleeing duration
    this.params = {
      ...this.params,
      fleeingDuration: this.params.fleeingDuration * this.personalityMods.fleeingDuration,
    };

    // Indoor cat modifier
    if (config.petSpecies === 'CAT' && config.isIndoorPet) {
      this.params = {
        ...this.params,
        homingStrength: 0.05, // Very low - too scared to navigate
        fleeingDuration: 30,  // Quick to hide
      };
      this.sizeModifier = 0.5; // Stays very close
    }

    // Roaming tendency (set later from displacement sampling)
    this.roamingTendencyMiles = null;
    this.territoryRadiusMiles = 0.2; // Default territory size
  }

  /**
   * Set roaming tendency based on displacement sampling
   *
   * This influences HOW the pet moves (territory size, speed limits)
   * NOT where it will end up - outcomes are EMERGENT, not pre-determined
   *
   * @param {number} tendencyMiles - Sampled displacement tendency in miles
   */
  setRoamingTendency(tendencyMiles) {
    this.roamingTendencyMiles = tendencyMiles;

    // Adjust territory size based on tendency
    // Pets with higher roaming tendency have larger territories
    this.territoryRadiusMiles = Math.min(tendencyMiles * 1.5, 2.0);

    // Adjust homing strength - pets that roam far are less likely to come home
    // This is a behavioral modifier, NOT a pre-determined outcome
    const roamingFactor = Math.min(tendencyMiles / 0.5, 2.0); // Normalize to 0.5 mile baseline
    this.params = {
      ...this.params,
      homingStrength: this.params.homingStrength / roamingFactor,
    };
  }

  /**
   * Update internal state (energy, hunger)
   */
  updateInternalState(minute, currentHour) {
    // Energy decreases when moving
    if (this.state === 'FLEEING' || this.state === 'WANDERING') {
      this.energy -= this.params.energyDecayRate;
    } else if (this.state === 'HIDING' || this.state === 'TERRITORIAL') {
      // Slowly recover energy while resting
      this.energy = Math.min(1.0, this.energy + 0.005);
    }

    // Hunger always increases
    this.hunger += this.params.hungerIncreaseRate;

    // Clamp values
    this.energy = Math.max(0, Math.min(1, this.energy));
    this.hunger = Math.max(0, Math.min(1, this.hunger));
  }

  /**
   * Check for state transitions based on triggers
   *
   * Personality affects transitions:
   * - SHY pets: hidingTendency=2.0 (more likely to hide)
   * - FRIENDLY pets: wanderingTendency=1.5 (more likely to stay visible)
   */
  checkStateTransitions(minute, currentHour) {
    const timeSinceStateChange = minute - this.lastStateChange;
    const isDawnDusk = (currentHour >= 5 && currentHour <= 7) || (currentHour >= 17 && currentHour <= 20);
    const isNight = currentHour >= 21 || currentHour <= 4;

    // Get terrain zone modifiers at current location
    const terrain = getTerrainCache();
    const zone = terrain.getZoneAt(this.lat, this.lng);
    const hidingBonus = zone.modifiers.hidingBonus;
    const foragingBonus = zone.modifiers.foragingBonus;

    // Personality modifiers for state transitions
    const hidingTendency = this.personalityMods.hidingTendency;
    const wanderingTendency = this.personalityMods.wanderingTendency;

    switch (this.state) {
      case 'FLEEING':
        // Transition to HIDING if energy low or time elapsed
        // SHY pets hide faster (higher hidingTendency)
        if (this.energy < 0.2 || timeSinceStateChange > this.params.fleeingDuration) {
          this.transitionTo('HIDING', minute);
        }
        // FRIENDLY pets calm down to WANDERING faster (higher wanderingTendency)
        else if (timeSinceStateChange > 120 && this.random() < 0.3 * wanderingTendency / hidingBonus) {
          this.transitionTo('WANDERING', minute);
        }
        // SHY pets more likely to hide in good hiding zones
        else if (hidingBonus > 1.0 && this.random() < 0.1 * hidingBonus * hidingTendency) {
          this.transitionTo('HIDING', minute);
        }
        break;

      case 'HIDING':
        // Transition to FORAGING if hungry and it's dawn/dusk
        // SHY pets stay hidden longer (divide by hidingTendency)
        if (this.hunger > 0.5 && isDawnDusk && this.random() < (0.3 * foragingBonus) / hidingTendency) {
          this.transitionTo('FORAGING', minute);
        }
        // Cats may venture out at night (primary hunting time)
        if (this.config.petSpecies === 'CAT' && isNight && this.hunger > 0.4 && this.random() < (0.2 * foragingBonus) / hidingTendency) {
          this.transitionTo('FORAGING', minute);
        }
        // Dogs are less patient - emerge sooner when hungry
        if (this.config.petSpecies === 'DOG' && this.hunger > 0.6 && this.random() < (0.15 * foragingBonus) / hidingTendency) {
          this.transitionTo('FORAGING', minute);
        }
        // Very hungry animals will emerge regardless of time (but SHY still slower)
        if (this.hunger > 0.85 && this.random() < 0.25 / hidingTendency) {
          this.transitionTo('FORAGING', minute);
        }
        break;

      case 'FORAGING':
        // Return to HIDING if threatened or daytime
        // SHY pets return to hiding more easily
        if (!isDawnDusk && !isNight && this.random() < (0.3 * hidingTendency) / foragingBonus) {
          this.transitionTo('HIDING', minute);
        }
        // Transition to WANDERING if hunger satisfied
        // FRIENDLY pets more likely to wander
        if (this.hunger < 0.3 && this.random() < 0.2 * wanderingTendency) {
          this.transitionTo('WANDERING', minute);
        }
        break;

      case 'WANDERING':
        // Establish territory after extended time
        if (timeSinceStateChange > 24 * 60 && this.random() < 0.1) { // After 24 hours
          this.transitionTo('TERRITORIAL', minute);
        }
        // SHY pets hide more easily while wandering
        if (this.random() < 0.02 * hidingBonus * hidingTendency) {
          this.transitionTo('HIDING', minute);
        }
        break;

      case 'TERRITORIAL':
        // Return to FORAGING if hungry
        if (this.hunger > 0.7 && this.random() < 0.1 * foragingBonus) {
          this.transitionTo('FORAGING', minute);
        }
        break;

      case 'SHELTERED':
        // No transitions out of sheltered (handled elsewhere)
        break;
    }
  }

  /**
   * Transition to a new state
   */
  transitionTo(newState, minute) {
    this.previousState = this.state;
    this.state = newState;
    this.lastStateChange = minute;
  }

  /**
   * Move the pet based on current state
   *
   * Speed is affected by:
   * - Base state speed (FLEEING faster than WANDERING)
   * - Species modifier (dogs faster than cats)
   * - Size modifier (larger pets move faster)
   * - Time of day (cats active at night, dogs during day)
   */
  move(minute, currentHour) {
    const baseSpeed = STATE_SPEEDS[this.state] || 0;
    // Apply BOTH species and size modifiers
    const speed = baseSpeed * this.sizeModifier * this.speciesSpeedMod;

    if (speed === 0) return;

    // Apply time of day modifier
    let timeModifier = 1.0;
    const isDawnDusk = (currentHour >= 5 && currentHour <= 7) || (currentHour >= 17 && currentHour <= 20);
    const isNight = currentHour >= 21 || currentHour <= 4;

    if (this.config.petSpecies === 'CAT') {
      timeModifier = isNight ? 1.5 : (isDawnDusk ? 1.2 : 0.7);
    } else if (this.config.petSpecies === 'DOG') {
      timeModifier = isDawnDusk ? 1.2 : 1.0;
    }

    const adjustedSpeed = speed * timeModifier;

    // Apply homing force
    if (this.random() < this.params.homingStrength * this.personalityMods.homingBonus) {
      const homingDirection = this.getDirectionTo(this.homeLat, this.homeLng);
      this.direction = this.lerpAngle(this.direction, homingDirection, 0.3);
    }

    // Add some randomness to direction
    this.direction += (this.random() - 0.5) * 60; // +/- 30 degrees

    // State-specific movement patterns
    switch (this.state) {
      case 'FLEEING':
        // Move away from home (panicked)
        if (this.random() < 0.7) {
          const awayFromHome = (this.getDirectionTo(this.homeLat, this.homeLng) + 180) % 360;
          this.direction = this.lerpAngle(this.direction, awayFromHome, 0.3);
        }
        break;

      case 'TERRITORIAL':
        // Circular pattern around territory center
        const distFromHome = this.getDistanceTo(this.homeLat, this.homeLng);
        if (distFromHome > 0.2) {
          // Too far, head back
          this.direction = this.getDirectionTo(this.homeLat, this.homeLng);
        } else {
          // Patrol in a circle
          this.direction = (this.direction + 10) % 360;
        }
        break;
    }

    // Calculate proposed new position
    const distanceMiles = adjustedSpeed;
    const latChange = distanceMiles * Math.cos(this.direction * Math.PI / 180) / 69.0;
    const lngChange = distanceMiles * Math.sin(this.direction * Math.PI / 180) / (69.0 * Math.cos(this.lat * Math.PI / 180));

    const newLat = this.lat + latChange;
    const newLng = this.lng + lngChange;

    // Check for terrain barriers
    const terrain = getTerrainCache();
    const moveCheck = terrain.checkMovement(this.lat, this.lng, newLat, newLng, this.random);

    if (moveCheck.blocked) {
      // If blocked, try up to 3 alternative directions
      if (moveCheck.canAttempt) {
        for (let attempt = 0; attempt < 3; attempt++) {
          // Try a different direction
          const altDirection = this.direction + (90 + this.random() * 90) * (this.random() < 0.5 ? 1 : -1);
          const altLatChange = distanceMiles * Math.cos(altDirection * Math.PI / 180) / 69.0;
          const altLngChange = distanceMiles * Math.sin(altDirection * Math.PI / 180) / (69.0 * Math.cos(this.lat * Math.PI / 180));

          const altLat = this.lat + altLatChange;
          const altLng = this.lng + altLngChange;

          const altCheck = terrain.checkMovement(this.lat, this.lng, altLat, altLng, this.random);
          if (!altCheck.blocked) {
            this.lat = altLat;
            this.lng = altLng;
            this.direction = altDirection; // Update direction for next move
            return;
          }
        }
      }
      // Completely blocked - stay in place (common for hiding pets near water)
      return;
    }

    // No barriers - move to new position
    this.lat = newLat;
    this.lng = newLng;
  }

  /**
   * Check if pet has returned home
   * Pet must have moved away first (at least 0.05 miles = 264 feet)
   * before it can "return home"
   */
  checkHoming() {
    const distanceToHome = this.getDistanceTo(this.homeLat, this.homeLng);

    // Track maximum distance from home
    if (!this.maxDistanceFromHome) {
      this.maxDistanceFromHome = 0;
    }
    this.maxDistanceFromHome = Math.max(this.maxDistanceFromHome, distanceToHome);

    // Pet must have moved away at least 0.05 miles before it can "return"
    // This prevents immediate "returned home" on first tick
    if (this.maxDistanceFromHome < 0.05) {
      return false;
    }

    // Consider "home" if within 0.01 miles (~50 feet)
    return distanceToHome < 0.01;
  }

  /**
   * Check for transport event (picked up by stranger)
   */
  checkTransportEvent(currentHour, random) {
    // Only friendly dogs in WANDERING state during daytime
    if (this.state !== 'WANDERING') return false;
    if (this.config.petSpecies !== 'DOG') return false;

    const isDay = currentHour >= 7 && currentHour <= 20;
    const basePickupRate = 0.001; // Per tick

    let probability = basePickupRate;
    probability *= this.personalityMods.transportRisk;
    probability *= isDay ? 1.0 : 0.4;

    // Collar increases pickup chance (people want to help)
    if (this.config.hasCollar) {
      probability *= 1.5;
    }

    return random() < probability;
  }

  /**
   * Get direction to a point (degrees)
   */
  getDirectionTo(targetLat, targetLng) {
    const dLng = targetLng - this.lng;
    const dLat = targetLat - this.lat;
    const angle = Math.atan2(dLng, dLat) * 180 / Math.PI;
    return (angle + 360) % 360;
  }

  /**
   * Get distance to a point (miles)
   */
  getDistanceTo(targetLat, targetLng) {
    const R = 3959;
    const dLat = (targetLat - this.lat) * Math.PI / 180;
    const dLng = (targetLng - this.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(this.lat * Math.PI / 180) * Math.cos(targetLat * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Linear interpolate between two angles
   */
  lerpAngle(from, to, t) {
    let diff = to - from;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return (from + diff * t + 360) % 360;
  }
}
