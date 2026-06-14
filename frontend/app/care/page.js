/**
 * /care - the daily product's landing page
 *
 * The second door (docs/PRODUCT_IA_PLAN.md §2): pitches the Health
 * Book to people whose pets are safe at home. Never says "lost pet
 * website"; the safety net is the quiet kicker at the bottom.
 * Server component: static, fast, indexable.
 */

import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { ShieldIcon } from '@/app/components/icons/HealthIcons';
import { PillGlyph, SparkleGlyph, SyringeGlyph } from '@/app/components/icons/MedGlyphs';
import { WalkIcon } from '@/app/components/icons/CareIcons';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import MembersBanner from './MembersBanner';

const FEATURES = [
  {
    icon: PillGlyph,
    tint: 'bg-amber-100 text-amber-700',
    title: 'Medications, one tap each',
    body: 'Set the schedule once. Check off doses in a second, see the week fill in, get warned before refills run out.',
  },
  {
    icon: ShieldIcon,
    tint: 'bg-emerald-100 text-emerald-700',
    title: 'The Health Book',
    body: 'Vaccine stamps with expiry reminders, weight over time, conditions, and your vet, all in one record you own.',
  },
  {
    icon: WalkIcon,
    tint: 'bg-sky-100 text-sky-700',
    title: 'The good stuff too',
    body: 'Walks, brushing, treats, playtime. Daily routines the whole family can see and share.',
  },
  {
    icon: SparkleGlyph,
    tint: 'bg-violet-100 text-violet-700',
    title: 'One link for any vet or sitter',
    body: 'Hand a read-only link to whoever cares for your pet. The schedule, the record, the vet contact. No account needed.',
  },
];

const STEPS = [
  ['Add your pet', 'Name, photo, and the basics. About a minute.'],
  ['Set it up once', 'Meds, routines, vaccines. Snap a label, tap a chip.'],
  ['Use it forever', 'One tap a day. Share it with family. Free, always.'],
];

// Every figure below is from peer-reviewed primary research, verified
// against the papers and cited on the page (DOIs linked). No folklore
// stats: the common "1 in 3 / 10M a year" numbers lack a primary source
// and were dropped for these.
//   - Weiss, Slater & Lord, Animals 2012;2(2):301-315 (DOI 10.3390/ani2020301):
//     14% of dogs / 15% of cats lost within 5 years; 93% vs 75% recovered;
//     56% of lost cats had no ID.
//   - Lord, Ingwersen, Gray & Wintz, JAVMA 2009;235(2):160-167
//     (DOI 10.2460/javma.235.2.160): microchipped pets returned to owner
//     2.5x more often (dogs) and 20x more often (cats) than all strays.
const LOSS_STATS = [
  { big: '1 in 7', label: 'dogs and cats go missing within just five years' },
  { big: '56%', label: 'of lost cats have no ID at all' },
  { big: 'Up to 20×', label: 'more likely to come home when their ID is on file' },
];

export default function CareLandingPage() {
  return (
    <div className="min-h-screen bg-midnight-50">
      <MembersBanner />
      {/* Hero: the daily promise, given the homepage's atmosphere. The
          Health Book's signature is a heartbeat tracing across the night,
          the calm-day counterpart to the homepage's GPS search trail. */}
      <section className="relative bg-midnight-950 text-white overflow-hidden">
        <style>{`
          @keyframes heartbeat-march { to { stroke-dashoffset: -340; } }
          @keyframes care-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
          @keyframes care-pulse { 0%,100% { opacity:.35; transform: scale(1); } 50% { opacity:.9; transform: scale(1.35); } }
        `}</style>

        {/* warm hearth glow + soft ambient motes */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[64rem] h-[36rem] rounded-full bg-flash-400/12 blur-3xl" />
          <div className="absolute top-1/3 left-[20%] w-[30rem] h-[20rem] rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="absolute top-16 left-[14%] w-1 h-1 rounded-full bg-white/60" />
          <div className="absolute top-28 right-[20%] w-1 h-1 rounded-full bg-white/40" />
          <div className="absolute top-48 left-[30%] w-0.5 h-0.5 rounded-full bg-white/50" />
          <div className="absolute bottom-40 right-[28%] w-1 h-1 rounded-full bg-flash-300/40" />
          <div className="absolute bottom-56 left-[22%] w-0.5 h-0.5 rounded-full bg-white/40" />
        </div>

        {/* the heartbeat trace: a faint ECG line marching across, with a
            bright pulse traveling its length */}
        <svg
          className="absolute inset-x-0 top-[42%] w-full h-40 pointer-events-none hidden sm:block"
          viewBox="0 0 1440 200"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path
            d="M -40 110 H 250 l 18 -14 l 14 14 l 22 0 l 10 16 l 12 -120 l 12 138 l 10 -34 H 620 l 18 -14 l 14 14 l 22 0 l 10 16 l 12 -120 l 12 138 l 10 -34 H 1000 l 18 -14 l 14 14 l 22 0 l 10 16 l 12 -120 l 12 138 l 10 -34 H 1480"
            fill="none"
            stroke="#34d399"
            strokeOpacity="0.35"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 12"
            style={{ animation: 'heartbeat-march 5s linear infinite' }}
          />
        </svg>

        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
          <div className="flex items-center justify-center gap-2 mb-6" aria-hidden="true">
            {['DOG', 'CAT', 'BIRD', 'RABBIT'].map((s) => (
              <span key={s} className="w-10 h-10 rounded-2xl bg-white/10 ring-1 ring-white/10 flex items-center justify-center text-flash-400">
                <SpeciesIcon species={s} size={22} />
              </span>
            ))}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            Your pet&apos;s Health Book.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-flash-300 via-flash-400 to-flash-500">Free forever.</span>
          </h1>
          <p className="text-midnight-300 text-lg mt-5 max-w-2xl mx-auto">
            Medications with one-tap logging, vaccine records, weight tracking,
            and a link any vet or sitter can read. No app, no fees, no catch.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-flash-400 hover:bg-flash-300 text-midnight-950 font-bold rounded-2xl transition text-lg"
            >
              Start your pet&apos;s book
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-midnight-200 hover:text-white font-bold rounded-2xl transition"
            >
              Sign in
            </Link>
          </div>
          <p className="text-midnight-400 text-sm mt-5">
            <Check size={13} className="inline -mt-0.5" /> Always free
            <span className="mx-2">·</span>
            <Check size={13} className="inline -mt-0.5" /> Takes a minute
            <span className="mx-2">·</span>
            <Check size={13} className="inline -mt-0.5" /> Works on any phone
          </p>

          {/* Show the product, not just describe it: a real Health Book,
              glowing on the dark hero, is the page's centerpiece */}
          <div className="relative mt-14 max-w-md mx-auto text-left" style={{ animation: 'care-float 6s ease-in-out infinite' }}>
            <div className="absolute -inset-5 bg-flash-400/15 blur-3xl rounded-[2.5rem]" aria-hidden="true" />
            <div className="relative bg-white rounded-3xl shadow-2xl shadow-black/50 ring-1 ring-white/10 p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-11 h-11 rounded-2xl bg-amber-400 flex items-center justify-center shrink-0">
                    <SpeciesIcon species="DOG" size={22} className="text-white" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-midnight-900 leading-tight truncate">Max&apos;s Health Book</p>
                    <p className="text-xs text-midnight-400">Golden Retriever · 65 lb</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: 'care-pulse 2.2s ease-in-out infinite' }} />
                  Home
                </span>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 px-4 py-3 mb-4">
                <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <ShieldIcon size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-midnight-900 leading-tight">Max is doing well.</p>
                  <p className="text-xs text-midnight-500">Vaccines current · checkup in 3 weeks</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {[
                  { name: 'Rabies', tag: 'OK', tint: 'bg-emerald-100 text-emerald-700' },
                  { name: 'DHPP', tag: 'OK', tint: 'bg-emerald-100 text-emerald-700' },
                  { name: 'Bordetella', tag: 'SOON', tint: 'bg-amber-100 text-amber-700' },
                ].map(({ name, tag, tint }) => (
                  <div key={name} className="relative rounded-2xl border-2 border-midnight-100 px-2 py-3 flex flex-col items-center gap-1.5 text-center">
                    <span className={`absolute -top-2 right-2 text-[8px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${tint}`}>{tag}</span>
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tint}`}><SyringeGlyph size={18} /></span>
                    <span className="text-[11px] font-bold text-midnight-900 leading-none">{name}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-flash-50 border border-flash-200 px-2.5 py-1.5">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center"><PillGlyph size={14} /></span>
                  <span className="text-[11px] font-bold text-midnight-700">Apoquel</span>
                  <Check size={12} className="text-emerald-500" strokeWidth={3} />
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-2.5 py-1.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center"><WalkIcon size={14} /></span>
                  <span className="text-[11px] font-bold text-midnight-700">Walk</span>
                  <Check size={12} className="text-emerald-500" strokeWidth={3} />
                </span>
                <span className="ml-auto text-[11px] font-semibold text-midnight-300">today</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The four pillars */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, tint, title, body }) => (
            <div key={title} className="bg-white border border-midnight-100 rounded-3xl p-6 transition-all hover:shadow-lg hover:shadow-midnight-200/50 hover:-translate-y-0.5">
              <span className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tint}`}>
                <Icon size={26} />
              </span>
              <h2 className="font-bold text-midnight-900 mt-4 text-lg">{title}</h2>
              <p className="text-sm text-midnight-500 mt-1.5 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 pb-14">
        <div className="bg-white border border-midnight-100 rounded-3xl p-8">
          <h2 className="font-bold text-midnight-900 text-xl text-center mb-8">Set up once, use it forever</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map(([title, body], i) => (
              <div key={title} className="text-center">
                <span className="w-9 h-9 rounded-full bg-flash-100 text-flash-700 font-bold flex items-center justify-center mx-auto">
                  {i + 1}
                </span>
                <h3 className="font-bold text-midnight-900 mt-3">{title}</h3>
                <p className="text-sm text-midnight-500 mt-1">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The safety net, made concrete with real numbers. Kept at the
          bottom so the daily promise stays the headline (PRODUCT_IA_PLAN). */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 pb-16">
        <div className="bg-midnight-950 rounded-3xl p-8 md:p-12">
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.2em] text-flash-400/80 mb-3">
            If the worst day ever comes
          </p>
          <h2 className="text-white font-bold text-2xl md:text-3xl text-center max-w-2xl mx-auto leading-tight">
            Pets go missing more often than you think. The prepared ones come home.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {LOSS_STATS.map(({ big, label }) => (
              <div key={big} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                <p className="text-flash-400 font-extrabold text-3xl tracking-tight">{big}</p>
                <p className="text-midnight-300 text-sm mt-1.5 leading-snug">{label}</p>
              </div>
            ))}
          </div>

          <p className="text-midnight-300 text-[15px] mt-8 max-w-2xl mx-auto text-center leading-relaxed">
            What decides whether a pet comes home is almost always identification,
            and that is exactly what panic erases. Your Health Book keeps the
            microchip number, a flyer-ready photo, the description, and behavior
            notes like &ldquo;friendly, does not bolt&rdquo; ready, so the moment your
            pet slips out it deploys as the search party&apos;s brief in one tap, with
            your neighborhood&apos;s Rescue Force already behind you.
          </p>

          <div className="flex justify-center mt-7">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-flash-400 hover:bg-flash-300 text-midnight-950 font-bold rounded-2xl transition text-lg"
            >
              Start a free Health Book
              <ArrowRight size={18} />
            </Link>
          </div>

          <p className="text-center text-[11px] text-midnight-500 mt-6 max-w-2xl mx-auto leading-relaxed">
            Sources:{' '}
            <a href="https://doi.org/10.3390/ani2020301" target="_blank" rel="noopener noreferrer" className="underline decoration-midnight-600 hover:text-midnight-300">
              Weiss, Slater &amp; Lord, Animals 2012;2(2):301-315
            </a>{' '}
            (14% of dogs and 15% of cats lost within five years; 56% of lost cats had no ID) and{' '}
            <a href="https://doi.org/10.2460/javma.235.2.160" target="_blank" rel="noopener noreferrer" className="underline decoration-midnight-600 hover:text-midnight-300">
              Lord et al., J. Am. Vet. Med. Assoc. 2009;235(2):160-167
            </a>{' '}
            (microchipped pets returned 2.5&times; more often for dogs, 20&times; for cats).
          </p>
        </div>
        <p className="text-center text-xs text-midnight-400 mt-8">
          A record you keep, not medical advice. Your vet&apos;s guidance comes first.
        </p>
      </section>
    </div>
  );
}
