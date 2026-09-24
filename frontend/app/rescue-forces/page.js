/**
 * Rescue Forces: what they are, the search for the one near you, and every
 * active force.
 *
 * A Rescue Force is a group of volunteers for an area. When a pet is
 * reported lost inside a force's area, the report is assigned to it
 * (app/api/reports/create), it shows on the force's page, and members can
 * join the search. That is all this page claims.
 *
 * Server-rendered, so the list is in the HTML for search engines and link
 * previews (metadata lives in ./layout.js). It replaced a client page that
 * only redirected to /rescue-forces/search, which next.config.js now sends
 * here, query and all.
 */

import Link from 'next/link';
import { Plus, Shield, ChevronRight } from 'lucide-react';
import prisma from '@/app/lib/prisma';
import { Button } from '@/components/ui';
import ForceSearch from './ForceSearch';

export const dynamic = 'force-dynamic';

const OPEN_CASE_STATUSES = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'];
const LIVE_ASSIGNMENT_STATUSES = ['ACCEPTED', 'ACTIVE', 'STANDBY'];

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

async function loadForces() {
  try {
    const rows = await prisma.rescueForce.findMany({
      where: { isActive: true, isDeleted: false },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        successfulReunions: true,
        _count: { select: { members: { where: { isActive: true } } } },
        caseAssignments: {
          where: { status: { in: LIVE_ASSIGNMENT_STATUSES }, case: { status: { in: OPEN_CASE_STATUSES } } },
          select: { id: true },
        },
      },
      take: 500,
    });
    return rows
      .map((f) => ({
        id: f.id,
        name: f.name,
        place: [f.city, f.state].filter(Boolean).join(', '),
        members: f._count.members,
        missing: f.caseAssignments.length,
        reunions: f.successfulReunions || 0,
      }))
      .sort((a, b) => b.members - a.members || b.missing - a.missing || a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Rescue Forces list failed:', error);
    return null;
  }
}

export default async function RescueForcesPage() {
  const forces = await loadForces();

  return (
    <div className="min-h-screen bg-midnight-50">
      <header className="border-b border-midnight-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 pb-8 pt-8 sm:pt-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold tracking-tight text-midnight-900 sm:text-4xl">Rescue Forces</h1>
              <p className="mt-2 text-midnight-600">
                Local volunteers who search for lost pets. When a pet is reported lost in a Rescue Force&apos;s area,
                the report goes to that force, and its members can join the search.
              </p>
            </div>
            {/* Beside the title from the small breakpoint up. On a phone,
                ForceSearch shows it under the search, where finding a force
                comes first. The icon goes in as rendered children: a server
                page cannot hand Button (a client component) an icon component
                as a prop. */}
            <div className="hidden shrink-0 sm:block">
              <Button href="/rescue-forces/create" variant="outline">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Start a Rescue Force
              </Button>
            </div>
          </div>
          <div className="mt-6">
            <ForceSearch />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <section aria-labelledby="all-forces-heading">
          <h2 id="all-forces-heading" className="text-xl font-semibold text-midnight-900">
            All Rescue Forces{forces?.length ? ` (${forces.length})` : ''}
          </h2>

          {forces === null ? (
            <p className="mt-3 rounded-2xl bg-white px-5 py-6 text-midnight-500 ring-1 ring-midnight-200">
              The list didn&apos;t load. Refresh the page to try again.
            </p>
          ) : forces.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-white px-5 py-6 text-midnight-500 ring-1 ring-midnight-200">
              There are no Rescue Forces yet. Start the first one for your town.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-midnight-100 overflow-hidden rounded-2xl bg-white ring-1 ring-midnight-200">
              {forces.map((f) => (
                <li key={f.id}>
                  <Link href={`/rescue-forces/${f.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-midnight-50 sm:px-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-midnight-100 text-midnight-600">
                      <Shield size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-midnight-900">{f.name}</span>
                      <span className="block text-sm text-midnight-500">
                        {[
                          f.place,
                          plural(f.members, 'member', 'members'),
                          f.missing > 0 && plural(f.missing, 'pet missing', 'pets missing'),
                          f.reunions > 0 && `${f.reunions} reunited`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-midnight-300" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
