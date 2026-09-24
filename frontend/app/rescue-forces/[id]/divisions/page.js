/**
 * A Rescue Force's divisions, for its members: the neighborhoods a big area
 * is split into, each linking to its own page. Founders and leaders add,
 * edit and delete them here, and give each an area (a ZIP code's centre and
 * a radius) so it shows on the map and pets can be matched to it. Members
 * are assigned to divisions on the Members tab.
 *
 * This replaced a "Division Management" page whose create, edit and delete
 * buttons all failed.
 */

import { notFound } from 'next/navigation';
import { requireForceMember } from '@/app/lib/forceViewer';
import MemberPageHeader from '../MemberPageHeader';
import DivisionsClient from './DivisionsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Divisions', robots: { index: false, follow: false } };

export default async function DivisionsPage({ params }) {
  const { id } = await params;
  const viewer = await requireForceMember(id, `/rescue-forces/${id}/divisions`);
  if (!viewer.force) notFound();

  return (
    <div className="min-h-screen bg-midnight-50">
      <MemberPageHeader force={viewer.force} title="Divisions">
        <p className="mt-2 text-midnight-600">
          Divisions split a large area into neighborhoods, so members can focus on the pets near them.
        </p>
      </MemberPageHeader>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <DivisionsClient forceId={id} canManage={viewer.isLeader} />
      </main>
    </div>
  );
}
