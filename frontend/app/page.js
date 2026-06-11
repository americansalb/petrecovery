'use client';

/**
 * Homepage - the front of the board
 *
 * Same story as ever (report -> your city's Rescue Force -> a Mission
 * brings them home), told in the house design language: the lost-pet
 * flyer and the search beacon. Night sky with a sweeping light, poster
 * capitals, stamped numbers, real missions pinned as flyers, and a
 * pinned white card to find your force. Every section still renders
 * something real at zero data.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell, Heart, MapPin, Search, Shield, Users, Target, ArrowRight,
  CheckCircle2, Pill, MessagesSquare, PawPrint, Megaphone,
} from 'lucide-react';
import FlyerCard from '@/app/components/FlyerCard';

/* --------------------------------- Hero ---------------------------------- */

function Hero({ metrics }) {
  const stats = [
    { value: metrics?.pets_reunited, label: metrics?.pets_reunited === 1 ? 'happy reunion' : 'happy reunions' },
    { value: metrics?.active_squads, label: metrics?.active_squads === 1 ? 'rescue force' : 'rescue forces' },
    { value: metrics?.total_volunteers, label: 'neighbors ready' },
  ].filter((s) => s.value > 0);

  return (
    <section className="relative bg-midnight-950 overflow-hidden border-b-4 border-flash-400">
      {/* Street-map grid + stars */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-10 left-[12%] w-1 h-1 rounded-full bg-white/70" />
        <div className="absolute top-24 right-[18%] w-1 h-1 rounded-full bg-white/50" />
        <div className="absolute top-40 left-[28%] w-0.5 h-0.5 rounded-full bg-white/60" />
        <div className="absolute bottom-24 right-[30%] w-1 h-1 rounded-full bg-white/40" />
        <div className="absolute bottom-40 left-[18%] w-0.5 h-0.5 rounded-full bg-white/50" />
      </div>
      {/* The beacon */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 bottom-0 w-[460px]"
        style={{
          background: 'linear-gradient(180deg, rgba(250,204,21,0.16) 0%, rgba(250,204,21,0.05) 60%, transparent 100%)',
          animation: 'beacon-sweep 10s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-flash-400/15 blur-3xl"
        style={{ animation: 'beacon-pulse 6s ease-in-out infinite' }}
      />

      <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-20 md:pt-24 md:pb-28 text-center">
        {metrics?.open_cases > 0 && (
          <div className="inline-flex items-center gap-2 border-[3px] border-red-500 text-red-400 bg-midnight-950/60 text-xs font-black uppercase tracking-[0.18em] px-4 py-1.5 -rotate-1 mb-8">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {metrics.open_cases} pet{metrics.open_cases !== 1 ? 's' : ''} waiting to come home
          </div>
        )}

        <p className="text-flash-400 font-black uppercase tracking-[0.3em] text-xs mb-4">
          The neighborhood rescue network
        </p>
        <h1 className="font-black uppercase text-white leading-[0.95] tracking-tight text-5xl md:text-7xl mb-6">
          Every lost pet<br />
          gets{' '}
          <span className="relative inline-block">
            a search party.
            <span aria-hidden="true" className="absolute left-0 right-0 -bottom-1 h-3 md:h-4 bg-flash-400 -skew-x-6" />
          </span>
        </h1>
        <p className="text-midnight-300 text-lg md:text-xl max-w-2xl mx-auto mb-10">
          Your city has a Rescue Force: neighbors organized like a volunteer
          fire department for lost pets. Report once, and they run the mission
          with you until your pet is home.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Link
            href="/report/new"
            className="inline-flex items-center gap-2.5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-wide text-lg px-8 py-4 -rotate-1 hover:rotate-0 transition-all shadow-[5px_5px_0_rgba(220,38,38,0.3)] w-full sm:w-auto justify-center"
          >
            <Bell className="w-5 h-5" />
            My pet is lost
          </Link>
          <Link
            href="/report/found"
            className="inline-flex items-center gap-2.5 bg-flash-400 hover:bg-flash-300 text-midnight-950 font-black uppercase tracking-wide text-lg px-8 py-4 rotate-1 hover:rotate-0 transition-all shadow-[5px_5px_0_rgba(250,204,21,0.25)] w-full sm:w-auto justify-center"
          >
            <Heart className="w-5 h-5" />
            I found a pet
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-midnight-300 text-sm">
          {['Always free', 'Takes about a minute', 'Powered by neighbors near you'].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t}
            </span>
          ))}
        </div>

        {stats.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-10 mt-12">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="font-black text-4xl text-white tracking-tight">{Number(value).toLocaleString()}</p>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-flash-400/90 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------ Geography entry (canonical) --------------------- */

function FindYourForce() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const go = (e) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/rescue-forces/search?q=${encodeURIComponent(q)}` : '/rescue-forces/search');
  };

  return (
    <section className="relative max-w-3xl mx-auto px-4 -mt-12 md:-mt-14 mb-16 md:mb-24">
      <div className="relative bg-white -rotate-[0.5deg] shadow-[0_18px_50px_rgba(15,23,42,0.25)] p-6 md:p-8">
        {/* Pin */}
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 shadow-[0_2px_4px_rgba(0,0,0,0.4),inset_-1px_-2px_3px_rgba(0,0,0,0.35)]" aria-hidden="true" />

        <div className="flex items-center gap-3 mb-1.5">
          <span className="w-11 h-11 bg-midnight-950 text-flash-400 flex items-center justify-center -rotate-3">
            <Shield className="w-5 h-5" />
          </span>
          <h2 className="font-black uppercase tracking-tight text-2xl text-midnight-950">Find your Rescue Force</h2>
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
              className="w-full border-2 border-midnight-900 bg-white pl-12 pr-4 py-3.5 text-lg text-midnight-900 placeholder:text-midnight-300 focus:outline-none focus:ring-4 focus:ring-flash-400/50 transition"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 bg-midnight-950 hover:bg-midnight-800 text-white font-black uppercase tracking-wide px-7 py-3.5 transition-colors"
          >
            <Search className="w-5 h-5" />
            Search
          </button>
        </form>
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
    accent: 'text-red-600',
  },
  {
    icon: Shield,
    title: 'Your Rescue Force gets it',
    body: 'The volunteer team covering your geography sees the case the moment it lands. Big cities organize further into neighborhood divisions.',
    accent: 'text-flash-600',
  },
  {
    icon: Target,
    title: 'It becomes a Mission',
    body: 'The force accepts the case and coordinates: search sectors on a live map, sighting reports, team chat, shelter checks, flyers. Until reunion.',
    accent: 'text-emerald-600',
  },
];

function HowItWorks() {
  return (
    <section className="max-w-5xl mx-auto px-4 mb-16 md:mb-24">
      <p className="text-center text-xs font-black uppercase tracking-[0.3em] text-flash-600 mb-3">From report to reunion</p>
      <h2 className="text-center font-black uppercase tracking-tight text-3xl md:text-5xl text-midnight-950 mb-12">
        How a neighborhood<br className="hidden md:block" /> brings a pet home
      </h2>
      <div className="grid md:grid-cols-3 gap-7">
        {STEPS.map(({ icon: Icon, title, body, accent }, i) => (
          <div
            key={title}
            className={`relative bg-white shadow-[0_10px_30px_rgba(15,23,42,0.12)] p-6 pt-8 ${i % 2 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'} hover:rotate-0 transition-transform`}
          >
            {/* Tape */}
            <span aria-hidden="true" className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-flash-400/90 rotate-[-2deg] shadow-sm" />
            <div className="flex items-start justify-between mb-4">
              <span className={`w-11 h-11 bg-midnight-950 flex items-center justify-center -rotate-3 ${accent === 'text-flash-600' ? 'text-flash-400' : accent.replace('600', '400')}`}>
                <Icon className="w-5 h-5" />
              </span>
              <span className="font-black text-6xl leading-none text-midnight-100 select-none">{i + 1}</span>
            </div>
            <h3 className="font-black uppercase tracking-tight text-lg text-midnight-950 mb-2">{title}</h3>
            <p className="text-midnight-500 text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------- Active missions ---------------------------- */

function ActiveMissions({ missions, loading }) {
  return (
    <section className="relative bg-midnight-950 py-16 md:py-20 mb-16 md:mb-24 border-y-4 border-flash-400 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.1]"
        style={{
          backgroundImage:
            'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <div className="relative max-w-5xl mx-auto px-4">
        <div className="flex items-end justify-between gap-4 mb-10 flex-wrap">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-flash-400 mb-2">Live right now</p>
            <h2 className="font-black uppercase tracking-tight text-3xl md:text-5xl text-white">The board</h2>
          </div>
          <Link
            href="/lost-and-found"
            className="inline-flex items-center gap-1.5 text-flash-300 hover:text-flash-200 font-black uppercase tracking-wide text-sm transition-colors"
          >
            See the full board <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 bg-midnight-800 animate-pulse-soft" />
            ))}
          </div>
        ) : missions.length === 0 ? (
          <div className="bg-midnight-900 border-2 border-midnight-700 p-10 text-center">
            <PawPrint className="w-10 h-10 text-midnight-500 mx-auto mb-3" />
            <p className="text-white font-black uppercase tracking-tight text-xl mb-1">The board is clear</p>
            <p className="text-midnight-300 text-sm mb-6">That&apos;s a good day. Join your local force so you&apos;re ready when a neighbor needs you.</p>
            <Link href="/rescue-forces/search" className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-950 font-black uppercase tracking-wide px-6 py-3 -rotate-1 hover:rotate-0 transition-all">
              <Shield className="w-4 h-4" /> Find your Rescue Force
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-7 gap-y-9 pt-2">
            {missions.slice(0, 6).map((m, i) => (
              <FlyerCard key={m.caseNumber} c={m} index={i} />
            ))}
          </div>
        )}
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
    title: 'Medication tracking, free for every pet',
    body: 'Daily med schedules, one-tap dose logging, shared care teams with family and sitters. What other apps paywall, we give away.',
    href: '/pets',
    label: "Track your pet's meds",
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
      <h2 className="text-center font-black uppercase tracking-tight text-3xl md:text-5xl text-midnight-950 mb-4">
        Built as a gift.<br className="md:hidden" />{' '}
        <span className="relative inline-block">
          Run like one.
          <span aria-hidden="true" className="absolute left-0 right-0 -bottom-0.5 h-2.5 bg-flash-400 -skew-x-6" />
        </span>
      </h2>
      <p className="text-center text-midnight-500 max-w-2xl mx-auto mb-12">
        Everything that helps a pet is free for everyone, forever. The only thing
        we ever charge for is optional extra reach, and that keeps the lights on.
      </p>
      <div className="grid md:grid-cols-3 gap-7">
        {PILLARS.map(({ icon: Icon, title, body, href, label }, i) => (
          <div
            key={title}
            className={`bg-white shadow-[0_10px_30px_rgba(15,23,42,0.12)] p-6 flex flex-col ${i % 2 ? 'rotate-[0.4deg]' : '-rotate-[0.4deg]'} hover:rotate-0 transition-transform`}
          >
            <span className="w-11 h-11 bg-midnight-950 text-flash-400 flex items-center justify-center mb-4 -rotate-3">
              <Icon className="w-5 h-5" />
            </span>
            <h3 className="font-black uppercase tracking-tight text-lg text-midnight-950 mb-2 leading-snug">{title}</h3>
            <p className="text-midnight-500 text-sm leading-relaxed mb-4 flex-1">{body}</p>
            <Link href={href} className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-midnight-950 hover:text-flash-600 transition-colors">
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
    <section className="relative bg-midnight-950 pt-16 pb-8 border-t-4 border-flash-400 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-flash-400/10 blur-3xl"
      />
      <div className="relative max-w-5xl mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="font-black uppercase tracking-tight text-3xl md:text-5xl text-white mb-4 leading-tight">
            Be the neighbor you&apos;d want<br className="hidden md:block" /> on the worst day.
          </h2>
          <p className="text-midnight-300 max-w-xl mx-auto mb-8">
            Join your city&apos;s Rescue Force. No commitment, no cost. Just be
            reachable when a pet near you needs more eyes.
          </p>
          <Link
            href="/rescue-forces/search"
            className="inline-flex items-center gap-2.5 bg-flash-400 hover:bg-flash-300 text-midnight-950 font-black uppercase tracking-wide text-lg px-8 py-4 -rotate-1 hover:rotate-0 transition-all shadow-[5px_5px_0_rgba(250,204,21,0.25)]"
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
              <li><Link href="/lost-and-found?view=map" className="hover:text-flash-300 transition-colors">The board, on a map</Link></li>
              <li><Link href="/shelters" className="hover:text-flash-300 transition-colors">Shelters</Link></li>
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
      <Hero metrics={metrics} />
      <FindYourForce />
      <HowItWorks />
      <ActiveMissions missions={missions} loading={missionsLoading} />
      <FreeForever />
      <FooterCta />
    </main>
  );
}
