/**
 * Water Grid Pre-computation
 *
 * Creates a pre-computed grid of water/land for simulation areas.
 * Uses multiple detection strategies and caches results for fast
 * synchronous lookups during simulation.
 *
 * Grid approach: Divide simulation area into cells, check each cell
 * once using accurate APIs, then use grid for fast lookups.
 */

import { isInNaturalEarthWater, loadNaturalEarthData, isDataLoaded } from './naturalEarthWater';

export interface Position {
  lat: number;
  lng: number;
}

export interface WaterGrid {
  // Grid boundaries
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  // Cell size in degrees (roughly 100m at mid-latitudes)
  cellSizeLat: number;
  cellSizeLng: number;
  // Grid dimensions
  numRows: number;
  numCols: number;
  // Bitmap: 1 = water, 0 = land (packed as Uint8Array for efficiency)
  cells: Uint8Array;
  // Metadata
  source: string;
  timestamp: number;
}

/**
 * Check a single point using IsItWater.com API
 */
async function checkPointIsItWater(lat: number, lng: number): Promise<boolean | null> {
  try {
    const url = `https://isitwater-com.p.rapidapi.com/?latitude=${lat}&longitude=${lng}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
        'X-RapidAPI-Host': 'isitwater-com.p.rapidapi.com',
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.water === true;
  } catch {
    return null;
  }
}

/**
 * Check a single point using Onwater.io API (free, no key required)
 */
async function checkPointOnwater(lat: number, lng: number): Promise<boolean | null> {
  try {
    const url = `https://api.onwater.io/api/v1/results/${lat},${lng}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ReunitePets/1.0' },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.water === true;
  } catch {
    return null;
  }
}

/**
 * Check a single point using multiple strategies
 */
async function checkPointWater(lat: number, lng: number): Promise<boolean> {
  // Strategy 1: Natural Earth (fast, local)
  // Good for open ocean, not for bays
  if (isDataLoaded()) {
    const naturalEarthResult = isInNaturalEarthWater({ lat, lng });
    if (naturalEarthResult) {
      return true; // Definitely in ocean/major lake
    }
  }

  // Strategy 2: Onwater.io API (free, accurate for all water)
  const onwaterResult = await checkPointOnwater(lat, lng);
  if (onwaterResult !== null) {
    return onwaterResult;
  }

  // Fallback: Assume land if no API response
  return false;
}

/**
 * Build a water grid for a circular area around a center point
 *
 * @param center Center position
 * @param radiusM Radius in meters
 * @param cellSizeM Cell size in meters (default 200m for balance of accuracy and speed)
 */
export async function buildWaterGrid(
  center: Position,
  radiusM: number,
  cellSizeM: number = 200
): Promise<WaterGrid> {
  // Convert meters to degrees
  const latOffset = radiusM / 111000;
  const lngOffset = radiusM / (111000 * Math.cos(center.lat * Math.PI / 180));
  const cellSizeLat = cellSizeM / 111000;
  const cellSizeLng = cellSizeM / (111000 * Math.cos(center.lat * Math.PI / 180));

  // Grid boundaries
  const minLat = center.lat - latOffset;
  const maxLat = center.lat + latOffset;
  const minLng = center.lng - lngOffset;
  const maxLng = center.lng + lngOffset;

  // Grid dimensions
  const numRows = Math.ceil((maxLat - minLat) / cellSizeLat);
  const numCols = Math.ceil((maxLng - minLng) / cellSizeLng);
  const totalCells = numRows * numCols;

  console.log(`Building water grid: ${numRows}x${numCols} = ${totalCells} cells, ${cellSizeM}m resolution`);

  // Initialize grid
  const cells = new Uint8Array(totalCells);

  // Ensure Natural Earth data is loaded
  await loadNaturalEarthData();

  // First pass: Use Natural Earth for fast initial classification
  let oceanCells = 0;
  let landCells = 0;
  const uncertainCells: number[] = [];

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const cellLat = minLat + (row + 0.5) * cellSizeLat;
      const cellLng = minLng + (col + 0.5) * cellSizeLng;
      const index = row * numCols + col;

      // Check Natural Earth
      if (isInNaturalEarthWater({ lat: cellLat, lng: cellLng })) {
        cells[index] = 1; // Definitely water (ocean/major lake)
        oceanCells++;
      } else {
        // Could be land OR bay/local water - mark as uncertain
        uncertainCells.push(index);
        landCells++;
      }
    }
  }

  console.log(`Natural Earth pass: ${oceanCells} ocean cells, ${landCells} uncertain (potential bay/lake) cells`);

  // Second pass: Check uncertain cells near water using API (smart sampling)
  // Only check cells that are adjacent to known water cells (coastline detection)
  const coastlineCells: number[] = [];

  for (const index of uncertainCells) {
    const row = Math.floor(index / numCols);
    const col = index % numCols;

    // Check if any adjacent cell is water
    let nearWater = false;
    for (let dr = -1; dr <= 1 && !nearWater; dr++) {
      for (let dc = -1; dc <= 1 && !nearWater; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < numRows && nc >= 0 && nc < numCols) {
          if (cells[nr * numCols + nc] === 1) {
            nearWater = true;
          }
        }
      }
    }

    if (nearWater) {
      coastlineCells.push(index);
    }
  }

  console.log(`Coastline cells to verify: ${coastlineCells.length}`);

  // Check coastline cells using API (with rate limiting)
  // Limit to 50 API calls to avoid rate limiting and timeouts
  const cellsToCheck = coastlineCells.slice(0, 50);
  let apiWaterCells = 0;

  for (let i = 0; i < cellsToCheck.length; i++) {
    const index = cellsToCheck[i];
    const row = Math.floor(index / numCols);
    const col = index % numCols;
    const cellLat = minLat + (row + 0.5) * cellSizeLat;
    const cellLng = minLng + (col + 0.5) * cellSizeLng;

    const isWater = await checkPointWater(cellLat, cellLng);
    if (isWater) {
      cells[index] = 1;
      apiWaterCells++;
    }

    // Rate limiting: 100ms between requests
    if (i < cellsToCheck.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`API verification: ${apiWaterCells}/${cellsToCheck.length} additional water cells found`);

  // Third pass: Flood fill from verified water cells to find connected water
  // This helps fill in bays that are connected to verified water points
  let floodFilled = 0;
  let changed = true;
  let iterations = 0;
  const maxIterations = 5; // Limit iterations

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const index = row * numCols + col;
        if (cells[index] !== 0) continue; // Already marked as water

        // Count water neighbors
        let waterNeighbors = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < numRows && nc >= 0 && nc < numCols) {
              if (cells[nr * numCols + nc] === 1) {
                waterNeighbors++;
              }
            }
          }
        }

        // If surrounded by water on 3+ sides, likely also water
        if (waterNeighbors >= 3) {
          cells[index] = 1;
          floodFilled++;
          changed = true;
        }
      }
    }
  }

  console.log(`Flood fill: ${floodFilled} additional cells marked as water`);

  const totalWater = cells.reduce((sum, cell) => sum + cell, 0);
  console.log(`Final grid: ${totalWater} water cells, ${totalCells - totalWater} land cells`);

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    cellSizeLat,
    cellSizeLng,
    numRows,
    numCols,
    cells,
    source: 'natural-earth+api',
    timestamp: Date.now(),
  };
}

/**
 * Check if a position is in water using the pre-computed grid
 * Fast O(1) lookup
 */
export function isInWaterGrid(pos: Position, grid: WaterGrid): boolean {
  // Check bounds
  if (pos.lat < grid.minLat || pos.lat > grid.maxLat ||
      pos.lng < grid.minLng || pos.lng > grid.maxLng) {
    // Outside grid - fall back to Natural Earth
    return isInNaturalEarthWater(pos);
  }

  // Calculate cell index
  const row = Math.floor((pos.lat - grid.minLat) / grid.cellSizeLat);
  const col = Math.floor((pos.lng - grid.minLng) / grid.cellSizeLng);

  // Bounds check
  if (row < 0 || row >= grid.numRows || col < 0 || col >= grid.numCols) {
    return isInNaturalEarthWater(pos);
  }

  const index = row * grid.numCols + col;
  return grid.cells[index] === 1;
}

/**
 * Serialize grid for storage/transfer (smaller than full grid)
 */
export function serializeWaterGrid(grid: WaterGrid): string {
  return JSON.stringify({
    ...grid,
    cells: Array.from(grid.cells), // Convert Uint8Array to regular array for JSON
  });
}

/**
 * Deserialize grid from storage/transfer
 */
export function deserializeWaterGrid(json: string): WaterGrid {
  const data = JSON.parse(json);
  return {
    ...data,
    cells: new Uint8Array(data.cells),
  };
}
