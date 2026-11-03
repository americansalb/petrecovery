/**
 * Waking the people who can act. One call per event, from the route that
 * owns the event: a sighting of a force's pet, a block that frees up, a
 * need added for a pet, a search party planned.
 *
 * Everyone in the force gets the bell (a Notification row, the in-app
 * list). A push goes to members on duty (app/lib/duty.js), or to everyone
 * for the few events worth waking anyone for (`everyone: true`, a search
 * party). Each push lands on one page with one button: the url is the
 * place to act, never a feed. Never throws: a wake-up failing must not
 * fail the thing that caused it.
 */

import prisma from '@/app/lib/prisma';
import { membersByDuty } from '@/app/lib/duty';
import { isPushConfigured, sendPushToUser } from '@/app/lib/push';

export const WAKE_KINDS = {
  SIGHTING: 'FORCE_SIGHTING',
  BLOCK_FREE: 'FORCE_BLOCK_FREE',
  NEED: 'FORCE_NEED',
  PARTY: 'FORCE_PARTY',
};

/**
 * `forceIds`: the forces whose members this concerns. `title` and `body`
 * are the words on the phone and in the bell. `url` is where the tap
 * lands. Returns { bell, pushed } counts.
 */
export async function wakeForces({ forceIds, exceptUserId = null, kind, title, body, url, data = null, everyone = false, now = new Date() }) {
  try {
    const { onDuty, offDuty } = await membersByDuty(forceIds, { exceptUserId, now });
    const all = [...onDuty, ...offDuty];
    if (!all.length) return { bell: 0, pushed: 0 };

    await prisma.notification.createMany({
      data: all.map((userId) => ({
        userId,
        type: kind,
        title,
        message: body,
        actionUrl: url,
        data: data ? JSON.stringify(data) : null,
      })),
    });

    const toPush = everyone ? all : onDuty;
    let pushed = 0;
    if (toPush.length && isPushConfigured()) {
      const results = await Promise.all(
        toPush.map((userId) => sendPushToUser(prisma, userId, { title, body, url, data: data || undefined }).catch(() => null))
      );
      pushed = results.filter((r) => r && r.sent > 0).length;
    }
    return { bell: all.length, pushed };
  } catch (error) {
    console.error('[wake] failed:', error?.message);
    return { bell: 0, pushed: 0 };
  }
}
