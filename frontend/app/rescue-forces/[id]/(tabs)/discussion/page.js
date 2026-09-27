/**
 * A Rescue Force's page, Discussion tab: announcements from its leaders and
 * posts from its members, with likes and comments (./UpdatesClient.js, the
 * force's /announcements and /posts APIs). It was the Updates page.
 *
 * Members only: posts can hold owners' addresses and search plans. Anyone
 * else sees what the tab is for and the way in (./LockedDiscussion.js).
 * Platform admins may read, for moderation.
 */

import { notFound } from 'next/navigation';
import { getForceViewer } from '@/app/lib/forceViewer';
import { FORCE_COMMAND_ROLES } from '@/app/lib/forceRoles';
import { forceMetadata } from '../forceMetadata';
import UpdatesClient from './UpdatesClient';
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

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 lg:pb-10">
      <UpdatesClient
        forceId={id}
        userId={viewer.userId}
        canPost={Boolean(viewer.membership)}
        canAnnounce={FORCE_COMMAND_ROLES.includes(viewer.membership?.role)}
      />
    </div>
  );
}
