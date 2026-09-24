/**
 * One division of a Rescue Force, for the force's members: the pets missing
 * inside its area and the members assigned to it.
 *
 * This replaced the dark "hub" page, which showed force-wide numbers as the
 * division's, an "On duty" count that was never real (availability defaults
 * to AVAILABLE for everyone), and chat, announcement and help tools that
 * never rendered. Updates and chat now live on the force's own tabs.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import prisma from '@/app/lib/prisma';
import { requireForceMember } from '@/app/lib/forceViewer';
import { getPublicForce } from '@/app/lib/forcePublic';
import { FORCE_ROLE_LABEL, memberName } from '@/app/lib/forceRoles';
import PetCard from '@/app/lost-and-found/PetCard';
import MemberPageHeader from '../../MemberPageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Division', robots: { index: false, follow: false } };

function zipOf(division) {
  try {
    return JSON.parse(division.zipCodes || '[]')[0] || null;
  } catch {
    return null;
  }
}

export default async function DivisionPage({ params }) {
  const { id, divisionId } = await params;
  const viewer = await requireForceMember(id, `/rescue-forces/${id}/divisions/${divisionId}`);
  if (!viewer.force) notFound();

  const division = await prisma.division.findFirst({
    where: { id: divisionId, rescueSquadId: id, isActive: true, isDeleted: false },
    select: {
      id: true,
      name: true,
      description: true,
      centerLatitude: true,
      centerLongitude: true,
      radiusMiles: true,
      zipCodes: true,
      members: {
        where: { isActive: true },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        select: { id: true, role: true, user: { select: { firstName: true, lastName: true, profileImage: true } } },
      },
    },
  });
  if (!division) notFound();

  const hasArea = division.centerLatitude != null && division.centerLongitude != null;
  const publicForce = hasArea ? await getPublicForce(id) : null;
  const pets = (publicForce?.liveMissions || []).filter((m) => m.zoneId === division.id);
  const zip = zipOf(division);

  return (
    <div className="min-h-screen bg-midnight-50">
      <MemberPageHeader force={viewer.force} title={division.name} wide>
        <p className="mt-2 text-midnight-600">
          {[division.description, hasArea && zip ? `${division.radiusMiles} miles around ${zip}` : null].filter(Boolean).join(' · ') ||
            'A division of this force.'}
        </p>
      </MemberPageHeader>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">
        <Link
          href={`/rescue-forces/${id}/divisions`}
          className="-ml-1 inline-flex items-center gap-1 px-1 text-sm font-medium text-midnight-500 hover:text-midnight-900"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          All divisions
        </Link>

        <section aria-labelledby="division-missing">
          <h2 id="division-missing" className="text-xl font-semibold text-midnight-900">
            Missing in this division
          </h2>
          {!hasArea ? (
            <p className="mt-3 rounded-2xl bg-white px-5 py-6 text-midnight-500 ring-1 ring-midnight-200">
              {viewer.isLeader
                ? 'This division has no area yet. Give it a ZIP code on the Divisions tab so missing pets can be matched to it.'
                : 'This division has no area yet, so no pets are matched to it.'}
            </p>
          ) : pets.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-white px-5 py-6 text-midnight-500 ring-1 ring-midnight-200">
              No pets are reported missing in this division right now.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {pets.map((c) => (
                <PetCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="division-members">
          <h2 id="division-members" className="text-xl font-semibold text-midnight-900">
            Members
          </h2>
          {division.members.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-white px-5 py-6 text-midnight-500 ring-1 ring-midnight-200">
              No one is assigned to this division yet.
              {viewer.isLeader ? ' Assign members on the Members tab.' : ''}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-midnight-100 overflow-hidden rounded-2xl bg-white ring-1 ring-midnight-200">
              {division.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  {m.user.profileImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.user.profileImage} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-midnight-100 text-sm font-semibold text-midnight-700">
                      {(m.user.firstName || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-midnight-800">{memberName(m.user)}</span>
                  {m.role !== 'MEMBER' && <span className="text-sm text-midnight-500">{FORCE_ROLE_LABEL[m.role]}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
