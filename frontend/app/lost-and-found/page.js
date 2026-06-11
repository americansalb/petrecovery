'use client';

/**
 * Lost & Found - the corkboard
 *
 * Design language: the lost-pet flyer, made digital. Every case is a
 * flyer pinned a little crooked to the board: full-bleed photo, a
 * rubber-stamped status, the name in poster capitals, and tear-off
 * tabs carrying the case number. Above it all, a search beacon sweeps
 * the night sky. Urgency you can feel; reunions stamped HOME in green.
 *
 * Same machinery as before: one search box, species chips, three tabs
 * (Lost now / Found pets / Reunited), list or map, shareable URLs.
 */

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Search, MapPin, List, Map as MapIcon,
  Loader2, PawPrint, Megaphone, HeartHandshake, ChevronLeft, ChevronRight,
} from 'lucide-react';

import FlyerCard from '@/app/components/FlyerCard';

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

/* --------------------------------- Page ----------------------------------- */

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
      <style>{`
        @keyframes beacon-sweep {
          0%   { transform: translateX(-30%) skewX(-12deg); opacity: 0.0; }
          12%  { opacity: 0.55; }
          50%  { transform: translateX(120%) skewX(-12deg); opacity: 0.45; }
          88%  { opacity: 0.55; }
          100% { transform: translateX(-30%) skewX(-12deg); opacity: 0.0; }
        }
        @keyframes beacon-pulse {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Night sky + search beacon */}
      <div className="relative overflow-hidden bg-midnight-950 border-b-4 border-flash-400">
        {/* Street-map texture */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        {/* The beacon */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 bottom-0 w-[420px]"
          style={{
            background: 'linear-gradient(180deg, rgba(250,204,21,0.16) 0%, rgba(250,204,21,0.05) 60%, transparent 100%)',
            animation: 'beacon-sweep 9s ease-in-out infinite',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 right-[12%] w-[480px] h-[480px] rounded-full bg-flash-400/15 blur-3xl"
          style={{ animation: 'beacon-pulse 6s ease-in-out infinite' }}
        />

        <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-10 sm:pt-16 sm:pb-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-flash-400 font-black uppercase tracking-[0.3em] text-xs mb-3">
                The neighborhood board
              </p>
              <h1 className="font-black uppercase text-white leading-[0.92] tracking-tight text-5xl sm:text-7xl">
                Lost is<br />
                <span className="relative inline-block">
                  not gone.
                  <span aria-hidden="true" className="absolute left-0 right-0 -bottom-1 h-3 bg-flash-400 -skew-x-6" />
                </span>
              </h1>
              <p className="text-midnight-300 mt-5 text-lg">
                Every lost pet, every found pet, every reunion. One board.
              </p>
            </div>
            <Link
              href="/report/new"
              className="group relative flex items-center gap-2.5 px-6 py-4 bg-flash-400 hover:bg-flash-300 text-midnight-950 font-black uppercase tracking-wide rounded-none -rotate-1 hover:rotate-0 transition-all shadow-[4px_4px_0_rgba(250,204,21,0.25)]"
            >
              <Megaphone size={19} />
              Report a pet
            </Link>
          </div>

          {/* The spotlight search */}
          <div className="relative mt-9 max-w-3xl">
            <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-midnight-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, breed, color, city or ZIP..."
              className="w-full h-16 pl-14 pr-5 bg-white text-midnight-950 text-lg font-medium placeholder:text-midnight-400 focus:outline-none focus:ring-4 focus:ring-flash-400/60 shadow-[0_12px_40px_rgba(250,204,21,0.12)]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
            <div className="flex gap-1.5 flex-wrap">
              {SPECIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSpecies(s.id)}
                  className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider transition ${
                    species === s.id
                      ? 'bg-flash-400 text-midnight-950 -rotate-1'
                      : 'bg-midnight-800/80 text-midnight-300 hover:text-white border border-midnight-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex border border-midnight-700">
              {[{ id: 'list', icon: List, label: 'Board' }, { id: 'map', icon: MapIcon, label: 'Map' }].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                    view === id ? 'bg-flash-400 text-midnight-950' : 'bg-midnight-900 text-midnight-300 hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tape tabs */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-2 pt-5 -mb-px">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                tab === t.id
                  ? `bg-flash-400 text-midnight-950 ${i % 2 ? 'rotate-1' : '-rotate-1'} shadow-md`
                  : 'bg-white/70 text-midnight-400 hover:text-midnight-800 hover:bg-white rotate-0'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* The corkboard */}
      <div
        className="border-t-2 border-midnight-200"
        style={{
          backgroundImage: 'radial-gradient(rgba(15,23,42,0.07) 1.2px, transparent 1.2px)',
          backgroundSize: '18px 18px',
          backgroundColor: '#f6f4ee',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-8">
          {countLine && (
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-midnight-400 mb-7">{countLine}</p>
          )}

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 size={32} className="animate-spin text-midnight-300" />
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-20 max-w-md mx-auto">
              <PawPrint size={36} className="text-midnight-300 mx-auto mb-4" />
              <h3 className="text-xl font-black uppercase tracking-tight text-midnight-900">
                {tab === 'reunited' ? 'No reunions match yet' : 'Nothing on the board'}
              </h3>
              <p className="text-sm text-midnight-500 mt-1.5 mb-6">
                {tab === 'lost'
                  ? 'Good news for the neighborhood, or time to widen the search.'
                  : tab === 'found'
                    ? 'No found pets reported here yet.'
                    : 'Every reunion gets pinned here, named and celebrated.'}
              </p>
              <Link
                href={tab === 'found' ? '/report/found' : '/report/new'}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-flash-400 hover:bg-flash-300 text-midnight-950 font-black uppercase tracking-wide -rotate-1 hover:rotate-0 transition-all"
              >
                <Megaphone size={16} />
                {tab === 'found' ? 'Report a found pet' : 'Report a lost pet'}
              </Link>
            </div>
          ) : view === 'map' ? (
            <div className="h-[560px] overflow-hidden border-4 border-midnight-950 shadow-[8px_8px_0_rgba(15,23,42,0.15)]">
              <BrowseMap cases={cases} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-7 gap-y-9 pt-2">
                {cases.map((c, i) => (
                  <FlyerCard key={c.id} c={c} index={i} />
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-10">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    aria-label="Previous page"
                    className="w-10 h-10 border-2 border-midnight-300 bg-white flex items-center justify-center text-midnight-600 hover:border-midnight-900 disabled:opacity-40 transition"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-xs font-black uppercase tracking-widest text-midnight-500">
                    Page {page} / {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pagination.hasMore}
                    aria-label="Next page"
                    className="w-10 h-10 border-2 border-midnight-300 bg-white flex items-center justify-center text-midnight-600 hover:border-midnight-900 disabled:opacity-40 transition"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Found-a-pet strip */}
      <div className="bg-midnight-950 border-t-4 border-flash-400">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="w-13 h-13 p-3 bg-flash-400 -rotate-3 shrink-0">
              <HeartHandshake size={26} className="text-midnight-950" />
            </span>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-white">Found a pet wandering?</h2>
              <p className="text-sm text-midnight-300">
                Report it and our match engine compares it with every lost report nearby.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/report/found"
              className="px-5 py-3 bg-white hover:bg-flash-50 text-midnight-950 font-black uppercase tracking-wide text-sm -rotate-1 hover:rotate-0 transition-all"
            >
              Report a found pet
            </Link>
            <Link
              href="/shelters"
              className="px-5 py-3 border-2 border-midnight-600 hover:border-flash-400 text-white font-bold uppercase tracking-wide text-sm transition"
            >
              Shelters near you
            </Link>
          </div>
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
