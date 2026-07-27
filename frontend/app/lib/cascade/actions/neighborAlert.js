/**
 * neighbor_alert action (tier 0) - actually DELIVER the alert to nearby patrol
 * members (the create route already selected them and wrote Alert rows). We
 * deliver via in-app notification + web-push only - never unsolicited SMS to
 * third parties (locked policy). Deduped against the existing Alert rows so a
 * member is never double-notified.
 */

import prisma from '@/app/lib/prisma';
import { createBulkNotifications } from '@/app/lib/notifications-inapp';
import { sendPushToUser } from '@/app/lib/push';

export async function runNeighborAlert(ctx) {
  const lost = ctx.case;

  // The create route's radius selection already produced Alert rows for the
  // nearby patrol members - reuse them as the recipient list (dedup by userId),
  // excluding the reporter themselves.
  const alerts = await prisma.alert.findMany({
    where: { caseId: lost.id },
    select: { userId: true },
  });
  const userIds = [...new Set(alerts.map((a) => a.userId))].filter((id) => id && id !== lost.reporterId);

  if (userIds.length === 0) {
    return { count: 0, result: { inApp: 0, push: 0 } };
  }

  const species = (lost.petSpecies || 'pet').toLowerCase();
  const area = (lost.lastSeenAddress || '').split(',').slice(1, 2).join('').trim() || 'your area';

  // In-app fan-out (one efficient createMany).
  let inApp = 0;
  try {
    const res = await createBulkNotifications(userIds, {
      type: 'CASE_UPDATE',
      title: `Lost ${species} near you`,
      message: `${lost.petName} went missing near ${area}. Keep an eye out and report any sighting.`,
      actionUrl: `/cases/${lost.caseNumber}`,
      data: JSON.stringify({ type: 'NEIGHBOR_ALERT', caseNumber: lost.caseNumber }),
    });
    inApp = res?.count ?? userIds.length;
  } catch (err) {
    console.error('[neighbor_alert] in-app fan-out failed:', err.message);
  }

  // Web-push (best-effort per user; a failed push must not sink the step).
  let push = 0;
  await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        const r = await sendPushToUser(prisma, userId, {
          title: `Lost ${species} near you`,
          body: `${lost.petName} went missing near ${area}. Tap to help.`,
          url: `/cases/${lost.caseNumber}`,
          type: 'NEIGHBOR_ALERT',
          data: { type: 'NEIGHBOR_ALERT' },
        });
        if (r?.success && (r.sent ?? 0) > 0) push += 1;
      } catch {
        /* ignore individual push failures */
      }
    })
  );

  return { count: userIds.length, result: { recipients: userIds.length, inApp, push } };
}
