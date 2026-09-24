/**
 * A Rescue Force's members, for its members. Founders and leaders manage
 * roles, divisions and removals here (it used to be a panel on the settings
 * page, which regular members could not open); anyone can leave the force.
 */

import { notFound } from 'next/navigation';
import { requireForceMember } from '@/app/lib/forceViewer';
import MemberPageHeader from '../MemberPageHeader';
import MembersClient from './MembersClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Members', robots: { index: false, follow: false } };

export default async function MembersPage({ params }) {
  const { id } = await params;
  const viewer = await requireForceMember(id, `/rescue-forces/${id}/members`);
  if (!viewer.force) notFound();

  return (
    <div className="min-h-screen bg-midnight-50">
      <MemberPageHeader force={viewer.force} title="Members" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <MembersClient
          forceId={id}
          forceName={viewer.force.name}
          userId={viewer.userId}
          myRole={viewer.membership?.role || null}
        />
      </main>
    </div>
  );
}
