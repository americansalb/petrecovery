/**
 * SearcherAgent - Simulates volunteer search behavior
 *
 * Strategies: GRID, SPIRAL, RANDOM, PROBABILITY
 */

// Search speed in miles per 5 minutes
const BASE_SPEED = 0.04; // ~0.48 mph = walking while searching

export class SearcherAgent {
  constructor(id, config, random) {
    this.id = id;
    this.config = config;
    this.random = random;

    // Start position (distributed around center based on strategy)
    const startPositions = this.calculateStartPosition(id, config);
    this.lat = startPositions.lat;
    this.lng = startPositions.lng;

    // Strategy-specific state
    this.strategy = config.searchStrategy;
    this.direction = random() * 360;
    this.spiralAngle = id * (360 / config.searcherCount);
    this.spiralRadius = 0.05; // Starting radius in miles

    // Grid-specific
    this.gridCellSize = 0.02; // miles
    this.currentGridX = 0;
    this.currentGridY = 0;
    this.gridDirection = 1;

    // Fatigue tracking
    this.startMinute = 0;
    this.hoursSearching = 0;
    this.fatigueModifier = 1.0;

    // Speed based on config
    this.speed = (config.searcherSpeedMph / 60) * config.timeStepMinutes;
  }

  /**
   * Calculate starting position for searcher
   * Searchers start at the "last seen" location edge, not at center
   * This represents arriving at the search area perimeter
   */
  calculateStartPosition(id, config) {
    const count = config.searcherCount;
    // Start at search area edge, not center (more realistic - searchers arrive at perimeter)
    const baseRadius = Math.min(0.3, config.searchRadiusMiles * 0.3); // 30% of search radius, min 0.3 miles

    switch (config.searchStrategy) {
      case 'GRID':
        // Distribute at edge of search area for grid coverage
        const gridSize = Math.ceil(Math.sqrt(count));
        const row = Math.floor(id / gridSize);
        const col = id % gridSize;
        // Start at edges and work inward
        const edgeOffset = config.searchRadiusMiles * 0.8;
        return {
          lat: config.centerLatitude + ((row - gridSize / 2) * (edgeOffset * 2 / gridSize)) / 69,
          lng: config.centerLongitude + ((col - gridSize / 2) * (edgeOffset * 2 / gridSize)) / (69 * Math.cos(config.centerLatitude * Math.PI / 180)),
        };

      case 'SPIRAL':
        // Start at perimeter, spiral inward
        const angle = (id / count) * 360;
        const spiralStartRadius = config.searchRadiusMiles * 0.4;
        return {
          lat: config.centerLatitude + (spiralStartRadius * Math.cos(angle * Math.PI / 180)) / 69,
          lng: config.centerLongitude + (spiralStartRadius * Math.sin(angle * Math.PI / 180)) / (69 * Math.cos(config.centerLatitude * Math.PI / 180)),
        };

      case 'PROBABILITY':
        // Start spread out, converge on high probability zones
        const probAngle = (id / count) * 360;
        const probRadius = baseRadius + (this.random() * baseRadius * 0.5);
        return {
          lat: config.centerLatitude + (probRadius * Math.cos(probAngle * Math.PI / 180)) / 69,
          lng: config.centerLongitude + (probRadius * Math.sin(probAngle * Math.PI / 180)) / (69 * Math.cos(config.centerLatitude * Math.PI / 180)),
        };

      case 'RANDOM':
      default:
        // Random positions, but not too close to center
        const randAngle = this.random() * 360;
        const minRadius = config.searchRadiusMiles * 0.2;
        const maxRadius = config.searchRadiusMiles * 0.8;
        const randRadius = minRadius + this.random() * (maxRadius - minRadius);
        return {
          lat: config.centerLatitude + (randRadius * Math.cos(randAngle * Math.PI / 180)) / 69,
          lng: config.centerLongitude + (randRadius * Math.sin(randAngle * Math.PI / 180)) / (69 * Math.cos(config.centerLatitude * Math.PI / 180)),
        };
    }
  }

  /**
   * Move according to search strategy
   */
  move(minute, currentHour) {
    switch (this.strategy) {
      case 'GRID':
        this.moveGrid();
        break;
      case 'SPIRAL':
        this.moveSpiral();
        break;
      case 'PROBABILITY':
        this.moveProbability();
        break;
      case 'RANDOM':
      default:
        this.moveRandom();
        break;
    }

    // Stay within search radius
    this.constrainToSearchArea();
  }

  /**
   * Grid search pattern - systematic coverage
   */
  moveGrid() {
    // Move in current direction
    if (this.gridDirection > 0) {
      this.lng += this.speed / (69 * Math.cos(this.lat * Math.PI / 180));
      this.currentGridX += 1;
    } else {
      this.lng -= this.speed / (69 * Math.cos(this.lat * Math.PI / 180));
      this.currentGridX -= 1;
    }

    // Check if we need to move to next row
    const distFromCenter = Math.abs(this.lng - this.config.centerLongitude) * 69 * Math.cos(this.lat * Math.PI / 180);
    if (distFromCenter > this.config.searchRadiusMiles) {
      // Move to next row
      this.lat += this.gridCellSize / 69;
      this.gridDirection *= -1;
    }
  }

  /**
   * Spiral search pattern - expanding from center
   */
  moveSpiral() {
    this.spiralAngle += 15; // degrees per tick
    this.spiralRadius += 0.002; // Slowly expand

    // Don't go beyond search radius
    if (this.spiralRadius > this.config.searchRadiusMiles) {
      this.spiralRadius = 0.05; // Reset to center
    }

    this.lat = this.config.centerLatitude +
      (this.spiralRadius * Math.cos(this.spiralAngle * Math.PI / 180)) / 69;
    this.lng = this.config.centerLongitude +
      (this.spiralRadius * Math.sin(this.spiralAngle * Math.PI / 180)) /
      (69 * Math.cos(this.config.centerLatitude * Math.PI / 180));
  }

  /**
   * Probability-weighted search - focus on high probability zones
   */
  moveProbability() {
    // Calculate current distance from center
    const distFromCenter = this.getDistanceFromCenter();

    // Determine target zone based on probability
    // HIGH zone: 67.5%, within base radius
    // MEDIUM zone: 18%, 1-2x base radius
    // LOW zone: 3.6%, 2-4x base radius
    const rand = this.random();
    let targetRadiusFraction;

    if (rand < 0.675) {
      targetRadiusFraction = 0.25; // HIGH zone
    } else if (rand < 0.855) {
      targetRadiusFraction = 0.5; // MEDIUM zone
    } else {
      targetRadiusFraction = 0.75; // LOW zone
    }

    const targetRadius = this.config.searchRadiusMiles * targetRadiusFraction;

    // Move toward target zone with some randomness
    if (distFromCenter < targetRadius - 0.1) {
      // Move outward
      this.direction = this.getDirectionFromCenter() + (this.random() - 0.5) * 60;
    } else if (distFromCenter > targetRadius + 0.1) {
      // Move inward
      this.direction = (this.getDirectionFromCenter() + 180) % 360 + (this.random() - 0.5) * 60;
    } else {
      // Patrol within zone
      this.direction += (this.random() - 0.5) * 90;
    }

    this.applyMovement();
  }

  /**
   * Random search pattern - uncoordinated
   */
  moveRandom() {
    // Change direction randomly
    this.direction += (this.random() - 0.5) * 120;
    this.applyMovement();
  }

  /**
   * Apply movement in current direction
   */
  applyMovement() {
    const latChange = this.speed * Math.cos(this.direction * Math.PI / 180) / 69;
    const lngChange = this.speed * Math.sin(this.direction * Math.PI / 180) /
      (69 * Math.cos(this.lat * Math.PI / 180));

    this.lat += latChange;
    this.lng += lngChange;
  }

  /**
   * Constrain position to search area
   */
  constrainToSearchArea() {
    const dist = this.getDistanceFromCenter();
    if (dist > this.config.searchRadiusMiles) {
      // Move back toward center
      const dirToCenter = (this.getDirectionFromCenter() + 180) % 360;
      const excess = dist - this.config.searchRadiusMiles;
      this.lat += (excess * Math.cos(dirToCenter * Math.PI / 180)) / 69;
      this.lng += (excess * Math.sin(dirToCenter * Math.PI / 180)) /
        (69 * Math.cos(this.lat * Math.PI / 180));
    }
  }

  /**
   * Update fatigue level
   */
  updateFatigue(minute) {
    this.hoursSearching = minute / 60;

    // Fatigue modifiers (affects detection probability)
    if (this.hoursSearching < 2) {
      this.fatigueModifier = 1.0;
    } else if (this.hoursSearching < 4) {
      this.fatigueModifier = 0.9;
    } else if (this.hoursSearching < 6) {
      this.fatigueModifier = 0.75;
    } else {
      this.fatigueModifier = 0.5;
    }
  }

  /**
   * Get distance from center in miles
   */
  getDistanceFromCenter() {
    const R = 3959;
    const dLat = (this.lat - this.config.centerLatitude) * Math.PI / 180;
    const dLng = (this.lng - this.config.centerLongitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(this.lat * Math.PI / 180) * Math.cos(this.config.centerLatitude * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get direction from center (degrees)
   */
  getDirectionFromCenter() {
    const dLng = this.lng - this.config.centerLongitude;
    const dLat = this.lat - this.config.centerLatitude;
    const angle = Math.atan2(dLng, dLat) * 180 / Math.PI;
    return (angle + 360) % 360;
  }
}
