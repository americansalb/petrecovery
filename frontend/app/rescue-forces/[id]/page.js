/**
 * The Rescue Force page - Phase 1 of docs/RESCUE_FORCES_REDESIGN.md.
 *
 * Server-rendered civic surface in the house register (light ground,
 * midnight hero, one flash CTA). Answers three questions in order:
 * WHERE (Lantern territory map), WHO (crew with on-duty glow), and
 * WHAT NOW (MISSING NOW missions, or the watchtower state). The only
 * dark element is the map card - a window into the night layer that
 * Mission Control owns.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getPublicForce } from '@/app/lib/forcePublic';
import {
  SITE_NAME,
  shareImage,
  buildShareMetadata,
  genericShareMetadata,
} from '@/app/lib/shareMetadata';
import TerritoryMapCard from './TerritoryMapCard';
import JoinForceButton from './JoinForceButton';
import {
  Shield, ShieldCheck, Dog, Plane, Moon, Heart, Timer, CalendarDays, MapPin,
  ArrowRight, Star, UserPlus, Eye, Radar, Activity as ActivityIcon, PawPrint,
  CheckCircle2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  try {
    const force = await prisma.rescueForce.findFirst({
      where: { id: params.id, isDeleted: false },
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
      ? ` ${force.successfulReunions} successful reunion${force.successfulReunions === 1 ? '' : 's'} and counting.`
      : '';
    const description =
      (force.slogan || force.description || `Neighbors organized to bring lost pets home${place ? ` in ${place}` : ''}.`) +
      reunions;

    return buildShareMetadata({
      title,
      description,
      image: shareImage(force.photoUrl || force.logoUrl),
      imageAlt: force.name,
      canonical: `/rescue-forces/${params.id}`,
      index: force.isActive,
    });
  } catch (error) {
    console.error('Error generating rescue force metadata:', error);
    return genericShareMetadata();
  }
}

/* ---------- tiny server-side presenters ---------- */

function elapsedLabel(lastSeenAt) {
  if (!lastSeenAt) return null;
  const hours = Math.max(1, Math.floor((Date.now() - new Date(lastSeenAt)) / 3600000));
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function timeAgo(date) {
  const mins = Math.floor((Date.now() - new Date(date)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function daysHome(reunion) {
  if (!reunion.resolvedAt || !reunion.lastSeenAt) return null;
  const days = Math.round(
    (new Date(reunion.resolvedAt) - new Date(reunion.lastSeenAt)) / 86400000
  );
  return days > 0 ? days : null;
}

function Avatar({ user, size = 'w-8 h-8', ring = '' }) {
  if (user?.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.image} alt="" className={`${size} rounded-full object-cover ${ring}`} />;
  }
  return (
    <span
      className={`${size} rounded-full bg-midnight-200 text-midnight-700 inline-flex items-center justify-center text-[11px] font-bold ${ring}`}
    >
      {(user?.name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

const ACTIVITY_ICONS = {
  MEMBER_JOINED: UserPlus,
  SIGHTING_REPORTED: Eye,
  CASE_ACCEPTED: Radar,
  CASE_COMPLETED: Heart,
};

const LEVEL_LABELS = {
  ROOKIE: null, // new forces show their founding date instead of a rank
  ESTABLISHED: 'Established',
  VETERAN: 'Veteran',
  ELITE: 'Elite',
  LEGENDARY: 'Legendary',
};

function HeroChip({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/5 text-midnight-200 px-3 py-1 rounded-full border border-white/10 text-[12px] font-medium">
      {children}
    </span>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-midnight-400 mb-3">
      {children}
    </h2>
  );
}

/* ---------- the page ---------- */

export default async function ForcePage({ params }) {
  const data = await getPublicForce(params.id);
  if (!data) notFound();
  const { force, zones, liveMissions, reunions, onDutyCount } = data;

  const session = await getServerSession(authOptions);
  const viewerMembership = session?.user?.id
    ? force.members.find((m) => m.user.id === session.user.id)
    : null;

  const place = [force.city, force.state].filter(Boolean).join(', ');
  const levelLabel = LEVEL_LABELS[force.rescueSquadLevel] ?? null;
  const founded = new Date(force.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // "Austin Rescue Force" → white "Austin" + flash "Rescue Force"
  const nameSuffix = 'Rescue Force';
  const namePrefix = force.name.endsWith(nameSuffix)
    ? force.name.slice(0, -nameSuffix.length).trim()
    : null;

  const divisionNames = new Map(zones.map((z) => [z.id, z.name]));
  const crewGroups = [];
  for (const zone of zones) {
    const group = force.members.filter((m) => m.divisionId === zone.id);
    if (group.length) crewGroups.push({ label: zone.name, members: group });
  }
  const unassigned = force.members.filter((m) => !m.divisionId || !divisionNames.has(m.divisionId));
  if (unassigned.length) {
    crewGroups.unshift({ label: zones.length ? 'Force-wide' : null, members: unassigned });
  }

  const flares = liveMissions
    .filter((m) => m.lastSeenLatitude != null)
    .map((m) => ({ lat: m.lastSeenLatitude, lng: m.lastSeenLongitude }));

  return (
    <div className="bg-midnight-50 min-h-screen">
      {/* ---------- Hero: identity + the one join CTA ---------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0a1526] via-midnight-900 to-[#0c1a30]">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[640px] h-[640px] bg-flash-400/10 rounded-full blur-[130px] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 py-12 md:py-16 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 bg-flash-400/10 text-flash-200 px-3.5 py-1.5 rounded-full border border-flash-400/25 text-[12px] font-bold uppercase tracking-[0.12em]">
              <Shield className="w-3.5 h-3.5" /> Rescue Force{place ? ` · ${place}` : ''}
            </span>
            <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-tight text-white">
              {namePrefix !== null ? (
                <>
                  {namePrefix}{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-flash-300 via-flash-400 to-amber-300">
                    Rescue Force
                  </span>
                </>
              ) : (
                force.name
              )}
            </h1>
            {force.slogan && (
              <p className="mt-3 text-lg text-midnight-200">{force.slogan}</p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {levelLabel && (
                <HeroChip>
                  <Star className="w-3.5 h-3.5 text-flash-300" /> {levelLabel}
                </HeroChip>
              )}
              {force.hasTrackingDogs && (
                <HeroChip>
                  <Dog className="w-3.5 h-3.5" /> Tracking dogs
                </HeroChip>
              )}
              {force.hasDrones && (
                <HeroChip>
                  <Plane className="w-3.5 h-3.5" /> Drone pilots
                </HeroChip>
              )}
              {force.availableNight && (
                <HeroChip>
                  <Moon className="w-3.5 h-3.5" /> Night search
                </HeroChip>
              )}
              {!force.isActive && (
                <span className="inline-flex items-center gap-1.5 bg-amber-400/10 text-amber-200 px-3 py-1 rounded-full border border-amber-400/25 text-[12px] font-medium">
                  Pending activation
                </span>
              )}
            </div>
          </div>

          <div className="w-full lg:w-80 shrink-0 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {force.members.slice(0, 4).map((m) => (
                  <Avatar key={m.id} user={m.user} ring="ring-2 ring-midnight-900" />
                ))}
              </div>
              <p className="text-sm text-midnight-200">
                <strong className="text-white font-bold">{force.members.length}</strong>{' '}
                {force.members.length === 1 ? 'member' : 'members'}
                {onDutyCount > 0 && (
                  <>
                    {' · '}
                    <span className="text-emerald-300">{onDutyCount} on duty now</span>
                  </>
                )}
              </p>
            </div>
            <div className="mt-4">
              {viewerMembership ? (
                <div className="text-center">
                  <p className="inline-flex items-center gap-2 text-emerald-300 font-bold">
                    <CheckCircle2 className="w-4 h-4" /> You&rsquo;re on this force
                  </p>
                  <p className="text-[12px] text-midnight-300 mt-1.5">
                    {viewerMembership.availabilityStatus === 'AVAILABLE'
                      ? 'On duty. You’ll be alerted when a pet needs eyes.'
                      : 'Off duty right now.'}
                  </p>
                </div>
              ) : (
                <JoinForceButton forceId={force.id} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Vitals: labeled, zero-suppressing ---------- */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="mt-6 rounded-2xl border border-midnight-100 bg-white shadow-sm px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
          {liveMissions.length > 0 ? (
            <span className="inline-flex items-center gap-2 font-bold text-midnight-900">
              <i className="w-2 h-2 rounded-full bg-flash-500 animate-pulse-soft" />
              {liveMissions.length} {liveMissions.length === 1 ? 'pet' : 'pets'} missing now
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 font-bold text-midnight-900">
              <i className="w-2 h-2 rounded-full bg-emerald-500" />
              All quiet right now
            </span>
          )}
          {force.successfulReunions > 0 && (
            <span className="inline-flex items-center gap-2 text-midnight-700">
              <Heart className="w-4 h-4 text-emerald-600" />
              <strong className="font-bold text-midnight-900">{force.successfulReunions}</strong>{' '}
              reunited
            </span>
          )}
          {force.avgResponseTimeMinutes != null && (
            <span className="inline-flex items-center gap-2 text-midnight-700">
              <Timer className="w-4 h-4 text-midnight-400" />~{force.avgResponseTimeMinutes} min
              response
            </span>
          )}
          {force.successfulReunions === 0 && (
            <span className="inline-flex items-center gap-2 text-midnight-500">
              <CalendarDays className="w-4 h-4 text-midnight-400" /> Founded {founded}
            </span>
          )}
        </div>
      </div>

      {/* ---------- Working grid ---------- */}
      <main className="max-w-6xl mx-auto px-4 py-8 md:py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 space-y-8 lg:space-y-0">
        <div className="space-y-8 min-w-0">
          {/* MISSING NOW - urgency owns the top */}
          <section>
            <SectionTitle>Missing now</SectionTitle>
            {liveMissions.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-6 py-8 text-center">
                <ShieldCheck className="w-9 h-9 text-emerald-500 mx-auto mb-2.5" />
                <p className="font-bold text-midnight-900 text-lg">
                  All quiet{force.city ? ` in ${force.city}` : ''} tonight.
                </p>
                <p className="text-midnight-600 mt-1">
                  {force.members.length > 0 ? (
                    <>
                      {onDutyCount > 0 ? `${onDutyCount} of ` : ''}
                      {force.members.length} {force.members.length === 1 ? 'volunteer' : 'volunteers'}
                      {onDutyCount > 0 ? ' on duty, ' : ' '}watching over the neighborhood.
                    </>
                  ) : (
                    'The watch starts when the first neighbors join.'
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {liveMissions.map((mission) => (
                  <div
                    key={mission.id}
                    className="rounded-2xl border border-midnight-100 border-l-4 border-l-flash-400 bg-white shadow-card p-4 sm:p-5 flex gap-4"
                  >
                    {mission.petPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mission.petPhotoUrl}
                        alt={mission.petName || 'Missing pet'}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <span className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-midnight-100 flex items-center justify-center shrink-0">
                        <PawPrint className="w-8 h-8 text-midnight-300" />
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-xl font-black text-midnight-900 leading-tight">
                          {mission.petName || 'Missing pet'}
                        </h3>
                        <span className="inline-flex items-center gap-1.5 bg-flash-100 text-flash-800 border border-flash-200 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide">
                          <i className="w-1.5 h-1.5 rounded-full bg-flash-500 animate-pulse-soft" />
                          Live · {elapsedLabel(mission.lastSeenAt) || '-'} missing
                        </span>
                      </div>
                      <p className="text-sm text-midnight-500 mt-0.5 truncate">
                        {[mission.petBreed, mission.petSpecies?.toLowerCase()]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {mission.lastSeenAddress && (
                        <p className="text-sm text-midnight-600 mt-1.5 inline-flex items-center gap-1.5 max-w-full">
                          <MapPin className="w-3.5 h-3.5 text-midnight-400 shrink-0" />
                          <span className="truncate">{mission.lastSeenAddress.split(',')[0]}</span>
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-2 text-[13px] text-midnight-500">
                          {mission.searchers.length > 0 && (
                            <span className="flex -space-x-2">
                              {mission.searchers.slice(0, 3).map((u, i) => (
                                <Avatar key={u.id || i} user={u} size="w-6 h-6" ring="ring-2 ring-white" />
                              ))}
                            </span>
                          )}
                          {mission.searchers.length > 0
                            ? `${mission.searchers.length} searching`
                            : 'Be the first out there'}
                        </span>
                        <Link
                          href={`/mission-control?mission=${mission.caseNumber}`}
                          className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-4 py-2 rounded-xl transition"
                        >
                          Join the search <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ACTIVITY - the pulse, auto-generated, never asks for content */}
          {force.activities.length > 0 && (
            <section>
              <SectionTitle>Activity</SectionTitle>
              <div className="rounded-2xl border border-midnight-100 bg-white shadow-sm divide-y divide-midnight-100 overflow-hidden">
                {force.activities.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.type] || ActivityIcon;
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-7 h-7 rounded-full bg-midnight-50 border border-midnight-100 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-midnight-500" />
                      </span>
                      {/* line-clamp-2, not truncate: one line dropped the where and the
                          which-pet, so "Sarah reported a verified sighti..." told
                          a reader nothing they could act on. */}
                      <p className="flex-1 min-w-0 text-sm text-midnight-700 line-clamp-2">{a.message}</p>
                      <span className="text-[12px] text-midnight-400 tabular-nums shrink-0">
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* ---------- Right rail: WHERE and WHO ---------- */}
        <aside className="space-y-6">
          {force.centerLatitude != null && (
            <section>
              <SectionTitle>Territory</SectionTitle>
              <TerritoryMapCard
                forceId={force.id}
                center={[force.centerLatitude, force.centerLongitude]}
                radiusMiles={force.radiusMiles}
                zones={zones}
                flares={flares}
              />
            </section>
          )}

          {force.members.length > 0 && (
            <section>
              <SectionTitle>Crew</SectionTitle>
              <div className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-4 space-y-4">
                {crewGroups.map((group, gi) => (
                  <div key={group.label || gi}>
                    {group.label && (
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-midnight-400 mb-2">
                        {group.label}
                      </p>
                    )}
                    <div className="space-y-2">
                      {group.members.slice(0, 5).map((m) => (
                        <div key={m.id} className="flex items-center gap-2.5">
                          <span className="relative inline-flex">
                            <Avatar user={m.user} />
                            {m.availabilityStatus === 'AVAILABLE' && (
                              <i
                                className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                                title="On duty"
                              />
                            )}
                          </span>
                          <span className="text-sm text-midnight-800 truncate">
                            {m.user.name || 'Neighbor'}
                          </span>
                          {(m.role === 'FOUNDER' || m.role === 'LEADER') && (
                            <Star
                              className="w-3.5 h-3.5 text-flash-500 shrink-0"
                              title={m.role === 'FOUNDER' ? 'Founder' : 'Leader'}
                            />
                          )}
                        </div>
                      ))}
                      {group.members.length > 5 && (
                        <p className="text-[12px] text-midnight-400 pl-10">
                          +{group.members.length - 5} more
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {reunions.length > 0 && (
            <section>
              <SectionTitle>Reunited</SectionTitle>
              <div className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-4 space-y-3">
                {reunions.map((r) => {
                  const days = daysHome(r);
                  return (
                    <div key={r.id} className="flex items-center gap-3">
                      {r.petPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.petPhotoUrl}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                          <Heart className="w-4 h-4 text-emerald-500" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-midnight-900 truncate">{r.petName}</p>
                        <p className="text-[12px] text-midnight-500">
                          Home{days ? ` after ${days} ${days === 1 ? 'day' : 'days'}` : ' again'} 🎉
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
      </main>
    </div>
  );
}
