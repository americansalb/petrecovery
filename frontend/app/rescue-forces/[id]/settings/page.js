/**
 * A Rescue Force's settings, for its founders and leaders: the photo and
 * description shown on its public page, whether it takes new pets, which
 * pets it searches for, when, and with what. Saves through PATCH
 * /api/rescue-forces/[id] and POST .../photo.
 *
 * Member roles and removals moved to the Members tab. The old page also
 * showed its whole form to members who were not leaders, with an error
 * banner on top; this one sends them to the force's page before rendering.
 */

import { notFound } from 'next/navigation';
import prisma from '@/app/lib/prisma';
import { requireForceMember } from '@/app/lib/forceViewer';
import MemberPageHeader from '../MemberPageHeader';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings', robots: { index: false, follow: false } };

export default async function SettingsPage({ params }) {
  const { id } = await params;
  const viewer = await requireForceMember(id, `/rescue-forces/${id}/settings`, { leadersOnly: true });
  if (!viewer.force) notFound();

  const settings = await prisma.rescueForce.findFirst({
    where: { id, isDeleted: false },
    select: {
      description: true,
      photoUrl: true,
      logoUrl: true,
      isAcceptingCases: true,
      specializesInDogs: true,
      specializesInCats: true,
      specializesInBirds: true,
      specializesInOther: true,
      availableWeekdays: true,
      availableWeekends: true,
      availableDay: true,
      availableNight: true,
      hasTrackingDogs: true,
      hasDrones: true,
    },
  });
  if (!settings) notFound();

  return (
    <div className="min-h-screen bg-midnight-50">
      <MemberPageHeader force={viewer.force} title="Settings" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <SettingsClient forceId={id} initial={settings} canEdit={viewer.isLeader} />
      </main>
    </div>
  );
}
