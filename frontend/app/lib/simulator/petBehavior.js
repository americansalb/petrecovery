/**
 * PetAgent - Simulates lost pet behavior with state machine
 *
 * States: FLEEING, HIDING, FORAGING, WANDERING, TERRITORIAL, SHELTERED
 *
 * RESEARCH-BASED CALIBRATION:
 * - Indoor cats typically found within 50m (0.03mi) of escape point
 * - Dogs: 42% found within 1 city block (~100m = 0.06mi)
 * - Bimodal distribution: pets either very close OR transported far
 * - "Silence Factor": displaced cats won't vocalize for 5-10 days
 */

import { getTerrainCache } from './terrain';

// Movement speeds by state (miles per 5 minutes)
// CALIBRATED: Reduced to match research on displacement distances
const STATE_SPEEDS = {
  FLEEING: 0.08,    // ~0.96 mph - running but not marathon pace
  HIDING: 0.002,    // ~0.024 mph - minimal movement between spots
  FORAGING: 0.015,  // ~0.18 mph - slow, cautious searching
  WANDERING: 0.025, // ~0.3 mph - casual but cautious
  TERRITORIAL: 0.01, // ~0.12 mph - patrolling small area
  SHELTERED: 0.0,   // Stationary (at shelter/home)
};

// Base parameters by species
// CALIBRATION: Reduced homing strength to prevent pets always returning to searchers
const SPECIES_PARAMS = {
  DOG: {
    homingStrength: 0.15,    // Reduced from 0.3 - dogs wander more before returning
    fleeingDuration: 120,    // minutes
    energyDecayRate: 0.01,
    hungerIncreaseRate: 0.02,
  },
  CAT: {
    homingStrength: 0.08,    // Reduced from 0.1 - cats rarely return on their own
    fleeingDuration: 60,
    energyDecayRate: 0.008,
    hungerIncreaseRate: 0.025, // Increased from 0.015 - cats get hungry faster, emerge sooner
  },
  BIRD: {
    homingStrength: 0.4,
    fleeingDuration: 30,
    energyDecayRate: 0.02,
    hungerIncreaseRate: 0.03,
  },
  OTHER: {
    homingStrength: 0.15,
    fleeingDuration: 90,
    energyDecayRate: 0.01,
    hungerIncreaseRate: 0.02,
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

// Personality modifiers
const PERSONALITY_MODIFIERS = {
  FRIENDLY: { transportRisk: 2.0, homingBonus: 1.0 },
  NEUTRAL: { transportRisk: 1.0, homingBonus: 1.0 },
  SHY: { transportRisk: 0.2, homingBonus: 0.8 },
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
    this.personalityMods = PERSONALITY_MODIFIERS[config.petPersonality] || PERSONALITY_MODIFIERS.NEUTRAL;

    // Indoor cat modifier - stays VERY close (research: 50m median)
    if (config.petSpecies === 'CAT' && config.isIndoorPet) {
      this.params = {
        ...this.params,
        homingStrength: 0.02, // Almost never returns on own - too disoriented
        fleeingDuration: 15,  // Panics briefly, then hides immediately
      };
      this.sizeModifier = 0.3; // Stays very close (50m target displacement)
    }

    // Track time since escape (for Silence Factor)
    this.minutesSinceEscape = 0;
  }

  /**
   * Update internal state (energy, hunger)
   */
  updateInternalState(minute, currentHour) {
    // Track time since escape (for Silence Factor)
    this.minutesSinceEscape = minute;

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
   * Get the "Silence Factor" modifier for cat detection
   * Displaced cats typically won't vocalize for 5-10 days due to stress
   * This significantly reduces their detectability in early days
   */
  getSilenceFactor() {
    if (this.config.petSpecies !== 'CAT') return 1.0;

    const daysSinceEscape = this.minutesSinceEscape / (24 * 60);

    // First 2 days: severely reduced vocalization
    if (daysSinceEscape < 2) return 0.3;
    // Days 2-5: gradually recovering
    if (daysSinceEscape < 5) return 0.5;
    // Days 5-10: mostly recovered
    if (daysSinceEscape < 10) return 0.8;
    // After 10 days: normal behavior
    return 1.0;
  }

  /**
   * Check for state transitions based on triggers
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

    switch (this.state) {
      case 'FLEEING':
        // Transition to HIDING if energy low or time elapsed
        // More likely to hide if in good hiding spot (woods, park)
        if (this.energy < 0.2 || timeSinceStateChange > this.params.fleeingDuration) {
          this.transitionTo('HIDING', minute);
        }
        // Or calm down to WANDERING if time passed and no threats
        else if (timeSinceStateChange > 120 && this.random() < 0.3 / hidingBonus) {
          this.transitionTo('WANDERING', minute);
        }
        // More likely to hide in good hiding zones
        else if (hidingBonus > 1.0 && this.random() < 0.1 * hidingBonus) {
          this.transitionTo('HIDING', minute);
        }
        break;

      case 'HIDING':
        // Transition to FORAGING if hungry and it's dawn/dusk
        // More likely to forage if in commercial area (dumpsters)
        // CALIBRATION: Increased probabilities so pets emerge more often
        if (this.hunger > 0.5 && isDawnDusk && this.random() < 0.3 * foragingBonus) {
          this.transitionTo('FORAGING', minute);
        }
        // Cats may venture out at night (primary hunting time)
        if (this.config.petSpecies === 'CAT' && isNight && this.hunger > 0.4 && this.random() < 0.2 * foragingBonus) {
          this.transitionTo('FORAGING', minute);
        }
        // Dogs are less patient - emerge sooner when hungry
        if (this.config.petSpecies === 'DOG' && this.hunger > 0.6 && this.random() < 0.15 * foragingBonus) {
          this.transitionTo('FORAGING', minute);
        }
        // Very hungry animals will emerge regardless of time
        if (this.hunger > 0.85 && this.random() < 0.25) {
          this.transitionTo('FORAGING', minute);
        }
        break;

      case 'FORAGING':
        // Return to HIDING if threatened or daytime
        // More likely to stay out in commercial areas
        if (!isDawnDusk && !isNight && this.random() < 0.3 / foragingBonus) {
          this.transitionTo('HIDING', minute);
        }
        // Transition to WANDERING if hunger satisfied
        if (this.hunger < 0.3 && this.random() < 0.2) {
          this.transitionTo('WANDERING', minute);
        }
        break;

      case 'WANDERING':
        // Establish territory after extended time
        if (timeSinceStateChange > 24 * 60 && this.random() < 0.1) { // After 24 hours
          this.transitionTo('TERRITORIAL', minute);
        }
        // Hide if scared (low probability random event)
        // More likely to hide if in good hiding spot
        if (this.random() < 0.02 * hidingBonus) {
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
   */
  move(minute, currentHour) {
    const baseSpeed = STATE_SPEEDS[this.state] || 0;
    const speed = baseSpeed * this.sizeModifier;

    if (speed === 0) return;

    // Apply time of day modifier
    let speedModifier = 1.0;
    const isDawnDusk = (currentHour >= 5 && currentHour <= 7) || (currentHour >= 17 && currentHour <= 20);
    const isNight = currentHour >= 21 || currentHour <= 4;

    if (this.config.petSpecies === 'CAT') {
      speedModifier = isNight ? 1.5 : (isDawnDusk ? 1.2 : 0.7);
    } else if (this.config.petSpecies === 'DOG') {
      speedModifier = isDawnDusk ? 1.2 : 1.0;
    }

    const adjustedSpeed = speed * speedModifier;

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
   */
  checkHoming() {
    const distanceToHome = this.getDistanceTo(this.homeLat, this.homeLng);
    // Consider "home" if within 0.01 miles (~50 feet)
    return distanceToHome < 0.01;
  }

  /**
   * Check for transport event (picked up by stranger)
   * BIMODAL DISTRIBUTION: Pets are either found very close OR transported far
   * Research suggests 74% of shelter intake is "over-the-counter" (citizen drop-off)
   * This means "good samaritan teleportation" is a major factor
   */
  checkTransportEvent(currentHour, random) {
    const isDay = currentHour >= 7 && currentHour <= 20;

    // Dogs: primarily when wandering
    if (this.config.petSpecies === 'DOG') {
      if (this.state !== 'WANDERING' && this.state !== 'FORAGING') return false;

      const basePickupRate = 0.0015; // Per tick
      let probability = basePickupRate;
      probability *= this.personalityMods.transportRisk;
      probability *= isDay ? 1.0 : 0.3;

      // Collar increases pickup chance (people want to help)
      if (this.config.hasCollar) probability *= 1.5;

      return random() < probability;
    }

    // Cats: can be picked up when visible (foraging/wandering) - less common
    if (this.config.petSpecies === 'CAT') {
      // Only friendly cats in visible states
      if (this.state !== 'WANDERING' && this.state !== 'FORAGING') return false;
      if (this.config.petPersonality === 'SHY') return false;

      const basePickupRate = 0.0005; // Lower than dogs - cats are harder to catch
      let probability = basePickupRate;
      probability *= this.personalityMods.transportRisk;
      probability *= isDay ? 1.0 : 0.2;

      // Collar increases pickup - people recognize it as someone's pet
      if (this.config.hasCollar) probability *= 2.0;
      // Friendly cats much more likely to be picked up
      if (this.config.petPersonality === 'FRIENDLY') probability *= 2.0;

      return random() < probability;
    }

    return false;
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
