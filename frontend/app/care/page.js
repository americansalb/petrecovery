/**
 * /care - the daily product's landing page
 *
 * The second door (docs/PRODUCT_IA_PLAN.md §2): pitches the Health
 * Book to people whose pets are safe at home. Never says "lost pet
 * website"; the safety net is the quiet kicker at the bottom.
 * Server component: static, fast, indexable.
 *
 * The register IS the product: the Paper Passport. Cream paper, ink,
 * rubber stamps — the hero shows the actual book, because the book is
 * the pitch. The "worst day" section is the one place the rescue
 * world's midnight reaches into the page.
 */

import Link from 'next/link';
import { Check, ArrowRight, Users, FileText, Share2 } from 'lucide-react';
import { SARAMA_AVATAR_PNG, SARAMA_NAME } from '@/lib/brandAssets';
import CareGate from './CareGate';

const FEATURES = [
  {
    mark: '℞',
    title: 'Medications, one tap each',
    body: 'Set the schedule once. Check off doses in a second, see the week fill in, get warned before refills run out.',
  },
  {
    mark: '✚',
    title: 'The Health Book',
    body: 'Vaccine stamps with expiry reminders, weight over time, conditions, and your vet, all in one record you own.',
  },
  {
    mark: '❀',
    title: 'The good stuff too',
    body: 'Walks, brushing, treats, playtime. Daily routines the whole family can see and share.',
  },
  {
    mark: '✉',
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

/* The hero's centerpiece: a real page of the book, statically drawn.
   This is the actual product UI (the Paper Passport), not an illustration. */
function BookMock() {
  return (
    <div className="relative bg-paper-50 border border-paper-400 rounded-md shadow-[0_18px_44px_-18px_rgba(35,42,61,0.5)] px-6 py-5 pl-9 text-left">
      {/* perforated edge */}
      <span
        aria-hidden="true"
        className="absolute left-4 top-2 bottom-2 w-[3px]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(35,42,61,0.25) 1.6px, transparent 1.9px)',
          backgroundSize: '3px 13px',
          backgroundRepeat: 'repeat-y',
        }}
      />
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-pen-900 pb-2 mb-1">
        <span className="font-diary italic text-[19px] text-pen-900">Max&rsquo;s Health Book</span>
        <span
          className="font-stamp text-[8px] uppercase tracking-[0.12em] text-stampgreen border-2 border-stampgreen rounded-[4px] px-1.5 py-0.5"
          style={{ transform: 'rotate(-5deg)' }}
        >
          Home
        </span>
      </div>

      {/* two ruled dose lines */}
      <div className="flex items-center gap-3 py-2.5 border-b border-pen-900/[0.16]">
        <span className="relative w-[18px] h-[18px] border-2 border-pen-900 rounded-[3px] shrink-0">
          <span className="absolute -top-[9px] left-0 text-[22px] leading-none font-bold text-stampgreen" style={{ transform: 'rotate(-8deg)' }}>✓</span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-bold text-pen-900">Apoquel · 16 mg</span>
          <span className="block font-diary italic text-[11px] text-pen-400">with breakfast</span>
        </span>
        <span
          className="font-stamp text-[8px] uppercase tracking-[0.1em] text-stampgreen border-2 border-stampgreen rounded-[4px] px-1.5 py-0.5"
          style={{ transform: 'rotate(-6deg)' }}
        >
          Given · 8:02 am
        </span>
      </div>
      <div className="flex items-center gap-3 py-2.5 border-b border-pen-900/[0.16]">
        <span className="w-[18px] h-[18px] border-2 border-pen-900 rounded-[3px] shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-bold text-pen-900">Apoquel · 16 mg</span>
          <span className="block font-diary italic text-[11px] text-pen-400">due 8:00 in the evening</span>
        </span>
        <span className="font-stamp text-[8.5px] uppercase tracking-[0.1em] text-stampred border-[1.5px] border-dashed border-stampred rounded-[4px] px-2 py-1">
          Give now
        </span>
      </div>

      {/* the passport row */}
      <p className="font-diary italic text-[12px] text-pen-600 mt-3 mb-2">the book, stamped</p>
      <div className="flex gap-3 flex-wrap">
        {[
          { over: 'Protected', name: 'DHPP', under: "to Feb '27", tone: 'text-stampgreen border-stampgreen', r: -7 },
          { over: 'Protected', name: 'Rabies', under: "to Oct '28", tone: 'text-stampgreen border-stampgreen', r: 5 },
          { over: 'Due soon', name: 'Bordetella', under: 'Aug 3', tone: 'text-stampred border-stampred', r: -4 },
        ].map((s) => (
          <span
            key={s.name}
            className={`w-[74px] h-[74px] border-[2.5px] rounded-full flex flex-col items-center justify-center text-center gap-px opacity-90 ${s.tone}`}
            style={{ transform: `rotate(${s.r}deg)` }}
          >
            <small className="font-stamp text-[6.5px] uppercase tracking-[0.08em] leading-none">{s.over}</small>
            <b className="text-[10.5px] leading-tight">{s.name}</b>
            <small className="font-stamp text-[6.5px] uppercase tracking-[0.06em] leading-none">{s.under}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function CareLandingPage() {
  return (
    <div
      className="min-h-screen bg-paper-100 text-pen-900"
      style={{
        backgroundImage: 'radial-gradient(rgba(35,42,61,0.05) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
      }}
    >
     <CareGate>
      {/* Hero: the daily promise in the product's own register — the
          book itself, on paper. The "worst day" section later is where
          the dark rescue world rightly takes back over. */}
      <section className="relative overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-14 md:py-20 text-center">
          {/* PLACEHOLDER mascot: reuses the rescue-vest Sarama for now.
              Replace with a warm, health-register Sarama (white vet coat,
              holding a notepad) to match this page's paper world. */}
          <div className="flex justify-center mb-6">
            <img
              src={SARAMA_AVATAR_PNG}
              alt={SARAMA_NAME}
              className="h-24 md:h-28 w-auto drop-shadow-[0_10px_20px_rgba(35,42,61,0.25)]"
            />
          </div>
          <p className="font-stamp text-[10px] uppercase tracking-[0.22em] text-pen-400 mb-4">The Paper Passport for pets</p>
          <h1 className="font-diary italic text-[44px] md:text-[64px] leading-[1.02] tracking-tight text-pen-900">
            Your pet&rsquo;s Health Book.
            <br />
            <span className="text-stampred">Free forever.</span>
          </h1>
          <p className="font-diary italic text-pen-600 text-[17px] mt-5 max-w-xl mx-auto">
            medications with one-tap logging, vaccine stamps, weight over time,
            and a link any vet or sitter can read. no app, no fees, no catch.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
            <Link
              href="/care/start"
              className="inline-flex items-center gap-2 font-stamp text-[12px] uppercase tracking-[0.14em] bg-stampred text-paper-50 rounded-[5px] px-6 py-4 hover:bg-stampred-dark transition-colors shadow-[0_10px_24px_-10px_rgba(179,57,46,0.7)]"
            >
              Start your pet&rsquo;s book
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/login"
              className="font-stamp text-[11px] uppercase tracking-[0.14em] text-pen-600 hover:text-pen-900 transition-colors"
            >
              Sign in
            </Link>
          </div>
          <p className="font-stamp text-[9px] uppercase tracking-[0.16em] text-pen-400 mt-6">
            <Check size={11} className="inline -mt-0.5" /> Always free
            <span className="mx-2 text-pen-300">·</span>
            <Check size={11} className="inline -mt-0.5" /> Takes a minute
            <span className="mx-2 text-pen-300">·</span>
            <Check size={11} className="inline -mt-0.5" /> Works on any phone
          </p>

          {/* Show the product, not just describe it: an actual page of
              the book is the centerpiece. */}
          <div className="relative mt-12 max-w-md mx-auto" style={{ transform: 'rotate(-0.6deg)' }}>
            <BookMock />
          </div>
        </div>
      </section>

      {/* The four pillars: the everyday product, sold on its own merits.
          THIS is the reason to sign up. The rescue safety net further down
          is a bonus on top, never the pitch. */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="font-stamp text-[10px] uppercase tracking-[0.22em] text-stampred mb-3">Every single day</p>
          <h2 className="font-diary italic text-[30px] md:text-[36px] text-pen-900 leading-tight">
            The easiest way to take great care of them.
          </h2>
          <p className="font-diary italic text-pen-600 text-[15.5px] mt-4">
            one free place for all of it, the medical records and the daily joys
            alike. set it up once and it earns its keep on the ordinary days, not
            just the hard ones.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map(({ mark, title, body }) => (
            <div key={title} className="bg-paper-50 border border-paper-400 rounded-md p-6 shadow-[0_10px_24px_-18px_rgba(35,42,61,0.45)]">
              <span className="w-10 h-10 rounded-[5px] border-[1.5px] border-pen-900 text-pen-900 flex items-center justify-center font-diary text-[19px]" aria-hidden="true">
                {mark}
              </span>
              <h3 className="font-bold text-pen-900 mt-4 text-[16px]">{title}</h3>
              <p className="font-diary italic text-[13px] text-pen-400 mt-1.5 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 pb-12">
        <div className="bg-paper-50 border border-paper-400 rounded-md p-8">
          <h2 className="font-diary italic text-[20px] text-pen-900 text-center mb-8">set up once, use it forever</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map(([title, body], i) => (
              <div key={title} className="text-center">
                <span
                  className="w-9 h-9 rounded-full border-2 border-pen-900 text-pen-900 font-diary italic text-[16px] flex items-center justify-center mx-auto"
                  style={{ transform: `rotate(${i % 2 ? 4 : -4}deg)` }}
                >
                  {i + 1}
                </span>
                <h3 className="font-bold text-pen-900 mt-3 text-[14.5px]">{title}</h3>
                <p className="font-diary italic text-[12.5px] text-pen-400 mt-1">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The warm climax: the everyday product's emotional payoff — a
          marker-highlighted passage in the book. */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 pb-6">
        <div className="rounded-md bg-marker-wash/80 border border-paper-400 p-8 md:p-12 text-center">
          <h2 className="font-diary italic text-[24px] md:text-[30px] text-pen-900 leading-tight max-w-2xl mx-auto">
            Most days, it just makes loving them easier.
          </h2>
          <p className="font-diary italic text-pen-600 text-[14.5px] md:text-[15.5px] mt-4 max-w-2xl mx-auto leading-relaxed">
            no more wondering whether the morning pill got given. no digging for
            the vaccine card the night before boarding. no wall of instructions
            texted to the sitter. just a calm, organized book where all of it
            lives, that you can share in a tap and never pay a cent for.
          </p>
        </div>
      </section>

      {/* The worst day, made concrete. The dark register is the rescue/
          shadow world reaching into the paper page. It is framed as a BONUS
          on top of the everyday value above ("And if..."), not the reason to
          sign up. The pitch is the MECHANIC: time is the whole game, and a
          book you kept on calm days turns the panic into one tap. */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 pb-16">
        <div className="bg-midnight-950 rounded-md p-8 md:p-12 shadow-[0_24px_48px_-20px_rgba(2,6,23,0.8)]">
          <p className="text-center font-stamp text-[10px] uppercase tracking-[0.22em] text-flash-400/80 mb-3">
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
              <div key={title} className="bg-white/5 border border-white/10 rounded-md p-5 text-left">
                <span className="w-10 h-10 rounded-[5px] bg-flash-400/15 text-flash-400 flex items-center justify-center mb-3">
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
              href="/care/start"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-flash-400 hover:bg-flash-300 text-midnight-950 font-bold rounded-[6px] transition text-lg"
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
        <p className="text-center font-diary italic text-[12px] text-pen-400 mt-8">
          a record you keep, not medical advice · your vet&rsquo;s guidance comes first
        </p>
      </section>
     </CareGate>
    </div>
  );
}
