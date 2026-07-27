/**
 * The pitch page for shelters and rescues. Server-rendered, zero client JS.
 *
 * STRUCTURE (the page has a spine, not a pile of centered sections):
 *   1. Claim, in one line, over the dark band.
 *   2. Proof: a still of the real portal, overlapping into the page.
 *   3. Order: an animal's path through the building (arrives, in your
 *      care, goes home) as a timeline. That is how shelter staff think,
 *      so it needs no explaining.
 *   4. Price: the whole offering as an itemized bill totalling $0.
 *   5. Reason and the way in.
 *
 * COLOR LAW: midnight + flash only. Flash marks exactly two things on
 * this page: the CTA and the timeline nodes. The one place other hues
 * appear is INSIDE the portal still, where red/amber/green are real
 * product status and reading them as decoration would be a mistake.
 *
 * Copy register: plain (CLAUDE.md). No comma-quip titles, no metaphors,
 * no anthropomorphized product, no icon-badge card grids, no promise
 * that a paid tier will never exist (MONETIZATION.md keeps one open;
 * what is permanent is that everything on the bill stays free).
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

/* The one pricing table this product needs. */
const PRICE_LIST = [
  'Medical records for every animal',
  'Lost-pet matching on every stray',
  'Stray hold tracking',
  'Full-record transfer to adopters',
  'Adoption inquiry inbox',
  'Staff and volunteer accounts',
  'A public shelter page',
  'A listing in the shelter directory',
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

      {/* 4. The price, as the bill it replaces */}
      <section className="bg-midnight-900 py-20 md:py-24">
        <div className="mx-auto max-w-xl px-4">
          <h2 className="mb-10 text-center text-3xl font-black tracking-tight text-white md:text-4xl">
            What it costs
          </h2>
          <div className="rounded-2xl bg-[#FFFDF6] px-6 py-8 shadow-2xl shadow-black/30 sm:px-10">
            <ul>
              {PRICE_LIST.map((label) => (
                <li key={label} className="flex items-baseline gap-3 py-2">
                  <span className="font-medium text-midnight-800">{label}</span>
                  <span className="relative -top-1 flex-1 border-b border-dotted border-midnight-300" />
                  <span className="font-semibold tabular-nums text-midnight-500">$0</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-baseline gap-3 border-t-2 border-midnight-900 pt-5">
              <span className="text-lg font-black text-midnight-900">Total, forever</span>
              <span className="flex-1" />
              <span className="text-3xl font-black tabular-nums text-midnight-900">$0</span>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-midnight-400">
            Everything on this list stays free for shelters and rescues, permanently.
          </p>
        </div>
      </section>

      {/* 5. The reason and the way in */}
      <section className="mx-auto max-w-4xl px-4 py-20 md:py-24">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-3xl font-black tracking-tight text-midnight-900">Why is it free?</h2>
          <p className="mb-6 leading-relaxed text-midnight-700">
            ReunitePets is a nonprofit that exists to get lost pets home, and lost
            pets end up in shelters. Every shelter working here means more strays
            checked against lost-pet reports the day they arrive. Charging for that
            would work against the reason we built it.
          </p>
          <ul className="space-y-2.5">
            {[
              'No ads on your shelter’s page.',
              'We do not sell your data.',
              'A person reviews every shelter, so the directory stays real.',
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 text-midnight-700">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-flash-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-16 border-t border-midnight-200 pt-12">
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
