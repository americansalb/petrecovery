/**
 * The pitch page for shelters and rescues: what the free account is,
 * why it exists, and one path in (/shelter/start). Server-rendered,
 * zero client JS.
 *
 * Nobody reads feature prose. The pitch is carried by a still of the
 * actual portal and a list you can scan in seconds; sentences are spent
 * only where trust demands them (matching confirms before any owner is
 * contacted). Copy register: plain (CLAUDE.md "Site copy is written
 * plain"). No comma-quip titles, no metaphors, no anthropomorphized
 * product, no icon-badge card grids.
 */

import Link from 'next/link';
import { Building2, ArrowRight, CheckCircle2 } from 'lucide-react';

/* A hand-built still of the portal's morning screen, matching what
   /my-shelter actually renders for the demo shelter. */
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

/* The offering as the one pricing table this product will ever need:
   every line item costs nothing, and the total is the strategy. */
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
  ['Apply', 'A few questions about your shelter, your city, and your role. Takes about a minute. No credit card.'],
  ['We review it', 'A person reads every application, usually within a day or two. This is how the directory stays free of fake shelters.'],
  ['Start working', 'Add your animals, invite your team, publish your page.'],
];

export default function ForSheltersPage() {
  return (
    <div className="bg-midnight-50 min-h-screen">
      {/* Hero: the claim, one sentence, and the product itself */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0a1526] via-midnight-900 to-[#0c1a30]">
        <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-20 text-center">
          <span className="inline-flex items-center gap-2 bg-flash-400/10 text-flash-200 px-4 py-2 rounded-full border border-flash-400/25 text-sm font-medium mb-6">
            <Building2 className="w-4 h-4" /> For shelters and rescues
          </span>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-5">
            Shelter software that costs <span className="text-flash-400">nothing. Forever.</span>
          </h1>
          <p className="text-lg md:text-xl text-midnight-200 max-w-2xl mx-auto mb-9">
            Animal records, lost-pet matching, adoption tools, and a public page.
            No credit card and no trial: ReunitePets is a nonprofit.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/shelter/start"
              className="inline-flex items-center gap-2.5 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold text-lg px-8 py-4 rounded-2xl shadow-lg shadow-flash-400/25 transition-all hover:scale-[1.02]"
            >
              Get your free account <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/shelters"
              className="inline-flex items-center gap-2.5 bg-[#FFF9EE] hover:bg-white text-midnight-900 font-bold text-lg px-8 py-4 rounded-2xl shadow-lg shadow-black/20 transition-all hover:scale-[1.02]"
            >
              See shelter pages
            </Link>
          </div>

          {/* The portal, as a shelter's morning starts */}
          <div className="mt-14 max-w-3xl mx-auto" aria-hidden="true">
            <div className="flex rounded-2xl overflow-hidden bg-white text-left shadow-2xl shadow-black/40 ring-1 ring-white/10">
              <div className="hidden sm:flex w-44 shrink-0 flex-col gap-1 bg-midnight-950 p-3">
                <div className="mb-1 flex items-center gap-2 px-2 py-1.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-flash-400">
                    <Building2 className="h-4 w-4 text-midnight-900" />
                  </span>
                  <span className="text-[11px] font-bold leading-tight text-white">Austin Animal Center</span>
                </div>
                {PORTAL_NAV.map(([label, active, badge]) => (
                  <span
                    key={label}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
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
              <div className="flex-1 bg-slate-50 p-4 sm:p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-midnight-400">Monday, July 27</p>
                <p className="mb-3 text-sm font-black text-midnight-900">2 animals in care · 1 ready for adoption</p>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-midnight-400">Needs attention</p>
                <div className="mb-3 divide-y divide-midnight-100 rounded-lg border border-midnight-100 bg-white">
                  {PORTAL_ATTENTION.map(([dot, text, chip]) => (
                    <div key={text} className="flex items-center gap-2.5 px-3 py-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                      <span className="flex-1 text-[11px] text-midnight-700">{text}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wide text-midnight-400">{chip}</span>
                    </div>
                  ))}
                </div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-midnight-400">In your care</p>
                <div className="divide-y divide-midnight-100 rounded-lg border border-midnight-100 bg-white">
                  {PORTAL_ROSTER.map(([name, breed, status, dot, days]) => (
                    <div key={name} className="flex items-center gap-2.5 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-midnight-100 text-[10px] font-bold text-midnight-500">
                        {name[0]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold text-midnight-900">{name}</span>
                        <span className="block text-[10px] text-midnight-500">{breed}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-midnight-600">
                        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                        {status}
                      </span>
                      <span className="text-[10px] text-midnight-400">{days}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The offering, priced: an itemized bill where the total is the
          strategy. The receipt promises that everything ON it is free;
          it deliberately says nothing about what may be sold beside it
          later (MONETIZATION.md keeps a paid CRM tier open). */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:py-20">
        <h2 className="mb-10 text-center text-3xl font-black text-midnight-900 md:text-4xl">
          What it costs
        </h2>
        <div className="mx-auto max-w-xl rounded-2xl border border-midnight-200 bg-white px-6 py-7 sm:px-10 sm:py-9 shadow-card">
          <ul>
            {PRICE_LIST.map((label) => (
              <li key={label} className="flex items-baseline gap-3 py-2">
                <span className="font-medium text-midnight-800">{label}</span>
                <span className="relative -top-1 flex-1 border-b-2 border-dotted border-midnight-200" aria-hidden="true" />
                <span className="font-semibold tabular-nums text-midnight-400">$0</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-baseline gap-3 border-t-2 border-midnight-900 pt-4">
            <span className="text-lg font-black text-midnight-900">Total, forever</span>
            <span className="flex-1" aria-hidden="true" />
            <span className="text-2xl font-black tabular-nums text-midnight-900">$0</span>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-midnight-500">
          The only fine print: matching never contacts an owner until your staff
          confirms the match.
        </p>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-midnight-100">
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <h2 className="text-3xl font-black text-midnight-900 text-center mb-12">
            Getting started
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map(([title, body], i) => (
              <div key={title} className="text-center">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-midnight-900 text-flash-400 font-black text-lg mb-4">
                  {i + 1}
                </span>
                <h3 className="font-bold text-midnight-900 mb-2">{title}</h3>
                <p className="text-sm text-midnight-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why free */}
      <section className="max-w-3xl mx-auto px-4 py-16 md:py-20 text-center">
        <h2 className="text-3xl font-black text-midnight-900 mb-4">Why is it free?</h2>
        <p className="text-midnight-700 leading-relaxed mb-4">
          ReunitePets exists to get lost pets home, and lost pets end up in
          shelters. Every shelter working here means more strays checked against
          lost-pet reports. Charging for that would work against the mission.
        </p>
        <ul className="inline-flex flex-col items-start gap-2 text-midnight-700 mb-9">
          {['Everything above stays free, permanently', 'No ads on your page, no selling your data', 'A human reviews every shelter, so the directory stays trustworthy'].map((line) => (
            <li key={line} className="inline-flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> {line}
            </li>
          ))}
        </ul>
        <div>
          <Link
            href="/shelter/start"
            className="inline-flex items-center gap-2.5 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold text-lg px-8 py-4 rounded-2xl shadow-lg shadow-flash-400/25 transition-all hover:scale-[1.02]"
          >
            Start your application <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
