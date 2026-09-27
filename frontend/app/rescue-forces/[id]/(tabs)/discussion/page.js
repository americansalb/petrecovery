/**
 * A Rescue Force's page, Discussion tab: the force's posts, laid out like a
 * group (./DiscussionClient.js): what leaders pinned, search parties coming
 * up, every post newest first, and Topics (where to start, the pets, the
 * kinds of post, with counts from app/lib/forceDiscussion.js).
 *
 * Members only: posts can hold owners' addresses and search plans. Anyone
 * else sees what the tab is for and the way in (./LockedDiscussion.js).
 * Platform admins may read, for moderation.
 */

import { notFound } from 'next/navigation';
import prisma from '@/app/lib/prisma';
import { getForceViewer } from '@/app/lib/forceViewer';
import { getForcePage } from '@/app/lib/forcePage';
import { discussionSummary } from '@/app/lib/forceDiscussion';
import { FORCE_COMMAND_ROLES } from '@/app/lib/forceRoles';
import { forceMetadata } from '../forceMetadata';
import DiscussionClient from './DiscussionClient';
import LockedDiscussion from './LockedDiscussion';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  return forceMetadata(id, { tab: 'discussion' });
}

export default async function ForceDiscussionPage({ params }) {
  const { id } = await params;
  const viewer = await getForceViewer(id);
  if (!viewer.force) notFound();
  if (!viewer.membership && !viewer.isAdmin) return <LockedDiscussion />;

  const data = await getForcePage(id);
  const live = (data?.pets || []).filter((p) => p.status === 'lost' || p.status === 'found');
  const [summary, me] = await Promise.all([
    discussionSummary(id, live),
    prisma.user.findUnique({ where: { id: viewer.userId }, select: { firstName: true } }),
  ]);

  return (
    <DiscussionClient
      forceId={id}
      canPost={Boolean(viewer.membership)}
      canAnnounce={FORCE_COMMAND_ROLES.includes(viewer.membership?.role)}
      myName={(me?.firstName || '').trim()}
      pets={live.map((p) => ({ id: p.id, name: p.name }))}
      summary={summary}
    />
  );
}
