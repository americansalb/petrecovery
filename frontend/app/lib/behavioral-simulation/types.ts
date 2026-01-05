/**
 * Types for Behavioral Profiles Monte Carlo Simulation
 * Based on BEHAVIORAL_PROFILES.md research-backed parameters
 */

export type Species = 'dog' | 'cat';

export type DogTemperament = 'G' | 'C' | 'A' | 'X' | 'B';
export type CatTemperament = 'CUR' | 'CL' | 'CAU' | 'X' | 'B';
export type Temperament = DogTemperament | CatTemperament;

export type DogSize = 'TOY' | 'SML' | 'MED' | 'LRG' | 'GNT';
export type CatSize = 'SML' | 'MED' | 'LRG';
export type Size = DogSize | CatSize;

export type AgeClass = 'PUP' | 'KIT' | 'JUV' | 'YNG' | 'ADT' | 'SEN';

export type CatHidingPhase = 'INITIAL' | 'DEEP' | 'EMERGENCE' | 'PATROL';

export interface Position {
  lat: number;
  lng: number;
}

export interface AnimalProfile {
  species: Species;
  temperament: Temperament;
  size: Size;
  age: AgeClass;
  isIndoorOnly: boolean;
  hasMicrochip: boolean;
  hasCollar: boolean;
}

export interface AnimalState {
  position: Position;
  fearLevel: number;
  hungerLevel: number;
  thirstLevel: number;
  stamina: number;
  isHiding: boolean;
  hidingPhase?: CatHidingPhase;
  thresholdReached?: boolean;
  hoursSinceEscape: number;
  isDeceased: boolean;
}

export interface SearcherProfile {
  type: 'OWNER' | 'HOUSEHOLD' | 'VOLUNTEER' | 'PROFESSIONAL';
  detectionRange: number;
  recallBonus: number;
  captureSkill: number;
}

export interface SearcherState {
  position: Position;
  isActive: boolean;
  fatigue: number;
}

export interface SimulationConfig {
  seed?: number;
  maxHours: number;
  timeStepMinutes: number;
  startHour: number;
  searchRadiusM: number;
  numSearchers: number;
  searchStartDelay?: number;
  useTraps: boolean;
  useScentArticles: boolean;
}

export interface PathPoint {
  hour: number;
  lat: number;
  lng: number;
  fear: number;
  hunger: number;
  state: string;
}

export interface SimulationResult {
  id: string;
  seed: number;
  outcome: string;
  outcomeDescription: string;
  timeToOutcomeHours: number | null;
  finalPosition: Position;
  petPath: PathPoint[];
  searcherPaths: PathPoint[][];
  petDistanceM: number;
  maxDistanceFromHomeM: number;
  stats: {
    avgFear: number;
    peakHunger: number;
    hidingHours: number;
  };
}

export interface BatchResult {
  id: string;
  totalRuns: number;
  successRate: number;
  avgTimeToFindHours: number | null;
  medianTimeToFindHours: number | null;
  avgDistanceM: number;
  outcomes: {
    captured: number;
    selfReturn: number;
    shelter: number;
    timeout: number;
    deceased: number;
  };
  simulations: SimulationResult[];
}
