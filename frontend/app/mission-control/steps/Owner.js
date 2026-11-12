'use client';

/**
 * The owner's side of the search, one thing at a time:
 *
 *   OwnerNow       who is looking, and the one thing that brings more
 *   OwnerSighting  the pet was seen: where, and one button to get there
 *
 * Everything else an owner has (the flyer, a message to everyone, the
 * details) is on the pet's page, one tap back. Opening directions also
 * tells the person who saw the pet that the owner is coming, so the owner
 * has one button and not two.
 *
 * Every line of advice here is the advice engine's (app/lib/adviceFor.js
 * reads app/lib/petAdvice.js), under a line that says so. Nothing is
 * written for this screen.
 */
import { useMemo, useState } from 'react';
import { Navigation, Share2 } from 'lucide-react';
import { adviceFor } from '@/app/lib/adviceFor';
import { Eyebrow, Heading, Lead, Note, Primary, QuietLink, AdviceBlock, Problem } from '../components/kit';
import { clockTime, dayAndTime, placeWords, agoWords, lookingLine } from '../lib/words';

function useAdvice(picture, now) {
  return useMemo(
    () => adviceFor({ petSpecies: picture.pet?.species, escapeScenario: picture.pet?.howOut, petDescription: picture.pet?.description, lastSeenAt: picture.lastSeen?.at }, now),
    // The section changes with the day, not the minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picture.pet?.species, picture.pet?.howOut, picture.pet?.description, picture.lastSeen?.at, Math.floor(now / 3600000)]
  );
}

/** Who is looking, and the one thing that brings more people. */
export function OwnerNow({ picture, name, now, unit, counts, onShare, onHome, problem }) {
  const advice = useAdvice(picture, now);
  const [open, setOpen] = useState(false);
  const thing = unit === 'block' ? 'block' : 'street';
  const steps = [...advice.steps, ...advice.more].slice(0, 5);
  return (
    <>
      <Heading>{lookingLine(picture.looking?.helpers || 0)}</Heading>
      {counts.total > 0 && (
        <Lead className="mt-1.5">
          {counts.searched} of {counts.total} {thing}s {counts.searched === 1 ? 'is' : 'are'} searched.
        </Lead>
      )}
      <Problem className="mt-2">{problem}</Problem>
      <Primary onClick={onShare} icon={Share2} className="mt-4">
        Text the link to neighbors
      </Primary>
      <div className="mt-1 flex items-center justify-between gap-3">
        <QuietLink onClick={onHome}>{name} is back with me</QuietLink>
        {steps.length > 0 && (
          <QuietLink onClick={() => setOpen((v) => !v)}>
            <span aria-expanded={open}>{open ? 'Hide the steps' : 'What to do now'}</span>
          </QuietLink>
        )}
      </div>
      {open && (
        <div className="mt-1">
          <Eyebrow>{advice.source}</Eyebrow>
          <ol className="mt-2 flex flex-col gap-2">
            {steps.map((item, i) => (
              <li key={item.full} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--mc-line-strong)] text-xs font-extrabold text-[var(--mc-soft)]" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="min-w-0 text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">{item.lead}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

/** The pet was seen: where, the engine's first line, and one button to get there. */
export function OwnerSighting({ picture, name, hot, now, onGoing, onHome, problem }) {
  const zone = picture.timeZone;
  const advice = adviceFor({ petSpecies: picture.pet?.species, escapeScenario: picture.pet?.howOut, petDescription: picture.pet?.description, lastSeenAt: picture.lastSeen?.at });
  const where = placeWords(hot.place);
  // The engine's first "do not": the one line an owner needs before setting off.
  const first = advice.mistakes[0]?.full;
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${hot.lat},${hot.lng}`;
  return (
    <>
      <Heading>
        {name} was seen{where ? ` ${where}` : ''}
      </Heading>
      <Lead className="mt-1.5">
        {dayAndTime(hot.at, zone, now)}, {agoWords(hot.at, now)}.
      </Lead>
      {first && <AdviceBlock source="ReunitePets advice" lines={[first]} className="mt-3" />}
      <Problem className="mt-2">{problem}</Problem>
      {/* One button: it opens the way there, and tells the person who saw the pet that the owner is coming. */}
      <Primary href={mapsHref} newTab onClick={onGoing} icon={Navigation} className="mt-4">
        Directions
      </Primary>
      <Note className="mt-2 text-center">
        {hot.ownerGoingAt ? `The person who saw ${name} was told you are coming, at ${clockTime(hot.ownerGoingAt, zone)}.` : `The person who saw ${name} is told you are coming.`}
      </Note>
      <div className="mt-1 flex items-center justify-between gap-3">
        <QuietLink onClick={onHome}>{name} is back with me</QuietLink>
      </div>
    </>
  );
}
