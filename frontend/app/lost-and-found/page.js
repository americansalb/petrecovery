'use client';

/**
 * Lost & Found: every pet reported lost or found, and every reunion.
 *
 * One search box, species chips, three tabs (Lost / Found / Reunited), a
 * list or a map, and a URL that shares exactly what is on screen. Cards
 * and map pins describe a pet the same way (app/lib/caseLabels.js).
 *
 * One request per change of question. Per-tab counts were left out on
 * purpose: they cost three more requests per filter change against a
 * public limit of 60 a minute, shared by everyone behind one address.
 */

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Search, X, List, Map as MapIcon, Megaphone, ChevronLeft, ChevronRight, PawPrint,
} from 'lucide-react';

import { Button } from '@/components/ui';
import PetCard from './PetCard';

const BrowseMap = dynamic(() => import('./BrowseMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-midnight-100" />,
});

const TABS = [
  { id: 'lost', label: 'Lost', params: { type: 'LOST', status: 'LIVE' } },
  { id: 'found', label: 'Found', params: { type: 'FOUND', status: 'LIVE' } },
  { id: 'reunited', label: 'Reunited', params: { type: 'ALL', status: 'REUNITED' } },
];

const SPECIES = [
  { id: '', label: 'All' },
  { id: 'DOG', label: 'Dogs' },
  { id: 'CAT', label: 'Cats' },
  { id: 'BIRD', label: 'Birds' },
  { id: 'OTHER', label: 'Other' },
];

const VIEWS = [
  { id: 'list', label: 'List', icon: List },
  { id: 'map', label: 'Map', icon: MapIcon },
];

const PAGE_SIZE = 18;

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/* --------------------------------- Page ----------------------------------- */

function LostAndFoundContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState(TABS.some((t) => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'lost');
  const [species, setSpecies] = useState(searchParams.get('species') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [view, setView] = useState(searchParams.get('view') === 'map' ? 'map' : 'list');
  const [page, setPage] = useState(Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1));

  const [debouncedQ, setDebouncedQ] = useState(q.trim());
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const [cases, setCases] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Keep the URL shareable
  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== 'lost') params.set('tab', tab);
    if (species) params.set('species', species);
    if (debouncedQ) params.set('q', debouncedQ);
    if (view !== 'list') params.set('view', view);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    router.replace(`/lost-and-found${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [tab, species, debouncedQ, view, page, router]);

  useEffect(() => {
    let alive = true;
    const tabDef = TABS.find((t) => t.id === tab) || TABS[0];
    const params = new URLSearchParams({
      ...tabDef.params,
      page: String(page),
      limit: view === 'map' ? '100' : String(PAGE_SIZE),
    });
    if (species) params.set('species', species);
    if (debouncedQ) params.set('q', debouncedQ);

    setLoading(true);
    setFailed(false);
    fetch(`/api/public/missions?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!alive) return;
        setCases(data.cases || []);
        setPagination(data.pagination || null);
      })
      .catch(() => {
        if (!alive) return;
        setCases([]);
        setPagination(null);
        setFailed(true);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [tab, species, debouncedQ, page, view, attempt]);

  // A new question starts on the first page
  useEffect(() => { setPage(1); }, [tab, species, debouncedQ]);

  const filtered = Boolean(species || debouncedQ);
  const clearFilters = () => { setSpecies(''); setQ(''); };

  const resultLine = useMemo(() => {
    if (loading || !pagination) return null;
    const n = pagination.totalCount;
    // With a search active the count describes the matches, not the
    // neighborhood: "0 pets missing" under a typo is not good news.
    if (debouncedQ) return `${plural(n, 'match', 'matches')} for “${debouncedQ}”`;
    if (tab === 'reunited') return `${plural(n, 'pet', 'pets')} back home`;
    if (tab === 'found') return `${plural(n, 'found pet', 'found pets')} waiting for their owners`;
    return `${plural(n, 'pet', 'pets')} missing right now`;
  }, [loading, pagination, tab, debouncedQ]);

  return (
    <div className="min-h-screen bg-midnight-50">
      {/* Title, the two reports, and the controls */}
      <header className="border-b border-midnight-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-5 pt-8 sm:pt-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <h1 className="text-3xl font-bold tracking-tight text-midnight-900 sm:text-4xl">Lost &amp; Found</h1>
              <p className="mt-2 text-midnight-500">
                Pets reported lost or found on ReunitePets. Open one to see where it was last seen and how you can help.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
              <Button href="/report/new" variant="primary" size="lg" leftIcon={Megaphone}>
                Report a lost pet
              </Button>
              <Button href="/report/found" variant="outline" size="lg">
                Report a found pet
              </Button>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Lost / Found / Reunited */}
            <div role="tablist" aria-label="Which pets" className="grid grid-cols-3 rounded-xl bg-midnight-100 p-1 lg:w-80 lg:shrink-0">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${
                    tab === t.id ? 'bg-white text-midnight-900 shadow-sm' : 'text-midnight-500 hover:text-midnight-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1">
              <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-midnight-400" aria-hidden="true" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, breed, color, city or ZIP"
                aria-label="Search pets"
                className="h-11 w-full rounded-xl border border-midnight-200 bg-white pl-10 pr-10 text-midnight-900 placeholder:text-midnight-400 focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-flash-400/60"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-midnight-400 hover:bg-midnight-100 hover:text-midnight-700"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Species */}
          <div className="mt-3">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SPECIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={species === s.id}
                  onClick={() => setSpecies(s.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${
                    species === s.id
                      ? 'bg-midnight-900 text-white'
                      : 'bg-white text-midnight-600 ring-1 ring-midnight-200 hover:ring-midnight-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Results */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="min-h-[1.25rem] text-sm text-midnight-500" aria-live="polite">{resultLine}</p>
          <div className="flex shrink-0 rounded-xl bg-midnight-100 p-1" role="group" aria-label="Show as">
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${
                  view === id ? 'bg-white text-midnight-900 shadow-sm' : 'text-midnight-500 hover:text-midnight-900'
                }`}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          view === 'map' ? (
            <div className="h-[70vh] min-h-[420px] animate-pulse rounded-2xl bg-midnight-100" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4 rounded-2xl bg-white p-3 ring-1 ring-midnight-200 sm:block sm:p-0">
                  <div className="h-28 w-28 shrink-0 animate-pulse rounded-xl bg-midnight-100 sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-none sm:rounded-t-2xl" />
                  <div className="flex-1 space-y-2 py-1 sm:p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-midnight-100" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-midnight-100" />
                    <div className="h-3 w-3/5 animate-pulse rounded bg-midnight-100" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : failed ? (
          <EmptyState
            title="The list did not load"
            body="Check your connection and try again."
            action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>Try again</Button>}
          />
        ) : cases.length === 0 ? (
          filtered ? (
            <EmptyState
              title="No pets match"
              body={`Nothing in ${TABS.find((t) => t.id === tab)?.label.toLowerCase()} matches. Try another word or clear the filters.`}
              action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : tab === 'found' ? (
            <EmptyState
              title="No found pets reported"
              body="If you have found a pet, report it and we will compare it with the lost pets reported nearby."
              action={<Button href="/report/found" variant="primary">Report a found pet</Button>}
            />
          ) : tab === 'reunited' ? (
            <EmptyState title="No reunions yet" body="Pets that make it home are listed here." />
          ) : (
            <EmptyState
              title="No lost pets reported"
              body="If your pet is missing, report it and neighbors can start looking."
              action={<Button href="/report/new" variant="primary" leftIcon={Megaphone}>Report a lost pet</Button>}
            />
          )
        ) : view === 'map' ? (
          <div className="h-[70vh] min-h-[420px] overflow-hidden rounded-2xl ring-1 ring-midnight-200">
            <BrowseMap cases={cases} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {cases.map((c) => (
                <PetCard key={c.id} c={c} />
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pages">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  leftIcon={ChevronLeft}
                >
                  Previous
                </Button>
                <span className="text-sm text-midnight-500">
                  Page {page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasMore}
                  rightIcon={ChevronRight}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )}

        {/* Found a pet */}
        <section className="mt-12 flex flex-col gap-4 rounded-2xl bg-white p-6 ring-1 ring-midnight-200 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-midnight-900">Found a pet?</h2>
            <p className="mt-1 text-sm text-midnight-500">
              Report it and we will compare it with the lost pets reported nearby.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
            <Button href="/report/found" variant="secondary">Report a found pet</Button>
            <Button href="/shelters" variant="outline">Find a shelter</Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function EmptyState({ title, body, action }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-midnight-200">
      <PawPrint size={32} className="mx-auto text-midnight-300" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-semibold text-midnight-900">{title}</h2>
      <p className="mt-1 text-sm text-midnight-500">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default function LostAndFoundPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-midnight-50" />}>
      <LostAndFoundContent />
    </Suspense>
  );
}
