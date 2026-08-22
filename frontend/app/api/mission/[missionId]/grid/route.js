/**
 * GET /api/mission/[missionId]/grid
 *
 * The collaborative search board. [missionId] is the caseId, like every
 * sibling route here.
 *
 * First GET for a case with coordinates creates the grid: SearchGrid and
 * GridCell had been in the schema with zero rows and zero readers, and
 * this is the route that finally fills and serves them. Idempotent -
 * SearchGrid.caseId is unique, and a concurrent first-GET loses the race
 * quietly and reads the winner's board.
 *
 * Every GET also sweeps stale claims: someone claims a block and goes
 * home for dinner, and the block must not stay theirs all night. Claims
 * older than CLAIM_TTL_MS revert to UNSEARCHED here rather than in a
 * scheduler nobody runs.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { generateGrid, cellLabel, CLAIM_TTL_MS } from '@/app/lib/searchGrid';
import { logEvent } from '@/lib/logging';
import crypto from 'crypto';

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
    // P2002 on caseId: a concurrent first-GET won the race. Read theirs.
    if (error?.code === 'P2002') return null;
    throw error;
  }
}

export async function GET(request, { params }) {
  const correlationId = crypto.randomUUID();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { missionId } = params;
    const caseData = await prisma.case.findUnique({
      where: { id: missionId },
      select: {
        id: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
        searchRadius: true,
        sightings: {
          select: { latitude: true, longitude: true, sightedAt: true, createdAt: true },
          orderBy: { sightedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseData.lastSeenLatitude == null || caseData.lastSeenLongitude == null) {
      return NextResponse.json(
        { error: 'This case has no last-seen location, so there is no area to grid.', code: 'NO_LOCATION' },
        { status: 409 }
      );
    }

    let grid = await prisma.searchGrid.findUnique({
      where: { caseId: caseData.id },
      select: { id: true },
    });
    if (!grid) {
      grid = (await createGridForCase(caseData, correlationId)) ||
        (await prisma.searchGrid.findUnique({ where: { caseId: caseData.id }, select: { id: true } }));
    }

    // Dinner sweep: expired claims revert so the block is takeable again.
    await prisma.gridCell.updateMany({
      where: {
        gridId: grid.id,
        status: 'IN_PROGRESS',
        claimedAt: { lt: new Date(Date.now() - CLAIM_TTL_MS) },
      },
      data: { status: 'UNSEARCHED', claimedById: null, claimedAt: null },
    });

    const full = await prisma.searchGrid.findUnique({
      where: { id: grid.id },
      select: {
        id: true,
        centerLatitude: true,
        centerLongitude: true,
        radiusMiles: true,
        cellSizeMeters: true,
        totalCells: true,
        cells: {
          select: {
            id: true,
            row: true,
            col: true,
            centerLatitude: true,
            centerLongitude: true,
            northLat: true,
            southLat: true,
            eastLng: true,
            westLng: true,
            status: true,
            priority: true,
            claimedById: true,
            claimedAt: true,
            searchedAt: true,
            searchCount: true,
          },
          orderBy: [{ row: 'asc' }, { col: 'asc' }],
        },
      },
    });

    // First names for claim holders, so the board can say who has what.
    const holderIds = [...new Set(full.cells.map((c) => c.claimedById).filter(Boolean))];
    const holders = holderIds.length
      ? await prisma.user.findMany({
          where: { id: { in: holderIds } },
          select: { id: true, firstName: true },
        })
      : [];
    const nameById = Object.fromEntries(holders.map((u) => [u.id, u.firstName || 'Helper']));

    const searched = full.cells.filter((c) => c.status === 'SEARCHED' || c.status === 'PET_FOUND').length;
    const inProgress = full.cells.filter((c) => c.status === 'IN_PROGRESS').length;

    return NextResponse.json({
      grid: {
        id: full.id,
        center: { lat: full.centerLatitude, lng: full.centerLongitude },
        radiusMiles: full.radiusMiles,
        cellSizeMeters: full.cellSizeMeters,
        totalCells: full.cells.length,
        searchedCells: searched,
        inProgressCells: inProgress,
      },
      cells: full.cells.map((c) => ({
        ...c,
        label: cellLabel(c.row, c.col),
        claimedByName: c.claimedById ? nameById[c.claimedById] || 'Helper' : null,
        mine: c.claimedById === session.user.id,
      })),
    });
  } catch (error) {
    console.error('Grid fetch failed:', error);
    await logEvent({
      event_type: 'grid.fetch_failed',
      correlation_id: correlationId,
      resource_type: 'case',
      action: 'read',
      result: 'failure',
      error_message: error.message,
    }).catch(() => {});
    return NextResponse.json({ error: 'Could not load the search grid.' }, { status: 500 });
  }
}
