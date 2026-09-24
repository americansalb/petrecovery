/**
 * A Rescue Force's updates: announcements from its leaders, then posts from
 * any member, with likes and comments. Members only (the posts can hold
 * owners' addresses and search plans). The data comes from the force's
 * /announcements and /posts APIs; this replaced the dark "Community" feed on
 * the old division page, which regular members had no link to.
 */

import { notFound } from 'next/navigation';
import { requireForceMember } from '@/app/lib/forceViewer';
import { FORCE_COMMAND_ROLES } from '@/app/lib/forceRoles';
import MemberPageHeader from '../MemberPageHeader';
import UpdatesClient from './UpdatesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Updates', robots: { index: false, follow: false } };

export default async function UpdatesPage({ params }) {
  const { id } = await params;
  const viewer = await requireForceMember(id, `/rescue-forces/${id}/updates`);
  if (!viewer.force) notFound();

  return (
    <div className="min-h-screen bg-midnight-50">
      <MemberPageHeader force={viewer.force} title="Updates" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <UpdatesClient
          forceId={id}
          userId={viewer.userId}
          canPost={Boolean(viewer.membership)}
          canAnnounce={FORCE_COMMAND_ROLES.includes(viewer.membership?.role)}
        />
      </main>
    </div>
  );
}
