'use client';

/**
 * The shelter directory surface: map and list of the same set, always in
 * sync. Typing filters the loaded set instantly; Enter reaches wider
 * through /api/shelters/search (geocode + Apple cache); "Near me" sorts
 * by distance and drops a you-are-here dot.
 *
 * Register: civic daylight. Light tiles, midnight pins; flash appears
 * only on the selected shelter and the one CTA.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import {
  Search,
  LocateFixed,
  Loader2,
  Phone,
  Globe,
  Navigation as DirectionsIcon,
  ShieldCheck,
  Building2,
  ArrowRight,
  X,
} from 'lucide-react';

const ShelterMap = nextDynamic(() => import('./ShelterMapInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-midnight-100 animate-pulse" aria-hidden="true" />,
});

function haversineMiles(a, b) {
  const R = 3958.8;
  const dLat = ((b.latitude - a.lat) * Math.PI) / 180;
  const dLng = ((b.longitude - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Wider-search results arrive in the API's shape; fold to the page's. */
function normalizeRemote(s) {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    city: s.city,
    state: s.state,
    zipCode: s.zipCode,
    phone: s.phone,
    website: s.website,
    latitude: s.latitude,
    longitude: s.longitude,
    isVerified: !!s.isVerified,
    hasPage: !!s.hasPage,
    apiDistanceMi: typeof s.distance === 'number' ? s.distance : null,
  };
}

export default function SheltersDirectoryClient({ initialShelters }) {
  const [query, setQuery] = useState('');
  // A wider search replaces the displayed set until cleared.
  const [remote, setRemote] = useState(null); // { label, shelters }
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [origin, setOrigin] = useState(null); // { lat, lng }
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const itemRefs = useRef({});

  const base = remote ? remote.shelters : initialShelters;

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return base;
    return base.filter((s) =>
      [s.name, s.city, s.state, s.zipCode, s.address].some(
        (v) => v && v.toLowerCase().includes(q)
      )
    );
  }, [base, q]);

  const shown = useMemo(() => {
    if (!origin) return filtered;
    return filtered
      .map((s) => ({
        ...s,
        distanceMi: s.latitude != null ? haversineMiles(origin, s) : null,
      }))
      .sort((a, b) => (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity));
  }, [filtered, origin]);

  // Pin click -> bring the matching card into view.
  useEffect(() => {
    if (!selectedId) return;
    const el = itemRefs.current[selectedId];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  async function searchWider(e) {
    if (e) e.preventDefault();
    const location = query.trim();
    if (!location || searching) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `/api/shelters/search?location=${encodeURIComponent(location)}&distance=50`
      );
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      setRemote({ label: location, shelters: (data.shelters || []).map(normalizeRemote) });
      setSelectedId(null);
      setQuery('');
    } catch {
      setSearchError('Search failed - try a city, state, or ZIP.');
    } finally {
      setSearching(false);
    }
  }

  function locateMe() {
    if (locating) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setGeoError('Could not get your location.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }

  return (
    <div className="bg-white lg:h-[calc(100vh-4rem)] lg:flex lg:flex-col">
      {/* Compact hero band: title, the one piece of advice that matters,
          search. The band shrinks so the map leads. */}
      <section className="bg-midnight-900 border-b border-midnight-800 shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-6 lg:py-7">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
            <div className="min-w-0 lg:max-w-md">
              <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                Shelters &amp; rescues
              </h1>
              <p className="text-midnight-300 mt-1 text-sm lg:text-[15px]">
                Lost pets land in shelters first. Call every one within 25 miles,
                starting today.
              </p>
            </div>
            <form onSubmit={searchWider} className="flex-1 flex items-center gap-2 lg:max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-midnight-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="City, ZIP, or shelter name"
                  aria-label="Search shelters by city, ZIP, or name"
                  className="w-full rounded-xl bg-white pl-9 pr-3 py-2.5 text-sm text-midnight-900 placeholder:text-midnight-400 outline-none focus:ring-2 focus:ring-flash-400"
                />
              </div>
              <button
                type="button"
                onClick={locateMe}
                disabled={locating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-flash-400 hover:bg-flash-300 text-midnight-900 text-sm font-bold transition whitespace-nowrap disabled:opacity-60"
              >
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
                Near me
              </button>
            </form>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              href="/for-shelters"
              className="text-[13px] text-midnight-400 hover:text-white transition inline-flex items-center gap-1"
            >
              <Building2 className="w-3.5 h-3.5" />
              Run a shelter or rescue? Every tool here is free
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {(geoError || searchError) && (
              <p className="text-[13px] text-red-300" role="status">{geoError || searchError}</p>
            )}
          </div>
        </div>
      </section>

      {/* Map + list, one set in sync. Mobile: map leads, list follows. */}
      <div className="lg:flex-1 lg:min-h-0 lg:grid lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="h-72 lg:h-auto lg:order-2">
          <ShelterMap
            shelters={shown}
            selectedId={selectedId}
            onSelect={setSelectedId}
            origin={origin}
          />
        </div>

        <aside className="lg:order-1 lg:overflow-y-auto lg:border-r lg:border-midnight-100">
          <div className="px-4 pt-4 pb-1 flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-midnight-900">
              {shown.length > 0
                ? `${shown.length} ${shown.length === 1 ? 'place' : 'places'}`
                : 'No matches'}
              {origin && shown.length > 0 && (
                <span className="font-medium text-midnight-500"> · nearest first</span>
              )}
            </p>
            {remote && (
              <button
                onClick={() => { setRemote(null); setSelectedId(null); }}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-midnight-600 bg-midnight-50 hover:bg-midnight-100 rounded-full pl-2.5 pr-1.5 py-1 transition"
              >
                Showing {remote.label}
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {shown.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Building2 className="w-8 h-8 text-midnight-300 mx-auto mb-3" />
              {q ? (
                <>
                  <p className="font-semibold text-midnight-900 mb-1">
                    Nothing here matches &ldquo;{query.trim()}&rdquo;
                  </p>
                  <p className="text-sm text-midnight-500 mb-4">
                    Press Enter to search that place on the wider map.
                  </p>
                  <button
                    onClick={() => searchWider()}
                    disabled={searching}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-midnight-900 hover:bg-midnight-800 text-white text-sm font-bold transition disabled:opacity-60"
                  >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search {query.trim()}
                  </button>
                </>
              ) : (
                <>
                  <p className="font-semibold text-midnight-900 mb-1">No shelters listed yet</p>
                  <p className="text-sm text-midnight-500">
                    Search a city or ZIP above to look further afield.
                  </p>
                </>
              )}
            </div>
          ) : (
            <ul className="px-3 py-2 space-y-2 pb-24 lg:pb-6">
              {shown.map((s) => (
                <ShelterCard
                  key={s.id}
                  shelter={s}
                  selected={s.id === selectedId}
                  onSelect={() => setSelectedId(s.id)}
                  itemRef={(el) => { itemRefs.current[s.id] = el; }}
                />
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

function ShelterCard({ shelter: s, selected, onSelect, itemRef }) {
  const dist = s.distanceMi ?? s.apiDistanceMi ?? null;
  const hasCoords = s.latitude != null && s.longitude != null;
  return (
    <li ref={itemRef}>
      <div
        className={`rounded-xl border bg-white transition ${
          selected
            ? 'border-flash-400 ring-2 ring-flash-400/40 shadow-card'
            : 'border-midnight-100 hover:border-midnight-300'
        }`}
      >
        <button onClick={onSelect} className="w-full text-left px-4 pt-3.5 pb-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-midnight-900 flex items-center gap-1.5">
                <span className="truncate">{s.name}</span>
                {s.isVerified && (
                  <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" aria-label="Verified" />
                )}
              </p>
              <p className="text-sm text-midnight-500 truncate">
                {[s.address, [s.city, s.state].filter(Boolean).join(', ')]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {dist != null && (
              <span className="shrink-0 mt-0.5 text-[12px] font-bold text-midnight-600 bg-midnight-50 rounded-full px-2 py-0.5">
                {dist < 10 ? dist.toFixed(1) : Math.round(dist)} mi
              </span>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1 flex-wrap">
          {s.phone && <ActionLink href={`tel:${s.phone}`} icon={Phone} label="Call" />}
          {hasCoords && (
            <ActionLink
              href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`}
              icon={DirectionsIcon}
              label="Directions"
              external
            />
          )}
          {s.website && <ActionLink href={s.website} icon={Globe} label="Website" external />}
          <span className="flex-1" />
          {s.hasPage ? (
            <Link
              href={`/shelters/${s.id}`}
              className="inline-flex items-center gap-1 px-1.5 text-[13px] font-bold text-midnight-900 hover:text-flash-600 transition"
            >
              View page <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            /* The claim door rides on every unclaimed entry - this is how
               a shelter director discovers the free portal exists. */
            <Link
              href="/for-shelters"
              className="px-1.5 text-[12px] font-medium text-midnight-400 hover:text-midnight-700 transition"
            >
              Work here? Free tools
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function ActionLink({ href, icon: Icon, label, external }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-semibold text-midnight-600 hover:bg-midnight-50 hover:text-midnight-900 transition"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </a>
  );
}
