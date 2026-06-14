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
import { PillGlyph, SparkleGlyph } from '@/app/components/icons/MedGlyphs';
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

// Real, attributed figures. American Humane's lifetime/annual loss numbers
// and the JAVMA microchip reunion study (Lord et al., 2009) are widely
// cited; sources are shown on the page so the claim stays honest.
const LOSS_STATS = [
  { big: '1 in 3', label: 'pets goes missing at some point in their life' },
  { big: '~10M', label: 'dogs and cats lost or stolen in the U.S. every year' },
  { big: '52% vs 22%', label: 'how often dogs come home with their ID on file, versus without' },
];

export default function CareLandingPage() {
  return (
    <div className="min-h-screen bg-midnight-50">
      <MembersBanner />
      {/* Hero: the daily promise, nothing else */}
      <section className="bg-midnight-950 text-white">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
          <div className="flex items-center justify-center gap-2 mb-6" aria-hidden="true">
            {['DOG', 'CAT', 'BIRD', 'RABBIT'].map((s) => (
              <span key={s} className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-flash-400">
                <SpeciesIcon species={s} size={22} />
              </span>
            ))}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Your pet&apos;s Health Book.
            <br />
            <span className="text-flash-400">Free forever.</span>
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
        </div>
      </section>

      {/* The four pillars */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, tint, title, body }) => (
            <div key={title} className="bg-white border border-midnight-100 rounded-3xl p-6">
              <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${tint}`}>
                <Icon size={24} />
              </span>
              <h2 className="font-bold text-midnight-900 mt-4">{title}</h2>
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
            Most pets go missing at least once. The prepared ones come home.
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
            A panicked owner can&apos;t recall the microchip number or find a flyer-ready
            photo. Your Health Book already holds them, so the moment your pet slips
            out, it becomes the search party&apos;s briefing in one tap: the photo, the
            description, behavior notes like &ldquo;friendly, does not bolt,&rdquo; the chip
            number, your vet. And your neighborhood&apos;s Rescue Force is already behind you.
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

          <p className="text-center text-[11px] text-midnight-500 mt-6">
            Sources: American Humane; J. Am. Vet. Med. Assoc. (Lord et al., 2009), reunion rates for dogs with vs. without a registered microchip (for cats the gap is wider, ~38% vs. under 2%).
          </p>
        </div>
        <p className="text-center text-xs text-midnight-400 mt-8">
          A record you keep, not medical advice. Your vet&apos;s guidance comes first.
        </p>
      </section>
    </div>
  );
}
