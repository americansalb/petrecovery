/**
 * PATCH /api/mission/[missionId]/grid/cell
 *
 * The three verbs of the board: claim, release, searched.
 *
 * Claiming is a CONDITIONAL WRITE, the same discipline as the rate
 * limiter: two volunteers tap the same block, the database picks exactly
 * one winner, and the loser is told in words rather than silently
 * double-booked. An updateMany with the availability predicate in the
 * WHERE returns count 0 to whoever lost.
 *
 * Every successful mutation broadcasts on the mission's SSE stream -
 * which existed with zero callers until this file. Anyone with the board
 * open sees the block change hands without refreshing.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { broadcast } from '@/app/lib/sse/missionStream';
import { cellLabel, CLAIM_TTL_MS } from '@/app/lib/searchGrid';
import { logEvent } from '@/lib/logging';
import crypto from 'crypto';

const ACTIONS = ['claim', 'release', 'searched'];

async function broadcastCellChange(caseId, type, cell, actor) {
  // The stream route registers connections under the raw [missionId]
  // param - the caseId - so broadcasts key the same way. (First version
  // keyed by the MissionControl id: same map, different key, and every
  // event fell into the gap. Observed with two browsers open.)
  try {
    broadcast(caseId, {
      type,
      cell: {
        id: cell.id,
        row: cell.row,
        col: cell.col,
        label: cellLabel(cell.row, cell.col),
        status: cell.status,
        claimedById: cell.claimedById,
        claimedByName: actor?.firstName || null,
        claimedAt: cell.claimedAt,
        searchedAt: cell.searchedAt,
        searchCount: cell.searchCount,
      },
    });
  } catch (err) {
    // A broadcast hiccup must never fail the write that caused it.
    console.warn('Grid broadcast failed:', err.message);
  }
}

export async function PATCH(request, { params }) {
  const correlationId = crypto.randomUUID();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { missionId } = params;
    const body = await request.json().catch(() => ({}));
    const { cellId, action } = body;

    if (!cellId || !ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `Send a cellId and one of: ${ACTIONS.join(', ')}.` },
        { status: 400 }
      );
    }

    const cell = await prisma.gridCell.findUnique({
      where: { id: cellId },
      select: {
        id: true, gridId: true, row: true, col: true, status: true,
        claimedById: true, claimedAt: true,
        grid: { select: { caseId: true } },
      },
    });

    if (!cell || cell.grid.caseId !== missionId) {
      return NextResponse.json({ error: 'That block is not on this search.' }, { status: 404 });
    }

    const userId = session.user.id;
    const label = cellLabel(cell.row, cell.col);
    const staleBefore = new Date(Date.now() - CLAIM_TTL_MS);

    if (action === 'claim') {
      // One block per person: walking two blocks at once is walking
      // neither. Release anything they already hold first.
      await prisma.gridCell.updateMany({
        where: { gridId: cell.gridId, claimedById: userId, status: 'IN_PROGRESS' },
        data: { status: 'UNSEARCHED', claimedById: null, claimedAt: null },
      });

      // The conditional write: free, or expired, or already mine.
      const won = await prisma.gridCell.updateMany({
        where: {
          id: cellId,
          OR: [
            { claimedById: null },
            { claimedById: userId },
            { claimedAt: { lt: staleBefore } },
          ],
          // SEARCHED is claimable too: a dog moves, and a walked block
          // three hours ago is worth walking again. Only a found pet or a
          // ruled-out block closes the door.
          status: { in: ['UNSEARCHED', 'IN_PROGRESS', 'NEEDS_REVISIT', 'SEARCHED'] },
        },
        data: { status: 'IN_PROGRESS', claimedById: userId, claimedAt: new Date() },
      });

      if (won.count === 0) {
        const current = await prisma.gridCell.findUnique({
          where: { id: cellId },
          select: { claimedById: true, status: true },
        });
        const holder = current?.claimedById
          ? await prisma.user.findUnique({ where: { id: current.claimedById }, select: { firstName: true } })
          : null;
        return NextResponse.json(
          {
            error: holder?.firstName
              ? `${holder.firstName} just claimed ${label}. Pick a block nearby.`
              : `${label} is not claimable right now.`,
            code: 'CELL_TAKEN',
          },
          { status: 409 }
        );
      }
    } else if (action === 'release') {
      const released = await prisma.gridCell.updateMany({
        where: { id: cellId, claimedById: userId },
        data: { status: 'UNSEARCHED', claimedById: null, claimedAt: null },
      });
      if (released.count === 0) {
        return NextResponse.json(
          { error: `${label} is not yours to release.`, code: 'NOT_YOURS' },
          { status: 409 }
        );
      }
    } else if (action === 'searched') {
      // Only the holder can mark it - "searched" means someone walked it,
      // and the row records who.
      const marked = await prisma.gridCell.updateMany({
        where: { id: cellId, claimedById: userId, status: 'IN_PROGRESS' },
        data: {
          status: 'SEARCHED',
          claimedById: null,
          claimedAt: null,
          searchedById: userId,
          searchedAt: new Date(),
          searchCount: { increment: 1 },
        },
      });
      if (marked.count === 0) {
        return NextResponse.json(
          { error: `Claim ${label} first, then mark it searched.`, code: 'NOT_CLAIMED' },
          { status: 409 }
        );
      }
      await prisma.searchGrid.update({
        where: { id: cell.gridId },
        data: { cellsSearched: { increment: 1 }, lastActivityAt: new Date() },
      }).catch(() => {});
    }

    const updated = await prisma.gridCell.findUnique({
      where: { id: cellId },
      select: {
        id: true, row: true, col: true, status: true,
        claimedById: true, claimedAt: true, searchedAt: true, searchCount: true,
      },
    });

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });

    const eventType =
      action === 'claim' ? 'CELL_CLAIMED' : action === 'release' ? 'CELL_RELEASED' : 'CELL_SEARCHED';
    await broadcastCellChange(missionId, eventType, updated, updated.claimedById ? actor : null);

    await logEvent({
      event_type: `grid.cell_${action}`,
      correlation_id: correlationId,
      actor_user_id: userId,
      resource_type: 'grid_cell',
      resource_id: cellId,
      action: 'update',
      result: 'success',
      metadata: { label, status: updated.status },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      cell: {
        ...updated,
        label,
        claimedByName: updated.claimedById ? actor?.firstName || 'Helper' : null,
        mine: updated.claimedById === userId,
      },
    });
  } catch (error) {
    console.error('Grid cell action failed:', error);
    return NextResponse.json({ error: 'Could not update the block.' }, { status: 500 });
  }
}
