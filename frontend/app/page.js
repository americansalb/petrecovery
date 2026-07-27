'use client';

/**
 * Homepage, rebuilt around how the system actually works:
 * a lost pet database + Rescue Forces anchored to real geographies, whose
 * communities run Missions for lost pets in their vicinity.
 *
 * One story, top to bottom: report in a minute -> your city's Rescue Force
 * gets it -> a coordinated Mission brings them home. One canonical location
 * entry (deep-links to /rescue-forces/search) instead of three competing
 * search bars. Every section renders something real at zero data, so the
 * page never shows empty voids.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { ShieldIcon } from '@/app/components/icons/HealthIcons';
import dynamic from 'next/dynamic';
import {
  Bell, Heart, MapPin, Search, Shield, Users, Target, ArrowRight,
  CheckCircle2, Pill, MessagesSquare, PawPrint, Megaphone, Clock, Building2,
} from 'lucide-react';
import { cn } from '@/components/ui';
import { SARAMA_AVATAR_PNG, SARAMA_NAME, SARAMA_TAGLINE } from '@/lib/brandAssets';

const BrowseMap = dynamic(() => import('@/app/lost-and-found/BrowseMap'), { ssr: false });


function timeAgo(date) {
  const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* --------------------------------- Hero ---------------------------------- */

// The search trail the hero draws across the night: one continuous GPS leg
const SEARCH_PATH_D = 'M -60 640 C 180 540, 300 660, 460 560 S 720 380, 900 450 S 1180 320, 1330 210';

function Hero({ metrics }) {
  const stats = [
    { value: metrics?.pets_reunited, one: 'happy reunion', many: 'happy reunions' },
    { value: metrics?.active_squads, one: 'rescue force', many: 'rescue forces' },
    { value: metrics?.total_volunteers, one: 'neighbor ready', many: 'neighbors ready' },
    // Only brag once the numbers reassure; a row of 1s reads as an empty
    // room. The row self-heals on as the platform grows.
  ].filter((s) => Number(s.value) >= 25);

  return (
    <section className="relative bg-midnight-950 overflow-hidden">
      <style>{`
        @keyframes trail-march { to { stroke-dashoffset: -26; } }
      `}</style>

      {/* flashlight glow + stars, pure CSS so it can never render as a void */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[60rem] h-[34rem] rounded-full bg-flash-400/15 blur-3xl" />
        <div className="absolute top-10 left-[12%] w-1 h-1 rounded-full bg-white/70" />
        <div className="absolute top-24 right-[18%] w-1 h-1 rounded-full bg-white/50" />
        <div className="absolute top-40 left-[28%] w-0.5 h-0.5 rounded-full bg-white/60" />
        <div className="absolute bottom-24 right-[30%] w-1 h-1 rounded-full bg-white/40" />
        <div className="absolute bottom-40 left-[18%] w-0.5 h-0.5 rounded-full bg-white/50" />
      </div>

      {/* A live GPS search, drawing itself across the night: the dashed
          trail marches, a searcher dot walks the route, and the last-seen
          pin pings until somebody gets there. This is the product. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none hidden sm:block"
        viewBox="0 0 1440 760"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path
          d={SEARCH_PATH_D}
          fill="none"
          stroke="#facc15"
          strokeOpacity="0.45"
          strokeWidth="3.5"
          strokeDasharray="10 16"
          strokeLinecap="round"
          style={{ animation: 'trail-march 2.4s linear infinite' }}
        />
        <circle r="20" fill="#34d399" opacity="0.14">
          <animateMotion dur="18s" repeatCount="indefinite" path={SEARCH_PATH_D} />
        </circle>
        <circle r="6" fill="#34d399">
          <animateMotion dur="18s" repeatCount="indefinite" path={SEARCH_PATH_D} />
        </circle>
      </svg>
      <div className="absolute right-[5%] top-[10%] hidden lg:block pointer-events-none" aria-hidden="true">
        <span className="absolute -inset-3 rounded-full bg-flash-400/30 animate-ping" />
        <span className="absolute -inset-7 rounded-full bg-flash-400/10 animate-ping" style={{ animationDelay: '0.7s' }} />
        <MapPin className="relative w-7 h-7 text-flash-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.7)]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 pt-10 pb-20 md:pt-14 md:pb-24">
        <div className="lg:grid lg:grid-cols-[1fr_minmax(0,44%)] lg:gap-12 lg:items-center">
          <div className="text-center lg:text-left">
            {/* Sarama as a compact brand row: present, not presiding */}
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
              <img
                src={SARAMA_AVATAR_PNG}
                alt={`${SARAMA_NAME}, ${SARAMA_TAGLINE}`}
                className="h-14 w-auto drop-shadow-[0_8px_20px_rgba(250,204,21,0.25)]"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <p className="text-flash-300/90 text-[11px] font-semibold uppercase tracking-[0.25em]">
                {SARAMA_NAME} · {SARAMA_TAGLINE}
              </p>
            </div>

            {metrics?.open_cases > 0 && (
              <Link
                href="/lost-and-found"
                className="inline-flex items-center gap-2 bg-red-500/15 border border-red-400/30 hover:border-red-400/60 hover:bg-red-500/25 text-red-200 text-sm font-semibold px-4 py-1.5 rounded-full mb-6 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse-soft" />
                {metrics.open_cases} pet{metrics.open_cases !== 1 ? 's' : ''} waiting to come home right now
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold text-white leading-tight mb-5">
              Every lost pet deserves{' '}
              <span className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-flash-300 to-flash-500">
                a search party
              </span>
            </h1>
            <p className="text-midnight-200 text-lg md:text-xl max-w-2xl mx-auto lg:mx-0 mb-8">
              Your city has a Rescue Force: neighbors organized like a volunteer
              fire department for lost pets. Report once, and they search with you
              until your pet is home.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-6">
              {/* Yellow-on-navy is THE brand move (navbar CTA, footer CTA, the
                  posters' LOST DOG band) - the crisis button speaks it loudest */}
              <Link
                href="/report/new"
                className="inline-flex items-center gap-2.5 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold text-lg px-8 py-4 rounded-2xl shadow-lg shadow-flash-400/25 transition-all hover:scale-[1.02] w-full sm:w-auto justify-center"
              >
                <Bell className="w-5 h-5" />
                My pet is lost
                <ArrowRight className="w-5 h-5" />
              </Link>
              {/* Solid cream, navy text: substantial like the primary but the
                  yellow still leads at a glance */}
              <Link
                href="/report/found"
                className="inline-flex items-center gap-2.5 bg-[#FFF9EE] hover:bg-white text-midnight-900 font-bold text-lg px-8 py-4 rounded-2xl shadow-lg shadow-black/20 transition-all hover:scale-[1.02] w-full sm:w-auto justify-center"
              >
                <Heart className="w-5 h-5" />
                I found a pet
              </Link>
            </div>

            {/* The everyday door, on the main page from the first second:
                the rescue product is the headline, this is the quiet peer */}
            <Link
              href="/care/start"
              className="group inline-flex items-center gap-2 mb-6 text-midnight-200 hover:text-white font-semibold text-sm transition-colors"
            >
              <ShieldIcon size={16} className="text-flash-400" />
              Pet safe at home? Start their free Health Book
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-midnight-300 text-sm">
              {['Always free', 'Takes about a minute', 'Powered by neighbors near you'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t}
                </span>
              ))}
            </div>

            {/* Proof as quiet chips, not a billboard: one lonely giant number
                reads as an empty room, chips read as momentum */}
            {stats.length > 0 && (
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 mt-7">
                {stats.map(({ value, one, many }) => (
                  <span
                    key={many}
                    className="inline-flex items-baseline gap-1.5 bg-white/5 border border-white/10 rounded-full px-4 py-1.5"
                  >
                    <span className="text-white font-extrabold">{Number(value).toLocaleString()}</span>
                    <span className="text-midnight-300 text-xs font-semibold">
                      {Number(value) === 1 ? one : many}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* The product, above the fold: a real Mission Control, framed live */}
          <div className="mt-12 lg:mt-0">
            <div className="rounded-3xl overflow-hidden border border-midnight-700/80 shadow-2xl shadow-black/40 bg-midnight-950 lg:rotate-1 lg:hover:rotate-0 transition-transform duration-300">
              <div className="flex items-center gap-1.5 px-4 py-3 bg-midnight-900 border-b border-midnight-800">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-flash-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 text-midnight-300 text-xs font-semibold tracking-wide">
                  Mission Control · AUS-2026-0001
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-soft" /> Live
                </span>
              </div>
              <img
                src="/landing/mission-control.jpg"
                alt="Mission Control: a live satellite map with the search zone, sighting reports, one-tap flyers, and the team's mission log"
                className="w-full h-auto"
              />
            </div>
            <p className="text-center text-midnight-400 text-xs mt-3">
              Mission Control: the live map your Rescue Force searches from.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------ Geography entry (canonical) --------------------- */

function FindYourForce() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null until the first search
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  // Search in place - nobody gets shipped to another page mid-thought.
  const go = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setError('');
    try {
      const res = await fetch(`/api/rescue-forces?search=${encodeURIComponent(q)}&radius=25&country=US`);
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      setResults((data.cities || []).slice(0, 4));
    } catch {
      setResults(null);
      setError('Search hit a snag. Try again, or browse all forces.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <section className="relative max-w-3xl mx-auto px-4 -mt-12 md:-mt-16 mb-16 md:mb-20">
      <div className="bg-white rounded-3xl shadow-xl border border-midnight-100 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-1.5">
          <span className="w-10 h-10 rounded-xl bg-flash-100 text-flash-700 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-midnight-900">Find your Rescue Force</h2>
        </div>
        <p className="text-midnight-500 text-sm mb-5">
          Every force covers a real place. Enter your city or ZIP to find yours,
          or be the neighbor who starts it.
        </p>
        <form onSubmit={go} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Your city or ZIP code"
              aria-label="Your city or ZIP code"
              className="w-full rounded-2xl border-2 border-midnight-200 bg-white pl-12 pr-4 py-3.5 text-lg text-midnight-900 placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 focus:ring-4 focus:ring-flash-100 transition"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="inline-flex items-center justify-center gap-2 bg-midnight-900 hover:bg-midnight-800 disabled:opacity-60 text-white font-bold px-7 py-3.5 rounded-2xl transition-colors"
          >
            <Search className={cn('w-5 h-5', searching && 'animate-pulse-soft')} />
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && <p className="text-rose-600 text-sm font-semibold mt-4">{error}</p>}

        {results !== null && (
          <div className="mt-5 space-y-2.5">
            {results.length === 0 && (
              <p className="text-midnight-500 text-sm">
                No matches for &ldquo;{query}&rdquo;. Try your city name or a ZIP code.
              </p>
            )}
            {results.map((c) =>
              c.exists && c.squad ? (
                <Link
                  key={`${c.city}-${c.state}`}
                  href={`/rescue-forces/${c.squad.id}`}
                  className="group flex items-center gap-3 rounded-2xl border border-midnight-100 bg-midnight-50 hover:border-flash-400 hover:bg-flash-50 px-4 py-3.5 transition-colors"
                >
                  <span className="w-9 h-9 rounded-xl bg-midnight-900 text-flash-400 flex items-center justify-center shrink-0">
                    <Shield className="w-[18px] h-[18px]" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-midnight-900 truncate">{c.squad.name}</span>
                    <span className="block text-midnight-500 text-sm truncate">
                      {c.city}, {c.state} · {c.squad.memberCount} member{c.squad.memberCount !== 1 ? 's' : ''}
                      {c.squad.successfulReunions > 0 && ` · ${c.squad.successfulReunions} reunions`}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-midnight-900 group-hover:text-flash-700 shrink-0 transition-colors">
                    View <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              ) : (
                <Link
                  key={`${c.city}-${c.state}`}
                  href={`/rescue-forces/search?q=${encodeURIComponent(`${c.city}, ${c.state}`)}`}
                  className="group flex items-center gap-3 rounded-2xl border-2 border-dashed border-midnight-200 hover:border-flash-400 px-4 py-3.5 transition-colors"
                >
                  <span className="w-9 h-9 rounded-xl bg-flash-100 text-flash-700 flex items-center justify-center shrink-0">
                    <Users className="w-[18px] h-[18px]" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-midnight-900 truncate">{c.city}, {c.state}</span>
                    <span className="block text-midnight-500 text-sm">No force yet. Be the neighbor who starts it</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-midnight-900 group-hover:text-flash-700 shrink-0 transition-colors">
                    Start it <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              )
            )}
          </div>
        )}

        <div className="mt-4 text-right">
          <Link
            href="/rescue-forces/search"
            className="inline-flex items-center gap-1 text-sm font-semibold text-midnight-400 hover:text-midnight-700 transition-colors"
          >
            Browse all forces <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ How it works ------------------------------ */

const STEPS = [
  {
    icon: Bell,
    title: 'Report in about a minute',
    body: 'Where they were last seen, a photo, a few taps. Your report instantly joins the public lost pet database.',
    color: 'bg-rose-100 text-rose-600',
  },
  {
    icon: Shield,
    title: 'Your Rescue Force gets it',
    body: 'The volunteer team covering your neighborhood sees the case the moment it lands.',
    color: 'bg-flash-100 text-flash-700',
  },
  {
    icon: Target,
    title: 'It becomes a Mission',
    body: 'Search sectors on a live map, sighting reports, team chat, shelter checks, flyers. Until reunion.',
    color: 'bg-emerald-100 text-emerald-700',
  },
];

function HowItWorks() {
  return (
    <section className="max-w-5xl mx-auto px-4 mb-16 md:mb-24">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-flash-600 mb-2">From report to reunion</p>
      <h2 className="text-center text-3xl md:text-4xl font-extrabold text-midnight-900 mb-10 md:mb-12">
        How a neighborhood brings a pet home
      </h2>
      <div className="grid md:grid-cols-3 gap-5">
        {STEPS.map(({ icon: Icon, title, body, color }, i) => (
          <div key={title} className="relative bg-white rounded-3xl border border-midnight-100 shadow-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className={cn('w-11 h-11 rounded-2xl flex items-center justify-center', color)}>
                <Icon className="w-5 h-5" />
              </span>
              <span className="text-4xl font-extrabold text-midnight-200">{i + 1}</span>
            </div>
            <h3 className="font-bold text-lg text-midnight-900 mb-1.5">{title}</h3>
            <p className="text-midnight-500 text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-midnight-500 text-sm mt-8 max-w-2xl mx-auto">
        Step 3 is the Mission Control you saw up top: the search zone on a live
        map, sighting reports, one-tap flyers, and the team&apos;s log, until the
        reunion.
      </p>
    </section>
  );
}

/* ----------------------------- Active missions ---------------------------- */

function ActiveMissions({ missions, loading }) {
  const mapped = missions.filter((m) => m.lastSeenLatitude && m.lastSeenLongitude);

  return (
    <section className="bg-midnight-900 py-16 md:py-20 mb-16 md:mb-24">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-flash-400 mb-2">Live right now</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">Active missions</h2>
          </div>
          <Link href="/lost-and-found" className="inline-flex items-center gap-1.5 text-flash-300 hover:text-flash-200 font-semibold text-sm transition-colors">
            See all missions <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* The map IS the promise: real missions on real streets */}
        {!loading && mapped.length > 0 && (
          <div className="h-[380px] rounded-3xl overflow-hidden border border-midnight-700 shadow-2xl mb-6">
            <BrowseMap cases={mapped} />
          </div>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-midnight-800 animate-pulse-soft" />
            ))}
          </div>
        ) : missions.length === 0 ? (
          <div className="bg-midnight-800 border border-midnight-700 rounded-3xl p-10 text-center">
            <PawPrint className="w-10 h-10 text-midnight-500 mx-auto mb-3" />
            <p className="text-white font-bold text-lg mb-1">No active missions right now</p>
            <p className="text-midnight-300 text-sm mb-5">That&apos;s a good day. Join your local force so you&apos;re ready when a neighbor needs you.</p>
            <Link href="/rescue-forces/search" className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-6 py-3 rounded-xl transition-colors">
              <Shield className="w-4 h-4" /> Find your Rescue Force
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {missions.slice(0, 6).map((m) => (
              <Link
                key={m.caseNumber}
                href={`/cases/${m.caseNumber}`}
                className="group bg-midnight-800 hover:bg-midnight-700 border border-midnight-700 rounded-2xl overflow-hidden transition-colors"
              >
                <div className="h-36 bg-midnight-700 flex items-center justify-center overflow-hidden">
                  {m.petPhotoUrl ? (
                    <img src={m.petPhotoUrl} alt={m.petName} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
                  ) : (
                    <SpeciesIcon species={m.petSpecies} size={56} className="text-midnight-300" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-bold text-white truncate">{m.petName}</p>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-rose-300 bg-rose-500/15 border border-rose-400/20 px-2 py-0.5 rounded-full whitespace-nowrap">Missing</span>
                  </div>
                  <p className="text-midnight-300 text-sm truncate">
                    <MapPin className="inline w-3.5 h-3.5 -mt-0.5 mr-1" />
                    {[m.city, m.state].filter(Boolean).join(', ') || m.lastSeenAddress || 'Location on file'}
                  </p>
                  <p className="text-midnight-400 text-xs mt-1.5">
                    <Clock className="inline w-3 h-3 -mt-0.5 mr-1" />
                    {m.lastSeenAt ? `Last seen ${timeAgo(m.lastSeenAt)}` : 'Recently reported'}
                  </p>
                </div>
              </Link>
            ))}
            {/* Fill sparse grids with an invitation instead of a void */}
            {missions.length < 3 && (
              <Link
                href="/rescue-forces/search"
                className="group border-2 border-dashed border-midnight-700 hover:border-flash-400/60 rounded-2xl flex flex-col items-center justify-center text-center p-6 min-h-[176px] transition-colors"
              >
                <Shield className="w-8 h-8 text-midnight-500 group-hover:text-flash-400 transition-colors mb-3" />
                <p className="text-white font-bold mb-1">More eyes bring them home</p>
                <p className="text-midnight-400 text-sm">
                  Join your Rescue Force and be ready when a neighbor needs you.
                </p>
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------ Health Book (shown, not told) ------------------- */

function HealthBookLane() {
  return (
    <section className="max-w-5xl mx-auto px-4 mb-16 md:mb-24">
      <div className="bg-white border border-midnight-100 rounded-3xl p-8 md:p-10 md:flex items-center gap-10">
        <div className="flex-1 min-w-0 mb-8 md:mb-0">
          <p className="text-xs font-extrabold uppercase tracking-widest text-flash-600 mb-2">Not lost? Keep it that way.</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-midnight-900 leading-tight">
            The Health Book is the same record.
          </h2>
          <p className="text-midnight-500 mt-3">
            Meds with one-tap logging, vaccines, weight, a care team any vet or
            sitter can read. And if the worst day ever comes, this profile
            becomes the search mission: photos, chip, quirks, all ready.
          </p>
          <Link
            href="/care/start"
            className="inline-flex items-center gap-2 mt-5 px-5 py-3 bg-midnight-900 hover:bg-midnight-800 text-white font-bold rounded-2xl transition"
          >
            Start a free Health Book
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="md:w-[46%] shrink-0">
          <div className="rounded-2xl overflow-hidden border border-midnight-200 shadow-xl">
            <img
              src="/landing/health-book-today.jpg"
              alt="A pet's Health Book: today's dose checklist with morning and evening medications, one tap to log each"
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------- Shelters lane (dark band) ----------------------- */

const SHELTER_POINTS = [
  'A full health record for every animal in your care',
  'Strays checked against local lost-pet reports automatically',
  'Adoptions leave with their complete medical history',
  'Staff seats, plus a public page you never have to maintain',
];

function ShelterLane() {
  return (
    <section className="max-w-5xl mx-auto px-4 mb-16 md:mb-24">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0a1526] via-midnight-900 to-[#0c1a30] rounded-3xl p-8 md:p-10 md:flex items-center gap-10">
        <div className="absolute -top-24 -right-24 w-[380px] h-[380px] bg-flash-400/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="flex-1 min-w-0 mb-8 md:mb-0 relative">
          <p className="text-xs font-extrabold uppercase tracking-widest text-flash-400 mb-2">
            <Building2 className="inline w-3.5 h-3.5 -mt-0.5 mr-1.5" />
            For shelters and rescues
          </p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
            Run a shelter? All of this is yours too. Free.
          </h2>
          <p className="text-midnight-300 mt-3">
            Shelter software costs money everywhere else. Here, every animal you
            manage helps a lost pet get found, so we give shelters the whole
            platform for nothing. Forever.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <Link
              href="/shelter/start"
              className="inline-flex items-center gap-2 px-5 py-3 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold rounded-2xl transition"
            >
              Get your free shelter account
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/for-shelters"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-midnight-200 hover:text-white transition-colors"
            >
              See everything included <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
        <div className="md:w-[42%] shrink-0 relative">
          <ul className="space-y-3">
            {SHELTER_POINTS.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-midnight-100">
                <CheckCircle2 className="w-5 h-5 text-flash-400 shrink-0 mt-0.5" />
                <span className="text-sm leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- Free forever band -------------------------- */

const PILLARS = [
  {
    icon: Megaphone,
    title: 'Recovery is free. Period.',
    body: 'Reports, alerts, the database, force coordination, flyers. Money never decides whether a pet comes home.',
    href: '/report/new',
    label: 'Report a lost pet',
  },
  {
    icon: Pill,
    title: 'The Health Book, free for every pet',
    body: 'Med schedules with one-tap logging, vaccine records, weight tracking, shared care teams. What other apps paywall, we give away.',
    href: '/care',
    label: 'See the Health Book',
  },
  {
    icon: MessagesSquare,
    title: 'A community, not just an app',
    body: 'Your Rescue Force has its own feed, chat, and honors. The Rescue Hub connects every force for advice, transport, and fostering.',
    href: '/hub',
    label: 'Visit the Rescue Hub',
  },
];

function FreeForever() {
  return (
    <section className="max-w-5xl mx-auto px-4 mb-16 md:mb-24">
      <h2 className="text-center text-3xl md:text-4xl font-extrabold text-midnight-900 mb-3">
        Built as a gift, run like one
      </h2>
      <p className="text-center text-midnight-500 max-w-2xl mx-auto mb-10">
        Everything that helps a pet is free for everyone, forever. The only thing
        we ever charge for is optional extra reach, and that keeps the lights on.
      </p>
      <div className="grid md:grid-cols-3 gap-5">
        {PILLARS.map(({ icon: Icon, title, body, href, label }) => (
          <div key={title} className="bg-white rounded-3xl border border-midnight-100 shadow-card p-6 flex flex-col">
            <span className="w-11 h-11 rounded-2xl bg-midnight-900 text-flash-400 flex items-center justify-center mb-4">
              <Icon className="w-5 h-5" />
            </span>
            <h3 className="font-bold text-lg text-midnight-900 mb-1.5">{title}</h3>
            <p className="text-midnight-500 text-sm leading-relaxed mb-4 flex-1">{body}</p>
            <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-bold text-midnight-900 hover:text-flash-600 transition-colors">
              {label} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------- Footer --------------------------------- */

function FooterCta() {
  return (
    <section className="bg-midnight-950 pt-16 pb-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
            Be the neighbor you&apos;d want on the worst day
          </h2>
          <p className="text-midnight-300 max-w-xl mx-auto mb-7">
            Join your city&apos;s Rescue Force. No commitment, no cost. Just be
            reachable when a pet near you needs more eyes.
          </p>
          <Link
            href="/rescue-forces/search"
            className="inline-flex items-center gap-2.5 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold text-lg px-8 py-4 rounded-2xl transition-all hover:scale-[1.02]"
          >
            <Users className="w-5 h-5" />
            Join your Rescue Force
          </Link>
        </div>

        <div className="border-t border-midnight-800 pt-8 grid sm:grid-cols-3 gap-8 text-sm">
          <div>
            <p className="font-extrabold text-white text-lg mb-2">Reunite<span className="text-flash-400">Pets</span></p>
            <p className="text-midnight-400 leading-relaxed">
              Coordinated search and rescue for lost pets, powered by neighbors. Free, forever.
            </p>
          </div>
          <div>
            <p className="font-bold text-midnight-200 mb-3">Do something</p>
            <ul className="space-y-2 text-midnight-400">
              <li><Link href="/report/new" className="hover:text-flash-300 transition-colors">Report a lost pet</Link></li>
              <li><Link href="/report/found" className="hover:text-flash-300 transition-colors">Report a found pet</Link></li>
              <li><Link href="/lost-and-found" className="hover:text-flash-300 transition-colors">Browse Lost &amp; Found</Link></li>
              <li><Link href="/rescue-forces/search" className="hover:text-flash-300 transition-colors">Find your Rescue Force</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-midnight-200 mb-3">Explore</p>
            <ul className="space-y-2 text-midnight-400">
              <li><Link href="/lost-and-found" className="hover:text-flash-300 transition-colors">Active missions</Link></li>
              <li><Link href="/shelters" className="hover:text-flash-300 transition-colors">Shelters</Link></li>
              <li><Link href="/for-shelters" className="hover:text-flash-300 transition-colors">For shelters &amp; rescues</Link></li>
              <li><Link href="/hub" className="hover:text-flash-300 transition-colors">Rescue Hub</Link></li>
              <li><Link href="/about" className="hover:text-flash-300 transition-colors">About</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-midnight-800 mt-8 pt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-midnight-500">
          <span>&copy; {new Date().getFullYear()} ReunitePets.org</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-midnight-300 transition-colors">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-midnight-300 transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-midnight-300 transition-colors">Contact</Link>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function HomePage() {
  const [metrics, setMetrics] = useState(null);
  const [missions, setMissions] = useState([]);
  const [missionsLoading, setMissionsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/public/metrics')
      .then((r) => (r.ok ? r.json() : null))
      .then(setMetrics)
      .catch(() => {});

    fetch('/api/public/missions?limit=6')
      .then((r) => (r.ok ? r.json() : { cases: [] }))
      .then((d) => setMissions(d.cases || []))
      .catch(() => setMissions([]))
      .finally(() => setMissionsLoading(false));
  }, []);

  return (
    <main className="bg-midnight-50">
      <Hero metrics={metrics} />
      <FindYourForce />
      <HowItWorks />
      <ActiveMissions missions={missions} loading={missionsLoading} />
      <HealthBookLane />
      <ShelterLane />
      <FreeForever />
      <FooterCta />
    </main>
  );
}
