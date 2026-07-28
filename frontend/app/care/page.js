/**
 * /care - the daily product's landing page
 *
 * The second door (docs/PRODUCT_IA_PLAN.md §2): pitches the care product
 * to people whose pets are safe at home. Never says "lost pet website";
 * the safety net is the quiet section near the bottom. Server component:
 * static, fast, indexable.
 */

import Link from 'next/link';
import { Check, ArrowRight, Pill, Syringe, LineChart, Share2, Users, FileText } from 'lucide-react';
import CareGate from './CareGate';

const FEATURES = [
  {
    icon: Pill,
    title: 'Medications, one tap each',
    body: 'Set the schedule once. Check off doses in a second, and get warned before refills run out.',
  },
  {
    icon: Syringe,
    title: 'Vaccine and health records',
    body: 'Vaccines with expiry reminders, weight over time, conditions, and your vet, in one record you own.',
  },
  {
    icon: LineChart,
    title: 'Daily routines too',
    body: 'Walks, brushing, treats, and playtime the whole family can see and check off.',
  },
  {
    icon: Share2,
    title: 'One link for any vet or sitter',
    body: 'Hand off a read-only link with the schedule, the record, and the vet contact. No account needed.',
  },
];

// What one tap does the moment a pet goes missing. Each is a shipped
// capability: Rescue Forces are alerted, flyers are generated from the
// profile, and the case shares to Facebook, Nextdoor, and group chats.
const DEPLOY = [
  { icon: Users, title: 'Your neighborhood, on it', body: 'Your local Rescue Force is alerted the second you report, so people who know the streets are out looking, not just you.' },
  { icon: FileText, title: 'A flyer, already made', body: 'Print ready and built from the profile you keep every day. No design, no hunting for the right photo.' },
  { icon: Share2, title: 'Posted everywhere at once', body: 'The case goes to Facebook, Nextdoor, and your group chats, each post already carrying the photo and the details.' },
];

/* The hero's centerpiece: a small honest mock of the Today list, drawn
   in the same plain style as the real product. */
function TodayMock() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white text-left overflow-hidden">
      <div className="px-5 py-3 border-b border-neutral-100">
        <p className="text-[13px] font-medium text-neutral-500">Today</p>
      </div>
      <div className="px-5 divide-y divide-neutral-100">
        <div className="flex items-center gap-3 py-3">
          <span className="w-14 shrink-0 text-[13px] text-neutral-500 tabular-nums">8:00 AM</span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-neutral-400">Apoquel <span className="font-normal">16 mg</span></p>
          </div>
          <span className="inline-flex items-center gap-1 text-[13px] text-emerald-600"><Check size={15} /> 8:02 AM</span>
        </div>
        <div className="flex items-center gap-3 py-3">
          <span className="w-14 shrink-0 text-[13px] text-neutral-500 tabular-nums">8:00 PM</span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-neutral-900">Apoquel <span className="font-normal text-neutral-400">16 mg</span></p>
          </div>
          <span className="rounded-full bg-care-teal text-white text-sm font-medium px-4 py-1.5">Give</span>
        </div>
        <div className="flex items-center gap-3 py-3">
          <span className="w-14 shrink-0 text-[13px] text-neutral-500 tabular-nums">Walk</span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-neutral-900">Evening walk</p>
          </div>
          <span className="rounded-full border border-neutral-300 text-sm font-medium text-neutral-700 px-3 py-1">6:00 PM</span>
        </div>
      </div>
    </div>
  );
}

export default function CareLandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
     <CareGate>
      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-900 text-balance">
          Never miss a dose.
        </h1>
        <p className="text-lg text-neutral-500 mt-5 max-w-xl mx-auto">
          Track medications, vaccines, and weight in one place, and share it with any vet or sitter. Free, no card.
        </p>
        <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
          <Link
            href="/care/start"
            className="inline-flex items-center gap-2 rounded-full bg-care-teal text-white text-sm font-medium px-6 py-3 hover:bg-care-tealDark transition-colors"
          >
            Start free <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
            Sign in
          </Link>
        </div>
        <p className="text-[13px] text-neutral-400 mt-6">Free to use. Takes a minute. Works on any phone.</p>

        <div className="mt-12 max-w-md mx-auto">
          <TodayMock />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 pb-16">
        <div className="divide-y divide-neutral-100">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-4 py-5">
              <span className="w-9 h-9 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center shrink-0" aria-hidden="true">
                <Icon size={18} />
              </span>
              <div>
                <h3 className="text-[15px] font-medium text-neutral-900">{title}</h3>
                <p className="text-[15px] text-neutral-500 mt-0.5">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The worst day. The dark section is the one place the rescue world
          reaches into the page: framed as a bonus on top, not the pitch. */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
        <div className="bg-midnight-950 rounded-2xl p-8 md:p-12">
          <p className="text-center text-[13px] font-medium text-flash-400 mb-3">If the worst day ever comes</p>
          <h2 className="text-white text-2xl md:text-3xl font-semibold tracking-tight text-center max-w-2xl mx-auto text-balance">
            When a pet slips out, the first hour is the whole game.
          </h2>
          <p className="text-midnight-300 text-[15px] mt-5 max-w-2xl mx-auto text-center leading-relaxed">
            About 1 in 3 pets goes missing in their lifetime, and the ones who make it home are almost
            always found fast. A scared animal keeps moving, so every minute lost multiplies the ground
            you have to cover. What burns those minutes is the scramble: hunting for a clear photo, the
            microchip number, the vet records. Your record already holds every piece of that.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {DEPLOY.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white/5 rounded-xl p-5 text-left">
                <span className="w-10 h-10 rounded-full bg-flash-400/15 text-flash-400 flex items-center justify-center mb-3">
                  <Icon size={20} />
                </span>
                <p className="text-white font-medium text-sm">{title}</p>
                <p className="text-midnight-400 text-[13px] mt-1.5 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <p className="text-midnight-300 text-[15px] mt-8 max-w-2xl mx-auto text-center leading-relaxed">
            Pets with a registered microchip and current contact details, exactly what your record keeps
            ready, are reunited up to <span className="text-white font-semibold">20 times</span> more often.
          </p>

          <div className="flex justify-center mt-7">
            <Link
              href="/care/start"
              className="inline-flex items-center gap-2 rounded-full bg-flash-400 hover:bg-flash-300 text-midnight-950 font-medium px-6 py-3 transition-colors"
            >
              Start free <ArrowRight size={16} />
            </Link>
          </div>

          <p className="text-center text-[12px] text-midnight-500 mt-6 max-w-2xl mx-auto leading-relaxed">
            Sources: the 1-in-3 lifetime figure is an American Humane Association estimate. Reunion rates
            are peer-reviewed:{' '}
            <a href="https://doi.org/10.2460/javma.235.2.160" target="_blank" rel="noopener noreferrer" className="underline hover:text-midnight-300">
              Lord et al., J. Am. Vet. Med. Assoc. 2009;235(2):160 to 167
            </a>{' '}
            found microchipped pets returned 2.5 times more often for dogs and 20 times for cats.
          </p>
        </div>
        <p className="text-center text-[13px] text-neutral-400 mt-8">
          A record you keep, not medical advice. Your vet's guidance comes first.
        </p>
      </section>
     </CareGate>
    </div>
  );
}
