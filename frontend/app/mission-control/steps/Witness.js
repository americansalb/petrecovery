'use client';

/**
 * Someone has seen the pet. Two screens:
 *
 *   Seen  where and when, with one button
 *   Sent  it is sent: call the owner, or send again from a new spot
 *
 * What they send is a place and a time, never their number. There is no
 * question about which way the pet went and no button for each way a
 * sighting can end. If the pet moves, they send again from where it is
 * now, and two marks on the map show the way better than a question does.
 *
 * How to behave near this pet is the owner's own answer from the report
 * (the finder guide, app/lib/caseDetails.js), shown as the pet's page
 * shows it. This file writes no advice of its own.
 */
import { useState } from 'react';
import { Check, Loader2, MapPin, MousePointerClick, Phone } from 'lucide-react';
import LocationPicker from '@/app/components/report/LocationPicker';
import { Eyebrow, Heading, Lead, Note, Primary, SeenButton, QuietLink, AdviceBlock, Problem } from '../components/kit';
import { clockTime, phoneTel, phoneWords } from '../lib/words';

/** How long ago, in four words a person can pick at a glance. The minutes are what is sent. */
export const WHEN = [
  { minutes: 0, label: 'Just now' },
  { minutes: 30, label: 'Last hour' },
  { minutes: 180, label: 'Today' },
  { minutes: 1440, label: 'Yesterday' },
];

/** Where and when, on one screen, with one button. */
export function Seen({ name, owner, signedIn = false, where, onWhere, near = null, locating = false, canLocate = true, mapPick = false, minutes, onMinutes, onSend, busy, problem }) {
  // With the spot already on the map, typing is the second way and stays out of sight until asked for.
  const [typing, setTyping] = useState(false);
  const placed = Boolean(where && Number.isFinite(Number(where.lat)));
  return (
    <div className="flex min-h-full flex-col px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-4">
      <Heading className="!text-[25px] !leading-8">Where did you see {name}?</Heading>
      {locating ? (
        <p className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--mc-raised)] px-4 py-5 text-[17px] font-medium leading-6 text-[var(--mc-soft)]" role="status">
          <Loader2 size={22} className="shrink-0 animate-spin text-flash-400" aria-hidden="true" />
          Finding where you are
        </p>
      ) : mapPick ? (
        // A desk has the whole map beside this form: a click on it is the place, and the pin can be dragged.
        // Typing a street is the second way.
        <>
          <div className="mt-3 flex items-start gap-3 rounded-2xl border border-[var(--mc-seen)] bg-[var(--mc-seen-bg)] px-3.5 py-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--mc-seen)] text-[var(--mc-on-seen)]" aria-hidden="true">
              {placed ? <MapPin size={19} /> : <MousePointerClick size={19} />}
            </span>
            <p className="min-w-0 text-[15px] font-semibold leading-[22px] text-[var(--mc-ink)]" aria-live="polite">
              {placed ? (where.address ? `Marked at ${where.address}.` : 'Marked on the map.') : `Click the map where you saw ${name}.`}
              <span className="block text-[13px] font-medium leading-[18px] text-[var(--mc-soft)]">{placed ? 'Drag the pin, or click again, to move it.' : 'Zoom in for a closer place.'}</span>
            </p>
          </div>
          {typing ? (
            <div className="mt-2.5 overflow-visible rounded-2xl bg-white p-3 text-midnight-900">
              <LocationPicker value={where} onChange={onWhere} variant="lost" canLocate={false} search near={near} mapless />
            </div>
          ) : (
            <div>
              <QuietLink onClick={() => setTyping(true)}>Type a street instead</QuietLink>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mt-3 overflow-hidden rounded-2xl bg-white p-3 text-midnight-900">
            {/* On a desk the picker never offers the device's position: it would be a guess from the network.
                A typed street is looked for around the search first: "W 41st St" means the one by the pet. */}
            <LocationPicker value={where} onChange={onWhere} variant="lost" canLocate={canLocate} search={typing || !placed} near={near} />
          </div>
          {placed && !typing && (
            <div>
              <QuietLink onClick={() => setTyping(true)}>Type the street instead</QuietLink>
            </div>
          )}
        </>
      )}
      <p className="mt-3 text-[17px] font-bold leading-6 text-[var(--mc-ink)]" id="mc-when">
        When?
      </p>
      {/* Four equal chips on one row; two rows of two on a narrow phone. Flex, not grid: globals.css gives every .grid a 1rem gap. */}
      <div role="radiogroup" aria-labelledby="mc-when" className="mt-2 flex flex-wrap gap-1.5">
        {WHEN.map((w) => {
          const on = minutes === w.minutes;
          return (
            <button
              key={w.minutes}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onMinutes(w.minutes)}
              className={`min-h-[44px] grow basis-[calc(50%-3px)] whitespace-nowrap rounded-full border px-1 text-[14px] font-semibold leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 min-[380px]:basis-0 ${
                on ? 'border-[var(--mc-ink)] bg-[var(--mc-ink)] text-[var(--mc-surface)]' : 'border-[var(--mc-line-strong)] bg-[var(--mc-raised)] text-[var(--mc-ink)]'
              }`}
            >
              {w.label}
            </button>
          );
        })}
      </div>
      <div className="mt-auto pt-4">
        {/* Beside the button, where the eye is after pressing it. */}
        <Problem className="mb-2.5">{problem}</Problem>
        <Primary onClick={onSend} busy={busy} disabled={locating}>
          Send to {owner?.firstName || 'the owner'}
        </Primary>
        {/* Someone signed in is recorded as themselves, as on the pet's page. The screen says so. */}
        <Note className="mt-2 text-center">It sends the place and the time{signedIn ? ', in your name. Not your number.' : '. Not your name or number.'}</Note>
      </div>
    </div>
  );
}

/** It is sent: what the owner has done about it, and the two things left to do. */
export function Sent({ picture, name, owner, mine, signedIn = false, onAgain, onDone }) {
  const report = picture.sightings.find((s) => s.id === mine.id) || null;
  const zone = picture.timeZone;
  const ownerName = owner?.firstName || 'The owner';
  const coming = Boolean(report?.ownerGoingAt);
  const seen = Boolean(report?.ownerSeenAt);
  const title = coming ? `${ownerName} is on the way` : seen ? `${ownerName} has seen it` : `${ownerName} was told`;
  const detail = coming
    ? report.etaMinutes
      ? `About ${report.etaMinutes} minutes away.`
      : ''
    : seen
      ? `${ownerName} opened it at ${clockTime(report.ownerSeenAt, zone)}.`
      : `${ownerName} gets it on the phone and by email.`;
  return (
    <div className="flex min-h-full flex-col px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--mc-seen)] text-midnight-950" aria-hidden="true">
        <Check size={26} strokeWidth={3} />
      </span>
      <Eyebrow className="mt-3 !text-[var(--mc-seen)]">
        Sent to {ownerName} at {clockTime(mine.sentAt || mine.at, zone)}
      </Eyebrow>
      <Heading className="mt-1 !text-[25px] !leading-8">
        <span aria-live="polite">{title}</span>
      </Heading>
      {detail && <Lead className="mt-1.5">{detail}</Lead>}
      {picture.approach && <AdviceBlock source={`From ${owner?.firstName || 'the owner'}, about ${name}`} lines={[picture.approach]} className="mt-5" />}
      <div className="mt-auto pt-4">
        {owner?.phone && (
          <Primary href={`tel:${phoneTel(owner.phone)}`} icon={Phone}>
            Call {ownerName} {phoneWords(owner.phone)}
          </Primary>
        )}
        {/* The pet moved, or is still there: the same send again, from where it is now. */}
        <SeenButton name={name} label={`I see ${name} again`} onClick={onAgain} className="mt-2.5" />
        <div className="mt-1 flex justify-center">
          <QuietLink onClick={onDone} className="min-w-[88px] justify-center">
            Done
          </QuietLink>
        </div>
        <p className="text-center text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">
          {ownerName} got the place and the time{signedIn ? ', in your name. Not your number.' : ', not your name or number.'}
        </p>
      </div>
    </div>
  );
}
