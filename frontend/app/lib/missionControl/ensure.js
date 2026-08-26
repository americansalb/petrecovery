/**
 * ensureMissionControl - find-or-create the MissionControl row for a case.
 *
 * The volunteer, sighting and join-info routes all key off MissionControl,
 * but only cases opened from Mission Control ever had one. A case created
 * by the report wizard had no row, so its share link answered "this search
 * has ended" and the volunteer APIs 404ed - observed end to end on a
 * freshly posted report. An open case IS a live search: create the row on
 * first contact, the same lazy pattern the search grid uses.
 */

import prisma from '@/app/lib/prisma';
import { isCaseOpen } from '@/app/lib/caseStatus';

const MC_SELECT = { id: true, mode: true };

export async function ensureMissionControl(caseId, select = MC_SELECT) {
  const existing = await prisma.missionControl.findUnique({
    where: { caseId },
    select,
  });
  if (existing) return existing;

  const caseRow = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, status: true, searchRadius: true },
  });
  if (!caseRow || !isCaseOpen(caseRow.status)) return null;

  try {
    return await prisma.missionControl.create({
      data: {
        caseId,
        mode: 'LIVE_SEARCH',
        activatedAt: new Date(),
        initialRadius: caseRow.searchRadius ?? null,
      },
      select,
    });
  } catch (error) {
    // P2002 on caseId: a concurrent request created it first. Read theirs.
    if (error?.code === 'P2002') {
      return prisma.missionControl.findUnique({ where: { caseId }, select });
    }
    throw error;
  }
}
