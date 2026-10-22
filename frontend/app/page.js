'use client';

/**
 * Homepage. The first screen asks one question, lost or found, and answers
 * it with two large doors, so a panicked owner on a phone knows where to tap
 * without reading. Everything below serves the people who scroll: the pets
 * missing right now (each with a one-tap way to report a sighting), how a
 * search works, the neighbors who search, then the Health Book and shelters.
 *
 * The hero sits on a quiet street map with two search trails: the product
 * (neighbors searching an area together) shown, not explained. Live numbers
 * come from /api/public/metrics and /api/public/missions, and every section
 * renders something real at zero data, so the page never shows empty voids.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import {
  ArrowRight, CheckCircle2, Clock, Eye, MapPin, PawPrint, Search, Users,
} from 'lucide-react';
import { cn } from '@/components/ui';
import { casePlace } from '@/app/lib/caseLabels';
import { SARAMA_AVATAR, SARAMA_AVATAR_PNG } from '@/lib/brandAssets';
import { displayFont } from '@/app/lib/fonts';

// "Last seen 3 days ago", in words a person reads at a glance.
function lastSeenText(date) {
  if (!date) return 'Recently reported';
  const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
  if (hours < 1) return 'Last seen just now';
  if (hours < 24) return `Last seen ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `Last seen ${days} day${days === 1 ? '' : 's'} ago`;
}

const heading = cn(displayFont.className, 'font-extrabold tracking-[-0.03em]');

/* ------------------------------- Hero map -------------------------------- */

// White streets on a pale blue ground, drawn once at 1440x900 and cropped to
// fit. The centre fades out so the headline sits on calm paper.
const MAP_STREETS = [
  ['M-40 150 L1480 96', 16],
  ['M-40 560 L1480 520', 16],
  ['M190 -40 L150 940', 16],
  ['M1240 -40 L1290 940', 16],
  ['M-40 790 C 320 710, 560 870, 820 770 S 1260 610, 1480 690', 18],
  ['M-40 350 L1480 310', 8],
  ['M410 -40 L380 940', 8],
  ['M640 -40 L630 940', 8],
  ['M860 -40 L880 940', 8],
  ['M1060 -40 L1090 940', 8],
  ['M-40 250 L420 236', 6],
  ['M1060 210 L1480 196', 6],
  ['M-40 450 L420 438', 6],
  ['M1060 430 L1480 418', 6],
  ['M290 -40 L270 940', 6],
  ['M1150 -40 L1180 940', 6],
  ['M1360 -40 L1390 940', 6],
];

const PHONE_STREETS = [
  ['M-20 90 L410 70', 12],
  ['M-20 340 L410 326', 12],
  ['M-20 700 L410 686', 12],
  ['M300 -20 L320 780', 12],
  ['M60 -20 L48 780', 8],
  ['M-20 210 L410 198', 6],
  ['M180 -20 L172 780', 6],
  ['M-20 530 L410 518', 6],
];

const TRAIL = { stroke: '#D9A700', strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };

// A map pin whose tip lands on (x, y).
function PinMark({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x - 12 * scale} ${y - 22 * scale}) scale(${scale})`}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="#0f172a" />
      <circle cx="12" cy="10" r="3" fill="#facc15" />
    </g>
  );
}

function MapBackdrop() {
  return (
    <>
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none hidden md:block"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="home-map-fade" cx="50%" cy="36%" r="50%">
            <stop offset="0" stopColor="#EEF2F8" stopOpacity="1" />
            <stop offset="0.6" stopColor="#EEF2F8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#EEF2F8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="1110" y="330" width="170" height="130" rx="18" fill="#DCEBE1" />
        <rect x="30" y="610" width="110" height="110" rx="16" fill="#DCEBE1" />
        <g stroke="#FFFFFF" strokeLinecap="round" fill="none">
          {MAP_STREETS.map(([d, w]) => <path key={d} d={d} strokeWidth={w} />)}
        </g>
        <rect width="1440" height="900" fill="url(#home-map-fade)" />
        <path d="M150 900 L160 640 L176 318" strokeWidth="4" strokeDasharray="2 12" {...TRAIL} />
        <path d="M1290 900 L1266 530 L1166 534 L1158 216" strokeWidth="4" strokeDasharray="2 12" {...TRAIL} />
        <circle cx="1158" cy="200" r="78" fill="#facc15" fillOpacity="0.16" stroke="#D9A700" strokeOpacity="0.6" strokeWidth="2" strokeDasharray="4 8" />
        <PinMark x={176} y={300} scale={1.6} />
        <PinMark x={1158} y={216} scale={1.6} />
      </svg>
      <svg
        className="absolute top-0 left-0 w-full h-auto pointer-events-none md:hidden"
        viewBox="0 0 390 760"
        aria-hidden="true"
      >
        <rect x="300" y="600" width="90" height="62" rx="10" fill="#DCEBE1" />
        <g stroke="#FFFFFF" strokeLinecap="round" fill="none">
          {PHONE_STREETS.map(([d, w]) => <path key={d} d={d} strokeWidth={w} />)}
        </g>
        <path d="M410 76 L372 78 L360 62" strokeWidth="3" strokeDasharray="2 10" {...TRAIL} />
        <circle cx="350" cy="40" r="26" fill="#facc15" fillOpacity="0.18" stroke="#D9A700" strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="3 6" />
        <PinMark x={350} y={50} />
      </svg>
    </>
  );
}

/* --------------------------------- Hero ---------------------------------- */

// One door per situation. On a phone it is a wide row with an arrow; from
// tablet up it is a tall card with a labeled button and Sarama in the corner.
function Door({ href, tone, icon: Icon, title, body, shortBody, cta, art }) {
  const lost = tone === 'lost';
  return (
    <Link
      href={href}
      className={cn(
        'group relative overflow-hidden flex items-center gap-4 rounded-[22px] p-5 min-h-[128px] transition-transform duration-200 hover:-translate-y-0.5',
        'md:flex-col md:items-start md:justify-between md:gap-7 md:rounded-[28px] md:p-9 md:min-h-[300px]',
        lost
          ? 'bg-flash-400 text-midnight-900 shadow-[0_24px_48px_-24px_rgba(120,90,0,0.55)]'
          : 'bg-midnight-900 text-white shadow-[0_24px_48px_-24px_rgba(15,23,42,0.6)]'
      )}
    >
      <span className="relative z-10 flex flex-1 items-center gap-4 md:flex-none md:flex-col md:items-start md:gap-3.5">
        <span
          className={cn(
            'shrink-0 flex items-center justify-center w-[52px] h-[52px] rounded-[15px] md:w-14 md:h-14 md:rounded-2xl',
            lost ? 'bg-midnight-900 text-white' : 'bg-flash-400 text-midnight-900'
          )}
        >
          <Icon className="w-[26px] h-[26px] md:w-7 md:h-7" strokeWidth={2.25} />
        </span>
        <span className="flex flex-col gap-1 md:gap-3.5">
          <span className={cn(heading, 'text-[26px] leading-[1.05] md:text-[clamp(34px,3.2vw,44px)] md:leading-[1.02]')}>
            {title}
          </span>
          <span className={cn('text-[15px] leading-snug md:text-lg md:leading-normal md:max-w-[320px]', lost ? 'text-midnight-900/85' : 'text-white/80')}>
            <span className="md:hidden">{shortBody}</span>
            <span className="hidden md:inline">{body}</span>
          </span>
        </span>
      </span>
      <span
        className={cn(
          'md:hidden shrink-0 flex items-center justify-center w-10 h-10 rounded-full',
          lost ? 'bg-midnight-900 text-white' : 'bg-white text-midnight-900'
        )}
      >
        <ArrowRight className="w-5 h-5" />
      </span>
      <span
        className={cn(
          'relative z-10 hidden md:inline-flex items-center gap-2.5 h-[52px] px-6 rounded-full font-bold text-[17px]',
          lost ? 'bg-midnight-900 text-white' : 'bg-white text-midnight-900'
        )}
      >
        {cta}
        <ArrowRight className="w-5 h-5" />
      </span>
      {art}
    </Link>
  );
}

function Hero({ openCount, neighbors }) {
  return (
    <section className="relative overflow-hidden bg-[#EEF2F8]">
      <MapBackdrop />
      <div className="relative max-w-[1080px] mx-auto px-5 pt-7 pb-10 md:px-6 md:pt-20 md:pb-24 flex flex-col items-start md:items-center gap-[18px] md:gap-6 text-left md:text-center">
        {openCount > 0 && (
          <a
            href="#missing"
            className="inline-flex items-center gap-2 md:gap-2.5 rounded-full bg-[#FDECEA] hover:bg-[#FBDDD9] text-[#9F1D12] text-sm md:text-[15px] font-semibold pl-3 pr-3.5 py-2 md:pl-3.5 md:pr-4 transition-colors"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#E5372A] animate-pulse-soft shrink-0" />
            <span>
              {openCount} {openCount === 1 ? 'pet is' : 'pets are'} waiting to come home
              <span className="hidden md:inline"> right now</span>
            </span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </a>
        )}

        <h1 className={cn(heading, 'text-midnight-900 max-w-[980px] text-[42px] leading-[1.02] tracking-[-0.035em] md:text-[clamp(44px,6vw,84px)] md:leading-none')}>
          <span className="md:block">Lost or found a pet?</span>{' '}
          Let&apos;s get them <span className="shadow-[inset_0_-0.24em_0_#facc15]">home.</span>
        </h1>
        <p className="max-w-[640px] text-[17px] leading-relaxed text-midnight-600 md:text-[clamp(18px,1.6vw,21px)]">
          Report it in about a minute. Neighbors in your town&apos;s Rescue Force see it and
          search with you until your pet is safe.
        </p>

        <div className="w-full grid gap-3 mt-1.5 md:gap-5 md:mt-5 lg:grid-cols-2 text-left">
          <Door
            href="/report/new"
            tone="lost"
            icon={Search}
            title="My pet is lost"
            shortBody="Start a search. Neighbors nearby help you look."
            body="Start a search now. Neighbors nearby see it and help you look."
            cta="Start a search"
            art={
              <img
                src={SARAMA_AVATAR_PNG}
                alt=""
                className="hidden md:block absolute -right-2.5 -bottom-[34px] w-[236px] h-[236px] object-contain pointer-events-none"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            }
          />
          <Door
            href="/report/found"
            tone="found"
            icon={PawPrint}
            title="I found a pet"
            shortBody="Post a photo and where you found them."
            body="Post a photo and where you found them. We email owners nearby whose lost pet looks like a close match."
            cta="Report a found pet"
            art={
              <img
                src={SARAMA_AVATAR}
                alt=""
                className="hidden md:block absolute -right-5 -bottom-10 w-[190px] h-[236px] object-contain pointer-events-none"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            }
          />
        </div>

        {/* Only brag once the numbers reassure; a small count reads as an
            empty room, so below 25 the row says who searches instead. */}
        <ul className="flex flex-wrap justify-start md:justify-center gap-x-[18px] gap-y-2 md:gap-x-7 md:mt-2 text-sm md:text-[15px] font-medium text-midnight-600">
          <li className="inline-flex items-center gap-1.5 md:gap-2">
            <CheckCircle2 className="w-4 h-4 md:w-[18px] md:h-[18px] text-emerald-700" /> Free to use
          </li>
          <li className="inline-flex items-center gap-1.5 md:gap-2">
            <Clock className="w-4 h-4 md:w-[18px] md:h-[18px] text-emerald-700" /> Takes about a minute
          </li>
          <li className="inline-flex items-center gap-1.5 md:gap-2">
            <Users className="w-4 h-4 md:w-[18px] md:h-[18px] text-emerald-700" />
            {neighbors ? `${neighbors.toLocaleString()} neighbors ready to search` : 'Powered by neighbors near you'}
          </li>
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------- Missing right now --------------------------- */

// Muted per-species tints keep photo-less cards from reading as one grey wall.
const SPECIES_TINT = {
  DOG: 'bg-amber-50 text-amber-700',
  CAT: 'bg-orange-50 text-orange-700',
  BIRD: 'bg-sky-50 text-sky-700',
  RABBIT: 'bg-rose-50 text-rose-700',
};

function MissingCard({ m }) {
  const sp = (m.petSpecies || '').toUpperCase();
  const speciesWord = sp ? sp.charAt(0) + sp.slice(1).toLowerCase() : 'Pet';
  const named = m.petName && !/^unknown/i.test(m.petName);
  const name = named ? m.petName : speciesWord;
  const href = `/cases/${m.caseNumber}`;

  return (
    <article className="w-[248px] shrink-0 snap-start md:w-auto flex flex-col bg-white border border-midnight-200 rounded-[18px] md:rounded-[20px] overflow-hidden">
      <Link href={href} className="relative block" tabIndex={-1} aria-hidden="true">
        <div className={cn('aspect-[4/3] flex items-center justify-center overflow-hidden', m.petPhotoUrl ? 'bg-midnight-100' : SPECIES_TINT[sp] || 'bg-midnight-100 text-midnight-500')}>
          {m.petPhotoUrl ? (
            <img src={m.petPhotoUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <SpeciesIcon species={m.petSpecies} size={56} className="text-current" />
          )}
        </div>
        <span className="absolute top-2.5 left-2.5 md:top-3 md:left-3 rounded-full bg-white text-[#9F1D12] text-[11px] md:text-xs font-bold uppercase tracking-[0.08em] px-2.5 py-1">
          Missing
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-2.5 p-3.5 md:gap-3 md:p-[18px] md:pb-5">
        <h3 className={cn(displayFont.className, 'text-[22px] md:text-2xl font-bold tracking-[-0.02em] text-midnight-900 truncate')}>
          <Link href={href} className="hover:underline underline-offset-4">{name}</Link>
        </h3>
        <div className="flex flex-col gap-1 md:gap-1.5 text-sm md:text-[15px] text-midnight-600">
          <span className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="truncate">{casePlace(m)}</span>
          </span>
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" />
            {lastSeenText(m.lastSeenAt)}
          </span>
        </div>
        {/* ?seen=1 opens the case page's sighting sheet straight away */}
        <Link
          href={`${href}?seen=1`}
          className="mt-auto flex items-center justify-center gap-2 h-11 md:h-[46px] px-3 rounded-xl bg-midnight-900 hover:bg-midnight-800 text-white text-[15px] font-bold transition-colors"
        >
          <Eye className="w-[18px] h-[18px] shrink-0" />
          <span className="truncate">I&apos;ve seen {named ? m.petName : `this ${speciesWord.toLowerCase()}`}</span>
        </Link>
      </div>
    </article>
  );
}

function MissingNow({ missions, loading, openCount }) {
  return (
    <section id="missing" className="bg-white py-12 md:py-24 scroll-mt-16">
      <div className="max-w-[1200px] mx-auto px-5 md:px-6 flex flex-col gap-5 md:gap-10">
        <div className="flex flex-wrap items-end justify-between gap-5 md:gap-6">
          <div className="flex flex-col gap-2.5 md:gap-3 max-w-[560px]">
            <p className="inline-flex items-center gap-2 text-xs md:text-[13px] font-bold uppercase tracking-[0.12em] text-[#9F1D12]">
              <span className="w-2 h-2 rounded-full bg-[#E5372A]" />
              Live right now
            </p>
            <h2 className={cn(heading, 'text-[32px] leading-[1.05] md:text-[clamp(32px,3.4vw,48px)] text-midnight-900')}>
              Have you seen them?
            </h2>
            <p className="text-base md:text-lg leading-relaxed text-midnight-600">
              These pets are missing right now. If you have seen one, tap the button on its
              card to report where.
            </p>
          </div>
          <form action="/lost-and-found" method="get" className="w-full md:w-auto flex flex-col gap-1.5">
            <label htmlFor="home-near" className="text-sm font-semibold text-midnight-700">
              Show pets near
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1 md:flex-none md:w-[260px]">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-midnight-400" />
                <input
                  id="home-near"
                  name="q"
                  type="text"
                  placeholder="City or ZIP"
                  autoComplete="postal-code"
                  className="w-full h-[52px] rounded-[14px] border border-midnight-300 bg-white pl-10 pr-3 text-base text-midnight-900 placeholder:text-midnight-400 focus:outline-none focus:border-flash-500 focus:ring-4 focus:ring-flash-100"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 h-[52px] px-5 rounded-[14px] bg-midnight-900 hover:bg-midnight-800 text-white text-[15px] font-bold transition-colors"
              >
                <Search className="w-[18px] h-[18px]" />
                Show
              </button>
            </div>
          </form>
        </div>

        {loading ? (
          <div className="flex gap-3.5 overflow-hidden -mx-5 px-5 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-5 md:mx-0 md:px-0">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-[248px] shrink-0 md:w-auto h-[340px] rounded-[20px] bg-midnight-100 animate-pulse-soft" />
            ))}
          </div>
        ) : missions.length === 0 ? (
          <div className="rounded-[20px] border border-midnight-200 bg-midnight-50 p-8 md:p-10 text-center">
            <PawPrint className="w-10 h-10 text-midnight-400 mx-auto mb-3" />
            <p className="text-midnight-900 font-bold text-lg mb-1">No pets reported missing right now</p>
            <p className="text-midnight-600 text-sm mb-5">
              Join your town&apos;s Rescue Force to help search when a pet goes missing near you.
            </p>
            <Link
              href="/rescue-forces"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold transition-colors"
            >
              <Users className="w-4 h-4" /> Find your Rescue Force
            </Link>
          </div>
        ) : (
          <div className="flex gap-3.5 overflow-x-auto snap-x -mx-5 px-5 pb-2 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-5 md:overflow-visible md:mx-0 md:px-0 md:pb-0">
            {missions.slice(0, 3).map((m) => <MissingCard key={m.caseNumber} m={m} />)}
            <div className="hidden md:flex flex-col justify-center gap-3.5 p-7 rounded-[20px] border-2 border-dashed border-midnight-300">
              <span className="w-[52px] h-[52px] rounded-2xl bg-midnight-900 text-flash-400 flex items-center justify-center">
                <PawPrint className="w-[26px] h-[26px]" strokeWidth={2.25} />
              </span>
              <h3 className={cn(displayFont.className, 'text-2xl font-bold leading-tight tracking-[-0.02em] text-midnight-900')}>
                Found a pet who isn&apos;t here?
              </h3>
              <p className="text-base leading-normal text-midnight-600">Post them so their family can find them.</p>
              <Link
                href="/report/found"
                className="self-start inline-flex items-center h-[46px] px-[18px] rounded-xl border border-midnight-900 text-midnight-900 hover:bg-midnight-900 hover:text-white text-[15px] font-bold transition-colors"
              >
                Report a found pet
              </Link>
            </div>
          </div>
        )}

        <Link
          href="/lost-and-found"
          className="self-stretch md:self-center inline-flex items-center justify-center gap-2 h-[50px] md:h-auto rounded-[14px] md:rounded-none border border-midnight-300 md:border-0 text-base md:text-[17px] font-bold text-midnight-900 md:py-2.5 hover:underline underline-offset-4"
        >
          {openCount > 0 ? `See all ${openCount} pets on the Lost & Found board` : 'Browse the Lost & Found board'}
          <ArrowRight className="w-[18px] h-[18px]" />
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------ How it works ------------------------------ */

// What actually happens, step by step. Members are not alerted: the report
// is posted in the force's discussion, where they see it.
const STEPS = [
  {
    title: 'Tell us where and when',
    body: 'Where and when they were last seen, and a photo. The report goes on the Lost & Found board.',
  },
  {
    title: "Your town's Rescue Force gets it",
    body: "It is posted in the force's discussion, where its members see it.",
  },
  {
    title: 'Members search from Mission Control',
    body: 'The search map, sightings, flyers and shelter calls, until the pet is home.',
  },
];

function HowItWorks() {
  return (
    <section className="bg-[#F4F6FA] py-14 md:py-28">
      <div className="max-w-[1200px] mx-auto px-5 md:px-6 flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-16">
        <div className="lg:flex-1 flex flex-col gap-6 md:gap-8">
          <h2 className={cn(heading, 'text-[30px] leading-[1.08] md:text-[clamp(32px,3.4vw,48px)] md:leading-[1.05] text-midnight-900')}>
            How a search works
          </h2>
          <ol className="flex flex-col">
            {STEPS.map(({ title, body }, i) => {
              const last = i === STEPS.length - 1;
              return (
                <li key={title} className="flex gap-4 md:gap-5">
                  <span className="flex flex-col items-center shrink-0">
                    <span className="w-[38px] h-[38px] md:w-11 md:h-11 rounded-full bg-flash-400 text-midnight-900 font-extrabold text-base md:text-lg flex items-center justify-center">
                      {i + 1}
                    </span>
                    {!last && <span className="flex-1 min-h-[20px] border-l-2 border-dashed border-midnight-300 my-1.5" aria-hidden="true" />}
                  </span>
                  <span className={cn('flex flex-col gap-1 md:gap-1.5 pt-1.5 md:pt-2', !last && 'pb-5 md:pb-7')}>
                    <strong className="text-lg md:text-xl font-bold text-midnight-900">{title}</strong>
                    <span className="text-[15px] md:text-base leading-relaxed text-midnight-600">{body}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/report/new"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 h-[52px] px-6 rounded-full bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold text-[17px] transition-colors"
            >
              Start a search <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/report/found" className="hidden sm:inline py-3 font-bold text-midnight-900 underline-offset-4 hover:underline">
              I found a pet
            </Link>
          </div>
        </div>
        <figure className="lg:flex-[1.5] flex flex-col gap-2.5 md:gap-3.5">
          <div className="rounded-2xl md:rounded-[20px] overflow-hidden bg-midnight-900 shadow-[0_40px_80px_-40px_rgba(15,23,42,0.5)] ring-1 ring-midnight-900/10">
            <img
              src="/landing/mission-control.jpg"
              alt="Mission Control: a live satellite map with the search zone, sighting reports, one-tap flyers, and the team's mission log"
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
          <figcaption className="text-sm md:text-[15px] text-midnight-600 text-center">
            Mission Control, the live map your Rescue Force searches from.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/* --------------------------- Neighbors + force search ---------------------- */

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
    <div className="w-full lg:w-[460px] lg:shrink-0 rounded-[20px] md:rounded-3xl bg-white text-midnight-900 p-[22px] md:p-8">
      <form method="post" onSubmit={go} className="flex flex-col gap-3 md:gap-3.5">
        <label htmlFor="home-force" className={cn(displayFont.className, 'text-[22px] md:text-2xl font-bold tracking-[-0.02em]')}>
          Find your Rescue Force
        </label>
        <p className="text-[15px] leading-normal text-midnight-600">
          Every force covers a real place. Enter your city or ZIP to find yours, or be the
          neighbor who starts it.
        </p>
        <div className="relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-midnight-400" />
          <input
            id="home-force"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City or ZIP"
            autoComplete="postal-code"
            className="w-full h-[52px] md:h-14 rounded-[14px] border border-midnight-300 bg-white pl-11 pr-4 text-base text-midnight-900 placeholder:text-midnight-400 focus:outline-none focus:border-flash-500 focus:ring-4 focus:ring-flash-100"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="h-[52px] md:h-14 rounded-[14px] bg-flash-400 hover:bg-flash-300 disabled:opacity-60 text-midnight-900 text-base md:text-[17px] font-bold transition-colors"
        >
          {searching ? 'Searching…' : 'Find my Rescue Force'}
        </button>
      </form>

      {error && <p className="text-rose-600 text-sm font-semibold mt-4">{error}</p>}

      {results !== null && (
        <div className="mt-4 space-y-2.5">
          {results.length === 0 && (
            <p className="text-midnight-600 text-sm">
              No matches for &ldquo;{query}&rdquo;. Try your city name or a ZIP code.
            </p>
          )}
          {results.map((c) =>
            c.exists && c.squad ? (
              <Link
                key={`${c.city}-${c.state}`}
                href={`/rescue-forces/${c.squad.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-midnight-200 bg-midnight-50 hover:border-flash-400 hover:bg-flash-50 px-4 py-3 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-midnight-900 truncate">{c.squad.name}</span>
                  <span className="block text-midnight-600 text-sm truncate">
                    {c.city}, {c.state} · {c.squad.memberCount} member{c.squad.memberCount !== 1 ? 's' : ''}
                    {c.squad.successfulReunions > 0 && ` · ${c.squad.successfulReunions} reunions`}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-bold shrink-0">
                  View <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ) : (
              <Link
                key={`${c.city}-${c.state}`}
                href={`/rescue-forces?q=${encodeURIComponent(`${c.city}, ${c.state}`)}`}
                className="group flex items-center gap-3 rounded-2xl border-2 border-dashed border-midnight-300 hover:border-flash-400 px-4 py-3 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-midnight-900 truncate">{c.city}, {c.state}</span>
                  <span className="block text-midnight-600 text-sm">No force yet. Be the neighbor who starts it</span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-bold shrink-0">
                  Start it <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            )
          )}
        </div>
      )}

      <Link
        href="/rescue-forces"
        className="mt-2 flex justify-center py-2 text-[15px] font-semibold text-midnight-700 underline underline-offset-4 hover:text-midnight-900"
      >
        Browse all forces
      </Link>
    </div>
  );
}

function Neighbors({ neighbors }) {
  return (
    <section className="bg-midnight-900 text-white py-14 md:py-24">
      <div className="max-w-[1200px] mx-auto px-5 md:px-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-12">
        <div className="lg:flex-1 lg:max-w-[580px] flex flex-col gap-3.5 md:gap-4">
          <p className="text-xs md:text-[13px] font-bold uppercase tracking-[0.12em] text-flash-400">For neighbors</p>
          <h2 className={cn(heading, 'text-[30px] leading-[1.08] md:text-[clamp(32px,3.4vw,48px)] md:leading-[1.05] text-white')}>
            Help find lost pets in your town
          </h2>
          {/* Members are not alerted; they see each report in the force's
              discussion and on their dashboard. */}
          <p className="text-base md:text-lg leading-relaxed text-white/80">
            Join your town&apos;s Rescue Force. Members see each pet reported lost in their area
            and help search for it. Joining costs nothing.
          </p>
          {neighbors && (
            <p className="inline-flex items-center gap-3 mt-1 md:mt-2 text-[15px] md:text-base font-semibold">
              <span className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-flash-400/15 text-flash-400 flex items-center justify-center shrink-0">
                <Users className="w-[18px] h-[18px] md:w-5 md:h-5" />
              </span>
              {neighbors.toLocaleString()} neighbors ready to search
            </p>
          )}
        </div>
        <FindYourForce />
      </div>
    </section>
  );
}

/* ------------------------- Health Book and shelters ----------------------- */

const SHELTER_POINTS = [
  'A full health record for every animal in your care',
  'Strays checked against local lost-pet reports automatically',
  'Adoptions leave with their complete medical history',
  'Staff seats, plus a public page you never have to maintain',
];

function MoreLanes() {
  return (
    <section className="bg-[#F4F6FA] py-12 md:py-24">
      <div className="max-w-[1200px] mx-auto px-5 md:px-6 grid gap-4 md:gap-6 lg:grid-cols-2">
        <article className="flex flex-col bg-white border border-midnight-200 rounded-[22px] md:rounded-[28px] overflow-hidden">
          <div className="flex flex-col gap-2.5 md:gap-3.5 p-6 md:p-10 md:pb-8">
            <p className="text-xs md:text-[13px] font-bold uppercase tracking-[0.12em] text-flash-700">Pet safe at home?</p>
            <h2 className={cn(heading, 'text-[26px] md:text-[34px] leading-[1.1] text-midnight-900')}>
              Keep a free Health Book
            </h2>
            <p className="text-base md:text-[17px] leading-relaxed text-midnight-600">
              Meds with one-tap logging, vaccines, weight, a care team any vet or sitter can read.
              And if the worst day ever comes, this profile becomes the search mission: photos,
              chip, quirks, all ready.
            </p>
            <Link
              href="/care/start"
              className="mt-1.5 md:mt-2 self-stretch sm:self-start inline-flex items-center justify-center gap-2.5 h-[50px] px-[22px] rounded-full bg-midnight-900 hover:bg-midnight-800 text-white font-bold transition-colors"
            >
              Start a free Health Book <ArrowRight className="w-[18px] h-[18px]" />
            </Link>
          </div>
          <div className="mt-auto px-6 md:px-10">
            <img
              src="/landing/health-book-today.jpg"
              alt="A pet's Health Book: today's dose checklist with morning and evening medications, one tap to log each"
              className="block w-full h-[170px] md:h-[250px] object-cover object-top rounded-t-xl md:rounded-t-2xl ring-1 ring-midnight-200"
              loading="lazy"
            />
          </div>
        </article>

        <article className="flex flex-col gap-2.5 md:gap-3.5 p-6 md:p-10 bg-white border border-midnight-200 rounded-[22px] md:rounded-[28px]">
          <p className="text-xs md:text-[13px] font-bold uppercase tracking-[0.12em] text-flash-700">For shelters and rescues</p>
          <h2 className={cn(heading, 'text-[26px] md:text-[34px] leading-[1.1] text-midnight-900')}>
            Run a shelter? All of this is yours too. Free.
          </h2>
          <p className="text-base md:text-[17px] leading-relaxed text-midnight-600">
            Shelter software costs money everywhere else. Here, every animal you manage helps a
            lost pet get found, so shelters get the whole platform for nothing.
          </p>
          <ul className="mt-1.5 md:mt-2 flex flex-col gap-2.5 md:gap-3 text-[15px] md:text-base leading-snug text-midnight-900">
            {SHELTER_POINTS.map((line) => (
              <li key={line} className="flex gap-2.5 md:gap-3">
                <CheckCircle2 className="w-[18px] h-[18px] md:w-5 md:h-5 text-emerald-700 shrink-0 mt-px" />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href="/shelter/start"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 sm:gap-2.5 h-[50px] px-5 sm:px-[22px] rounded-full bg-midnight-900 hover:bg-midnight-800 text-white text-[15px] sm:text-base font-bold whitespace-nowrap transition-colors"
            >
              Get your free shelter account <ArrowRight className="w-[18px] h-[18px]" />
            </Link>
            <Link
              href="/for-shelters"
              className="w-full sm:w-auto text-center py-2.5 font-bold text-midnight-900 underline-offset-4 hover:underline"
            >
              See everything included
            </Link>
          </div>
        </article>
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

    fetch('/api/public/missions?limit=3')
      .then((r) => (r.ok ? r.json() : { cases: [] }))
      .then((d) => setMissions(d.cases || []))
      .catch(() => setMissions([]))
      .finally(() => setMissionsLoading(false));
  }, []);

  const openCount = Number(metrics?.open_cases) || 0;
  const volunteers = Number(metrics?.total_volunteers) || 0;
  const neighbors = volunteers >= 25 ? volunteers : null;

  // The global SiteFooter renders below this page.
  return (
    <main className="bg-white">
      <Hero openCount={openCount} neighbors={neighbors} />
      <MissingNow missions={missions} loading={missionsLoading} openCount={openCount} />
      <HowItWorks />
      <Neighbors neighbors={neighbors} />
      <MoreLanes />
    </main>
  );
}
