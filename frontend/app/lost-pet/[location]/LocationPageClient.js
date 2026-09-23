'use client';

/**
 * A town's lost-and-found page (/lost-pet/orlando-fl), where a search for
 * "lost dog Orlando" lands. Someone arriving here has usually just lost a
 * pet, so it leads with the pets people have found in town, then the pets
 * reported missing, then shelters, the local Rescue Force, and what to do.
 *
 * The server page (page.js) checks the slug is a real town and state and
 * builds the link preview. Every number is counted from real reports.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Megaphone, Building2, Users } from 'lucide-react';

import { Button } from '@/components/ui';
import PetCard from '@/app/lost-and-found/PetCard';
import { formatLocationSlug } from '@/app/lib/utils';

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** The forces API answers per-town rows with the force nested inside. */
function forcesFrom(data) {
  const fromCities = (data?.cities || [])
    .filter((row) => row.exists && row.squad)
    .map((row) => ({ ...row.squad, city: row.city, state: row.state }));
  return fromCities.length ? fromCities : data?.squads || [];
}

function CardSkeletons() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4 rounded-2xl bg-white p-3 ring-1 ring-midnight-200 sm:flex-col sm:p-0">
          <div className="h-28 w-28 shrink-0 animate-pulse rounded-xl bg-midnight-100 sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-none" />
          <div className="flex-1 space-y-2 py-1 sm:p-4">
            <div className="h-5 w-1/2 animate-pulse rounded bg-midnight-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-midnight-100" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-midnight-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PetSection({ id, title, sub, cases, total, loading, empty, allHref }) {
  return (
    <section aria-labelledby={id}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id={id} className="text-xl font-semibold text-midnight-900">{title}</h2>
          {sub && <p className="mt-0.5 text-midnight-500">{sub}</p>}
        </div>
        {!loading && total > cases.length && (
          <Link href={allHref} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-midnight-700 hover:text-midnight-900">
            See all {total}
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="mt-4">
        {loading ? (
          <CardSkeletons />
        ) : cases.length === 0 ? (
          <p className="rounded-2xl bg-white px-5 py-6 text-midnight-500 ring-1 ring-midnight-200">{empty}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {cases.map((c) => (
              <PetCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function LocationPageClient() {
  const { location: slug } = useParams();
  const place = formatLocationSlug(slug);
  const town = place.city;

  const [status, setStatus] = useState('loading'); // loading | ready | failed
  const [attempt, setAttempt] = useState(0);
  const [lost, setLost] = useState({ cases: [], total: 0 });
  const [found, setFound] = useState({ cases: [], total: 0 });
  const [reunited, setReunited] = useState(0);
  const [forces, setForces] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const where = `city=${encodeURIComponent(place.city)}&state=${encodeURIComponent(place.state)}`;
    const page = (data) => ({ cases: data?.cases || [], total: data?.pagination?.totalCount ?? (data?.cases || []).length });

    (async () => {
      try {
        const [lostRes, foundRes, reunitedRes, forcesRes] = await Promise.all([
          fetch(`/api/public/missions?${where}&limit=6`),
          fetch(`/api/public/missions?${where}&type=FOUND&limit=6`),
          fetch(`/api/public/missions?${where}&status=REUNITED&type=ALL&limit=1`),
          // The forces API requires a town; the state picks the right one.
          fetch(`/api/rescue-forces?search=${encodeURIComponent(place.city)}&state=${encodeURIComponent(place.state)}&limit=4`),
        ]);
        if (!lostRes.ok) throw new Error('lost');
        const lostData = await lostRes.json();
        const foundData = foundRes.ok ? await foundRes.json() : null;
        const reunitedData = reunitedRes.ok ? await reunitedRes.json() : null;
        const forcesData = forcesRes.ok ? await forcesRes.json() : null;
        if (cancelled) return;
        setLost(page(lostData));
        setFound(page(foundData));
        setReunited(reunitedData?.pagination?.totalCount ?? 0);
        setForces(forcesFrom(forcesData));
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [place.city, place.state, attempt]);

  const loading = status === 'loading';
  const sheltersHref = `/shelters?near=${encodeURIComponent(place.display)}`;

  return (
    <div className="min-h-screen bg-midnight-50">
      <header className="border-b border-midnight-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-3 sm:pt-5">
          <Link href="/lost-and-found" className="-ml-1 inline-flex items-center gap-1 px-1 text-sm font-medium text-midnight-500 hover:text-midnight-900">
            <ChevronLeft size={16} aria-hidden="true" />
            Lost &amp; Found
          </Link>
          <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold tracking-tight text-midnight-900 sm:text-4xl">
                Lost and found pets in {place.display}
              </h1>
              <p className="mt-2 text-midnight-500">
                {status === 'ready'
                  ? `${plural(lost.total, 'pet', 'pets')} missing, ${plural(found.total, 'pet', 'pets')} found and ${reunited} reunited near ${town} on ReunitePets.`
                  : `Pets reported lost or found near ${town} on ReunitePets.`}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
              <Button href="/report/new" size="lg" leftIcon={Megaphone}>
                Report a lost pet
              </Button>
              <Button href="/report/found" size="lg" variant="outline">
                Report a found pet
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        {status === 'failed' ? (
          <div className="mx-auto max-w-md rounded-2xl bg-white px-6 py-10 text-center ring-1 ring-midnight-200">
            <h2 className="text-lg font-semibold text-midnight-900">This page didn&apos;t load</h2>
            <p className="mt-1 text-midnight-500">Check your connection, then try again.</p>
            <Button
              className="mt-5"
              onClick={() => {
                setStatus('loading');
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : (
          <>
            {(loading || found.cases.length > 0) && (
              <PetSection
                id="found-heading"
                title={`Found near ${town}`}
                sub="Pets people have found. Is one of them yours?"
                cases={found.cases}
                total={found.total}
                loading={loading}
                empty=""
                allHref={`/lost-and-found?tab=found&q=${encodeURIComponent(town)}`}
              />
            )}
            <PetSection
              id="lost-heading"
              title={`Missing near ${town}`}
              cases={lost.cases}
              total={lost.total}
              loading={loading}
              empty={`No pets are reported missing near ${town} right now.`}
              allHref={`/lost-and-found?q=${encodeURIComponent(town)}`}
            />
          </>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="shelters-heading" className="rounded-2xl bg-white p-5 ring-1 ring-midnight-200 sm:p-6">
            <h2 id="shelters-heading" className="flex items-center gap-2 text-lg font-semibold text-midnight-900">
              <Building2 size={20} className="text-midnight-400" aria-hidden="true" />
              Shelters near {town}
            </h2>
            <p className="mt-1 text-midnight-500">Lost pets are often taken to a shelter. Call each one near you, and visit if you can.</p>
            <Button href={sheltersHref} variant="secondary" className="mt-4">
              See shelters near {town}
            </Button>
          </section>

          <section aria-labelledby="force-heading" className="rounded-2xl bg-white p-5 ring-1 ring-midnight-200 sm:p-6">
            <h2 id="force-heading" className="flex items-center gap-2 text-lg font-semibold text-midnight-900">
              <Users size={20} className="text-midnight-400" aria-hidden="true" />
              Rescue Force in {town}
            </h2>
            {loading ? (
              <div className="mt-3 h-12 animate-pulse rounded-xl bg-midnight-100" />
            ) : forces.length > 0 ? (
              <ul className="mt-3 divide-y divide-midnight-100">
                {forces.map((f) => (
                  <li key={f.id}>
                    <Link href={`/rescue-forces/${f.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-midnight-900">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-midnight-900">{f.name}</span>
                        <span className="block text-sm text-midnight-500">
                          {plural(f.memberCount ?? 0, 'member', 'members')} · {plural(f.successfulReunions || 0, 'reunion', 'reunions')}
                        </span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-midnight-300" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="mt-1 text-midnight-500">
                  No Rescue Force covers {town} yet. A Rescue Force is a group of local volunteers who search for lost pets together.
                </p>
                <Button href="/rescue-forces/create" variant="outline" className="mt-4">
                  Start one in {town}
                </Button>
              </>
            )}
          </section>
        </div>

        <section aria-labelledby="help-heading" className="max-w-2xl">
          <h2 id="help-heading" className="text-xl font-semibold text-midnight-900">Lost a pet in {town}?</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-midnight-700">
            <li>
              <Link href="/report/new" className="font-medium text-midnight-900 underline underline-offset-4">Report it on ReunitePets</Link>.
              It goes on the Lost &amp; Found board and gets its own page to share.
            </li>
            <li>Walk your street and the blocks around it, and ask neighbors to check garages and sheds.</li>
            <li>
              <Link href={sheltersHref} className="font-medium text-midnight-900 underline underline-offset-4">Call the shelters near {town}</Link>,
              and visit in person if you can.
            </li>
            <li>Post your pet&apos;s page in local Facebook groups and on Nextdoor.</li>
            <li>Put up flyers near where your pet was last seen.</li>
          </ol>

          <h2 className="mt-8 text-xl font-semibold text-midnight-900">Found a pet in {town}?</h2>
          <p className="mt-2 text-midnight-700">
            Report it and we will compare it with the lost pets reported nearby.
          </p>
          <Button href="/report/found" variant="secondary" className="mt-4">
            Report a found pet
          </Button>
        </section>
      </main>
    </div>
  );
}
