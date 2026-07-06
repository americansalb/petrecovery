/**
 * followups action (tier 2) — persists the day-1/3/7 check-in reminders as
 * durable CaseFollowUp rows (idempotent via @@unique([caseId, day])). Nothing
 * is sent here; delivery happens later when a due row is drained by the sweep
 * endpoint or a piggyback drain (see ../followups.js). An already-resolved case
 * schedules nothing.
 */

import prisma from '@/app/lib/prisma';
import { FOLLOWUP_DAYS, followUpChannel, isResolved } from '../followups.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runFollowups(ctx) {
  const c = ctx.case;

  if (isResolved(c)) {
    const skip = new Error('case already resolved — no reminders scheduled');
    skip.skip = true;
    throw skip;
  }

  const channel = followUpChannel(c);
  const base = c.createdAt ? new Date(c.createdAt).getTime() : Date.now();

  await Promise.all(
    FOLLOWUP_DAYS.map((day) =>
      prisma.caseFollowUp.upsert({
        where: { caseId_day: { caseId: c.id, day } },
        create: {
          caseId: c.id,
          day,
          dueAt: new Date(base + day * DAY_MS),
          channel,
          status: 'PENDING',
        },
        update: {}, // never reschedule/clobber an existing reminder
      })
    )
  );

  return { count: FOLLOWUP_DAYS.length, result: { scheduled: FOLLOWUP_DAYS, channel } };
}
