/**
 * /care - the daily product's landing page
 *
 * The second door (docs/PRODUCT_IA_PLAN.md §2): pitches the Health
 * Book to people whose pets are safe at home. Never says "lost pet
 * website"; the safety net is the quiet kicker at the bottom.
 * Server component: static, fast, indexable.
 */

import Link from 'next/link';
import { Check, ArrowRight, Users, FileText, Share2 } from 'lucide-react';
import { ShieldIcon } from '@/app/components/icons/HealthIcons';
import { PillGlyph, SparkleGlyph, SyringeGlyph } from '@/app/components/icons/MedGlyphs';
import { WalkIcon } from '@/app/components/icons/CareIcons';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { SARAMA_AVATAR_PNG, SARAMA_NAME } from '@/lib/brandAssets';
import CareGate from './CareGate';

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

// What one tap does the moment a pet goes missing. Each of these is a
// shipped capability: Rescue Forces (geographic volunteer teams) are
// alerted to the mission, flyers are generated from the profile
// (app/api/mission/[id]/flyers/generate), and the case shares to the
// platforms in app/api/missions/[id]/share (Facebook, Nextdoor, X,
// WhatsApp, SMS, email, plus the native share sheet). Instagram has no
// web share-to-feed API, and paid social ads are designed but not yet
// built, so neither is claimed here.
const DEPLOY = [
  { icon: Users, title: 'Your neighborhood, on it', body: 'Your local Rescue Force is alerted the second you report, so people who know the streets are out looking, not just you.' },
  { icon: FileText, title: 'A flyer, already made', body: 'Print-ready and built from the profile you keep every day. No design, no hunting for the right photo.' },
  { icon: Share2, title: 'Posted everywhere at once', body: 'The case goes to Facebook, Nextdoor, and your group chats, each post already carrying the photo and the details.' },
];

// Stats: the lifetime figure is an American Humane Association estimate
// (widely cited; no national lost-pet registry exists). The reunion
// multiplier is peer-reviewed: Lord et al., JAVMA 2009;235(2):160-167
// (DOI 10.2460/javma.235.2.160) found microchipped pets returned to
// owner 2.5x more often (dogs) and 20x (cats) than all strays.

export default function CareLandingPage() {
  return (
    <div className="min-h-screen bg-midnight-50">
     <CareGate>
      {/* Hero: the daily promise, in its OWN register. The midnight theme
          is the rescue product's soul (a light in the shadows, search at
          night); the Health Book is its opposite, warm daylight and home.
          So this is sunlit, not dark. The "worst day" stats section later
          is where the dark rescue world rightly takes back over. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-flash-50 via-amber-50/40 to-midnight-50">
        <style>{`
          @keyframes heartbeat-pulse { 0%, 100% { opacity: .55; } 50% { opacity: .9; } }
          @keyframes care-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
          @keyframes care-pulse { 0%,100% { opacity:.4; transform: scale(1); } 50% { opacity:1; transform: scale(1.35); } }
          @keyframes drift-a { 0%,100% { transform: translate(-50%,0) scale(1); opacity:.8; } 50% { transform: translate(-45%,-30px) scale(1.14); opacity:1; } }
          @keyframes drift-b { 0%,100% { transform: translate(0,0) scale(1); opacity:.6; } 50% { transform: translate(42px,24px) scale(1.2); opacity:.95; } }
          @keyframes drift-c { 0%,100% { transform: translate(0,0) scale(1.06); opacity:.55; } 50% { transform: translate(-34px,-20px) scale(.92); opacity:.9; } }
          @media (prefers-reduced-motion: reduce) { [data-care-anim] { animation: none !important; } }
        `}</style>

        {/* Sunlight, pooling and drifting: warm pools of light that slowly
            breathe across a bright day. Ambient, never a focal point. */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div data-care-anim className="absolute -top-48 left-1/2 w-[62rem] h-[36rem] rounded-full bg-flash-300/40 blur-3xl" style={{ animation: 'drift-a 20s ease-in-out infinite' }} />
          <div data-care-anim className="absolute top-1/4 left-[4%] w-[34rem] h-[24rem] rounded-full bg-amber-200/50 blur-3xl" style={{ animation: 'drift-b 27s ease-in-out infinite' }} />
          <div data-care-anim className="absolute -bottom-28 right-[2%] w-[38rem] h-[26rem] rounded-full bg-emerald-200/45 blur-3xl" style={{ animation: 'drift-c 23s ease-in-out infinite' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
          {/* PLACEHOLDER mascot: reuses the rescue-vest Sarama for now.
              Replace with a warm, health-register Sarama (white vet coat,
              holding a notepad) to match this page's daylight world. */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 scale-125 rounded-full bg-flash-400/25 blur-2xl" aria-hidden="true" />
              <img
                src={SARAMA_AVATAR_PNG}
                alt={SARAMA_NAME}
                className="relative h-24 md:h-28 w-auto drop-shadow-[0_10px_24px_rgba(217,119,6,0.2)]"
              />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight text-midnight-900">
            Your pet&apos;s Health Book.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-flash-500 to-amber-600">Free forever.</span>
          </h1>
          <p className="text-midnight-600 text-lg mt-5 max-w-2xl mx-auto">
            Medications with one-tap logging, vaccine records, weight tracking,
            and a link any vet or sitter can read. No app, no fees, no catch.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-flash-400 hover:bg-flash-500 text-midnight-950 font-bold rounded-2xl shadow-lg shadow-flash-500/25 transition text-lg"
            >
              Start your pet&apos;s book
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-midnight-600 hover:text-midnight-900 font-bold rounded-2xl transition"
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
            <div className="absolute -inset-6 bg-amber-300/25 blur-3xl rounded-[2.5rem]" aria-hidden="true" />
            <div className="relative bg-white rounded-3xl shadow-2xl shadow-amber-900/10 ring-1 ring-midnight-100 p-5">
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
                {/* a contained vitals reading: a solid EKG trace that
                    breathes slowly, a calm sign of life, not a marquee */}
                <svg className="ml-auto shrink-0 hidden sm:block" width="60" height="22" viewBox="0 0 60 22" fill="none" aria-hidden="true">
                  <path
                    data-care-anim
                    d="M0 11 H15 l2 -6 l3 12 l3 -9 l2 3 H32 l2 -6 l3 12 l3 -9 l2 3 H60"
                    stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                    style={{ opacity: 0.7, animation: 'heartbeat-pulse 1.8s ease-in-out infinite' }}
                  />
                </svg>
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

      {/* The four pillars: the everyday product, sold on its own merits.
          THIS is the reason to sign up. The rescue safety net further down
          is a bonus on top, never the pitch. */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 py-14">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-500 mb-3">Every single day</p>
          <h2 className="text-3xl md:text-4xl font-bold text-midnight-900 tracking-tight leading-tight">
            The easiest way to take great care of them.
          </h2>
          <p className="text-midnight-600 text-lg mt-4">
            One free place for all of it, the medical records and the daily joys
            alike. Set it up once and it earns its keep on the ordinary days, not
            just the hard ones.
          </p>
        </div>
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

      {/* The warm climax: the everyday product's emotional payoff. This is
          the bright counterpart to the dark rescue card that follows, and it
          keeps the page's center of gravity on the daily value, not the fear. */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 pb-6">
        <div className="rounded-3xl bg-gradient-to-br from-flash-50 to-amber-100/60 border border-amber-100 p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-midnight-900 tracking-tight leading-tight max-w-2xl mx-auto">
            Most days, it just makes loving them easier.
          </h2>
          <p className="text-midnight-700 text-[15px] md:text-base mt-4 max-w-2xl mx-auto leading-relaxed">
            No more wondering whether the morning pill got given. No digging for
            the vaccine card the night before boarding. No wall of instructions
            texted to the sitter. Just a calm, organized place where all of it
            lives, that you can share in a tap and never pay a cent for.
          </p>
        </div>
      </section>

      {/* The worst day, made concrete. The dark register is the rescue/
          shadow world reaching into the bright page. It is framed as a BONUS
          on top of the everyday value above ("And if..."), not the reason to
          sign up. The pitch is the MECHANIC: time is the whole game, and a
          profile you built on a calm day turns the panic into one tap. */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 pb-16">
        <div className="bg-midnight-950 rounded-3xl p-8 md:p-12">
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.2em] text-flash-400/80 mb-3">
            And if the worst day ever comes
          </p>
          <h2 className="text-white font-bold text-2xl md:text-3xl text-center max-w-2xl mx-auto leading-tight">
            When a pet slips out, the first hour is the whole game.
          </h2>
          <p className="text-midnight-300 text-[15px] mt-5 max-w-2xl mx-auto text-center leading-relaxed">
            About 1 in 3 pets goes missing in their lifetime, and the ones who make it
            home are almost always found fast. The clock is brutal for a simple reason:
            a scared animal keeps moving outward, so every minute you lose multiplies the
            ground you have to cover. Wait twice as long to start and the area to search
            is roughly four times the size, the trail colder, the sightings fewer.
          </p>
          <p className="text-midnight-300 text-[15px] mt-4 max-w-2xl mx-auto text-center leading-relaxed">
            What burns those first minutes is the scramble: hunting for a clear photo,
            the microchip number, the vet records, then building a flyer and working out
            where to post it. Your Health Book already holds every piece of that.
          </p>
          <p className="text-white text-lg font-bold mt-6 text-center">
            So the worst day of pet ownership doesn&apos;t have to begin with a scramble.
            It begins with one tap.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {DEPLOY.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left">
                <span className="w-10 h-10 rounded-xl bg-flash-400/15 text-flash-400 flex items-center justify-center mb-3">
                  <Icon size={20} />
                </span>
                <p className="text-white font-bold text-sm leading-snug">{title}</p>
                <p className="text-midnight-400 text-xs mt-1.5 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <p className="text-midnight-300 text-[15px] mt-8 max-w-2xl mx-auto text-center leading-relaxed">
            That tap puts the search to work while the trail is still warm, minutes in,
            not an hour later. And readiness is what brings them home: pets with a
            registered microchip and current contact details, exactly what your Health
            Book keeps ready, are reunited up to <span className="text-white font-bold">20&times;</span> more often.
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
            Sources: the 1-in-3 lifetime figure is an American Humane Association
            estimate (widely cited; no national lost-pet registry exists). Reunion
            rates are peer-reviewed:{' '}
            <a href="https://doi.org/10.2460/javma.235.2.160" target="_blank" rel="noopener noreferrer" className="underline decoration-midnight-600 hover:text-midnight-300">
              Lord et al., J. Am. Vet. Med. Assoc. 2009;235(2):160-167
            </a>{' '}
            found microchipped pets returned 2.5&times; more often for dogs and 20&times; for cats.
          </p>
        </div>
        <p className="text-center text-xs text-midnight-400 mt-8">
          A record you keep, not medical advice. Your vet&apos;s guidance comes first.
        </p>
      </section>
     </CareGate>
    </div>
  );
}
