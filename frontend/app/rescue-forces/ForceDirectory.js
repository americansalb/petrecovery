'use client';

/**
 * The Rescue Forces directory: every force's area on a map, and the same
 * forces in a list beside it (above it on a phone), like /shelters.
 *
 * One search. The town field (./TownPicker.js) suggests real towns; picking
 * one, or pressing Enter on a town or ZIP code, asks /api/rescue-forces
 * where that town is, and the list becomes the forces within 25 miles of
 * it, the one whose area covers it first. "Near me" does the same from the
 * browser's location. Nothing is filtered while typing: a town with no
 * force of its own name is often inside a neighbor's area.
 *
 * `?q=Austin, TX` runs the search on arrival (the home page's town links
 * send it; old /rescue-forces/search links arrive through a redirect).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ChevronRight, Loader2, LocateFixed, PawPrint, Plus, Shield, X } from 'lucide-react';
import { normalizeState } from '@/app/lib/usStates';
import { areaContains, milesBetween } from '@/app/lib/maps/forceArea';
import { PET_TEXT } from '@/app/lib/petColors';
import TownPicker, { townLabel } from './TownPicker';

const ForceDirectoryMap = nextDynamic(() => import('./ForceDirectoryMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-midnight-100" aria-hidden="true" />,
});

const NEAR_MILES = 25;
const NONE = [];

/** "Austin, TX" -> { city: 'Austin', state: 'TX' }; "78704" -> { zip }. */
function parseTyped(text) {
  const t = text.trim();
  if (/^\d{5}$/.test(t)) return { zip: t };
  const [city, state] = t.split(',').map((p) => p.trim());
  return { city, state: state ? normalizeState(state) : '' };
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function missingText(n) {
  return `${plural(n, 'pet', 'pets')} missing now`;
}

/** The forces to list for a place: inside or within 25 miles, the covering one first. */
function forcesNear(forces, origin) {
  if (origin.lat == null) {
    // The town could not be placed on the map; fall back to its name.
    const towns = (origin.towns || []).map((t) => t.toLowerCase());
    return forces.filter((f) => f.city && towns.includes(f.city.toLowerCase()));
  }
  return forces
    .filter((f) => f.lat != null)
    .map((f) => ({ ...f, inside: areaContains(f, origin), miles: milesBetween(origin, f) }))
    .filter((f) => f.inside || f.miles <= NEAR_MILES)
    .sort((a, b) => Number(b.inside) - Number(a.inside) || a.miles - b.miles);
}

// Yellow buttons get their soft shading from app/globals.css.
const YELLOW_BUTTON = 'bg-flash-400 text-midnight-900 shadow-[0_2px_6px_rgba(202,138,4,0.28)]';

export default function ForceDirectory({ forces }) {
  const router = useRouter();
  const [text, setText] = useState('');
  // Where the list is measured from: { kind: 'me' | 'town', label, lat, lng, towns }.
  const [origin, setOrigin] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | searching | locating | empty | notfound | failed | nolocation
  const [problemLabel, setProblemLabel] = useState('');
  const [hoverId, setHoverId] = useState(null);
  // Each search or Near me takes a number; an answer for an older one is dropped.
  const latest = useRef(0);

  const all = forces || NONE;
  const list = useMemo(() => (origin ? forcesNear(all, origin) : all), [all, origin]);
  // The map fades every force outside the list; null means none are left out.
  const shownIds = useMemo(() => (origin ? list.map((f) => f.id) : null), [origin, list]);

  // The force whose area holds the place searched from, lit on the map.
  const coveringId = origin ? list.find((f) => f.inside)?.id || null : null;

  async function searchTown({ suggestion, typed }) {
    const mine = ++latest.current;
    setStatus('searching');
    const params = new URLSearchParams({ radius: String(NEAR_MILES) });
    let label;
    if (suggestion) {
      label = townLabel(suggestion);
      params.set('search', suggestion.city);
      if (suggestion.state_id) params.set('state', suggestion.state_id);
      if (suggestion.country && suggestion.country !== 'US') {
        params.set('country', suggestion.country);
        if (suggestion.lat != null) params.set('lat', String(suggestion.lat));
        if (suggestion.lng != null) params.set('lng', String(suggestion.lng));
      }
    } else {
      const parsed = parseTyped(typed);
      label = typed.trim();
      params.set('search', parsed.zip || parsed.city);
      if (parsed.state) params.set('state', parsed.state);
    }
    try {
      const res = await fetch(`/api/rescue-forces?${params}`);
      if (mine !== latest.current) return;
      if (res.status === 400) {
        setProblemLabel(label);
        setStatus('notfound');
        return;
      }
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      if (mine !== latest.current) return;
      const at = data.searchLocation || {};
      const placed = Number.isFinite(at.latitude) && Number.isFinite(at.longitude);
      setOrigin({
        kind: 'town',
        label,
        lat: placed ? at.latitude : null,
        lng: placed ? at.longitude : null,
        towns: at.cities || [],
      });
      setStatus('idle');
    } catch {
      if (mine === latest.current) setStatus('failed');
    }
  }

  function submit(e) {
    e.preventDefault();
    if (text.trim()) searchTown({ typed: text });
    else {
      setStatus('empty');
      document.getElementById('force-town')?.focus();
    }
  }

  function locateMe() {
    if (status === 'locating') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('nolocation');
      return;
    }
    const mine = ++latest.current;
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (mine !== latest.current) return;
        setOrigin({ kind: 'me', label: 'you', lat: pos.coords.latitude, lng: pos.coords.longitude });
        setText('');
        setStatus('idle');
      },
      () => mine === latest.current && setStatus('nolocation'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }

  function showAll() {
    latest.current += 1;
    setOrigin(null);
    setText('');
    setStatus('idle');
  }

  // Deep link: /rescue-forces?q=Austin, TX
  useEffect(() => {
    const q = (new URLSearchParams(window.location.search).get('q') || '').trim().slice(0, 120);
    if (q) {
      setText(q);
      searchTown({ typed: q });
    }
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const message = {
    searching: 'Searching...',
    empty: 'Type a town or a ZIP code first.',
    notfound: `We couldn't find “${problemLabel}”. Pick a town from the list, or type a ZIP code.`,
    failed: "The search didn't go through. Check your connection and try again.",
    nolocation: 'Your location is not available. Type your town or ZIP code instead.',
  }[status];

  const placeName = origin?.kind === 'me' ? 'you' : origin?.label;

  return (
    <div className="bg-white lg:flex lg:h-[calc(100vh-4rem)] lg:flex-col">
      {/* Title and search. White on a phone, the dark band on a computer. */}
      <section className="shrink-0 bg-white lg:border-b lg:border-midnight-800 lg:bg-gradient-to-b lg:from-midnight-900 lg:to-midnight-800">
        <div className="mx-auto max-w-7xl px-4 pb-4 pt-5 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:px-8 lg:py-6">
          <div className="min-w-0">
            <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-midnight-900 lg:text-[32px] lg:text-white">
              Rescue Forces
            </h1>
            <p className="mt-1.5 text-base text-midnight-600 lg:text-midnight-300">
              Neighbors who help find lost pets. Find the one for your town.
            </p>
          </div>

          <form method="post" onSubmit={submit} role="search" className="mt-4 lg:mt-0">
            <label htmlFor="force-town" className="mb-1.5 block text-sm font-bold text-midnight-700 lg:text-midnight-200">
              Your town or ZIP code
            </label>
            <div className="flex gap-2 lg:gap-2.5">
              <div className="min-w-0 flex-1 lg:w-[360px] lg:flex-none">
                <TownPicker
                  id="force-town"
                  text={text}
                  onTextChange={(value) => {
                    setText(value);
                    if (status !== 'searching') setStatus('idle');
                  }}
                  onPick={(s) => searchTown({ suggestion: s })}
                  onEnter={() => (text.trim() ? searchTown({ typed: text }) : setStatus('empty'))}
                  placeholder="Austin or 78704"
                  ariaLabel={null}
                  inputClassName="h-[52px] rounded-[14px] border-2 border-midnight-300 text-[17px] font-medium lg:border-white"
                />
              </div>
              <button
                type="button"
                onClick={locateMe}
                disabled={status === 'locating'}
                className={`inline-flex h-[52px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[14px] px-3.5 text-base font-bold transition disabled:opacity-60 lg:px-[18px] ${YELLOW_BUTTON}`}
              >
                {status === 'locating' ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
                ) : (
                  <LocateFixed className="h-[18px] w-[18px]" aria-hidden="true" />
                )}
                Near me
              </button>
              <Link
                href="/rescue-forces/create"
                className="hidden h-[52px] shrink-0 items-center gap-2 whitespace-nowrap rounded-[14px] border-2 border-midnight-500 px-[18px] text-base font-bold text-white transition hover:border-midnight-300 lg:inline-flex"
              >
                <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
                Start a Rescue Force
              </Link>
            </div>
            <p
              role="status"
              className={`text-sm empty:hidden ${status === 'searching' ? 'text-midnight-500 lg:text-midnight-300' : 'text-red-700 lg:text-red-300'}`}
            >
              {message ? <span className="mt-2 block">{message}</span> : null}
            </p>
          </form>
        </div>
      </section>

      {/* Map and list: one set of forces. On a phone the map leads. */}
      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="relative isolate h-60 border-y border-midnight-100 lg:order-2 lg:h-auto lg:border-0">
          <ForceDirectoryMap
            forces={all}
            shownIds={shownIds}
            litId={hoverId || coveringId}
            origin={origin}
            onOpen={(id) => router.push(`/rescue-forces/${id}`)}
          />
          <p className="pointer-events-none absolute bottom-4 left-4 z-[450] hidden max-w-sm items-center gap-3 rounded-[14px] bg-white px-4 py-3 text-sm text-midnight-700 shadow-[0_2px_10px_rgba(15,23,42,0.2)] lg:flex">
            <span className="h-4 w-6 shrink-0 rounded border-2 border-flash-600 bg-flash-400/30" aria-hidden="true" />
            Each yellow shape is one Rescue Force&apos;s area. Click a town to open it.
          </p>
        </div>

        <aside className="lg:order-1 lg:overflow-y-auto lg:border-r lg:border-midnight-100">
          <div className="px-4 pb-2 pt-[18px] lg:pt-5">
            <h2 className="text-xl font-extrabold tracking-tight text-midnight-900">Pick your Rescue Force</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-midnight-500" aria-live="polite">
              {origin ? (
                <>
                  <span>{origin.kind === 'me' ? 'Closest to you first.' : `Closest to ${origin.label} first.`}</span>
                  <button
                    type="button"
                    onClick={showAll}
                    className="inline-flex items-center gap-1 rounded-full bg-midnight-100 py-1 pl-2.5 pr-1.5 text-[13px] font-semibold text-midnight-700 transition hover:bg-midnight-200"
                  >
                    Show all
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <span>
                  <span className="lg:hidden">Tap your town to see its lost and found pets.</span>
                  <span className="hidden lg:inline">Click your town, here or on the map, to see its lost and found pets.</span>
                </span>
              )}
            </div>
          </div>

          <div className="px-4 pb-24 pt-1.5 lg:pb-6">
            {forces === null ? (
              <p className="rounded-2xl bg-midnight-50 px-5 py-6 text-midnight-600 ring-1 ring-midnight-200">
                The list didn&apos;t load. Refresh the page to try again.
              </p>
            ) : list.length > 0 ? (
              <ul className="space-y-2.5">
                {list.map((f) => (
                  <ForceCard
                    key={f.id}
                    force={f}
                    origin={origin}
                    lit={f.id === coveringId}
                    onHover={setHoverId}
                  />
                ))}
              </ul>
            ) : (
              <NoForce
                title={
                  !origin
                    ? 'There are no Rescue Forces yet'
                    : `No Rescue Force near ${placeName} yet`
                }
                onShowAll={origin && all.length > 0 ? showAll : null}
              />
            )}

            {list.length > 0 && (
              <p className="pt-4 text-center text-[15px] text-midnight-600">
                Your town is not here?{' '}
                <Link href="/rescue-forces/create" className="font-bold text-midnight-900 underline-offset-4 hover:underline">
                  Start a Rescue Force
                </Link>
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ForceCard({ force: f, origin, lit, onHover }) {
  const badge = origin && f.inside ? (origin.kind === 'me' ? 'You are here' : `Covers ${origin.label}`) : null;
  const away = origin && !f.inside && typeof f.miles === 'number' ? `${Math.max(1, Math.round(f.miles))} mi` : null;
  const meta = [f.place, plural(f.members, 'member', 'members'), away].filter(Boolean).join(' · ');

  return (
    <li>
      <Link
        href={`/rescue-forces/${f.id}`}
        onMouseEnter={() => onHover(f.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(f.id)}
        onBlur={() => onHover(null)}
        className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 transition hover:border-flash-400 hover:shadow-[0_4px_14px_rgba(15,23,42,0.10)] ${
          lit ? 'border-flash-400 bg-flash-50' : 'border-midnight-200 bg-white'
        }`}
      >
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-midnight-800 to-midnight-900 text-flash-400">
          <Shield className="h-[26px] w-[26px]" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          {badge && (
            <span className="self-start rounded-full bg-blue-100 px-2 py-0.5 text-xs font-extrabold text-blue-700">{badge}</span>
          )}
          <span className="text-[17px] font-bold leading-tight text-midnight-900">{f.name}</span>
          <span className="text-sm text-midnight-600">{meta}</span>
          <span className="mt-0.5 flex items-center gap-2">
            {f.missing > 0 ? (
              <>
                <span className="flex pr-2">
                  {f.pets.map((p, i) => (
                    <PetFace key={i} photo={p.photo} />
                  ))}
                </span>
                <span className={`text-sm font-bold ${PET_TEXT.lost}`}>{missingText(f.missing)}</span>
              </>
            ) : (
              <span className="text-sm text-midnight-500">No pets missing right now</span>
            )}
          </span>
        </span>
        <ChevronRight className="h-[22px] w-[22px] shrink-0 text-midnight-400" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** A missing pet's photo in a small circle; a paw when there is no photo or it fails to load. */
function PetFace({ photo }) {
  const [failed, setFailed] = useState(false);
  const ring = '-mr-2 h-[26px] w-[26px] shrink-0 rounded-full border-2 border-white';
  if (!photo || failed) {
    return (
      <span className={`${ring} flex items-center justify-center bg-red-50 text-red-600`} aria-hidden="true">
        <PawPrint className="h-3 w-3" />
      </span>
    );
  }
  return (
    // Pet photos come from the CDN and from uploads; next/image is not set up for either.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" loading="lazy" className={`${ring} bg-midnight-100 object-cover`} onError={() => setFailed(true)} />
  );
}

function NoForce({ title, onShowAll }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-midnight-300 bg-midnight-50 p-[18px]">
      <p className="text-[17px] font-bold text-midnight-900">{title}</p>
      <p className="mt-2 text-[15px] leading-relaxed text-midnight-600">
        Start one. Neighbors who live there can join it, and lost pets reported there will show up in it.
      </p>
      <Link
        href="/rescue-forces/create"
        className={`mt-3 flex h-[52px] items-center justify-center rounded-[14px] text-base font-extrabold transition ${YELLOW_BUTTON}`}
      >
        Start a Rescue Force
      </Link>
      {onShowAll && (
        <button
          type="button"
          onClick={onShowAll}
          className="mt-1.5 h-11 w-full text-[15px] font-semibold text-midnight-700 underline underline-offset-4"
        >
          Show all Rescue Forces
        </button>
      )}
    </div>
  );
}
