/**
 * Behavioral Profiles Monte Carlo Simulation Engine
 * Based on BEHAVIORAL_PROFILES.md research
 */

import {
  Species, Temperament, AnimalProfile, AnimalState, Position,
  SimulationConfig, SimulationResult, PathPoint, BatchResult,
  CatHidingPhase,
} from './types';
import {
  DOG_TEMPERAMENTS, CAT_TEMPERAMENTS, DISPLACEMENT,
  MOVEMENT_SPEEDS, PHYSIOLOGY, TIME_OF_DAY, SEARCHER_PARAMS,
} from './constants';

// Seeded random number generator
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  uniform(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  gauss(mean: number, stddev: number): number {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  }
}

// Helper functions
function distance(p1: Position, p2: Position): number {
  const latDiff = (p1.lat - p2.lat) * 111000;
  const lngDiff = (p1.lng - p2.lng) * 111000 * Math.cos(p1.lat * Math.PI / 180);
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}

function offsetPosition(pos: Position, distanceM: number, bearingDeg: number): Position {
  const bearingRad = bearingDeg * Math.PI / 180;
  const latOffset = (distanceM * Math.cos(bearingRad)) / 111000;
  const lngOffset = (distanceM * Math.sin(bearingRad)) / (111000 * Math.cos(pos.lat * Math.PI / 180));
  return { lat: pos.lat + latOffset, lng: pos.lng + lngOffset };
}

function getTimePeriod(hour: number): string {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

function sampleLognormal(rng: SeededRandom, median: number, q75: number): number {
  const sigma = Math.log(q75 / median) / 0.6745;
  const mu = Math.log(median);
  return Math.exp(rng.gauss(mu, sigma));
}

// Searcher agent class
class SearcherAgent {
  id: number;
  position: Position;
  homePosition: Position;
  heading: number;
  searchRadius: number;
  isActive: boolean;
  path: PathPoint[] = [];
  private rng: SeededRandom;
  private searchPattern: 'spiral' | 'grid' | 'random';
  private spiralAngle: number = 0;
  private spiralRadius: number = 50;

  constructor(id: number, home: Position, rng: SeededRandom) {
    this.id = id;
    this.homePosition = { ...home };
    this.position = { ...home };
    this.heading = rng.uniform(0, 360);
    this.searchRadius = 2000;
    this.isActive = false;
    this.rng = rng;
    // Randomize search pattern
    const patterns: Array<'spiral' | 'grid' | 'random'> = ['spiral', 'grid', 'random'];
    this.searchPattern = patterns[Math.floor(rng.next() * 3)];
  }

  update(hour: number, timeStepHours: number, currentTimeOfDay: number): void {
    // Searchers only active during daylight (7am - 9pm)
    if (currentTimeOfDay < 7 || currentTimeOfDay > 21) {
      this.isActive = false;
      // Return home at night
      this.position = { ...this.homePosition };
      return;
    }

    // Start searching after initial hours
    if (hour < 2) {
      this.isActive = false;
      return;
    }

    this.isActive = true;
    const speed = 3000; // 3 km/h walking speed
    const distanceM = speed * timeStepHours;

    switch (this.searchPattern) {
      case 'spiral':
        this.spiralAngle += 15;
        this.spiralRadius = Math.min(this.searchRadius, 50 + hour * 30);
        this.heading = this.spiralAngle;
        const spiralDist = Math.min(distanceM, this.spiralRadius / 10);
        this.position = offsetPosition(this.homePosition, this.spiralRadius, this.spiralAngle);
        break;

      case 'grid':
        // Grid pattern - move in cardinal directions
        if (this.rng.next() < 0.2) {
          this.heading = Math.round(this.heading / 90) * 90 + (this.rng.next() < 0.5 ? 90 : -90);
        }
        this.position = offsetPosition(this.position, distanceM, this.heading);
        break;

      case 'random':
        // Random walk with tendency to cover new ground
        this.heading += this.rng.uniform(-30, 30);
        this.position = offsetPosition(this.position, distanceM, this.heading);
        break;
    }

    // Keep within search radius
    const distFromHome = distance(this.position, this.homePosition);
    if (distFromHome > this.searchRadius) {
      // Turn back toward home
      const homeDir = Math.atan2(
        this.homePosition.lng - this.position.lng,
        this.homePosition.lat - this.position.lat
      ) * 180 / Math.PI;
      this.heading = homeDir;
      this.position = offsetPosition(this.position, distanceM, this.heading);
    }

    // Record path
    this.path.push({
      hour,
      lat: this.position.lat,
      lng: this.position.lng,
      fear: 0,
      hunger: 0,
      state: this.isActive ? 'searching' : 'inactive',
    });
  }
}

export class BehavioralSimulationEngine {
  private profile: AnimalProfile;
  private config: SimulationConfig;
  private rng: SeededRandom;
  private state: AnimalState;
  private homePosition: Position;
  private path: PathPoint[] = [];
  private searchers: SearcherAgent[] = [];
  private thresholdHours: number = 0;
  private totalDistanceM: number = 0;
  private maxDistanceM: number = 0;
  private heading: number = 0;

  constructor(
    profile: AnimalProfile,
    startPosition: Position,
    config: SimulationConfig
  ) {
    this.profile = profile;
    this.homePosition = startPosition;
    this.config = config;
    this.rng = new SeededRandom(config.seed || Math.floor(Math.random() * 1000000));

    // Initialize state
    this.state = {
      position: { ...startPosition },
      fearLevel: 0.8,
      hungerLevel: 0,
      thirstLevel: 0,
      stamina: 1.0,
      isHiding: false,
      hoursSinceEscape: 0,
      isDeceased: false,
    };

    // Cat-specific: threshold phenomenon
    if (profile.species === 'cat') {
      const tempParams = CAT_TEMPERAMENTS[profile.temperament as keyof typeof CAT_TEMPERAMENTS];
      if (tempParams) {
        const thresholdDays = this.rng.uniform(tempParams.thresholdDays.min, tempParams.thresholdDays.max);
        this.thresholdHours = thresholdDays * 24;
        this.state.hidingPhase = 'INITIAL';
        this.state.thresholdReached = false;
      }
    }

    this.heading = this.rng.uniform(0, 360);

    // Initialize searchers
    for (let i = 0; i < config.numSearchers; i++) {
      this.searchers.push(new SearcherAgent(i, startPosition, this.rng));
    }
  }

  run(): SimulationResult {
    const timeStepHours = this.config.timeStepMinutes / 60;
    const maxSteps = Math.ceil(this.config.maxHours / timeStepHours);
    let currentHour = this.config.startHour;
    let outcome = 'timeout';
    let outcomeTime: number | null = null;

    for (let step = 0; step < maxSteps; step++) {
      const simHour = step * timeStepHours;

      // Record path
      this.path.push({
        hour: simHour,
        lat: this.state.position.lat,
        lng: this.state.position.lng,
        fear: this.state.fearLevel,
        hunger: this.state.hungerLevel,
        state: this.getStateString(),
      });

      // Update physiology
      this.updatePhysiology(timeStepHours);

      // Check for death
      if (this.checkDeath()) {
        outcome = 'deceased';
        outcomeTime = simHour;
        break;
      }

      // Update fear
      this.updateFear(timeStepHours);

      // Move
      this.move(timeStepHours, currentHour);

      // Track distance
      const distFromHome = distance(this.state.position, this.homePosition);
      this.maxDistanceM = Math.max(this.maxDistanceM, distFromHome);

      // Check for self-return
      if (this.checkSelfReturn(distFromHome)) {
        outcome = 'self_return';
        outcomeTime = simHour;
        break;
      }

      // Update searcher positions
      for (const searcher of this.searchers) {
        searcher.update(simHour, timeStepHours, currentHour);
      }

      // Check for detection by searchers
      if (this.checkDetection(simHour, currentHour)) {
        outcome = 'captured';
        outcomeTime = simHour;
        break;
      }

      // Advance time
      currentHour = (currentHour + timeStepHours) % 24;
      this.state.hoursSinceEscape = simHour;
    }

    return {
      id: `sim_${this.config.seed}_${Date.now()}`,
      seed: this.config.seed || 0,
      outcome,
      outcomeDescription: this.getOutcomeDescription(outcome),
      timeToOutcomeHours: outcomeTime,
      finalPosition: { ...this.state.position },
      petPath: this.path,
      searcherPaths: this.searchers.map(s => s.path),
      petDistanceM: this.totalDistanceM,
      maxDistanceFromHomeM: this.maxDistanceM,
      stats: {
        avgFear: this.path.reduce((s, p) => s + p.fear, 0) / this.path.length,
        peakHunger: Math.max(...this.path.map(p => p.hunger)),
        hidingHours: this.path.filter(p => p.state === 'hiding').length * (this.config.timeStepMinutes / 60),
      },
    };
  }

  private updatePhysiology(hours: number): void {
    this.state.hungerLevel = Math.min(1, this.state.hungerLevel + PHYSIOLOGY.hunger.ratePerHour * hours);
    this.state.thirstLevel = Math.min(1, this.state.thirstLevel + PHYSIOLOGY.thirst.ratePerHour * hours);

    // Stamina
    if (this.state.fearLevel > 0.7) {
      this.state.stamina = Math.max(0, this.state.stamina - PHYSIOLOGY.stamina.drainFleeing * hours);
    } else if (this.state.isHiding) {
      this.state.stamina = Math.min(1, this.state.stamina + PHYSIOLOGY.stamina.recoveryResting * hours);
    } else {
      this.state.stamina = Math.max(0, this.state.stamina - PHYSIOLOGY.stamina.drainTraveling * hours);
    }
  }

  private checkDeath(): boolean {
    if (this.state.thirstLevel >= PHYSIOLOGY.thirst.criticalThreshold && this.rng.next() < 0.05) {
      this.state.isDeceased = true;
      return true;
    }
    if (this.state.hungerLevel >= PHYSIOLOGY.hunger.criticalThreshold && this.rng.next() < 0.02) {
      this.state.isDeceased = true;
      return true;
    }
    return false;
  }

  private updateFear(hours: number): void {
    if (this.profile.species === 'dog') {
      // Dogs: exponential decay
      const params = DOG_TEMPERAMENTS[this.profile.temperament as keyof typeof DOG_TEMPERAMENTS];
      if (params) {
        const decay = Math.exp(-params.fearDecayRate * hours);
        this.state.fearLevel *= decay;
      }
    } else {
      // Cats: threshold phenomenon
      if (!this.state.thresholdReached && this.state.hoursSinceEscape >= this.thresholdHours) {
        this.state.thresholdReached = true;
        this.state.hidingPhase = 'EMERGENCE';
      }

      if (this.state.thresholdReached) {
        // Post-threshold: gradual fear reduction
        this.state.fearLevel = Math.max(0.2, this.state.fearLevel - 0.02 * hours);
      }
    }
  }

  private move(hours: number, currentHour: number): void {
    const species = this.profile.species;
    const timePeriod = getTimePeriod(currentHour);
    const activityMult = TIME_OF_DAY[species][timePeriod as keyof typeof TIME_OF_DAY.dog];

    // Determine movement state
    let speed = 0;
    if (this.state.fearLevel > 0.7) {
      speed = MOVEMENT_SPEEDS[species].fleeing;
      this.state.isHiding = false;
    } else if (this.state.fearLevel > 0.4) {
      speed = MOVEMENT_SPEEDS[species].traveling;
      this.state.isHiding = false;
    } else if (species === 'cat' && !this.state.thresholdReached) {
      // Cat in hiding phase
      this.state.isHiding = true;
      speed = 0;
    } else {
      // Foraging/exploring
      speed = MOVEMENT_SPEEDS[species].foraging;
      this.state.isHiding = this.rng.next() < 0.3;
    }

    // Apply activity multiplier and stamina
    speed *= activityMult * this.state.stamina;

    if (speed > 0) {
      // Calculate movement
      const distanceM = speed * hours;

      // Dogs: gravity spiral toward home
      if (species === 'dog' && this.state.fearLevel < 0.5) {
        const homeDir = Math.atan2(
          this.homePosition.lng - this.state.position.lng,
          this.homePosition.lat - this.state.position.lat
        ) * 180 / Math.PI;
        this.heading = this.heading * 0.7 + homeDir * 0.3 + this.rng.uniform(-30, 30);
      } else {
        // Random walk with persistence
        this.heading += this.rng.uniform(-45, 45);
      }

      this.heading = ((this.heading % 360) + 360) % 360;
      const newPos = offsetPosition(this.state.position, distanceM, this.heading);

      this.totalDistanceM += distanceM;
      this.state.position = newPos;
    }
  }

  private checkSelfReturn(distFromHome: number): boolean {
    if (distFromHome < 50 && this.state.fearLevel < 0.3) {
      // Close to home and calm
      const returnProb = this.profile.species === 'dog' ? 0.1 : 0.05;
      return this.rng.next() < returnProb;
    }
    return false;
  }

  private checkDetection(simHour: number, currentHour: number): boolean {
    if (simHour < 2) return false; // Search hasn't started

    // Check each active searcher for proximity detection
    for (const searcher of this.searchers) {
      if (!searcher.isActive) continue;

      const dist = distance(searcher.position, this.state.position);
      const detectionRangeM = 50; // 50 meters base detection range

      if (dist > detectionRangeM) continue;

      // Base detection probability when in range
      let detectionProb = 0.3; // 30% chance per timestep when in range

      // Modify by temperament - affects whether pet approaches or flees
      if (this.profile.species === 'dog') {
        const params = DOG_TEMPERAMENTS[this.profile.temperament as keyof typeof DOG_TEMPERAMENTS];
        if (params) {
          detectionProb *= params.approachOwnerProb;
        }
      } else {
        const params = CAT_TEMPERAMENTS[this.profile.temperament as keyof typeof CAT_TEMPERAMENTS];
        if (params) {
          // Cats are harder to catch, especially before threshold
          detectionProb *= this.state.thresholdReached ? 0.4 : 0.1;
        }
      }

      // Hiding reduces detection significantly
      if (this.state.isHiding) {
        detectionProb *= 0.1;
      }

      // High fear means pet may flee before capture
      if (this.state.fearLevel > 0.7) {
        detectionProb *= 0.3;
      }

      if (this.rng.next() < detectionProb) {
        return true;
      }
    }

    return false;
  }

  private getStateString(): string {
    if (this.state.isDeceased) return 'deceased';
    if (this.state.isHiding) return 'hiding';
    if (this.state.fearLevel > 0.7) return 'fleeing';
    if (this.state.fearLevel > 0.4) return 'traveling';
    return 'foraging';
  }

  private getOutcomeDescription(outcome: string): string {
    const descriptions: Record<string, string> = {
      captured: 'Found by searcher',
      self_return: 'Returned home on own',
      deceased: 'Did not survive',
      timeout: 'Still missing after search period',
    };
    return descriptions[outcome] || outcome;
  }
}

export function runBatch(
  profile: AnimalProfile,
  startPosition: Position,
  baseConfig: SimulationConfig,
  numRuns: number,
  onProgress?: (completed: number) => void
): BatchResult {
  const results: SimulationResult[] = [];
  const baseSeed = baseConfig.seed || Math.floor(Math.random() * 1000000);

  for (let i = 0; i < numRuns; i++) {
    const config = { ...baseConfig, seed: baseSeed + i };
    const engine = new BehavioralSimulationEngine(profile, startPosition, config);
    results.push(engine.run());

    if (onProgress) {
      onProgress(i + 1);
    }
  }

  // Calculate statistics
  const successfulRuns = results.filter(r => r.outcome === 'captured' || r.outcome === 'self_return');
  const successRate = successfulRuns.length / numRuns;

  const timesToFind = successfulRuns
    .filter(r => r.timeToOutcomeHours !== null)
    .map(r => r.timeToOutcomeHours as number);

  const avgTime = timesToFind.length > 0
    ? timesToFind.reduce((a, b) => a + b, 0) / timesToFind.length
    : null;

  const medianTime = timesToFind.length > 0
    ? timesToFind.sort((a, b) => a - b)[Math.floor(timesToFind.length / 2)]
    : null;

  const avgDistance = results.reduce((s, r) => s + r.maxDistanceFromHomeM, 0) / numRuns;

  const outcomes = {
    captured: results.filter(r => r.outcome === 'captured').length,
    selfReturn: results.filter(r => r.outcome === 'self_return').length,
    shelter: 0, // Not implemented in simplified version
    timeout: results.filter(r => r.outcome === 'timeout').length,
    deceased: results.filter(r => r.outcome === 'deceased').length,
  };

  return {
    id: `batch_${baseSeed}_${Date.now()}`,
    totalRuns: numRuns,
    successRate: successRate * 100,
    avgTimeToFindHours: avgTime,
    medianTimeToFindHours: medianTime,
    avgDistanceM: avgDistance,
    outcomes,
    simulations: results,
  };
}
