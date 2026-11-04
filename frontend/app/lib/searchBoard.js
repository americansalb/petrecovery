/**
 * The search board's rows: the one place a case's grid is created, its
 * stale claims swept, and its open blocks read. The board's GET route and
 * the job picker (app/lib/jobs.js) both come here, so a pet's page can
 * offer "Walk C4" before anyone has opened the map.
 *
 * The geometry is app/lib/searchGrid.js (pure); this file is the Prisma
 * half.
 */

import prisma from '@/app/lib/prisma';
import { generateGrid, cellLabel, CLAIM_TTL_MS } from '@/app/lib/searchGrid';
import { logEvent } from '@/lib/logging';

const CASE_FOR_GRID = {
  id: true,
  lastSeenLatitude: true,
  lastSeenLongitude: true,
  searchRadius: true,
  sightings: {
    select: { latitude: true, longitude: true, sightedAt: true, createdAt: true },
    orderBy: { sightedAt: 'desc' },
    take: 20,
  },
};

async function createGridForCase(caseData, correlationId) {
  const sightings = (caseData.sightings || [])
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ lat: s.latitude, lng: s.longitude, at: s.sightedAt || s.createdAt }));

  const { radiusMeters, cellSizeMeters, cells } = generateGrid({
    center: { lat: caseData.lastSeenLatitude, lng: caseData.lastSeenLongitude },
    searchRadiusMiles: caseData.searchRadius,
    sightings,
  });

  try {
    const grid = await prisma.searchGrid.create({
      data: {
        caseId: caseData.id,
        centerLatitude: caseData.lastSeenLatitude,
        centerLongitude: caseData.lastSeenLongitude,
        radiusMiles: radiusMeters / 1609.344,
        cellSizeMeters,
        totalCells: cells.length,
        cells: {
          create: cells.map((c) => ({
            row: c.row,
            col: c.col,
            centerLatitude: c.centerLatitude,
            centerLongitude: c.centerLongitude,
            northLat: c.northLat,
            southLat: c.southLat,
            eastLng: c.eastLng,
            westLng: c.westLng,
            priority: c.priority,
          })),
        },
      },
      select: { id: true },
    });

    await logEvent({
      event_type: 'grid.created',
      correlation_id: correlationId,
      resource_type: 'case',
      resource_id: caseData.id,
      action: 'create',
      result: 'success',
      metadata: { cells: cells.length, cellSizeMeters },
    }).catch(() => {});

    return grid;
  } catch (error) {
    // P2002 on caseId: a concurrent first call won the race. Read theirs.
    if (error?.code === 'P2002') return null;
    throw error;
  }
}

/**
 * The case's grid, created on first use. Returns `{ id }`, or null when
 * the case has no last-seen location (nothing to grid), or does not exist.
 */
export async function ensureGrid(caseId, correlationId = null) {
  const caseData = await prisma.case.findUnique({ where: { id: caseId }, select: CASE_FOR_GRID });
  if (!caseData) return null;
  if (caseData.lastSeenLatitude == null || caseData.lastSeenLongitude == null) return null;

  let grid = await prisma.searchGrid.findUnique({ where: { caseId: caseData.id }, select: { id: true } });
  if (!grid) {
    grid =
      (await createGridForCase(caseData, correlationId)) ||
      (await prisma.searchGrid.findUnique({ where: { caseId: caseData.id }, select: { id: true } }));
  }
  return grid;
}

/** Someone claims a block and goes home for dinner: it must not stay theirs all night. */
export async function sweepStaleClaims(gridId, now = Date.now()) {
  await prisma.gridCell.updateMany({
    where: { gridId, status: 'IN_PROGRESS', claimedAt: { lt: new Date(now - CLAIM_TTL_MS) } },
    data: { status: 'UNSEARCHED', claimedById: null, claimedAt: null },
  });
}

/**
 * Blocks nobody is walking, most urgent first: unsearched and worth
 * another look, by the board's priority. Each carries its letter name.
 */
export async function openBlocks(caseId, { take = 12 } = {}) {
  const grid = await ensureGrid(caseId);
  if (!grid) return [];
  await sweepStaleClaims(grid.id);
  const cells = await prisma.gridCell.findMany({
    where: { gridId: grid.id, status: { in: ['UNSEARCHED', 'NEEDS_REVISIT'] } },
    orderBy: [{ priority: 'desc' }, { row: 'asc' }, { col: 'asc' }],
    take,
    select: {
      id: true,
      row: true,
      col: true,
      status: true,
      priority: true,
      centerLatitude: true,
      centerLongitude: true,
    },
  });
  return cells.map((c) => ({ ...c, label: cellLabel(c.row, c.col) }));
}
