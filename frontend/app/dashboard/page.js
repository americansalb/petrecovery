'use client';

/**
 * Home for a signed-in person.
 *
 * The old page was a launcher: five equally-weighted sections with a
 * coloured icon each, a grid of action tiles duplicating the top nav, and
 * a welcome card. It answered no question. Worse, it listed lost REPORTS
 * rather than pets, so someone whose animals were all safely at home saw
 * an empty page, and an owner mid-search saw "no active missions".
 *
 * This asks the only two questions that matter when you open it:
 * is everyone home, and does anything need me? A missing pet outranks
 * everything else on the page and says so. Otherwise your animals lead,
 * each with something true about it, and the community sits in a rail
 * beside them rather than competing for the same weight.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  PawPrint, Plus, ArrowRight, ArrowUpRight, Users, Search, Eye, Loader2,
} from 'lucide-react';

const SPECIES_LABEL = { DOG: 'Dog', CAT: 'Cat', BIRD: 'Bird', RABBIT: 'Rabbit', OTHER: 'Pet' };

function elapsed(hours) {
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function shortDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Label({ children, action }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-midnight-500">{children}</h2>
      {action}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set by middleware when a signed-in non-admin follows an /admin link.
  // Without this they just arrive here for no visible reason.
  const deniedAdmin = searchParams.get('denied') === 'admin';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) {
          if (res.status === 401) { router.push('/login'); return; }
          const body = await res.json().catch(() => ({}));
          throw new Error(body.details || body.error || 'Could not load your dashboard');
        }
        setData(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (status === 'authenticated') load();
  }, [status, router]);

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-midnight-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <p className="font-bold text-midnight-900">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex items-center gap-2 bg-midnight-900 hover:bg-midnight-800 text-white font-semibold px-4 py-2 rounded-xl transition"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!session || !data) return null;

  const {
    user, pets = [], squads = [], missions = [], nearbyAlerts = [], activeSearches = [],
  } = data;
  const firstName = user?.firstName || session.user?.name?.split(' ')[0] || 'there';

  /* The search's live state belongs on the alert, not two clicks away */
  const missionById = new Map(missions.map((m) => [m.id, m]));
  const missingPets = pets
    .filter((p) => p.missing)
    .map((p) => ({ ...p, mission: missionById.get(p.missing.caseId) || null }));
  const helping = missions.filter((m) => !m.isOwner);
  const urgentNearby = nearbyAlerts.filter((a) => (parseInt(a.hoursMissing, 10) || 999) < 48);

  /**
   * What needs this person today. A missing animal silences everything
   * else about that animal: nobody wants to be told their lost dog's
   * booster is due while they are out looking for him.
   */
  const attention = [];
  for (const p of pets) {
    if (p.missing) continue;
    if (p.vaccinationDue) {
      attention.push({
        tone: p.vaccinationDue.expired ? 'red' : 'amber',
        text: p.vaccinationDue.expired
          ? `${p.name}'s ${p.vaccinationDue.name} vaccination expired ${shortDate(p.vaccinationDue.expiresAt)}.`
          : `${p.name}'s ${p.vaccinationDue.name} vaccination expires ${shortDate(p.vaccinationDue.expiresAt)}.`,
        action: 'Health Book',
        href: `/pets/${p.id}/health`,
      });
    }
  }
  for (const p of pets) {
    if (!p.hasPhoto && !p.missing) {
      attention.push({
        tone: 'amber',
        text: `${p.name} has no photo. A photo is what lets anyone recognise them if they go missing.`,
        action: 'Add one',
        href: `/pets/${p.id}`,
      });
    }
  }

  /* Truly nothing yet. Someone who has joined a rescue force but owns no
     animals is NOT a newcomer; hiding their force behind a welcome card
     would delete the one thing they have here. */
  const isNewcomer = pets.length === 0 && missions.length === 0 && squads.length === 0;

  return (
    /* pb clears the fixed mobile tab bar, as /pets does */
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-12">
      {deniedAdmin && (
        <div role="status" className="bg-slate-800">
          <div className="max-w-5xl mx-auto px-4 py-2.5 text-sm text-slate-100">
            That page is for site administrators. You are signed in, just not as one.
          </div>
        </div>
      )}
      {activeSearches.length > 0 && (
        <Link href={`/mission-control?mission=${activeSearches[0].missionId}`} className="block bg-red-600 hover:bg-red-700 transition-colors">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3 text-white text-sm">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse shrink-0" />
            <span className="font-bold">Search underway</span>
            <span className="opacity-80 truncate">
              {activeSearches[0].petName} · {activeSearches[0].durationMinutes}m
            </span>
            <span className="ml-auto font-semibold shrink-0">Open</span>
          </div>
        </Link>
      )}

      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-10">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
          <div>
            <h1 className="text-[26px] leading-tight font-black text-midnight-900">Hi, {firstName}</h1>
            <p className="text-[15px] text-midnight-500 mt-1">
              {missingPets.length > 0
                ? `${missingPets.length === 1 ? missingPets[0].name : `${missingPets.length} of your animals`} still isn't home.`
                : pets.length > 0
                  ? `Everyone's home. ${pets.length} ${pets.length === 1 ? 'animal' : 'animals'} in your care.`
                  : 'Add your animals so they are ready if they ever go missing.'}
            </p>
          </div>
          {/* No page-level CTA. The navbar already carries Report Pet, and
              when an animal is missing the alert below IS the action. Two
              competing primaries at the top is how a page loses its point. */}
        </div>

        {/* A missing animal outranks the whole page */}
        {missingPets.map((p) => (
          <Link
            key={p.id}
            href={`/mission-control?mission=${p.missing.caseId}`}
            /* On a phone the headline needs the full width, so the action
               drops to its own full-width row instead of squeezing the
               sentence into three lines beside it. */
            className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border-2 border-red-200 bg-red-50/60 px-5 py-4 hover:bg-red-50 transition group"
          >
            <div className="flex items-center gap-4 min-w-0 basis-full sm:basis-auto sm:flex-1">
              {p.primaryPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.primaryPhotoUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 ring-2 ring-red-200" />
              ) : (
                <span className="w-14 h-14 rounded-xl bg-white flex items-center justify-center shrink-0 ring-2 ring-red-200">
                  <PawPrint className="w-6 h-6 text-red-400" />
                </span>
              )}
              <div className="min-w-0">
                <p className="font-black text-midnight-900 text-[17px] leading-tight">
                  {p.name} has been missing {elapsed(p.missing.hoursMissing)}
                </p>
                <p className="text-sm text-midnight-600 mt-0.5">
                  {[
                    `Mission ${p.missing.caseNumber}`,
                    p.mission?.sightings > 0
                      ? `${p.mission.sightings} sighting${p.mission.sightings === 1 ? '' : 's'}`
                      : 'no sightings yet',
                    p.mission?.totalVolunteers > 0
                      ? `${p.mission.totalVolunteers} helping`
                      : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <span className="w-full sm:w-auto justify-center text-sm font-bold text-white bg-red-600 group-hover:bg-red-700 px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 shrink-0 transition">
              Open search <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        ))}

        {isNewcomer ? (
          <section className="rounded-xl border border-midnight-100 bg-white px-6 py-10 text-center">
            <PawPrint className="w-8 h-8 text-midnight-300 mx-auto mb-2" />
            <p className="font-bold text-midnight-900">Start with your animals</p>
            <p className="text-sm text-midnight-500 mt-1 max-w-md mx-auto">
              Adding a pet builds their health record and gives us the photo and
              details that make a match possible if they ever go missing.
            </p>
            <Link
              href="/care/start"
              className="mt-4 inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-4 py-2.5 rounded-xl transition"
            >
              <Plus className="w-4 h-4" /> Add your first pet
            </Link>
            <p className="text-[13px] text-midnight-400 mt-4">
              Found someone else&rsquo;s pet?{' '}
              <Link href="/report/found" className="font-semibold text-midnight-600 hover:text-midnight-900 underline underline-offset-2">
                Report it here
              </Link>
              .
            </p>
          </section>
        ) : (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8 space-y-8 lg:space-y-0">
            <div className="space-y-8">
              {attention.length > 0 && (
                <section>
                  <Label>Needs you</Label>
                  <div className="rounded-xl border border-midnight-100 bg-white divide-y divide-midnight-100 overflow-hidden">
                    {attention.slice(0, 4).map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <i className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.tone === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <p className="flex-1 min-w-0 text-sm text-midnight-700">{item.text}</p>
                        <Link href={item.href} className="inline-flex items-center text-[13px] font-bold text-midnight-900 hover:text-flash-600 transition shrink-0">
                          {item.action}
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <Label
                  action={
                    <Link href="/pets" className="inline-flex items-center text-sm font-semibold text-midnight-600 hover:text-midnight-900 transition">
                      All pets
                    </Link>
                  }
                >
                  Your animals
                </Label>
                {pets.length === 0 && (
                  <p className="text-sm text-midnight-500 mb-3">
                    You haven&rsquo;t added an animal yet. Their record is what makes
                    a match possible if they ever go missing.
                  </p>
                )}
                <div className="rounded-xl border border-midnight-100 bg-white divide-y divide-midnight-100 overflow-hidden">
                  {pets.map((p) => (
                    <Link key={p.id} href={`/pets/${p.id}/today`} className="flex items-center gap-3.5 px-4 py-3 hover:bg-slate-50 transition">
                      {p.primaryPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.primaryPhotoUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <PawPrint className="w-[18px] h-[18px] text-midnight-300" />
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-midnight-900 text-[15px] leading-tight truncate">{p.name}</p>
                        <p className="text-[13px] text-midnight-400 truncate">
                          {p.breed || SPECIES_LABEL[p.species] || 'Pet'}
                        </p>
                      </div>
                      <span className="text-[13px] font-medium shrink-0 inline-flex items-center gap-1.5">
                        {p.missing ? (
                          <>
                            <i className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <span className="text-red-600">Missing {elapsed(p.missing.hoursMissing)}</span>
                          </>
                        ) : (
                          <>
                            <i className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-midnight-600">Home</span>
                          </>
                        )}
                      </span>
                    </Link>
                  ))}
                  <Link href="/care/start" className="flex items-center gap-3.5 px-4 py-3 text-midnight-500 hover:bg-slate-50 hover:text-midnight-900 transition">
                    <span className="w-10 h-10 rounded-lg border border-dashed border-midnight-200 flex items-center justify-center shrink-0">
                      <Plus className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-semibold">Add a pet</span>
                  </Link>
                </div>
              </section>

              {helping.length > 0 && (
                <section>
                  <Label>Searches you joined</Label>
                  <div className="rounded-xl border border-midnight-100 bg-white divide-y divide-midnight-100 overflow-hidden">
                    {helping.slice(0, 4).map((m) => (
                      <Link key={m.id} href={`/mission-control?mission=${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
                        <p className="flex-1 min-w-0 text-sm text-midnight-700 truncate">
                          <span className="font-bold text-midnight-900">{m.petName}</span>
                          {m.mySquad ? ` · with ${m.mySquad}` : ''}
                        </p>
                        <span className="text-[13px] text-midnight-400 tabular-nums shrink-0">
                          missing {elapsed(m.hoursMissing)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="space-y-6">
              {urgentNearby.length > 0 && (
                <section>
                  <Label>Near you</Label>
                  <div className="rounded-xl border border-midnight-100 bg-white divide-y divide-midnight-100 overflow-hidden">
                    {urgentNearby.slice(0, 3).map((a) => (
                      <Link key={a.id} href={`/mission-control?mission=${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-midnight-900 truncate">{a.petName}</p>
                          <p className="text-[13px] text-midnight-400">{a.distance} · missing {elapsed(a.hoursMissing)}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-midnight-300 shrink-0" />
                      </Link>
                    ))}
                  </div>
                  <p className="text-[12px] text-midnight-400 mt-2">
                    The first hours matter most. Even a look down your own street helps.
                  </p>
                </section>
              )}

              <section>
                <Label>Rescue forces</Label>
                <div className="rounded-xl border border-midnight-100 bg-white p-4">
                  {squads.length > 0 ? (
                    <>
                      {squads.slice(0, 3).map((s) => (
                        <Link key={s.id} href={`/rescue-forces/${s.id}`} className="block group">
                          <p className="text-sm font-bold text-midnight-900 group-hover:text-flash-600 transition truncate">{s.name}</p>
                          <p className="text-[13px] text-midnight-400 mb-2">
                            {s.memberCount} members{s.activeMissions > 0 ? ` · ${s.activeMissions} searching` : ''}
                          </p>
                        </Link>
                      ))}
                      <Link href="/rescue-forces/search" className="inline-flex items-center gap-1 text-[13px] font-semibold text-midnight-500 hover:text-midnight-900 transition">
                        Find more <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-midnight-600">
                        Volunteers near you who turn out when a pet goes missing, including yours.
                      </p>
                      <Link href="/rescue-forces/search" className="inline-flex items-center gap-1 text-sm font-bold text-midnight-900 hover:text-flash-600 transition mt-2">
                        Find one near you <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </>
                  )}
                </div>
              </section>

              <section>
                <Label>Help someone</Label>
                <div className="rounded-xl border border-midnight-100 bg-white divide-y divide-midnight-100 overflow-hidden">
                  <Link href="/report/found" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
                    <Eye className="w-4 h-4 text-midnight-400 shrink-0" />
                    <span className="text-sm font-semibold text-midnight-900">I found a pet</span>
                  </Link>
                  <Link href="/database" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
                    <Search className="w-4 h-4 text-midnight-400 shrink-0" />
                    <span className="text-sm font-semibold text-midnight-900">Search lost and found</span>
                  </Link>
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
