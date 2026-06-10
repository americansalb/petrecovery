'use client';

/**
 * Lost & Found - the one browse surface
 *
 * Replaces the split /missions and /database pages. One search box,
 * species chips, three honest tabs (Lost now / Found pets / Reunited),
 * list or map. Reunions are first-class: social proof that the whole
 * thing works. Fully public; contact info lives on the case page with
 * one consistent policy.
 */

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Search, MapPin, Clock, Eye, List, Map as MapIcon,
  Loader2, PawPrint, Megaphone, HeartHandshake, ChevronLeft, ChevronRight,
} from 'lucide-react';

const BrowseMap = dynamic(() => import('./BrowseMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-midnight-100 rounded-3xl">
      <Loader2 size={28} className="animate-spin text-midnight-400" />
    </div>
  ),
});

const TABS = [
  { id: 'lost', label: 'Lost now', params: { type: 'LOST', status: 'LIVE' } },
  { id: 'found', label: 'Found pets', params: { type: 'FOUND', status: 'LIVE' } },
  { id: 'reunited', label: 'Reunited', params: { type: 'ALL', status: 'REUNITED' } },
];

const SPECIES = [
  { id: '', label: 'All' },
  { id: 'DOG', label: 'Dogs' },
  { id: 'CAT', label: 'Cats' },
  { id: 'BIRD', label: 'Birds' },
  { id: 'OTHER', label: 'Other' },
];

function timeBadge(c, tab) {
  if (tab === 'reunited') {
    if (c.lastSeenAt && c.resolvedAt) {
      const days = Math.max(1, Math.round((new Date(c.resolvedAt) - new Date(c.lastSeenAt)) / 86400000));
      return `HOME after ${days} ${days === 1 ? 'day' : 'days'}`;
    }
    return 'HOME';
  }
  const ref = c.lastSeenAt || c.createdAt;
  if (!ref) return tab === 'found' ? 'FOUND' : 'LOST';
  const hours = Math.floor((Date.now() - new Date(ref).getTime()) / 3600000);
  const span = hours < 1 ? 'just now' : hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)} days`;
  return tab === 'found' ? `FOUND ${span === 'just now' ? span : span + ' ago'}` : `LOST ${span}`;
}

function speciesEmoji(species) {
  switch ((species || '').toUpperCase()) {
    case 'DOG': return '🐕';
    case 'CAT': return '🐈';
    case 'BIRD': return '🦜';
    default: return '🐾';
  }
}

function CaseCard({ c, tab }) {
  const reunited = tab === 'reunited';
  const badgeClass = reunited
    ? 'bg-emerald-500 text-white'
    : c.isUrgent
      ? 'bg-red-600 text-white'
      : tab === 'found'
        ? 'bg-sky-500 text-white'
        : 'bg-midnight-900 text-flash-400';

  return (
    <Link
      href={`/cases/${c.caseNumber}`}
      className="group rounded-3xl border-2 border-midnight-100 bg-white overflow-hidden hover:border-flash-400 hover:shadow-xl hover:-translate-y-0.5 transition-all"
    >
      <div className="relative h-44 bg-midnight-100">
        {c.petPhotoUrl ? (
          <img src={c.petPhotoUrl} alt={c.petName} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">{speciesEmoji(c.petSpecies)}</div>
        )}
        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${badgeClass}`}>
          {timeBadge(c, tab)}
        </span>
        {c.sightingCount > 0 && !reunited && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-midnight-950/80 backdrop-blur text-white text-[11px] font-semibold">
            <Eye size={11} className="text-flash-400" />
            {c.sightingCount} {c.sightingCount === 1 ? 'sighting' : 'sightings'}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-midnight-900 truncate">{c.petName || 'Unknown'}</h3>
          <span className="text-xs font-mono text-midnight-400 shrink-0">{c.caseNumber}</span>
        </div>
        <p className="text-sm text-midnight-500 truncate">
          {[c.petBreed, c.petColor].filter(Boolean).join(' · ') || c.petSpecies}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-midnight-500 mt-2 truncate">
          <MapPin size={12} className="text-midnight-400 shrink-0" />
          {c.city && c.city !== 'Unknown' ? `${c.city}, ${c.state}` : c.lastSeenAddress || 'Location unknown'}
        </p>
      </div>
    </Link>
  );
}

function LostAndFoundContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState(searchParams.get('tab') || 'lost');
  const [species, setSpecies] = useState(searchParams.get('species') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [view, setView] = useState(searchParams.get('view') || 'list');
  const [page, setPage] = useState(Math.max(parseInt(searchParams.get('page') || '1'), 1));

  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const [cases, setCases] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

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
      limit: view === 'map' ? '100' : '18',
    });
    if (species) params.set('species', species);
    if (debouncedQ) params.set('q', debouncedQ);

    setLoading(true);
    fetch(`/api/public/missions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setCases(data.cases || []);
        setPagination(data.pagination || null);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [tab, species, debouncedQ, page, view]);

  // Reset page when the question changes
  useEffect(() => { setPage(1); }, [tab, species, debouncedQ]);

  const countLine = useMemo(() => {
    if (loading || !pagination) return null;
    const n = pagination.totalCount;
    if (tab === 'reunited') return `${n} ${n === 1 ? 'pet' : 'pets'} brought home`;
    if (tab === 'found') return `${n} found ${n === 1 ? 'pet' : 'pets'} waiting to be claimed`;
    return `${n} ${n === 1 ? 'pet' : 'pets'} missing right now`;
  }, [loading, pagination, tab]);

  return (
    <div className="min-h-screen bg-midnight-50">
      {/* Hero: one question, one box */}
      <div className="bg-midnight-900 border-b border-midnight-800">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">
                Lost &amp; Found
              </h1>
              <p className="text-midnight-300 mt-2">
                Every lost pet, every found pet, every reunion. One place.
              </p>
            </div>
            <Link
              href="/report/new"
              className="flex items-center gap-2 px-5 py-3 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold rounded-2xl transition shadow-lg shadow-flash-400/20"
            >
              <Megaphone size={18} />
              Report a pet
            </Link>
          </div>

          <div className="relative mt-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-midnight-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, breed, color, city or ZIP..."
              className="w-full h-14 pl-11 pr-4 rounded-2xl border-2 border-midnight-700 bg-midnight-800 text-white placeholder:text-midnight-400 focus:outline-none focus:border-flash-400 text-base"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="flex gap-1.5 flex-wrap">
              {SPECIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSpecies(s.id)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition ${
                    species === s.id
                      ? 'bg-flash-400 text-midnight-900'
                      : 'bg-midnight-800 text-midnight-300 hover:text-white border border-midnight-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex rounded-xl border border-midnight-700 overflow-hidden">
              {[{ id: 'list', icon: List, label: 'List' }, { id: 'map', icon: MapIcon, label: 'Map' }].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold transition ${
                    view === id ? 'bg-flash-400 text-midnight-900' : 'bg-midnight-800 text-midnight-300 hover:text-white'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-1 -mb-px pt-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 rounded-t-2xl text-sm font-bold transition border-2 border-b-0 ${
                tab === t.id
                  ? 'bg-white border-midnight-100 text-midnight-900'
                  : 'bg-transparent border-transparent text-midnight-500 hover:text-midnight-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border-t-2 border-midnight-100">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {countLine && (
            <p className="text-sm text-midnight-500 mb-5">{countLine}</p>
          )}

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 size={32} className="animate-spin text-midnight-300" />
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-20 max-w-md mx-auto">
              <PawPrint size={36} className="text-midnight-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-midnight-900">
                {tab === 'reunited' ? 'No reunions match that search yet' : 'Nothing matches that search'}
              </h3>
              <p className="text-sm text-midnight-500 mt-1.5 mb-6">
                {tab === 'lost'
                  ? 'Good news for the neighborhood, or time to widen the search.'
                  : tab === 'found'
                    ? 'No found pets reported here yet.'
                    : 'Every reunion will show up here, named and celebrated.'}
              </p>
              <Link
                href={tab === 'found' ? '/report/found' : '/report/new'}
                className="inline-flex items-center gap-2 px-5 py-3 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold rounded-2xl transition"
              >
                <Megaphone size={16} />
                {tab === 'found' ? 'Report a found pet' : 'Report a lost pet'}
              </Link>
            </div>
          ) : view === 'map' ? (
            <div className="h-[560px] rounded-3xl overflow-hidden border-2 border-midnight-100">
              <BrowseMap cases={cases} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {cases.map((c) => (
                  <CaseCard key={c.id} c={c} tab={tab} />
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    aria-label="Previous page"
                    className="w-10 h-10 rounded-xl border-2 border-midnight-100 flex items-center justify-center text-midnight-600 hover:border-flash-400 disabled:opacity-40 transition"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-sm text-midnight-500 font-medium">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pagination.hasMore}
                    aria-label="Next page"
                    className="w-10 h-10 rounded-xl border-2 border-midnight-100 flex items-center justify-center text-midnight-600 hover:border-flash-400 disabled:opacity-40 transition"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Found-a-pet banner */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl border-2 border-midnight-900 bg-midnight-900 p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-flash-400 flex items-center justify-center shrink-0">
              <HeartHandshake size={24} className="text-midnight-900" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">Found a pet wandering?</h2>
              <p className="text-sm text-midnight-300">
                Report it and our match engine compares it with every lost report nearby.
              </p>
            </div>
          </div>
          <Link
            href="/report/found"
            className="px-5 py-3 bg-white hover:bg-midnight-50 text-midnight-900 font-bold rounded-2xl transition"
          >
            Report a found pet
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LostAndFoundPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-midnight-300" />
        </div>
      }
    >
      <LostAndFoundContent />
    </Suspense>
  );
}
