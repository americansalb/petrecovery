/**
 * Phase 2 & 3: Smart Search Grid System
 *
 * Divides search area into grid cells for organized volunteer coordination.
 * Tracks which areas have been searched, assigns volunteers to uncovered areas.
 */

import prisma from '@/app/lib/prisma';

// Grid cell size in meters (approximately 100m x 100m blocks)
const CELL_SIZE_METERS = 100;
const METERS_PER_DEGREE_LAT = 111320;

/**
 * Generate search grid for a case
 */
export async function generateSearchGrid(caseId, options = {}) {
  const {
    radiusMiles = 0.5, // Default half-mile radius
    cellSizeMeters = CELL_SIZE_METERS,
  } = options;

  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      lastSeenLatitude: true,
      lastSeenLongitude: true,
      petSpecies: true,
    }
  });

  if (!caseData?.lastSeenLatitude || !caseData?.lastSeenLongitude) {
    return { success: false, error: 'Case location not available' };
  }

  const { lastSeenLatitude: centerLat, lastSeenLongitude: centerLng } = caseData;

  // Convert radius to degrees
  const radiusMeters = radiusMiles * 1609.34;
  const latDegrees = radiusMeters / METERS_PER_DEGREE_LAT;
  const lngDegrees = radiusMeters / (METERS_PER_DEGREE_LAT * Math.cos(centerLat * Math.PI / 180));

  // Calculate grid dimensions
  const cellLatDegrees = cellSizeMeters / METERS_PER_DEGREE_LAT;
  const cellLngDegrees = cellSizeMeters / (METERS_PER_DEGREE_LAT * Math.cos(centerLat * Math.PI / 180));

  const gridRows = Math.ceil((latDegrees * 2) / cellLatDegrees);
  const gridCols = Math.ceil((lngDegrees * 2) / cellLngDegrees);

  // Create or get search grid
  let grid = await prisma.searchGrid.findFirst({
    where: { caseId }
  });

  if (!grid) {
    grid = await prisma.searchGrid.create({
      data: {
        caseId,
        centerLatitude: centerLat,
        centerLongitude: centerLng,
        radiusMiles,
        cellSizeMeters,
        totalCells: gridRows * gridCols,
      }
    });
  }

  // Generate cells
  const cells = [];
  const startLat = centerLat - latDegrees;
  const startLng = centerLng - lngDegrees;

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const cellCenterLat = startLat + (row + 0.5) * cellLatDegrees;
      const cellCenterLng = startLng + (col + 0.5) * cellLngDegrees;

      // Check if cell is within radius (circular grid, not square)
      const distanceFromCenter = haversineDistance(
        centerLat, centerLng,
        cellCenterLat, cellCenterLng
      );

      if (distanceFromCenter <= radiusMiles) {
        // Calculate priority based on distance from last seen location
        // Closer cells = higher priority
        const priority = Math.max(1, Math.round(10 - (distanceFromCenter / radiusMiles) * 9));

        cells.push({
          gridId: grid.id,
          row,
          col,
          centerLatitude: cellCenterLat,
          centerLongitude: cellCenterLng,
          northLat: cellCenterLat + cellLatDegrees / 2,
          southLat: cellCenterLat - cellLatDegrees / 2,
          eastLng: cellCenterLng + cellLngDegrees / 2,
          westLng: cellCenterLng - cellLngDegrees / 2,
          priority,
          status: 'UNSEARCHED',
        });
      }
    }
  }

  // Batch create cells
  await prisma.gridCell.createMany({
    data: cells,
    skipDuplicates: true,
  });

  // Update grid with actual cell count
  await prisma.searchGrid.update({
    where: { id: grid.id },
    data: { totalCells: cells.length }
  });

  return {
    success: true,
    gridId: grid.id,
    totalCells: cells.length,
    radiusMiles,
    center: { lat: centerLat, lng: centerLng },
  };
}

/**
 * Get suggested search area for a volunteer
 * Finds the best unclaimed cell based on location and priority
 */
export async function getSuggestedArea(caseId, volunteerLocation) {
  const { lat, lng } = volunteerLocation;

  // Get grid and unclaimed cells
  const grid = await prisma.searchGrid.findFirst({
    where: { caseId },
    include: {
      cells: {
        where: {
          status: { in: ['UNSEARCHED', 'NEEDS_REVISIT'] },
          claimedById: null,
        },
        orderBy: { priority: 'desc' },
      }
    }
  });

  if (!grid) {
    return { success: false, error: 'No search grid found. Generating...' };
  }

  if (grid.cells.length === 0) {
    return {
      success: true,
      allSearched: true,
      message: 'All areas have been searched or claimed!',
    };
  }

  // Find best cell: balance priority with proximity to volunteer
  let bestCell = null;
  let bestScore = -Infinity;

  for (const cell of grid.cells) {
    const distance = haversineDistance(lat, lng, cell.centerLatitude, cell.centerLongitude);
    // Score = priority (1-10) - distance penalty
    // Volunteers within 0.1 miles get full priority score
    const distancePenalty = Math.max(0, (distance - 0.1) * 5);
    const score = cell.priority - distancePenalty;

    if (score > bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }

  if (!bestCell) {
    return {
      success: true,
      allSearched: true,
      message: 'No available areas nearby.',
    };
  }

  const distanceToCell = haversineDistance(lat, lng, bestCell.centerLatitude, bestCell.centerLongitude);

  return {
    success: true,
    cell: {
      id: bestCell.id,
      center: { lat: bestCell.centerLatitude, lng: bestCell.centerLongitude },
      bounds: {
        north: bestCell.northLat,
        south: bestCell.southLat,
        east: bestCell.eastLng,
        west: bestCell.westLng,
      },
      priority: bestCell.priority,
      row: bestCell.row,
      col: bestCell.col,
    },
    distance: distanceToCell,
    walkingMinutes: Math.round(distanceToCell * 20), // ~3mph walking
    directions: getWalkingDirections(lat, lng, bestCell.centerLatitude, bestCell.centerLongitude),
  };
}

/**
 * Claim a grid cell for searching
 */
export async function claimCell(cellId, userId, sessionId) {
  const cell = await prisma.gridCell.findUnique({
    where: { id: cellId },
    include: { grid: true }
  });

  if (!cell) {
    return { success: false, error: 'Cell not found' };
  }

  if (cell.claimedById && cell.claimedById !== userId) {
    // Check if claim is stale (> 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (cell.claimedAt > thirtyMinutesAgo) {
      return {
        success: false,
        error: 'This area is being searched by another volunteer',
        claimedBy: cell.claimedById,
      };
    }
    // Stale claim - allow override
  }

  // Claim the cell
  await prisma.gridCell.update({
    where: { id: cellId },
    data: {
      claimedById: userId,
      claimedAt: new Date(),
      status: 'IN_PROGRESS',
    }
  });

  // Update search session
  if (sessionId) {
    await prisma.searchSession.update({
      where: { id: sessionId },
      data: {
        gridCellId: cellId,
        status: 'ACTIVE',
        startedAt: new Date(),
      }
    });
  }

  return {
    success: true,
    cellId,
    message: 'Area claimed! Start searching.',
    bounds: {
      north: cell.northLat,
      south: cell.southLat,
      east: cell.eastLng,
      west: cell.westLng,
    },
  };
}

/**
 * Mark a cell as searched
 */
export async function markCellSearched(cellId, userId, result) {
  const {
    foundPet = false,
    foundClue = false,
    notes = '',
    thoroughness = 'STANDARD', // QUICK, STANDARD, THOROUGH
  } = result;

  const cell = await prisma.gridCell.findUnique({
    where: { id: cellId },
    include: { grid: true }
  });

  if (!cell) {
    return { success: false, error: 'Cell not found' };
  }

  // Determine new status
  let newStatus = 'SEARCHED';
  if (foundPet) {
    newStatus = 'PET_FOUND';
  } else if (foundClue) {
    newStatus = 'CLUE_FOUND';
  } else if (thoroughness === 'QUICK') {
    newStatus = 'NEEDS_REVISIT';
  }

  // Update cell
  await prisma.gridCell.update({
    where: { id: cellId },
    data: {
      status: newStatus,
      searchedById: userId,
      searchedAt: new Date(),
      searchCount: { increment: 1 },
      notes: notes || undefined,
      claimedById: null, // Release claim
      claimedAt: null,
    }
  });

  // Update grid stats
  await prisma.searchGrid.update({
    where: { id: cell.gridId },
    data: {
      cellsSearched: { increment: 1 },
      lastActivityAt: new Date(),
    }
  });

  // Update participant stats
  const participant = await prisma.caseParticipant.findFirst({
    where: {
      assignment: { case: { id: cell.grid.caseId } },
      userId,
      isActive: true,
    }
  });

  if (participant) {
    await prisma.caseParticipant.update({
      where: { id: participant.id },
      data: { areasMarked: { increment: 1 } }
    });
  }

  return {
    success: true,
    status: newStatus,
    message: foundPet
      ? 'Amazing! Pet location reported!'
      : foundClue
        ? 'Clue noted! Team notified.'
        : 'Area marked as searched. Thank you!',
    nextAction: foundPet
      ? { type: 'REPORT_SIGHTING', url: `/search/${cell.grid.caseId}/found` }
      : { type: 'GET_NEXT_AREA', prompt: 'Search another area?' },
  };
}

/**
 * Get grid status for live ops view
 */
export async function getGridStatus(caseId) {
  const grid = await prisma.searchGrid.findFirst({
    where: { caseId },
    include: {
      cells: {
        select: {
          id: true,
          row: true,
          col: true,
          centerLatitude: true,
          centerLongitude: true,
          status: true,
          claimedById: true,
          claimedAt: true,
          searchedAt: true,
          priority: true,
        }
      }
    }
  });

  if (!grid) {
    return { success: false, error: 'No search grid found' };
  }

  // Calculate stats
  const stats = {
    total: grid.cells.length,
    unsearched: 0,
    inProgress: 0,
    searched: 0,
    cluesFound: 0,
    needsRevisit: 0,
  };

  for (const cell of grid.cells) {
    switch (cell.status) {
      case 'UNSEARCHED': stats.unsearched++; break;
      case 'IN_PROGRESS': stats.inProgress++; break;
      case 'SEARCHED': stats.searched++; break;
      case 'CLUE_FOUND': stats.cluesFound++; break;
      case 'NEEDS_REVISIT': stats.needsRevisit++; break;
    }
  }

  stats.coveragePercent = Math.round(
    ((stats.searched + stats.cluesFound) / stats.total) * 100
  );

  return {
    success: true,
    gridId: grid.id,
    center: { lat: grid.centerLatitude, lng: grid.centerLongitude },
    radiusMiles: grid.radiusMiles,
    cells: grid.cells,
    stats,
  };
}

/**
 * Get simple walking directions (cardinal direction + distance)
 */
function getWalkingDirections(fromLat, fromLng, toLat, toLng) {
  const latDiff = toLat - fromLat;
  const lngDiff = toLng - fromLng;

  let direction = '';

  if (Math.abs(latDiff) > Math.abs(lngDiff) * 0.5) {
    direction += latDiff > 0 ? 'north' : 'south';
  }
  if (Math.abs(lngDiff) > Math.abs(latDiff) * 0.5) {
    direction += lngDiff > 0 ? 'east' : 'west';
  }

  const distance = haversineDistance(fromLat, fromLng, toLat, toLng);
  const feet = Math.round(distance * 5280);

  if (feet < 500) {
    return `Head ${direction} about ${feet} feet`;
  } else {
    return `Head ${direction} about ${(distance).toFixed(1)} miles`;
  }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default {
  generateSearchGrid,
  getSuggestedArea,
  claimCell,
  markCellSearched,
  getGridStatus,
};
