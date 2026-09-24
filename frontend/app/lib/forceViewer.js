/**
 * Who is looking at a Rescue Force's pages, for the server components under
 * app/rescue-forces/[id]: the force's basics, the viewer's membership, and
 * whether they lead it. The member pages (updates, chat, members, divisions,
 * settings) call requireForceMember, which sends a signed-out visitor to sign
 * in and anyone else to the force's public page, where they can join.
 */

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getUserRole } from '@/app/lib/authz';

/** Founders and leaders run the force: settings, members, divisions. */
export const FORCE_LEADER_ROLES = ['FOUNDER', 'LEADER', 'ADMINISTRATOR'];

export async function getForceViewer(forceId) {
  const [session, force] = await Promise.all([
    getServerSession(authOptions),
    prisma.rescueForce.findFirst({
      where: { id: forceId, isDeleted: false },
      select: { id: true, name: true, city: true, state: true },
    }),
  ]);
  const userId = session?.user?.id || null;
  if (!force || !userId) return { force, userId, membership: null, isLeader: false, isAdmin: false };

  const [membership, role] = await Promise.all([
    prisma.rescueForceMember.findFirst({
      where: { rescueSquadId: forceId, userId, isActive: true },
      select: { id: true, role: true, divisionId: true },
    }),
    getUserRole(userId),
  ]);
  return {
    force,
    userId,
    membership,
    isLeader: FORCE_LEADER_ROLES.includes(membership?.role),
    isAdmin: role === 'ADMIN',
  };
}

/**
 * For a members-only page. Platform admins may look (moderation), but only
 * members act; `leadersOnly` pages also need a founder or leader.
 */
export async function requireForceMember(forceId, path, { leadersOnly = false } = {}) {
  const viewer = await getForceViewer(forceId);
  if (!viewer.force) return viewer; // the page calls notFound()
  if (!viewer.userId) redirect(`/login?callbackUrl=${encodeURIComponent(path)}`);
  const allowed = leadersOnly ? viewer.isLeader || viewer.isAdmin : viewer.membership || viewer.isAdmin;
  if (!allowed) redirect(`/rescue-forces/${forceId}`);
  return viewer;
}
