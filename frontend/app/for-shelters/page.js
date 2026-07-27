/**
 * The pitch page for shelters and rescues. Server-rendered, zero client JS.
 *
 * STRUCTURE (the page has a spine, not a pile of centered sections):
 *   1. Claim, in one line, over the dark band.
 *   2. Proof: a still of the real portal, overlapping into the page.
 *   3. Order: an animal's path through the building (arrives, in your
 *      care, goes home) as a timeline. That is how shelter staff think,
 *      so it needs no explaining.
 *   4. Price beside the reason for it: one number, one paragraph.
 *   5. The way in.
 *
 * COLOR LAW: midnight + flash only. Flash marks exactly two things on
 * this page: the CTA and the timeline nodes. The one place other hues
 * appear is INSIDE the portal still, where red/amber/green are real
 * product status and reading them as decoration would be a mistake.
 *
 * Copy register: plain (CLAUDE.md). No comma-quip titles, no metaphors,
 * no anthropomorphized product, no icon-badge card grids.
 *
 * PRICING CLAIMS ARE PRESENT TENSE. Never "forever", never
 * "permanently": MONETIZATION.md keeps a paid CRM tier open, and no
 * startup can underwrite eternity (usage costs, edge cases, whatever
 * 2030 looks like). What we promise instead is the thing a shelter
 * director actually fears losing: no card on file, nothing here behind
 * a paywall, and warning before any of that changes.
 */

import Link from 'next/link';
import { Building2, ArrowRight } from 'lucide-react';

/* A hand-built still of the portal's morning screen, matching what
   /my-shelter renders for the demo shelter. */
const PORTAL_NAV = [
  ['Overview', true, null],
  ['Animals', false, null],
  ['Matches', false, 1],
  ['Inquiries', false, 1],
  ['Team', false, null],
  ['Your page', false, null],
];

const PORTAL_ATTENTION = [
  ['bg-rose-500', 'Rufus’s rabies vaccination expired July 7.', 'Health'],
  ['bg-flash-500', 'A lost-pet report may match a stray in your care.', 'Matches'],
  ['bg-flash-500', 'A new adoption inquiry is waiting for a reply.', 'Inbox'],
];

const PORTAL_ROSTER = [
  ['Rufus', 'Boxer mix', 'Adoption pending', 'bg-amber-400', '12d in care'],
  ['Clover', 'Domestic shorthair', 'Available', 'bg-emerald-500', '3d in care'],
];

/* The offering ordered by an animal's path through the shelter. */
const PATH = [
  ['Arrives', [
    'Intake record with photos, weight, and medications.',
    'Checked against local lost-pet reports the same day.',
    'Hold clock starts on your jurisdiction’s schedule.',
  ]],
  ['In your care', [
    'Vaccinations and doses on a schedule your whole team shares.',
    'Each morning the portal lists what needs attention.',
    'Adopters see the animal on your public page.',
  ]],
  ['Goes home', [
    'Reunion: you confirm the match before any owner is contacted.',
    'Adoption: the full medical record moves to the adopter’s account.',
    'Either way the record stays with the animal.',
  ]],
];

const STEPS = [
  ['Apply', 'A few questions about your shelter, your city, and your role. About a minute, no credit card.'],
  ['We review it', 'A person reads every application, usually within a day or two. This is how the directory stays free of fake shelters.'],
  ['Start working', 'Add your animals, invite your team, publish your page.'],
];

export default function ForSheltersPage() {
  return (
    <div className="bg-white">
      {/* 1. The claim */}
      <section className="bg-gradient-to-b from-midnight-950 to-midnight-900 pb-32 pt-16 md:pb-40 md:pt-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-midnight-200">
            <Building2 className="h-4 w-4" /> For shelters and rescues
          </span>
          <h1 className="mb-5 text-4xl font-black tracking-tight text-white md:text-6xl">
            Shelter software that costs nothing
          </h1>
          <p className="mx-auto mb-9 max-w-xl text-lg text-midnight-300 md:text-xl">
            Medical records, lost-pet matching, adoption tools, and a public page.
            ReunitePets is a nonprofit, and shelters use all of it free.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/shelter/start"
              className="inline-flex items-center gap-2.5 rounded-2xl bg-flash-400 px-8 py-4 text-lg font-bold text-midnight-900 shadow-lg shadow-flash-400/25 transition hover:bg-flash-300"
            >
              Get your free account <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/shelters"
              className="rounded-2xl border border-white/20 px-8 py-4 text-lg font-bold text-white transition hover:bg-white/10"
            >
              See the directory
            </Link>
          </div>
        </div>
      </section>

      {/* 2. The proof: the portal, overlapping the band it came out of */}
      <div className="relative z-10 mx-auto -mt-24 max-w-4xl px-4 md:-mt-28" aria-hidden="true">
        <div className="flex overflow-hidden rounded-2xl bg-white shadow-2xl shadow-midnight-950/30 ring-1 ring-midnight-900/10">
          <div className="hidden w-48 shrink-0 flex-col gap-1 bg-midnight-950 p-3 sm:flex">
            <div className="mb-2 flex items-center gap-2 px-2 py-1.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-flash-400">
                <Building2 className="h-4 w-4 text-midnight-900" />
              </span>
              <span className="text-[11px] font-bold leading-tight text-white">Austin Animal Center</span>
            </div>
            {PORTAL_NAV.map(([label, active, badge]) => (
              <span
                key={label}
                className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[12px] font-semibold ${
                  active ? 'bg-flash-400 text-midnight-900' : 'text-midnight-300'
                }`}
              >
                {label}
                {badge ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-flash-400 text-[9px] font-bold text-midnight-900">
                    {badge}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          <div className="flex-1 bg-slate-50 p-4 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-wider text-midnight-400">Monday, July 27</p>
            <p className="mb-4 text-base font-black text-midnight-900">2 animals in care · 1 ready for adoption</p>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-midnight-400">Needs attention</p>
            <div className="mb-4 divide-y divide-midnight-100 rounded-lg border border-midnight-100 bg-white">
              {PORTAL_ATTENTION.map(([dot, text, chip]) => (
                <div key={text} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                  <span className="flex-1 text-[12px] text-midnight-700">{text}</span>
                  <span className="hidden text-[9px] font-bold uppercase tracking-wide text-midnight-400 sm:inline">{chip}</span>
                </div>
              ))}
            </div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-midnight-400">In your care</p>
            <div className="divide-y divide-midnight-100 rounded-lg border border-midnight-100 bg-white">
              {PORTAL_ROSTER.map(([name, breed, status, dot, days]) => (
                <div key={name} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-midnight-100 text-[11px] font-bold text-midnight-500">
                    {name[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold text-midnight-900">{name}</span>
                    <span className="block text-[11px] text-midnight-500">{breed}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-midnight-600">
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    {status}
                  </span>
                  <span className="hidden text-[11px] text-midnight-400 sm:inline">{days}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. The order of the work: an animal's path through the building */}
      <section className="mx-auto max-w-5xl px-4 py-20 md:py-24">
        <h2 className="mb-3 text-3xl font-black tracking-tight text-midnight-900 md:text-4xl">
          What happens to an animal in your care
        </h2>
        <p className="mb-12 max-w-xl text-midnight-600">
          The portal follows the animal, not the paperwork.
        </p>
        <ol className="grid md:grid-cols-3">
          {PATH.map(([stage, lines]) => (
            <li
              key={stage}
              className="relative border-l-2 border-midnight-200 pb-10 pl-6 last:pb-0 md:border-l-0 md:border-t-2 md:pb-0 md:pl-0 md:pr-10 md:pt-8"
            >
              <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-flash-400 ring-4 ring-white md:-top-[7px] md:left-0" />
              <h3 className="mb-4 text-lg font-black text-midnight-900">{stage}</h3>
              <ul className="space-y-2.5">
                {lines.map((line) => (
                  <li key={line} className="text-[15px] leading-relaxed text-midnight-600">
                    {line}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. The price and the reason it is that price, in one band.
          The number needs a companion or the band is a navy void; the
          reason needs the number or it reads as a boast. The claim is
          scoped to SHELTERS and to today: it must stay true on the day
          a paid tier ships elsewhere (MONETIZATION.md). */}
      <section className="bg-midnight-900">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 py-16 md:grid-cols-[auto_1fr] md:gap-16 md:py-20">
          <div className="md:border-r md:border-white/10 md:pr-16">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-midnight-400">
              What shelters pay
            </p>
            <p className="mt-1 flex items-start font-black leading-none text-flash-400">
              <span className="mt-2 text-4xl md:mt-3 md:text-5xl">$</span>
              <span className="text-[6.5rem] tracking-tight md:text-[9rem]">0</span>
            </p>
            <p className="mt-1 text-sm text-midnight-300">No card on file, no trial clock.</p>
          </div>
          <div>
            <h2 className="mb-4 text-2xl font-black tracking-tight text-white md:text-3xl">
              Why is it free?
            </h2>
            <p className="mb-5 leading-relaxed text-midnight-300">
              ReunitePets is a nonprofit that exists to get lost pets home, and lost
              pets end up in shelters. Charging shelters would work against the
              reason we built it.
            </p>
            <ul className="mb-5 space-y-2.5">
              {[
                'No ads on your shelter’s page.',
                'We do not sell your data.',
                'A person reviews every shelter, so the directory stays real.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-midnight-200">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-flash-400" />
                  {line}
                </li>
              ))}
            </ul>
            {/* A commitment we can keep, in place of a promise about
                eternity that we cannot. */}
            <p className="text-sm text-midnight-400">
              If any of that ever changes, you will hear it from us first.
            </p>
          </div>
        </div>
      </section>

      {/* 5. The way in */}
      <section className="mx-auto max-w-4xl px-4 py-20 md:py-24">
        <div>
          <h2 className="mb-10 text-center text-2xl font-black tracking-tight text-midnight-900">
            Getting started
          </h2>
          <ol className="mb-12 grid gap-8 md:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title}>
                <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-midnight-900 text-sm font-black text-flash-400">
                  {i + 1}
                </span>
                <h3 className="mb-1.5 font-bold text-midnight-900">{title}</h3>
                <p className="text-sm leading-relaxed text-midnight-600">{body}</p>
              </li>
            ))}
          </ol>
          <div className="text-center">
            <Link
              href="/shelter/start"
              className="inline-flex items-center gap-2.5 rounded-2xl bg-flash-400 px-8 py-4 text-lg font-bold text-midnight-900 shadow-lg shadow-flash-400/25 transition hover:bg-flash-300"
            >
              Get your free account <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
