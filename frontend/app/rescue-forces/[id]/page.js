/**
 * A Rescue Force's public page.
 *
 * From the top: which force and where, how many members, and the one action
 * (join, in place and signed out too, see ./JoinForcePanel.js; or links to
 * updates and chat if you are in it; members also get the force's tabs from
 * ./layout.js); then the pets missing in its area as the same cards the
 * Lost & Found board uses, each with a button into its search for members;
 * its area on a map; its members; and its reunions. Built in the same plain
 * style as the pet pages. There is no activity list: the force's activity rows include
 * members' chat messages and announcements, and this page used to print
 * the latest of them to anyone.
 *
 * Server-rendered for link previews and search engines. Members are shown
 * by first name, the rule /api/rescue-forces/[id]/members applies to the
 * public. Nothing here claims volunteers are "on duty": availability
 * defaults to AVAILABLE for everyone, so it was never a signal.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ChevronLeft, Shield, Heart, Star, CheckCircle2, Megaphone, MessageCircle, Radar, ArrowRight } from 'lucide-react';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getPublicForce } from '@/app/lib/forcePublic';
import { SITE_NAME, shareImage, buildShareMetadata, genericShareMetadata } from '@/app/lib/shareMetadata';
import PetCard from '@/app/lost-and-found/PetCard';
import TerritoryMapCard from './TerritoryMapCard';
import JoinForcePanel from './JoinForcePanel';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const force = await prisma.rescueForce.findFirst({
      where: { id, isDeleted: false },
      select: {
        name: true,
        description: true,
        slogan: true,
        photoUrl: true,
        logoUrl: true,
        city: true,
        state: true,
        successfulReunions: true,
        isActive: true,
      },
    });
    if (!force) return genericShareMetadata();

    const place = [force.city, force.state].filter(Boolean).join(', ');
    const title = `${force.name}${place ? ` - ${place}` : ''} | ${SITE_NAME}`;
    const reunions = force.successfulReunions
      ? ` ${force.successfulReunions} pet${force.successfulReunions === 1 ? '' : 's'} reunited.`
      : '';
    const description =
      (force.slogan || force.description || `Volunteers who search for lost pets${place ? ` in ${place}` : ''}.`) + reunions;

    return buildShareMetadata({
      title,
      description,
      image: shareImage(force.photoUrl || force.logoUrl),
      imageAlt: force.name,
      canonical: `/rescue-forces/${id}`,
      index: force.isActive,
    });
  } catch (error) {
    console.error('Error generating rescue force metadata:', error);
    return genericShareMetadata();
  }
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function Initial({ user }) {
  if (user?.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.image} alt="" className="h-9 w-9 rounded-full object-cover" />;
  }
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-midnight-100 text-sm font-semibold text-midnight-700">
      {(user?.name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

const CAPABILITIES = [
  ['hasTrackingDogs', 'Tracking dogs'],
  ['hasDrones', 'Drone pilots'],
  ['availableNight', 'Searches at night'],
];

/** What a member's button under a missing pet says: the pet by name when the report has one. */
function helpLabel(c) {
  if (c.reportType === 'FOUND') return 'Help find the owner';
  const name = (c.petName || '').trim();
  return name && !/^unknown/i.test(name) ? `Help find ${name}` : 'Help search';
}

export default async function ForcePage({ params, searchParams }) {
  const { id } = await params;
  const query = (await searchParams) || {};
  const data = await getPublicForce(id);
  if (!data) notFound();
  const { force, zones, liveMissions, reunions } = data;

  const session = await getServerSession(authOptions);
  const me = session?.user?.id ? force.members.find((m) => m.user.id === session.user.id) : null;
  const justCreated = query.created === 'true' && me?.role === 'FOUNDER';

  const place = [force.city, force.state].filter(Boolean).join(', ');
  const started = new Date(force.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const capabilities = CAPABILITIES.filter(([key]) => force[key]).map(([, label]) => label);

  const facts = [
    plural(force.members.length, 'member', 'members'),
    liveMissions.length > 0 && plural(liveMissions.length, 'pet missing', 'pets missing'),
    force.successfulReunions > 0 && `${force.successfulReunions} reunited`,
  ].filter(Boolean);

  // Members grouped by division, force-wide first.
  const divisionName = new Map(zones.map((z) => [z.id, z.name]));
  const groups = [];
  const unassigned = force.members.filter((m) => !m.divisionId || !divisionName.has(m.divisionId));
  if (unassigned.length) groups.push({ label: zones.length ? 'Whole area' : null, members: unassigned });
  for (const zone of zones) {
    const members = force.members.filter((m) => m.divisionId === zone.id);
    if (members.length) groups.push({ label: zone.name, members });
  }

  const pets = liveMissions
    .filter((m) => m.lastSeenLatitude != null && m.lastSeenLongitude != null)
    .map((m) => ({ lat: m.lastSeenLatitude, lng: m.lastSeenLongitude, caseNumber: m.caseNumber, name: m.petName }));

  return (
    <div className="min-h-screen bg-midnight-50">
      <header className="border-b border-midnight-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-3 sm:pt-5">
          <Link href="/rescue-forces" className="-ml-1 inline-flex items-center gap-1 px-1 text-sm font-medium text-midnight-500 hover:text-midnight-900">
            <ChevronLeft size={16} aria-hidden="true" />
            Rescue Forces
          </Link>

          <div className="mt-3 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              {force.photoUrl || force.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={force.photoUrl || force.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-midnight-100 text-midnight-600">
                  <Shield size={28} aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0">
                <h1 className="break-words text-3xl font-bold tracking-tight text-midnight-900 sm:text-4xl">{force.name}</h1>
                <p className="mt-1 text-midnight-500">
                  {[place, `Started ${started}`].filter(Boolean).join(' · ')}
                </p>
                {force.slogan && <p className="mt-2 text-midnight-700">{force.slogan}</p>}
                <p className="mt-3 text-midnight-700">{facts.join(' · ')}</p>
                {capabilities.length > 0 && (
                  <p className="mt-1 text-sm text-midnight-500">{capabilities.join(' · ')}</p>
                )}
                {!force.isActive && (
                  <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
                    Waiting to be activated
                  </p>
                )}
              </div>
            </div>

            <div className="w-full shrink-0 md:w-72">
              {me ? (
                <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                  <p className="inline-flex items-center gap-2 font-semibold text-emerald-800">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    You&apos;re a member
                  </p>
                  <div className="mt-2 flex flex-col gap-1">
                    <Link
                      href={`/rescue-forces/${force.id}/updates`}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-midnight-800 hover:text-midnight-950"
                    >
                      <Megaphone size={16} aria-hidden="true" />
                      Updates from the force
                    </Link>
                    <Link
                      href={`/rescue-forces/${force.id}/chat`}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-midnight-800 hover:text-midnight-950"
                    >
                      <MessageCircle size={16} aria-hidden="true" />
                      Force chat
                    </Link>
                  </div>
                </div>
              ) : (
                <JoinForcePanel forceId={force.id} forceName={force.name} signedIn={Boolean(session?.user?.id)} />
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">
        {justCreated && (
          <p role="status" className="rounded-2xl bg-emerald-50 px-5 py-4 text-emerald-900 ring-1 ring-emerald-200">
            Your Rescue Force is set up. Share this page with neighbors so they can join.
          </p>
        )}

        <section aria-labelledby="missing-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="missing-heading" className="text-xl font-semibold text-midnight-900">
              Missing in this area
            </h2>
            {/* An owner can land here first (a search, a flyer, a neighbor's
                link). A report inside the force's area is assigned to it. */}
            <Link
              href="/report/new"
              className="inline-flex items-center gap-1 text-sm font-semibold text-midnight-700 hover:text-midnight-950"
            >
              {force.city ? `Pet missing near ${force.city}? Report it` : 'Pet missing? Report it'}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {liveMissions.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-white px-5 py-6 text-midnight-500 ring-1 ring-midnight-200">
              No pets are reported missing in this force&apos;s area right now.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {liveMissions.map((c) => (
                <div key={c.id} className="flex flex-col gap-2">
                  <PetCard c={c} />
                  {/* Members work these searches, so each pet gets a direct
                      way into its search map (Mission Control), not only a
                      link to its public page. */}
                  {me && (
                    <Link
                      href={`/mission-control?mission=${encodeURIComponent(c.caseNumber)}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-midnight-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-midnight-800"
                    >
                      <Radar size={16} aria-hidden="true" />
                      {helpLabel(c)}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {force.centerLatitude != null && force.centerLongitude != null && (
            <section aria-labelledby="area-heading" className="min-w-0 lg:col-span-2">
              <h2 id="area-heading" className="text-xl font-semibold text-midnight-900">
                Area
              </h2>
              <div className="mt-4">
                <TerritoryMapCard
                  forceId={force.id}
                  center={[force.centerLatitude, force.centerLongitude]}
                  radiusMiles={force.radiusMiles}
                  zones={zones}
                  pets={pets}
                  isMember={Boolean(me)}
                />
              </div>
            </section>
          )}

          <section aria-labelledby="members-heading" className="min-w-0">
            <h2 id="members-heading" className="text-xl font-semibold text-midnight-900">
              Members
            </h2>
            {force.members.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-white px-5 py-6 text-midnight-500 ring-1 ring-midnight-200">
                No members yet. Be the first to join.
              </p>
            ) : (
              <div className="mt-4 space-y-4 rounded-2xl bg-white p-4 ring-1 ring-midnight-200">
                {groups.map((group, gi) => (
                  <div key={group.label || gi}>
                    {group.label && <p className="mb-2 text-sm font-semibold text-midnight-500">{group.label}</p>}
                    <ul className="space-y-2.5">
                      {group.members.slice(0, 8).map((m) => (
                        <li key={m.id} className="flex items-center gap-3">
                          <Initial user={m.user} />
                          <span className="min-w-0 truncate text-midnight-800">{m.user.name || 'Neighbor'}</span>
                          {(m.role === 'FOUNDER' || m.role === 'LEADER') && (
                            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-midnight-500">
                              <Star size={12} className="text-flash-500" aria-hidden="true" />
                              {m.role === 'FOUNDER' ? 'Founder' : 'Leader'}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {group.members.length > 8 && (
                      <p className="mt-2 text-sm text-midnight-500">and {group.members.length - 8} more</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {reunions.length > 0 && (
          <section aria-labelledby="reunited-heading">
            <h2 id="reunited-heading" className="flex items-center gap-2 text-xl font-semibold text-midnight-900">
              <Heart size={20} className="text-emerald-600" aria-hidden="true" />
              Reunited
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {reunions.map((c) => (
                <PetCard key={c.id} c={c} />
              ))}
            </div>
          </section>
        )}

        <p className="text-center text-sm text-midnight-500">
          Want a Rescue Force for another town?{' '}
          <Link href="/rescue-forces" className="font-medium text-midnight-700 underline underline-offset-4">
            Find or start one
          </Link>
        </p>
      </main>
    </div>
  );
}
