/**
 * A Rescue Force's page, Needs tab: what its searches need done right now
 * (the force's open SquadTasks), each with its pet. Owners and leaders ask;
 * members take one on.
 *
 * Everyone sees what is needed, which is the point of the tab for someone
 * deciding whether to join. The details under a need (notes, places) are
 * for members, like the tasks API they come from.
 */

import { notFound } from 'next/navigation';
import prisma from '@/app/lib/prisma';
import { getForcePage, OPEN_NEED_STATUSES } from '@/app/lib/forcePage';
import { timeAgo } from '@/app/lib/caseLabels';
import { forceMetadata } from '../forceMetadata';
import NeedsTab from './NeedsTab';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  return forceMetadata(id, { tab: 'needs' });
}

export default async function ForceNeedsPage({ params }) {
  const { id } = await params;
  const data = await getForcePage(id);
  if (!data) notFound();
  const member = data.viewer.isMember || data.viewer.isAdmin;

  const rows = await prisma.squadTask.findMany({
    where: { rescueSquadId: id, status: { in: OPEN_NEED_STATUSES }, role: { not: 'OWNER' } },
    orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      description: true,
      caseId: true,
      ownerRequested: true,
      ownerRequestedHelp: true,
      createdAt: true,
      _count: { select: { participants: { where: { status: 'ACTIVE' } } } },
    },
    take: 100,
  });

  // A need belongs to a pet still being looked for, or to the whole force.
  const petById = new Map(data.pets.filter((p) => p.status === 'lost' || p.status === 'found').map((p) => [p.id, p]));
  const needs = rows
    .filter((n) => !n.caseId || petById.has(n.caseId))
    .map((n) => {
      const pet = n.caseId ? petById.get(n.caseId) : null;
      return {
        id: n.id,
        title: n.title,
        details: member ? n.description || null : null,
        asked: `Asked ${timeAgo(n.createdAt)}`,
        people: n._count.participants,
        byOwner: n.ownerRequested || n.ownerRequestedHelp,
        pet: pet ? { name: pet.name, photo: pet.photo, species: pet.species, caseNumber: pet.caseNumber, status: pet.status } : null,
      };
    });

  return <NeedsTab needs={needs} />;
}
