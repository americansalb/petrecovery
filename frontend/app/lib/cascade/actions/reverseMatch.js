/**
 * reverse_match action (tier 0) - the instant "we may already have found your
 * pet" moment. Cross-checks the new lost report against ACTIVE found reports
 * (attribute + microchip). Surfaces coarsened, PII-free matches on the success
 * screen, and - for actionable-band matches - alerts the FINDER (in-app + push
 * only; no unsolicited third-party SMS).
 */

import prisma from '@/app/lib/prisma';
import { reverseMatch, formatMatch } from '../reverseMatch.js';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendPushToUser } from '@/app/lib/push';

export async function runReverseMatch(ctx) {
  const lost = ctx.case;
  const lostChip = lost.pet?.microchipId || null;

  const candidates = await prisma.case.findMany({
    where: {
      reportType: 'FOUND',
      status: 'ACTIVE',
      OR: [
        { petSpecies: lost.petSpecies },
        ...(lostChip ? [{ pet: { microchipId: lostChip } }] : []),
      ],
    },
    include: { pet: true },
    take: 300,
    orderBy: { createdAt: 'desc' },
  });

  const scored = reverseMatch(lost, candidates, { minScore: 35, maxResults: 8 });
  const matches = scored.map(formatMatch);

  // Alert finders of actionable-band matches (in-app + push only).
  let notified = 0;
  const actionable = scored.filter((m) => m.band === 'actionable');
  await Promise.allSettled(
    actionable.map(async (m) => {
      const finderId = m.case.reporterId;
      if (!finderId) return;
      const species = (lost.petSpecies || 'pet').toLowerCase();
      try {
        await createInAppNotification({
          userId: finderId,
          type: 'MATCH_ALERT',
          title: 'A possible owner just came forward',
          message: `Someone reported a lost ${species} that may match the one you found. Tap to review.`,
          actionUrl: `/cases/${m.case.caseNumber}`,
          data: JSON.stringify({ type: 'REVERSE_MATCH', lostCaseNumber: lost.caseNumber }),
        });
        await sendPushToUser(prisma, finderId, {
          title: 'A possible owner came forward',
          body: `Someone reported a lost ${species} matching the one you found - tap to review.`,
          url: `/cases/${m.case.caseNumber}`,
          type: 'MATCH_ALERT',
          data: { type: 'REVERSE_MATCH' },
        });
        notified += 1;
      } catch (err) {
        // one finder failing must not sink the others / the step
        console.error('[reverse_match] finder notify failed:', err.message);
      }
    })
  );

  return { count: matches.length, result: { matches, actionable: actionable.length, notified } };
}
