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
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell, Heart, MapPin, Search, Shield, Users, Target, ArrowRight,
  CheckCircle2, Pill, MessagesSquare, PawPrint, Megaphone, Clock,
} from 'lucide-react';
import { cn } from '@/components/ui';

const SPECIES_EMOJI = { DOG: '🐕', CAT: '🐈', BIRD: '🦜', RABBIT: '🐇', OTHER: '🐾' };

function timeAgo(date) {
  const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* --------------------------------- Hero ---------------------------------- */

function Hero({ metrics }) {
  const stats = [
    { value: metrics?.pets_reunited, label: 'happy reunions' },
    { value: metrics?.active_squads, label: 'rescue forces' },
    { value: metrics?.total_volunteers, label: 'neighbors ready' },
  ].filter((s) => s.value > 0);

  return (
    <section className="relative bg-midnight-950 overflow-hidden">
      {/* flashlight glow + stars, pure CSS so it can never render as a void */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[60rem] h-[34rem] rounded-full bg-flash-400/15 blur-3xl" />
        <div className="absolute top-10 left-[12%] w-1 h-1 rounded-full bg-white/70" />
        <div className="absolute top-24 right-[18%] w-1 h-1 rounded-full bg-white/50" />
        <div className="absolute top-40 left-[28%] w-0.5 h-0.5 rounded-full bg-white/60" />
        <div className="absolute bottom-24 right-[30%] w-1 h-1 rounded-full bg-white/40" />
        <div className="absolute bottom-40 left-[18%] w-0.5 h-0.5 rounded-full bg-white/50" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-24 md:pt-24 md:pb-32 text-center">
        {metrics?.open_cases > 0 && (
          <div className="inline-flex items-center gap-2 bg-red-500/15 border border-red-400/30 text-red-200 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse-soft" />
            {metrics.open_cases} pet{metrics.open_cases !== 1 ? 's' : ''} waiting to come home right now
          </div>
        )}

        <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-5">
          Every lost pet deserves{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-flash-300 to-flash-500">
            a search party
          </span>
        </h1>
        <p className="text-midnight-200 text-lg md:text-xl max-w-2xl mx-auto mb-9">
          Your city has a Rescue Force: neighbors organized and ready, like a
          volunteer fire department for lost pets. Report once, and they run
          the mission with you until your pet is home.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-7">
          <Link
            href="/report/new"
            className="inline-flex items-center gap-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-lg shadow-rose-900/40 transition-all hover:scale-[1.02] w-full sm:w-auto justify-center"
          >
            <Bell className="w-5 h-5" />
            My pet is lost
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/report/found"
            className="inline-flex items-center gap-2.5 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold text-lg px-8 py-4 rounded-2xl shadow-lg shadow-flash-900/20 transition-all hover:scale-[1.02] w-full sm:w-auto justify-center"
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
          <div className="flex flex-wrap items-center justify-center gap-8 mt-10">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-extrabold text-white">{Number(value).toLocaleString()}</p>
                <p className="text-midnight-300 text-sm">{label}</p>
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
            className="inline-flex items-center justify-center gap-2 bg-midnight-900 hover:bg-midnight-800 text-white font-bold px-7 py-3.5 rounded-2xl transition-colors"
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
    color: 'bg-rose-100 text-rose-600',
  },
  {
    icon: Shield,
    title: 'Your Rescue Force gets it',
    body: 'The volunteer team covering your geography sees the case the moment it lands. Big cities organize further into neighborhood divisions.',
    color: 'bg-flash-100 text-flash-700',
  },
  {
    icon: Target,
    title: 'It becomes a Mission',
    body: 'The force accepts the case and coordinates: search sectors on a live map, sighting reports, team chat, shelter checks, flyers. Until reunion.',
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
              <span className="text-4xl font-extrabold text-midnight-100">{i + 1}</span>
            </div>
            <h3 className="font-bold text-lg text-midnight-900 mb-1.5">{title}</h3>
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
    <section className="bg-midnight-900 py-16 md:py-20 mb-16 md:mb-24">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-flash-400 mb-2">Live right now</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">Active missions</h2>
          </div>
          <Link href="/missions" className="inline-flex items-center gap-1.5 text-flash-300 hover:text-flash-200 font-semibold text-sm transition-colors">
            See all missions <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

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
                    <span className="text-5xl">{SPECIES_EMOJI[m.petSpecies] || '🐾'}</span>
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
              <li><Link href="/database" className="hover:text-flash-300 transition-colors">Search the database</Link></li>
              <li><Link href="/rescue-forces/search" className="hover:text-flash-300 transition-colors">Find your Rescue Force</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-midnight-200 mb-3">Explore</p>
            <ul className="space-y-2 text-midnight-400">
              <li><Link href="/missions" className="hover:text-flash-300 transition-colors">Active missions</Link></li>
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
      <Hero metrics={metrics} />
      <FindYourForce />
      <HowItWorks />
      <ActiveMissions missions={missions} loading={missionsLoading} />
      <FreeForever />
      <FooterCta />
    </main>
  );
}
