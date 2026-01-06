# Global Terrain Detection Implementation Plan

## Problem
The current water detection relies on OSM Overpass API with hardcoded US city fallbacks. This breaks for ANY location outside those 8 cities when the API fails (which it often does).

## Solution: Multi-Layer Detection System

```
Layer 1: OSM Overpass API (with caching + retry)
    ↓ (if fails or empty)
Layer 2: Global Geographic Heuristics (coastline math)
    ↓ (always applied)
Layer 3: Major Water Bodies (predefined polygons)
    ↓ (always applied)
Layer 4: Distance Constraints (ultimate fallback)
```

## Key Files to Create/Modify

### New Files
1. `/app/lib/terrain/globalWaterHeuristics.ts` - Coastline approximations via lat/lng math
2. `/app/lib/terrain/majorWaterBodies.ts` - Great Lakes, bays, seas worldwide
3. `/app/lib/terrain/index.ts` - Unified detection API

### Modified Files
1. `/app/lib/behavioral-simulation/engine.ts` - Use multi-layer detection
2. `/app/lib/behavioral-simulation/terrain.ts` - Add retry logic
3. `/app/api/simulate/route.ts` - Cache integration

## Layer 2: Global Coastline Heuristics (Critical)

The key insight: We can approximate coastlines with piecewise linear functions.

Example - US West Coast:
```
Latitude 48 (Washington): Coast at ~-124.5
Latitude 45 (Oregon): Coast at ~-124.0
Latitude 40 (Northern CA): Coast at ~-124.3
Latitude 37 (SF): Coast at ~-122.5
Latitude 34 (LA): Coast at ~-118.5
Latitude 32 (San Diego): Coast at ~-117.2
```

If position.lng < getWestCoastLng(position.lat), it's in the Pacific Ocean.

Same logic applies globally:
- US East Coast
- European West Coast (UK, France, Spain, Portugal)
- Mediterranean coastline
- Asian coastlines (China, Japan, Korea)
- Australian coastlines
- South American coastlines
- African coastlines

## Layer 3: Major Water Bodies

Predefined bounding boxes/polygons for:
- Great Lakes (Superior, Michigan, Huron, Erie, Ontario)
- Major Bays (SF Bay, Chesapeake, Tokyo Bay, etc.)
- Inland Seas (Mediterranean, Baltic, Black Sea, etc.)
- Large Lakes (Lake Victoria, Baikal, etc.)

## Implementation Priority

1. **FIRST**: Global coastline heuristics (works without any API)
2. **SECOND**: Major water bodies data
3. **THIRD**: Integrate into engine.ts
4. **FOURTH**: OSM caching improvements

This order ensures we have a working solution immediately, with OSM as an enhancement rather than requirement.
