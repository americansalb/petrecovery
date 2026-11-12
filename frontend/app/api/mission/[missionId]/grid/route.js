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
import { cellLabel } from '@/app/lib/searchGrid';
import { ensureGrid, sweepStaleClaims } from '@/app/lib/searchBoard';
import { searcherFor } from '@/app/lib/searcher';
import { firstWord } from '@/app/lib/searchText';
import { logEvent } from '@/lib/logging';
import crypto from 'crypto';

export async function GET(request, { params }) {
  const correlationId = crypto.randomUUID();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { missionId } = await params;
    const exists = typeof missionId === 'string' && missionId ? await prisma.case.findUnique({ where: { id: missionId }, select: { id: true } }) : null;
    if (!exists) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    // Who holds each block is for the owner and the forces looking (app/lib/searcher.js, `seesNames`), like
    // the board the search screen reads. Anyone else signed in sees which blocks are held, not by whom.
    const searcher = await searcherFor(request, missionId);
    const withNames = Boolean(searcher?.seesNames);

    // The grid, created on first use (app/lib/searchBoard.js, shared with
    // the job picker so a pet's page can offer a block before the map opens).
    const grid = await ensureGrid(missionId, correlationId);
    if (!grid) {
      return NextResponse.json(
        { error: 'This case has no last-seen location, so there is no area to grid.', code: 'NO_LOCATION' },
        { status: 409 }
      );
    }

    // Dinner sweep: expired claims revert so the block is takeable again.
    await sweepStaleClaims(grid.id);

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

    // First names for claim holders, so the board can say who has what (to those it tells).
    const holderIds = withNames ? [...new Set(full.cells.map((c) => c.claimedById).filter(Boolean))] : [];
    const holders = holderIds.length
      ? await prisma.user.findMany({
          where: { id: { in: holderIds } },
          select: { id: true, firstName: true },
        })
      : [];
    const nameById = Object.fromEntries(holders.map((u) => [u.id, firstWord(u.firstName) || 'Helper']));

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
      // An account id never leaves: a block says whether it is held, whose it is by first name where names
      // are told, and whether it is the reader's own.
      cells: full.cells.map(({ claimedById, ...c }) => ({
        ...c,
        label: cellLabel(c.row, c.col),
        claimed: Boolean(claimedById),
        claimedByName: claimedById && withNames ? nameById[claimedById] || 'Helper' : null,
        mine: claimedById === session.user.id,
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
