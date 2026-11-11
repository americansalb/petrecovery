'use client';

/**
 * The owner's side of the search, on the same night:
 *
 *   OwnerNow       right after posting: who was told, and what to do now
 *   OwnerSighting  the pet was seen: where, the advice for it, and the
 *                  owner's own choice to ask the helpers to stay back
 *   OwnerMore      everything else, behind one word
 *
 * Every line of advice here is the advice engine's (app/lib/adviceFor.js
 * reads app/lib/petAdvice.js), under a line that says so. Nothing is
 * written for this screen.
 *
 * Asking the helpers to stay back is the owner's choice and nobody
 * else's (founder rule, 2026-11-11). The switch starts off. It shows the
 * owner the exact words that go out in their name, and says the helpers
 * can decline. Once on, it stays on through newer sightings until the
 * owner turns it off (app/lib/searchPicture.js says when it ends).
 */
import { useMemo } from 'react';
import { ChevronRight, Eye, FileText, Megaphone, MessageSquare, Navigation, Printer, Share2, X } from 'lucide-react';
import { adviceFor } from '@/app/lib/adviceFor';
import { holdAskTextFor } from '../lib/ask';
import { Eyebrow, Heading, Lead, Note, Primary, Second, QuietLink, AdviceBlock, Problem } from '../components/kit';
import { clockTime, placeWords, goingWords, dayAndTime } from '../lib/words';
import { distanceWords } from './Helper';

function useAdvice(picture, now) {
  return useMemo(
    () => adviceFor({ petSpecies: picture.pet?.species, escapeScenario: picture.pet?.howOut, petDescription: picture.pet?.description, lastSeenAt: picture.lastSeen?.at }, now),
    // The section changes with the day, not the minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picture.pet?.species, picture.pet?.howOut, picture.pet?.description, picture.lastSeen?.at, Math.floor(now / 3600000)]
  );
}

function QuietRow({ name, onHome, onMore }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-3">
      <QuietLink onClick={onHome}>{name} is back with me</QuietLink>
      <button
        type="button"
        onClick={onMore}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold leading-5 text-[var(--mc-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
      >
        <span aria-hidden="true" className="tracking-widest">···</span> More
      </button>
    </div>
  );
}

/** Right after posting, and every quiet hour after: the engine's steps for this pet, one at a time. */
export function OwnerNow({ picture, name, now, step, onStep, onShare, onHome, onMore }) {
  const advice = useAdvice(picture, now);
  const all = [...advice.steps, ...advice.more];
  const at = Math.min(step, all.length);
  const done = at >= all.length;
  const shown = all.slice(at, at + 4);
  return (
    <>
      <Eyebrow>{advice.source}</Eyebrow>
      {done ? (
        <>
          <Heading className="mt-2">You have been through every step</Heading>
          <QuietLink onClick={() => onStep(0)}>Read them again</QuietLink>
        </>
      ) : (
        <ol className="mt-2 flex flex-col gap-2.5">
          {shown.map((item, i) => (
            <li key={item.full} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${
                  i === 0 ? 'bg-flash-400 text-midnight-950' : 'border border-[var(--mc-line-strong)] text-[var(--mc-soft)]'
                }`}
                aria-hidden="true"
              >
                {at + i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block leading-[22px] text-[var(--mc-ink)] ${i === 0 ? 'text-[17px] font-bold' : 'text-[15px] font-medium'}`}>{item.lead}</span>
                {i === 0 && item.rest && <span className="mt-0.5 block text-[15px] font-medium leading-[22px] text-[var(--mc-soft)]">{item.rest}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {done ? (
        <Primary onClick={onShare} icon={Share2} className="mt-4">
          Text the link to neighbors
        </Primary>
      ) : (
        <>
          <Primary onClick={() => onStep(at + 1)} className="mt-4">
            Next step
          </Primary>
          <Second onClick={onShare} icon={Share2} className="mt-2.5">
            Text the link to neighbors
          </Second>
        </>
      )}
      <QuietRow name={name} onHome={onHome} onMore={onMore} />
    </>
  );
}

/** The pet was seen: where, what the witness is doing, the engine's lines, and the owner's own ask. */
export function OwnerSighting({ picture, name, hot, held, awayMeters, helpers, onHold, onGoing, onHome, onMore, busy, problem }) {
  const zone = picture.timeZone;
  const advice = adviceFor({ petSpecies: picture.pet?.species, escapeScenario: picture.pet?.howOut, petDescription: picture.pet?.description, lastSeenAt: picture.lastSeen?.at });
  const where = placeWords(hot.place);
  const going = goingWords(hot);
  const withThem = hot.state === 'WITH_WITNESS';
  const witness =
    hot.state === 'WATCHING'
      ? `The person who saw ${name} is still watching.`
      : withThem
        ? `The person who reported it has ${name} with them.`
        : hot.state === 'LOST_SIGHT'
          ? `They lost sight of ${name} at ${clockTime(hot.stateAt, zone)}.`
          : hot.state === 'LEFT'
            ? 'They had to leave.'
            : '';
  // The engine's mistakes for every pet: the first, and the one about calling.
  const lines = [advice.mistakes[0]?.full, advice.mistakes[2]?.full].filter(Boolean);
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${hot.lat},${hot.lng}`;
  return (
    <>
      <Heading>{withThem ? `${name} is with someone${where ? ` ${where}` : ''}` : `${name} was seen${where ? ` ${where}` : ''}`}</Heading>
      <Lead className="mt-1.5">
        {clockTime(hot.at, zone)}
        {going && !withThem ? `, ${going}` : ''}.{Number.isFinite(awayMeters) ? ` About ${distanceWords(awayMeters)} from you.` : ''} {witness}
      </Lead>
      <AdviceBlock source="ReunitePets advice" lines={lines} className="mt-3" />
      {helpers > 0 && (
        <label className="mt-3 flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl bg-[var(--mc-raised)] px-3.5 py-2">
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold leading-[21px] text-[var(--mc-ink)]">
              Ask the {helpers === 1 ? 'helper' : `${helpers} helpers`} to stay back
            </span>
            <span className="block text-[13px] font-medium leading-[18px] text-[var(--mc-soft)]">
              {held ? `They got: "${holdAskTextFor(name)}" They can decline.` : 'Off. Nobody is asked to stop.'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-[13px] font-bold text-[var(--mc-ink)]">{held ? 'On' : 'Off'}</span>
            <span className={`relative h-7 w-12 rounded-full transition ${held ? 'bg-[var(--mc-ink)]' : 'bg-[var(--mc-line-strong)]'}`}>
              <input type="checkbox" role="switch" checked={held} disabled={busy === 'hold'} onChange={(e) => onHold(e.target.checked)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`Ask the helpers to stay back while you go to ${name}`} />
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-[var(--mc-surface)] transition-all ${held ? 'left-6' : 'left-1'}`} />
            </span>
          </span>
        </label>
      )}
      <Problem className="mt-2">{problem}</Problem>
      {hot.ownerGoingAt ? (
        <Primary onClick={onHome} className="mt-3">
          {name} is back with me
        </Primary>
      ) : (
        <Primary onClick={onGoing} busy={busy === 'going'} className="mt-3">
          I am going
        </Primary>
      )}
      <Second href={mapsHref} icon={Navigation} className="mt-2.5">
        Directions to the sighting
      </Second>
      {hot.ownerGoingAt ? (
        <div className="mt-1 flex items-center justify-between gap-3">
          <Note>You said you are going, at {clockTime(hot.ownerGoingAt, zone)}.</Note>
          <button type="button" onClick={onMore} className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 text-[15px] font-semibold text-[var(--mc-soft)]">
            <span aria-hidden="true" className="tracking-widest">···</span> More
          </button>
        </div>
      ) : (
        <QuietRow name={name} onHome={onHome} onMore={onMore} />
      )}
    </>
  );
}

function Row({ icon: Icon, label, detail, onClick, href }) {
  const inner = (
    <>
      <Icon size={22} className="shrink-0 text-[var(--mc-soft)]" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-base font-semibold leading-[21px] text-[var(--mc-ink)]">{label}</span>
        <span className="block truncate text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">{detail}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-[var(--mc-muted)]" aria-hidden="true" />
    </>
  );
  const look = 'flex min-h-[56px] w-full items-center gap-3.5 border-b border-[var(--mc-line)] py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';
  if (href) {
    return (
      <a href={href} className={look}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={look}>
      {inner}
    </button>
  );
}

/** Everything else. Ending the search asks first. */
export function OwnerMore({ picture, name, now, petHref, onClose, onShare, onMessage, onFlyer, onSightings, onEnd }) {
  const count = picture.sightings.filter((s) => s.state !== 'NOT_THE_PET').length;
  const newest = picture.sightings.find((s) => s.state !== 'NOT_THE_PET');
  const helpers = picture.looking?.helpers || 0;
  return (
    <>
      <div className="flex items-center justify-between">
        <Heading>More</Heading>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--mc-ink)] hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-1">
        <Row icon={Megaphone} label="Tell more people" detail="Text the link or post it" onClick={onShare} />
        <Row icon={MessageSquare} label="Message the helpers" detail={helpers ? `${helpers} out looking now` : 'Everyone who is helping sees it'} onClick={onMessage} />
        <Row
          icon={Eye}
          label="Sightings"
          detail={count ? `${count} so far, the last ${dayAndTime(newest.at, picture.timeZone, now)}` : 'None yet'}
          onClick={onSightings}
        />
        <Row icon={Printer} label="Print the flyer" detail="One page, with the code to scan" onClick={onFlyer} />
        <Row icon={FileText} label={`${name}'s page`} detail="Details, shelters to call, your number" href={petHref} />
        <Row icon={X} label="End the search" detail={`${name} is back, or stop without. It asks first.`} onClick={onEnd} />
      </div>
      <Second onClick={onClose} className="mt-4">
        Close
      </Second>
    </>
  );
}

/** The sightings so far, newest first, for the owner. */
export function SightingList({ picture, name, now, onClose }) {
  const rows = picture.sightings.filter((s) => s.state !== 'NOT_THE_PET');
  return (
    <>
      <div className="flex items-center justify-between">
        <Heading>Sightings of {name}</Heading>
        <QuietLink onClick={onClose} className="shrink-0">
          Back
        </QuietLink>
      </div>
      {rows.length === 0 && <Lead className="mt-2">Nobody has reported seeing {name} yet.</Lead>}
      <ul className="mt-2 flex flex-col">
        {rows.map((s) => (
          <li key={s.id} className="border-b border-[var(--mc-line)] py-2.5">
            <p className="text-base font-semibold leading-[22px] text-[var(--mc-ink)]">
              {dayAndTime(s.at, picture.timeZone, now)}
              {placeWords(s.place) ? ` ${placeWords(s.place)}` : ''}
              {goingWords(s) ? `, ${goingWords(s)}` : ''}
            </p>
            {(s.by || s.note) && (
              <p className="text-sm font-medium leading-5 text-[var(--mc-soft)]">
                {s.by ? `From ${s.by}. ` : ''}
                {s.note || ''}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
