/**
 * SearcherAgent - Individual searcher with position and behavior
 *
 * Each searcher is an actual agent that:
 * - Has a position (lat/lng)
 * - Moves through the environment
 * - Can detect pets within their detection range
 * - Follows search patterns (grid, spiral, probability-based)
 *
 * This is TRUE emergent simulation - detection happens when
 * searcher and pet are in proximity, not from probability math.
 */

// Detection range in miles (how far can a searcher see/hear a pet)
const BASE_DETECTION_RANGE = {
  DAY_VISUAL: 0.05,    // ~80 meters line of sight
  DAY_AUDIO: 0.15,     // ~240 meters if pet makes noise
  NIGHT_VISUAL: 0.01,  // ~16 meters with flashlight
  NIGHT_AUDIO: 0.20,   // Better at night (quieter)
};

// Searcher speed in miles per minute
const SEARCHER_SPEED = {
  WALKING: 0.05,       // 3 mph
  SLOW_SEARCH: 0.025,  // 1.5 mph (careful searching)
  RUNNING: 0.10,       // 6 mph (responding to sighting)
};

/**
 * SearcherAgent class
 */
export class SearcherAgent {
  constructor(id, config, homePosition, random) {
    this.id = id;
    this.isOwner = id === 0;  // First searcher is always the owner
    this.random = random;

    // Position
    this.lat = homePosition.lat;
    this.lng = homePosition.lng;
    this.homeLat = homePosition.lat;
    this.homeLng = homePosition.lng;

    // Search config
    this.searchRadius = config.searchRadiusMiles || 2.0;
    this.strategy = config.searchStrategy || 'PROBABILITY';

    // State
    this.isActive = false;
    this.currentSpeed = SEARCHER_SPEED.WALKING;
    this.heading = this.random() * 360;  // Initial random heading

    // For spiral/grid patterns
    this.spiralRadius = 0.05;  // Start close to home
    this.spiralAngle = (id * 137.5) % 360;  // Golden angle distribution
    this.gridX = 0;
    this.gridY = 0;

    // For probability-based search
    this.targetLat = null;
    this.targetLng = null;

    // Track distance covered
    this.distanceCovered = 0;

    // Recall training (owner knows pet's name, habits)
    this.recallBonus = this.isOwner ? 0.3 : 0;
  }

  /**
   * Activate searcher (start searching)
   */
  activate() {
    this.isActive = true;
  }

  /**
   * Move searcher for one time step
   */
  move(timeStepMinutes, focusLocation = null) {
    if (!this.isActive) return;

    // If there's a focus location (reported sighting), head there
    if (focusLocation && this.strategy !== 'GRID') {
      this.moveTowardTarget(focusLocation.lat, focusLocation.lng, timeStepMinutes);
      return;
    }

    // Otherwise, follow search pattern
    switch (this.strategy) {
      case 'GRID':
        this.moveGrid(timeStepMinutes);
        break;
      case 'SPIRAL':
        this.moveSpiral(timeStepMinutes);
        break;
      case 'PROBABILITY':
        this.moveProbability(timeStepMinutes);
        break;
      case 'RANDOM':
      default:
        this.moveRandom(timeStepMinutes);
    }
  }

  /**
   * Grid search pattern - systematic coverage
   */
  moveGrid(timeStepMinutes) {
    const gridSpacing = 0.1;  // Miles between grid lines
    const distance = this.currentSpeed * timeStepMinutes;

    // Move along current heading
    const radHeading = this.heading * Math.PI / 180;
    const dLat = distance * Math.cos(radHeading) / 69;  // 69 miles per degree lat
    const dLng = distance * Math.sin(radHeading) / (69 * Math.cos(this.lat * Math.PI / 180));

    this.lat += dLat;
    this.lng += dLng;
    this.distanceCovered += distance;

    // Check if we've gone too far from home
    const distFromHome = this.distanceFrom(this.homeLat, this.homeLng);
    if (distFromHome > this.searchRadius) {
      // Turn around
      this.heading = (this.heading + 180) % 360;
      // Shift to next grid line
      this.gridX += 1;
      if (this.gridX > this.searchRadius / gridSpacing) {
        this.gridX = 0;
        this.gridY += 1;
      }
    }
  }

  /**
   * Spiral search pattern - expanding circles
   */
  moveSpiral(timeStepMinutes) {
    const distance = this.currentSpeed * timeStepMinutes;

    // Expand the spiral
    this.spiralAngle += 15;  // Degrees per step
    this.spiralRadius += 0.002;  // Expand outward

    // Cap at search radius
    if (this.spiralRadius > this.searchRadius) {
      this.spiralRadius = 0.05;  // Reset to start
    }

    // Calculate new position
    const radAngle = this.spiralAngle * Math.PI / 180;
    this.lat = this.homeLat + (this.spiralRadius / 69) * Math.cos(radAngle);
    this.lng = this.homeLng + (this.spiralRadius / (69 * Math.cos(this.homeLat * Math.PI / 180))) * Math.sin(radAngle);

    this.distanceCovered += distance;
  }

  /**
   * Probability-based search - focus on likely areas
   */
  moveProbability(timeStepMinutes) {
    const distance = this.currentSpeed * timeStepMinutes;

    // If no target or reached target, pick a new one
    if (!this.targetLat || this.distanceFrom(this.targetLat, this.targetLng) < 0.02) {
      // Focus on areas where pets are likely to be
      // (close to home, with cover)
      const angle = this.random() * 360;
      const radius = Math.pow(this.random(), 2) * this.searchRadius;  // Bias toward closer areas

      const radAngle = angle * Math.PI / 180;
      this.targetLat = this.homeLat + (radius / 69) * Math.cos(radAngle);
      this.targetLng = this.homeLng + (radius / (69 * Math.cos(this.homeLat * Math.PI / 180))) * Math.sin(radAngle);
    }

    this.moveTowardTarget(this.targetLat, this.targetLng, timeStepMinutes);
  }

  /**
   * Random walk (uncoordinated search)
   */
  moveRandom(timeStepMinutes) {
    const distance = this.currentSpeed * timeStepMinutes;

    // Random heading changes
    this.heading += (this.random() - 0.5) * 60;  // ±30 degrees

    const radHeading = this.heading * Math.PI / 180;
    const dLat = distance * Math.cos(radHeading) / 69;
    const dLng = distance * Math.sin(radHeading) / (69 * Math.cos(this.lat * Math.PI / 180));

    this.lat += dLat;
    this.lng += dLng;
    this.distanceCovered += distance;

    // Bounce back if too far from home
    const distFromHome = this.distanceFrom(this.homeLat, this.homeLng);
    if (distFromHome > this.searchRadius) {
      // Head back toward home
      this.heading = this.headingTo(this.homeLat, this.homeLng);
    }
  }

  /**
   * Move toward a target position
   */
  moveTowardTarget(targetLat, targetLng, timeStepMinutes) {
    const distance = this.currentSpeed * timeStepMinutes;

    // Calculate heading to target
    this.heading = this.headingTo(targetLat, targetLng);

    const radHeading = this.heading * Math.PI / 180;
    const dLat = distance * Math.cos(radHeading) / 69;
    const dLng = distance * Math.sin(radHeading) / (69 * Math.cos(this.lat * Math.PI / 180));

    this.lat += dLat;
    this.lng += dLng;
    this.distanceCovered += distance;
  }

  /**
   * Check if this searcher can detect a pet at the given position
   *
   * Returns: { detected: boolean, distance: number, method: string }
   */
  checkDetection(petLat, petLng, petState, currentHour, environment) {
    if (!this.isActive) return { detected: false };

    const distance = this.distanceFrom(petLat, petLng);

    // Determine detection range based on conditions
    const isNight = currentHour < 6 || currentHour > 20;
    const isHiding = petState === 'HIDING';
    const isFleeing = petState === 'FLEEING';

    // Visual detection range
    let visualRange = isNight ? BASE_DETECTION_RANGE.NIGHT_VISUAL : BASE_DETECTION_RANGE.DAY_VISUAL;

    // Concealment reduces visual range
    const concealment = environment.getConcealmentAt(petLat, petLng);
    visualRange *= (1 - concealment * 0.7);

    // Hiding pets are harder to see
    if (isHiding) {
      visualRange *= 0.3;
    }

    // Audio detection range
    let audioRange = isNight ? BASE_DETECTION_RANGE.NIGHT_AUDIO : BASE_DETECTION_RANGE.DAY_AUDIO;

    // Fleeing pets make more noise
    if (isFleeing) {
      audioRange *= 1.5;
    }

    // Hiding pets are quiet
    if (isHiding) {
      audioRange *= 0.2;
    }

    // Owner bonus (knows pet's sounds)
    if (this.isOwner) {
      audioRange *= 1.3;
    }

    // Check detection
    if (distance <= visualRange) {
      return { detected: true, distance, method: 'visual' };
    }

    if (distance <= audioRange) {
      // Audio detection has random chance
      const audioDetectProb = 0.3 * (1 - distance / audioRange);
      if (this.random() < audioDetectProb) {
        return { detected: true, distance, method: 'audio' };
      }
    }

    return { detected: false, distance };
  }

  /**
   * Calculate distance to a point
   */
  distanceFrom(lat, lng) {
    const R = 3959;  // Earth radius in miles
    const dLat = (lat - this.lat) * Math.PI / 180;
    const dLng = (lng - this.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(this.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate heading to a point
   */
  headingTo(lat, lng) {
    const dLng = (lng - this.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat * Math.PI / 180);
    const x = Math.cos(this.lat * Math.PI / 180) * Math.sin(lat * Math.PI / 180) -
              Math.sin(this.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  /**
   * Get current position
   */
  getPosition() {
    return { lat: this.lat, lng: this.lng };
  }
}

/**
 * Create a team of searcher agents
 */
export function createSearchTeam(count, config, homePosition, random) {
  const searchers = [];
  for (let i = 0; i < count; i++) {
    searchers.push(new SearcherAgent(i, config, homePosition, random));
  }
  return searchers;
}
