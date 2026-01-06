/**
 * Terrain Detection Module
 *
 * Multi-layer water detection system that works globally:
 * - OSM Overpass API (accurate but may timeout)
 * - Major water bodies (Great Lakes, bays, seas)
 * - Global coastline heuristics (math-based ocean detection)
 */

export { isLikelyInOcean, getCoastlineDistance } from './globalWaterHeuristics';
export {
  isInMajorWater,
  isInMajorWaterBody,
  getWaterBodiesInArea,
} from './majorWaterBodies';

export type { Position } from './globalWaterHeuristics';
export type { WaterBody } from './majorWaterBodies';
