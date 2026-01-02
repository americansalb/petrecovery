/**
 * PetAgent - Simulates lost pet behavior with state machine
 *
 * States: FLEEING, HIDING, FORAGING, WANDERING, TERRITORIAL, SHELTERED
 */

// Movement speeds by state (miles per 5 minutes)
const STATE_SPEEDS = {
  FLEEING: 0.15,    // ~1.8 mph - running
  HIDING: 0.0,      // Stationary
  FORAGING: 0.03,   // ~0.36 mph - slow, searching for food
  WANDERING: 0.05,  // ~0.6 mph - casual exploration
  TERRITORIAL: 0.02, // ~0.24 mph - patrolling
  SHELTERED: 0.0,   // Stationary (at shelter/home)
};

// Base parameters by species
const SPECIES_PARAMS = {
  DOG: {
    homingStrength: 0.3,
    fleeingDuration: 120, // minutes
    energyDecayRate: 0.01,
    hungerIncreaseRate: 0.02,
  },
  CAT: {
    homingStrength: 0.1,
    fleeingDuration: 60,
    energyDecayRate: 0.008,
    hungerIncreaseRate: 0.015,
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

    // Indoor cat modifier
    if (config.petSpecies === 'CAT' && config.isIndoorPet) {
      this.params = {
        ...this.params,
        homingStrength: 0.05, // Very low - too scared to navigate
        fleeingDuration: 30,  // Quick to hide
      };
      this.sizeModifier = 0.5; // Stays very close
    }
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
   */
  checkStateTransitions(minute, currentHour) {
    const timeSinceStateChange = minute - this.lastStateChange;
    const isDawnDusk = (currentHour >= 5 && currentHour <= 7) || (currentHour >= 17 && currentHour <= 20);
    const isNight = currentHour >= 21 || currentHour <= 4;

    switch (this.state) {
      case 'FLEEING':
        // Transition to HIDING if energy low or time elapsed
        if (this.energy < 0.2 || timeSinceStateChange > this.params.fleeingDuration) {
          this.transitionTo('HIDING', minute);
        }
        // Or calm down to WANDERING if time passed and no threats
        else if (timeSinceStateChange > 120 && this.random() < 0.3) {
          this.transitionTo('WANDERING', minute);
        }
        break;

      case 'HIDING':
        // Transition to FORAGING if hungry and it's dawn/dusk
        if (this.hunger > 0.7 && isDawnDusk && this.random() < 0.2) {
          this.transitionTo('FORAGING', minute);
        }
        // Cats may venture out at night
        if (this.config.petSpecies === 'CAT' && isNight && this.hunger > 0.5 && this.random() < 0.1) {
          this.transitionTo('FORAGING', minute);
        }
        break;

      case 'FORAGING':
        // Return to HIDING if threatened or daytime
        if (!isDawnDusk && !isNight && this.random() < 0.3) {
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
        if (this.random() < 0.02) {
          this.transitionTo('HIDING', minute);
        }
        break;

      case 'TERRITORIAL':
        // Return to FORAGING if hungry
        if (this.hunger > 0.7 && this.random() < 0.1) {
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

    // Calculate new position
    const distanceMiles = adjustedSpeed;
    const latChange = distanceMiles * Math.cos(this.direction * Math.PI / 180) / 69.0;
    const lngChange = distanceMiles * Math.sin(this.direction * Math.PI / 180) / (69.0 * Math.cos(this.lat * Math.PI / 180));

    this.lat += latChange;
    this.lng += lngChange;
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
