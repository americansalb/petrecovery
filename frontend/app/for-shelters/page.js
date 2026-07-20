/**
 * The pitch page for shelters and rescues: what the free account is,
 * why it exists, and one path in (/shelter/start). Server-rendered,
 * zero client JS. The tone matches the homepage: midnight hero, flash
 * CTAs, plain claims, no dark patterns, and the price is the point.
 */

import Link from 'next/link';
import {
  Building2, HeartPulse, Radar, HeartHandshake, Users, Globe2,
  ArrowRight, CheckCircle2, Sparkles,
} from 'lucide-react';

const FEATURES = [
  {
    icon: HeartPulse,
    title: 'A Health Book for every animal',
    body: 'Medications with dose schedules, vaccination records, weight tracking, photos, and shareable care pages, for every animal in your care.',
  },
  {
    icon: Radar,
    title: 'Strays matched against lost reports',
    body: 'Log a stray and we quietly check it against local lost-pet reports, photos included. You review the match side by side; the owner is only contacted after you confirm.',
  },
  {
    icon: HeartHandshake,
    title: 'Adoptions that keep the history',
    body: 'Send the full record home with the adopter in one click. Vaccines, meds, weights: everything arrives in their account, nothing gets lost in a paper folder.',
  },
  {
    icon: Users,
    title: 'Seats for your whole team',
    body: 'Invite staff and volunteers by email. Everyone works the same roster with the same records. Revoke access anytime.',
  },
  {
    icon: Globe2,
    title: 'Your own page, no website needed',
    body: 'A clean public page with your adoptable animals, hours, and contact info. Edit five fields from your dashboard; we handle the rest, and it ranks on Google.',
  },
  {
    icon: Sparkles,
    title: 'Part of a rescue network',
    body: 'Lost-pet reports, volunteer Rescue Forces, and community alerts already run here. Your shelter plugs into a neighborhood that is actively looking.',
  },
];

const STEPS = [
  ['Apply in about a minute', 'A few questions: your shelter, your city, your role. No card, no trial clock.'],
  ['A human says hello', 'We review every shelter by hand, usually within a day or two, so the directory stays real.'],
  ['Run your shelter', 'Add animals, invite your team, publish your page. If it ever stops being useful, export nothing, cancel nothing. It is just free.'],
];

export default function ForSheltersPage() {
  return (
    <div className="bg-midnight-50 min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0a1526] via-midnight-900 to-[#0c1a30]">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[720px] h-[720px] bg-flash-400/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 py-20 md:py-28 text-center">
          <span className="inline-flex items-center gap-2 bg-flash-400/10 text-flash-200 px-4 py-2 rounded-full border border-flash-400/25 text-sm font-medium mb-6">
            <Building2 className="w-4 h-4" /> For shelters and rescues
          </span>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-5">
            Shelter software that costs{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-flash-300 via-flash-400 to-amber-300 drop-shadow-[0_0_24px_rgba(250,204,21,0.35)]">
              nothing. Forever.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-midnight-200 max-w-2xl mx-auto mb-9">
            Manage every animal&rsquo;s health record, match strays against local
            lost-pet reports, send adoptions home with their full history, and get a
            public page your shelter never has to maintain.
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
          <p className="text-midnight-400 text-sm mt-6">
            No card. No trial. No &ldquo;free tier&rdquo;. A nonprofit built this for you.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-16 md:py-20">
        <h2 className="text-3xl md:text-4xl font-black text-midnight-900 text-center mb-3">
          Everything a shelter actually needs
        </h2>
        <p className="text-midnight-600 text-center max-w-2xl mx-auto mb-12">
          Built with shelters, not sold to them. Every feature exists because it
          reunites more pets or saves your staff time.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-midnight-100 bg-white shadow-sm p-6">
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-flash-50 border border-flash-200 mb-4">
                <Icon className="w-5 h-5 text-flash-600" />
              </span>
              <h3 className="font-bold text-midnight-900 mb-2">{title}</h3>
              <p className="text-sm text-midnight-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-midnight-100">
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <h2 className="text-3xl font-black text-midnight-900 text-center mb-12">
            Three steps, one of them ours
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
          ReunitePets exists to get lost pets home. Every animal a shelter manages here
          is one more animal that gets matched against lost-pet reports the moment it
          arrives, and one more adopter who walks out with a complete medical history
          instead of a folder. Your shelter using this <strong>is</strong> the mission.
        </p>
        <ul className="inline-flex flex-col items-start gap-2 text-midnight-700 mb-9">
          {['No cost, ever, for shelters and rescues', 'No ads on your page, no selling your data', 'A human reviews every shelter, so the directory stays trustworthy'].map((line) => (
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
