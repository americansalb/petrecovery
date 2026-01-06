/**
 * Behavioral Profiles Monte Carlo Simulation Engine
 * Based on BEHAVIORAL_PROFILES.md research
 */

import {
  Species, Temperament, AnimalProfile, AnimalState, Position,
  SimulationConfig, SimulationResult, PathPoint, BatchResult,
  CatHidingPhase, RoadSegment,
} from './types';
import {
  DOG_TEMPERAMENTS, CAT_TEMPERAMENTS, DISPLACEMENT,
  MOVEMENT_SPEEDS, PHYSIOLOGY, TIME_OF_DAY, SEARCHER_PARAMS, SURVIVAL,
} from './constants';
import { isInNaturalEarthWater } from '../terrain/naturalEarthWater';
import { checkRoadCrossing, RoadCrossingResult } from './terrain';

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
    // Box-Muller transform - avoid log(0) by ensuring u1 > 0
    let u1 = this.next();
    while (u1 === 0) u1 = this.next();
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

// Sample from a min/max range
function sampleRange(rng: SeededRandom, range: { min: number; max: number }): number {
  return rng.uniform(range.min, range.max);
}

// Check if point is inside a polygon using ray casting
function pointInPolygon(point: Position, polygon: Position[]): boolean {
  let inside = false;
  const x = point.lng, y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Multi-layer water detection system that works GLOBALLY
 *
 * Layer 1: OSM Overpass API data (most accurate for local water bodies)
 * Layer 2: Natural Earth data (authoritative global ocean & major lake polygons)
 *
 * Natural Earth data source: https://www.naturalearthdata.com/ (public domain)
 */
function isLikelyWater(
  pos: Position,
  homePos: Position,
  terrainData?: { waterPolygons: Array<{ points: Position[]; bbox: { south: number; west: number; north: number; east: number } }>; isCoastal: boolean }
): boolean {
  // === LAYER 1: OSM Terrain Data (most accurate for local water) ===
  // If we have OSM terrain data from the Overpass API, use it first
  // This catches ponds, small lakes, local water bodies
  if (terrainData && terrainData.waterPolygons.length > 0) {
    for (const water of terrainData.waterPolygons) {
      // Quick bbox check
      if (
        pos.lat < water.bbox.south ||
        pos.lat > water.bbox.north ||
        pos.lng < water.bbox.west ||
        pos.lng > water.bbox.east
      ) {
        continue;
      }
      // Full polygon check
      if (pointInPolygon(pos, water.points)) {
        return true;
      }
    }
  }

  // === LAYER 2: Natural Earth Data (authoritative global coverage) ===
  // Uses real geographic data from Natural Earth dataset
  // Covers all oceans and major lakes worldwide
  if (isInNaturalEarthWater(pos)) {
    return true;
  }

  return false;
}

// Get bearing from home to position (used for water avoidance)
function getBearing(from: Position, to: Position): number {
  const dLng = to.lng - from.lng;
  const y = Math.sin(dLng * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180);
  const x = Math.cos(from.lat * Math.PI / 180) * Math.sin(to.lat * Math.PI / 180) -
            Math.sin(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.cos(dLng * Math.PI / 180);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Physiology parameters sampled at initialization
interface SampledPhysiologyParams {
  hungerRate: number;
  thirstRate: number;
  staminaDrainFleeing: number;
  staminaDrainTraveling: number;
  staminaRecoveryResting: number;
}

// Survival parameters sampled at initialization for this pet
interface SampledSurvivalParams {
  dehydrationCriticalHours: number;
  dehydrationFatalHours: number;
  dehydrationDeathRate: number;
  starvationCriticalHours: number;
  starvationFatalHours: number;
  starvationDeathRate: number;
  hazardVehicleRate: number;
  hazardPredatorRate: number;
  hazardAccidentRate: number;
  sizeModifier: number;
  ageModifier: number;
  speciesModifier: number;
  indoorOnlyModifier: number;
}

// Terrain data type for water detection
type TerrainDataType = { waterPolygons: Array<{ points: Position[]; bbox: { south: number; west: number; north: number; east: number } }>; isCoastal: boolean } | undefined;

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
  private searchStartDelay: number;
  private terrainData: TerrainDataType;
  private skipTerrainChecks: boolean;
  private activeSearchHours: number = 0; // Track actual hours spent searching
  private isTransitioning: boolean = false; // Going home or returning to search area
  private lastSearchPosition: Position | null = null; // Last position before going home

  constructor(id: number, home: Position, rng: SeededRandom, searchStartDelay: number = 2, terrainData?: TerrainDataType, skipTerrainChecks: boolean = false) {
    this.id = id;
    this.homePosition = { ...home };
    this.position = { ...home };
    this.heading = rng.uniform(0, 360);
    this.searchRadius = 2000;
    this.isActive = false;
    this.rng = rng;
    this.searchStartDelay = searchStartDelay;
    this.terrainData = terrainData;
    this.skipTerrainChecks = skipTerrainChecks;
    // Randomize search pattern
    const patterns: Array<'spiral' | 'grid' | 'random'> = ['spiral', 'grid', 'random'];
    this.searchPattern = patterns[Math.floor(rng.next() * 3)];
  }

  update(hour: number, timeStepHours: number, currentTimeOfDay: number): void {
    const speed = 3000; // 3 km/h walking speed
    const distanceM = speed * timeStepHours;

    // Searchers only active during daylight (7am - 9pm)
    if (currentTimeOfDay < 7 || currentTimeOfDay > 21) {
      this.isActive = false;
      // Save last search position before heading home
      if (!this.isTransitioning && distance(this.position, this.homePosition) > 50) {
        this.lastSearchPosition = { ...this.position };
        this.isTransitioning = true;
      }
      // Gradually move toward home instead of teleporting
      const distToHome = distance(this.position, this.homePosition);
      if (distToHome > distanceM) {
        // Move toward home at walking speed
        const homeDir = Math.atan2(
          this.homePosition.lng - this.position.lng,
          this.homePosition.lat - this.position.lat
        ) * 180 / Math.PI;
        this.position = offsetPosition(this.position, distanceM, homeDir);
      } else {
        // Close enough, snap to home
        this.position = { ...this.homePosition };
        this.isTransitioning = false;
      }
      this.recordPath(hour);
      return;
    }

    // Start searching after configured delay
    if (hour < this.searchStartDelay) {
      this.isActive = false;
      this.recordPath(hour);
      return;
    }

    // If we have a saved search position (returning from night), move back to it
    if (this.lastSearchPosition && distance(this.position, this.lastSearchPosition) > distanceM) {
      this.isActive = true;
      this.isTransitioning = true;
      // Move toward last search position
      const targetDir = Math.atan2(
        this.lastSearchPosition.lng - this.position.lng,
        this.lastSearchPosition.lat - this.position.lat
      ) * 180 / Math.PI;
      this.position = offsetPosition(this.position, distanceM, targetDir);
      this.recordPath(hour);
      return;
    }

    // Clear transition state once we reach the search area
    if (this.lastSearchPosition) {
      this.lastSearchPosition = null;
      this.isTransitioning = false;
    }

    this.isActive = true;
    // Only accumulate search hours when actively searching (not transitioning)
    this.activeSearchHours += timeStepHours;

    let newPos: Position;

    switch (this.searchPattern) {
      case 'spiral':
        // Expanding spiral from home - based on active search hours, not total hours
        // Angle increases slowly: ~30 degrees per hour of actual searching
        this.spiralAngle += 30 * timeStepHours;
        // Radius grows slowly: starts at 50m, expands ~50m per active search hour, max 2km
        this.spiralRadius = Math.min(this.searchRadius, 50 + this.activeSearchHours * 50);
        this.heading = this.spiralAngle;
        // Move incrementally toward spiral target instead of teleporting
        const spiralTarget = offsetPosition(this.homePosition, this.spiralRadius, this.spiralAngle);
        const distToTarget = distance(this.position, spiralTarget);
        if (distToTarget > distanceM) {
          // Move toward spiral position at walking speed
          const targetDir = Math.atan2(
            spiralTarget.lng - this.position.lng,
            spiralTarget.lat - this.position.lat
          ) * 180 / Math.PI;
          newPos = offsetPosition(this.position, distanceM, targetDir);
        } else {
          // Close enough, use exact spiral position
          newPos = spiralTarget;
        }
        break;

      case 'grid':
        // Grid pattern - move in cardinal directions, turn at intervals
        // Move forward, occasionally turn 90 degrees
        if (this.rng.next() < 0.05 * timeStepHours * 60) { // ~5% chance per minute
          this.heading = Math.round(this.heading / 90) * 90 + (this.rng.next() < 0.5 ? 90 : -90);
        }
        newPos = offsetPosition(this.position, distanceM, this.heading);
        break;

      case 'random':
        // Random walk - gradual direction changes
        this.heading += this.rng.uniform(-15, 15) * timeStepHours * 12; // Smoother turns
        newPos = offsetPosition(this.position, distanceM, this.heading);
        break;

      default:
        newPos = this.position;
    }

    // Water avoidance - searchers don't search in water
    // Skip for batch runs - just need statistical outcomes
    if (!this.skipTerrainChecks && isLikelyWater(newPos, this.homePosition, this.terrainData)) {
      // Turn around and try a different direction
      this.heading = (this.heading + 180 + this.rng.uniform(-45, 45)) % 360;
      newPos = offsetPosition(this.position, distanceM, this.heading);
      // If still in water, stay put
      if (isLikelyWater(newPos, this.homePosition, this.terrainData)) {
        this.recordPath(hour);
        return;
      }
    }

    this.position = newPos;

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

    this.recordPath(hour);
  }

  private recordPath(hour: number): void {
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
  private survivalParams: SampledSurvivalParams;
  private physiologyParams: SampledPhysiologyParams;
  private lastDeathCheckHour: number = -1;
  private lastSelfReturnCheckDay: number = -1;

  constructor(
    profile: AnimalProfile,
    startPosition: Position,
    config: SimulationConfig
  ) {
    this.profile = profile;
    this.homePosition = startPosition;
    this.config = config;
    this.rng = new SeededRandom(config.seed || Math.floor(Math.random() * 1000000));

    // Sample parameters from ranges for this specific pet
    this.survivalParams = this.sampleSurvivalParams(profile);
    this.physiologyParams = this.samplePhysiologyParams();

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

    // === CRITICAL: Check if starting position is in water ===
    // If the user clicked on water, find nearest land position
    // Skip for batch runs - just need statistical outcomes, not accurate geography
    if (!config.skipTerrainChecks && isLikelyWater(this.state.position, this.homePosition, config.terrainData)) {
      const escapedPos = this.escapeFromWater(this.state.position);
      if (escapedPos) {
        this.state.position = escapedPos;
        this.homePosition = escapedPos; // Also update home if it was in water
      }
    }

    // Initialize searchers with terrain data for water avoidance
    const searchDelay = config.searchStartDelay ?? 2;
    const terrainData = config.terrainData;
    const skipTerrain = config.skipTerrainChecks ?? false;
    for (let i = 0; i < config.numSearchers; i++) {
      this.searchers.push(new SearcherAgent(i, startPosition, this.rng, searchDelay, terrainData, skipTerrain));
    }
  }

  // Sample physiology parameters from ranges
  private samplePhysiologyParams(): SampledPhysiologyParams {
    return {
      hungerRate: sampleRange(this.rng, PHYSIOLOGY.hunger.ratePerHour),
      thirstRate: sampleRange(this.rng, PHYSIOLOGY.thirst.ratePerHour),
      staminaDrainFleeing: sampleRange(this.rng, PHYSIOLOGY.stamina.drainFleeing),
      staminaDrainTraveling: sampleRange(this.rng, PHYSIOLOGY.stamina.drainTraveling),
      staminaRecoveryResting: sampleRange(this.rng, PHYSIOLOGY.stamina.recoveryResting),
    };
  }

  // Sample survival parameters from ranges based on pet profile
  private sampleSurvivalParams(profile: AnimalProfile): SampledSurvivalParams {
    const sizeKey = profile.size as keyof typeof SURVIVAL.modifiers.size;
    const ageKey = profile.age as keyof typeof SURVIVAL.modifiers.age;
    const speciesKey = profile.species as keyof typeof SURVIVAL.modifiers.species;

    const sizeMod = SURVIVAL.modifiers.size[sizeKey] || SURVIVAL.modifiers.size.MED;
    const ageMod = SURVIVAL.modifiers.age[ageKey] || SURVIVAL.modifiers.age.ADT;
    const speciesMod = SURVIVAL.modifiers.species[speciesKey] || SURVIVAL.modifiers.species.dog;

    return {
      dehydrationCriticalHours: sampleRange(this.rng, SURVIVAL.dehydration.criticalAfterHours),
      dehydrationFatalHours: sampleRange(this.rng, SURVIVAL.dehydration.fatalAfterHours),
      dehydrationDeathRate: sampleRange(this.rng, SURVIVAL.dehydration.deathRatePerHour),
      starvationCriticalHours: sampleRange(this.rng, SURVIVAL.starvation.criticalAfterHours),
      starvationFatalHours: sampleRange(this.rng, SURVIVAL.starvation.fatalAfterHours),
      starvationDeathRate: sampleRange(this.rng, SURVIVAL.starvation.deathRatePerHour),
      hazardVehicleRate: sampleRange(this.rng, SURVIVAL.hazards.vehicleStrike.nearRoad),
      hazardPredatorRate: sampleRange(this.rng, SURVIVAL.hazards.predator.nighttime),
      hazardAccidentRate: sampleRange(this.rng, SURVIVAL.hazards.accident.general),
      sizeModifier: sizeMod.survival,
      ageModifier: ageMod.survival,
      speciesModifier: speciesMod.outdoorSurvival,
      indoorOnlyModifier: profile.isIndoorOnly ? SURVIVAL.modifiers.indoorOnly.survivalPenalty : 1.0,
    };
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

      // Check for death (per-hour check with survival modifiers)
      if (this.checkDeath(simHour, currentHour)) {
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

      // Check for self-return (daily check)
      if (this.checkSelfReturn(distFromHome, simHour)) {
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
      startPosition: { ...this.homePosition }, // Actual start position (may differ if escaped from water)
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
    const params = this.physiologyParams;

    this.state.hungerLevel = Math.min(1, this.state.hungerLevel + params.hungerRate * hours);
    this.state.thirstLevel = Math.min(1, this.state.thirstLevel + params.thirstRate * hours);

    // Stamina - depends on current activity
    if (this.state.fearLevel > 0.7) {
      // Fleeing drains stamina fastest
      this.state.stamina = Math.max(0, this.state.stamina - params.staminaDrainFleeing * hours);
    } else if (this.state.isHiding) {
      // Resting recovers stamina
      this.state.stamina = Math.min(1, this.state.stamina + params.staminaRecoveryResting * hours);
    } else {
      // Traveling drains stamina moderately
      this.state.stamina = Math.max(0, this.state.stamina - params.staminaDrainTraveling * hours);
    }
  }

  private checkDeath(simHour: number, currentTimeOfDay: number): boolean {
    // Only check once per DAY (every 24 hours) to avoid compounding probability
    // In reality, death is rare - most lost pets survive
    const currentDayFloor = Math.floor(simHour / 24);
    if (currentDayFloor <= this.lastDeathCheckHour) {
      return false;
    }
    this.lastDeathCheckHour = currentDayFloor;

    const params = this.survivalParams;

    // Combined survival modifier from all factors
    // Higher = better survival = lower death rate
    const survivalModifier = params.sizeModifier * params.ageModifier *
                             params.speciesModifier * params.indoorOnlyModifier;

    // Base daily death probability is VERY LOW for healthy pets
    // A healthy adult medium pet should have ~0.1% daily death rate (~3% over 30 days)
    // This accounts for all causes: accidents, vehicles, predators, etc.
    let dailyDeathRate = 0.001; // 0.1% base daily rate

    // === MODIFIERS ===

    // Size affects vulnerability
    if (this.profile.size === 'TOY') {
      dailyDeathRate *= 2.5; // Toy breeds more vulnerable
    } else if (this.profile.size === 'SML') {
      dailyDeathRate *= 1.5;
    } else if (this.profile.size === 'LRG' || this.profile.size === 'GNT') {
      dailyDeathRate *= 0.7; // Larger pets are hardier
    }

    // Age affects vulnerability
    if (this.profile.age === 'PUP' || this.profile.age === 'KIT') {
      dailyDeathRate *= 3; // Very young are vulnerable
    } else if (this.profile.age === 'JUV') {
      dailyDeathRate *= 1.5;
    } else if (this.profile.age === 'SEN') {
      dailyDeathRate *= 2; // Seniors more vulnerable
    }

    // Indoor-only pets are less street-smart
    if (this.profile.isIndoorOnly) {
      dailyDeathRate *= 1.5;
    }

    // Cats are generally better at outdoor survival than small dogs
    if (this.profile.species === 'cat') {
      dailyDeathRate *= 0.8;
    }

    // Very long duration increases risk slightly (exhaustion, exposure)
    const dayNumber = Math.floor(simHour / 24);
    if (dayNumber > 14) {
      // After 2 weeks, slightly increased risk
      dailyDeathRate *= 1 + (dayNumber - 14) * 0.02; // +2% per day after day 14
    }

    // Apply overall survival modifier
    dailyDeathRate /= survivalModifier;

    // Cap the daily rate at 2% to prevent unrealistic outcomes
    dailyDeathRate = Math.min(dailyDeathRate, 0.02);

    if (this.rng.next() < dailyDeathRate) {
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
      let newPos = offsetPosition(this.state.position, distanceM, this.heading);

      // Skip terrain checks for batch simulations (just need statistical outcomes)
      if (!this.config.skipTerrainChecks) {
        // Water/terrain avoidance - if new position is in water, try alternatives
        if (isLikelyWater(newPos, this.homePosition, this.config.terrainData)) {
          // Try multiple escape directions
          const escapeDirections = [
            this.heading + 180, // Opposite direction
            this.heading + 90,  // Right
            this.heading - 90,  // Left
            this.heading + 135, // Back-right
            this.heading - 135, // Back-left
            this.heading + 45,  // Forward-right
            this.heading - 45,  // Forward-left
          ];

          let escaped = false;
          for (const dir of escapeDirections) {
            const normalizedDir = ((dir % 360) + 360) % 360;
            const testPos = offsetPosition(this.state.position, distanceM, normalizedDir);
            if (!isLikelyWater(testPos, this.homePosition, this.config.terrainData)) {
              this.heading = normalizedDir;
              newPos = testPos;
              escaped = true;
              break;
            }
          }

          // If all directions lead to water, stay put
          if (!escaped) {
            return; // Don't move this timestep
          }
        }
      }

      // Road crossing check - pets avoid major roads or face danger when crossing
      const terrainData = this.config.terrainData;
      if (!this.config.skipTerrainChecks && terrainData?.roads && terrainData.roads.length > 0) {
        const roadCrossing = this.checkRoadCrossingLocal(this.state.position, newPos, terrainData.roads);

        if (roadCrossing.crosses) {
          // Determine if pet will attempt to cross or avoid
          const attemptCross = this.rng.next() < roadCrossing.crossingDifficulty;

          if (!attemptCross) {
            // Pet avoids the road - try alternative directions
            const avoidDirections = [
              this.heading + 90,  // Right
              this.heading - 90,  // Left
              this.heading + 45,  // Forward-right
              this.heading - 45,  // Forward-left
              this.heading + 135, // Back-right
              this.heading - 135, // Back-left
            ];

            let avoided = false;
            for (const dir of avoidDirections) {
              const normalizedDir = ((dir % 360) + 360) % 360;
              const testPos = offsetPosition(this.state.position, distanceM * 0.5, normalizedDir);
              const testCrossing = this.checkRoadCrossingLocal(this.state.position, testPos, terrainData.roads);

              if (!testCrossing.crosses && !isLikelyWater(testPos, this.homePosition, this.config.terrainData)) {
                this.heading = normalizedDir;
                newPos = testPos;
                avoided = true;
                break;
              }
            }

            // If can't avoid, stay put this timestep
            if (!avoided) {
              return;
            }
          } else {
            // Pet attempts to cross - check for danger
            const dangerRoll = this.rng.next();
            if (dangerRoll < roadCrossing.dangerLevel * 0.1) {
              // Pet was struck by vehicle - deceased
              this.state.isDeceased = true;
              return;
            }
            // Pet successfully crossed (with luck)
          }
        }
      }

      this.totalDistanceM += distanceM;
      this.state.position = newPos;
    }
  }

  // Local road crossing check using terrain data
  private checkRoadCrossingLocal(
    from: Position,
    to: Position,
    roads: RoadSegment[]
  ): RoadCrossingResult {
    let worstCrossing: RoadCrossingResult = {
      crosses: false,
      crossingDifficulty: 1,
      dangerLevel: 0,
    };

    for (const road of roads) {
      for (let i = 0; i < road.points.length - 1; i++) {
        if (this.lineSegmentsIntersect(from, to, road.points[i], road.points[i + 1])) {
          if (road.dangerLevel > worstCrossing.dangerLevel) {
            worstCrossing = {
              crosses: true,
              road,
              crossingDifficulty: road.crossingDifficulty,
              dangerLevel: road.dangerLevel,
            };
          }
        }
      }
    }

    return worstCrossing;
  }

  // Check if two line segments intersect
  private lineSegmentsIntersect(
    p1: Position, p2: Position,
    p3: Position, p4: Position
  ): boolean {
    const d1 = this.direction(p3, p4, p1);
    const d2 = this.direction(p3, p4, p2);
    const d3 = this.direction(p1, p2, p3);
    const d4 = this.direction(p1, p2, p4);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }
    return false;
  }

  private direction(pi: Position, pj: Position, pk: Position): number {
    return (pk.lng - pi.lng) * (pj.lat - pi.lat) - (pj.lng - pi.lng) * (pk.lat - pi.lat);
  }

  private checkSelfReturn(distFromHome: number, simHour: number): boolean {
    // Only check once per day to avoid compounding
    const currentDay = Math.floor(simHour / 24);
    if (currentDay <= this.lastSelfReturnCheckDay) {
      return false;
    }
    this.lastSelfReturnCheckDay = currentDay;

    // Research: ~15% of dogs, ~59% of cats eventually self-return
    // Over 30 days, we want roughly 15% of dogs to return

    // Base daily probability depends on distance from home
    // Dogs/cats that wander far are less likely to return
    let returnProb = 0;

    if (distFromHome < 200) {
      // Very close to home - high chance
      returnProb = this.profile.species === 'dog' ? 0.02 : 0.03;
    } else if (distFromHome < 500) {
      // Close to home
      returnProb = this.profile.species === 'dog' ? 0.01 : 0.015;
    } else if (distFromHome < 1000) {
      // Moderate distance - still possible
      returnProb = this.profile.species === 'dog' ? 0.005 : 0.008;
    } else if (distFromHome < 2000) {
      // Far but reachable
      returnProb = this.profile.species === 'dog' ? 0.002 : 0.004;
    } else {
      // Very far - unlikely to return
      returnProb = 0.0005;
    }

    // Fear affects return probability
    // Must be somewhat calm to decide to return home
    if (this.state.fearLevel > 0.6) {
      returnProb *= 0.2; // Very scared - unlikely to return
    } else if (this.state.fearLevel > 0.4) {
      returnProb *= 0.5;
    } else if (this.state.fearLevel < 0.2) {
      returnProb *= 1.5; // Very calm - more likely to return
    }

    // Later in the search, pets may be more motivated to return
    if (simHour > 168) { // After 1 week
      returnProb *= 1.2;
    }
    if (simHour > 336) { // After 2 weeks
      returnProb *= 1.3;
    }

    return this.rng.next() < returnProb;
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

  /**
   * Escape from water by trying multiple directions at increasing distances
   * Returns new position on land, or null if unable to escape
   */
  private escapeFromWater(pos: Position): Position | null {
    // Try 16 directions (every 22.5 degrees) for better coverage
    const directions: number[] = [];
    for (let i = 0; i < 16; i++) {
      directions.push(i * 22.5);
    }

    // Search up to 50km for land (handles large lakes, bays, and oceans near coast)
    const distances = [100, 250, 500, 1000, 2000, 5000, 10000, 25000, 50000]; // meters

    for (const dist of distances) {
      for (const dir of directions) {
        const testPos = offsetPosition(pos, dist, dir);
        if (!isLikelyWater(testPos, this.homePosition, this.config.terrainData)) {
          console.log(`Escaped from water: moved ${dist}m in direction ${dir}° from (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}) to (${testPos.lat.toFixed(4)}, ${testPos.lng.toFixed(4)})`);
          return testPos;
        }
      }
    }

    // If still can't find land after 50km, the user clicked in the middle of an ocean
    console.warn('Could not escape from water at', pos, '- no land within 50km in any direction');
    return null;
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

  // Don't store ANY paths during batch - they're fetched on-demand
  // This allows running 100+ simulations without memory issues

  for (let i = 0; i < numRuns; i++) {
    const config = { ...baseConfig, seed: baseSeed + i };
    const engine = new BehavioralSimulationEngine(profile, startPosition, config);
    const result = engine.run();

    // Keep only summary data, discard large path arrays immediately
    results.push({
      ...result,
      petPath: [], // Clear to save memory
      searcherPaths: [], // Clear to save memory
    });

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
