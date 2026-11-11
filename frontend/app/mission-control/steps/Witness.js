'use client';

/**
 * Someone has seen the pet. Four screens, each one question:
 *
 *   Seen         is it the pet, and is it now
 *   SeenWay      already sent: which street did it take
 *   SeenSent     what the owner was told, what the owner answered, and
 *                a button for every way this can end
 *   SeenEarlier  it was earlier, or somewhere else: type the street
 *
 * The first tap sends the place. Nothing waits on a form: a witness is
 * standing on a corner with an animal in front of them. What they send
 * is the place and the time. It is never their name or their number.
 *
 * How to behave near this pet is the owner's own answer from the report
 * (the finder guide, app/lib/caseDetails.js), shown as the pet's page
 * shows it. This file writes no advice of its own.
 */
import { useMemo, useState } from 'react';
import { ArrowUp, Check, Phone } from 'lucide-react';
import LocationPicker from '@/app/components/report/LocationPicker';
import { waysFrom } from '@/app/lib/streetWalks';
import { Eyebrow, Heading, Lead, Note, Primary, Second, QuietLink, BottomRow, AdviceBlock, Problem, Stamp } from '../components/kit';
import { clockTime, placeWords, goingWords, petSub, phoneTel, phoneWords } from '../lib/words';

const COMPASS = [
  { compass: 'NORTH', bearing: 0, label: 'North' },
  { compass: 'EAST', bearing: 90, label: 'East' },
  { compass: 'SOUTH', bearing: 180, label: 'South' },
  { compass: 'WEST', bearing: 270, label: 'West' },
];

const WHEN = [
  { minutes: 0, label: 'Just now' },
  { minutes: 10, label: '10 minutes ago' },
  { minutes: 30, label: '30 minutes ago' },
  { minutes: 60, label: 'An hour ago' },
  { minutes: 180, label: 'Earlier today' },
  { minutes: 1440, label: 'Yesterday' },
];

/** How to behave near this pet, in the owner's own answer as the site words it. */
function Approach({ picture, owner, name, className = '' }) {
  if (!picture.approach) return null;
  return <AdviceBlock source={`From ${owner?.firstName || 'the owner'}, about ${name}`} lines={[picture.approach]} className={className} />;
}

/** Is it the pet, and is it now. The first tap sends the place. */
export function Seen({ picture, name, owner, signedIn = false, onNow, onWithMe, onEarlier, onBack, busy, problem }) {
  const pet = picture.pet || {};
  return (
    <div className="flex min-h-full flex-col">
      {pet.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pet.photoUrl} alt={`${name}${pet.color ? `, ${String(pet.color).toLowerCase()}` : ''}`} className="h-[38vh] max-h-[360px] min-h-[200px] w-full shrink-0 object-cover" />
      ) : null}
      <div className="flex flex-1 flex-col px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-3">
        <p className="flex items-center gap-2">
          <span className="text-[17px] font-bold leading-6 text-[var(--mc-ink)]">{name}</span>
          <Stamp kind="lost" />
        </p>
        <p className="text-sm font-medium leading-5 text-[var(--mc-soft)]">{petSub({ owner: owner?.firstName, species: pet.species, color: pet.color, breed: pet.breed })}</p>
        <Heading className="mt-3 !text-[25px] !leading-8">Do you see {name} right now?</Heading>
        <Approach picture={picture} owner={owner} name={name} className="mt-2" />
        <Problem className="mt-2">{problem}</Problem>
        <Primary onClick={onNow} busy={busy === 'now'} disabled={Boolean(busy)} className="mt-4">
          Yes, I see {name} now
        </Primary>
        {/* Someone signed in is recorded as themselves, as on the pet's page. The screen says so. */}
        <Note className="mt-2 text-center">
          It sends {owner?.firstName || 'the owner'} where you are now{signedIn ? ', in your name. Not your number.' : '. Not your name or number.'}
        </Note>
        <Second onClick={onWithMe} busy={busy === 'with'} disabled={Boolean(busy)} className="mt-2.5">
          {name} is right here with me
        </Second>
        <Second onClick={onEarlier} disabled={Boolean(busy)} className="mt-2.5">
          I saw {name} earlier
        </Second>
        <Note className="mt-3">Not sure it is {name}? Tap yes anyway.</Note>
        <div className="mt-auto pt-2">
          <BottomRow owner={owner}>
            <QuietLink onClick={onBack}>A different pet</QuietLink>
          </BottomRow>
        </div>
      </div>
    </div>
  );
}

function WayButton({ way, onPick, busy }) {
  return (
    <button
      type="button"
      onClick={() => onPick(way)}
      disabled={busy}
      className="flex min-h-[60px] w-full items-center gap-3 rounded-xl border border-[var(--mc-line-strong)] bg-[var(--mc-raised)] px-3 text-left transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--mc-ink)] text-[var(--mc-surface)]" aria-hidden="true">
        <ArrowUp size={22} style={{ transform: `rotate(${way.bearing}deg)` }} />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-bold leading-[22px] text-[var(--mc-ink)]">{way.toward ? `Toward ${way.toward}` : way.label || `Along ${way.along}`}</span>
        {way.along && way.toward && <span className="block text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">along {way.along}</span>}
      </span>
    </button>
  );
}

/** Already sent. Which street did it take: one tap, by the street's name. */
export function SeenWay({ picture, name, owner, mine, streets, map, onPick, onStaying, onUnsure, onClose, busy, problem }) {
  const report = picture.sightings.find((s) => s.id === mine.id) || null;
  const point = report ? { lat: report.lat, lng: report.lng } : null;
  const ways = useMemo(() => {
    const named = point ? waysFrom(streets, point) : [];
    return named.length ? named : COMPASS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streets, point?.lat, point?.lng]);
  const where = placeWords(report?.place || mine.place);
  return (
    <div className="flex min-h-full flex-col px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-3">
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--mc-seen)] text-midnight-950" aria-hidden="true">
          <Check size={20} strokeWidth={3} />
        </span>
        <p className="text-[15px] font-semibold leading-[21px] text-[var(--mc-ink)]">
          Sent at {clockTime(report?.at || mine.at, picture.timeZone)}. {owner?.firstName || 'The owner'} was told you see {name}
          {where ? ` ${where}` : ''}.
        </p>
      </div>
      <Heading className="mt-4">Which way is {name} going?</Heading>
      <Lead className="mt-1">Tap the street {name} took. The top of the map is north.</Lead>
      {map && <div className="mt-3 h-44 shrink-0 overflow-hidden rounded-2xl border border-[var(--mc-line)]">{map}</div>}
      <div className="mt-3 flex flex-col gap-2">
        {ways.map((way) => (
          <WayButton key={`${way.along || ''}-${way.compass}`} way={way} onPick={onPick} busy={busy} />
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <Second onClick={onStaying} disabled={busy}>
          Staying here
        </Second>
        <Second onClick={onUnsure} disabled={busy}>
          Not sure
        </Second>
      </div>
      <Problem className="mt-2">{problem}</Problem>
      <Note className="mt-3">That is all. {owner?.firstName || 'The owner'} already has the place, so you can close this page at any time.</Note>
      <div className="mt-auto pt-2">
        <BottomRow owner={owner}>
          <QuietLink onClick={onClose}>Close</QuietLink>
        </BottomRow>
      </div>
    </div>
  );
}

/** What was sent, what the owner answered, and a button for every ending. */
export function SeenSent({ picture, name, owner, mine, signedIn = false, onState, onAgain, onChangeWay, onDone, busy, problem }) {
  const report = picture.sightings.find((s) => s.id === mine.id) || null;
  const zone = picture.timeZone;
  const ownerName = owner?.firstName || 'The owner';
  const state = report?.state || (mine.kind === 'with' ? 'WITH_WITNESS' : mine.kind === 'now' ? 'WATCHING' : null);
  const withMe = state === 'WITH_WITNESS';
  const where = placeWords(report?.place || mine.place);
  const going = goingWords(report);
  const coming = Boolean(report?.ownerGoingAt);
  const seen = Boolean(report?.ownerSeenAt);
  const title = coming
    ? withMe
      ? `${ownerName} is coming to you`
      : `${ownerName} is coming${where ? ` ${where.replace(/^(at|on|near) /, 'to ')}` : ''}`
    : withMe
      ? `${ownerName} was told ${name} is with you`
      : seen
        ? `${ownerName} has seen your report`
        : `${ownerName} was told`;
  const status = coming
    ? `${clockTime(report.ownerGoingAt, zone)}. ${ownerName} is on the way${report.etaMinutes ? `, about ${report.etaMinutes} minutes away` : ''}.`
    : seen
      ? `${clockTime(report.ownerSeenAt, zone)}. ${ownerName} opened your report.`
      : `${ownerName} gets it on the phone and by email.`;
  const live = state === 'WATCHING' || withMe;
  return (
    <div className="flex min-h-full flex-col px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--mc-seen)] text-midnight-950" aria-hidden="true">
        <Check size={26} strokeWidth={3} />
      </span>
      <Eyebrow className="mt-3 !text-[var(--mc-seen)]">
        Sent to {ownerName} at {clockTime(report?.at || mine.at, zone)}
      </Eyebrow>
      <Heading className="mt-1 !text-[25px] !leading-8">{title}</Heading>
      <p className="mt-2 flex items-start gap-2.5 text-[15px] font-semibold leading-[22px] text-[var(--mc-ink)]" aria-live="polite">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-400 text-xs font-extrabold text-midnight-950" aria-hidden="true">
          {ownerName.charAt(0).toUpperCase()}
        </span>
        {status}
      </p>
      {live && <Approach picture={picture} owner={owner} name={name} className="mt-3" />}
      {state === 'WATCHING' && (
        <Note className="mt-2">
          When {name} is out of sight, tap &quot;I lost sight of {name}&quot;. It is fine to leave when you need to.
        </Note>
      )}
      {state === 'LOST_SIGHT' && <Note className="mt-3">You said you lost sight of {name} at {clockTime(report?.stateAt, zone)}. Thank you for watching.</Note>}
      {state === 'LEFT' && <Note className="mt-3">You said you had to go. Thank you. The place you sent is still on the map.</Note>}
      {state === 'NOT_THE_PET' && <Note className="mt-3">You said it was not {name}. The sighting is off the map. Thank you for checking.</Note>}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3">
        <p className="text-[15px] font-medium leading-[21px] text-[var(--mc-soft)]">
          You reported {withMe ? `${name} with you` : name}
          {where ? ` ${where}` : ''}
          {going && !withMe ? `, ${going}` : ''}.
        </p>
        {state === 'WATCHING' && onChangeWay && <QuietLink onClick={onChangeWay}>Change</QuietLink>}
      </div>
      <Problem className="mt-2">{problem}</Problem>
      <div className="mt-auto pt-4">
        {withMe && owner?.phone && (
          <>
            <Primary href={`tel:${phoneTel(owner.phone)}`} icon={Phone}>
              Call {ownerName} {phoneWords(owner.phone)}
            </Primary>
            <Note className="mt-2 text-center">
              {ownerName} knows {name} and can tell you what to do.
            </Note>
          </>
        )}
        {state === 'WATCHING' && (
          <Second onClick={() => onState('LOST_SIGHT')} busy={busy === 'LOST_SIGHT'} disabled={Boolean(busy)}>
            I lost sight of {name}
          </Second>
        )}
        {live && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {withMe ? (
              <Second onClick={() => onState('LOST_SIGHT')} busy={busy === 'LOST_SIGHT'} disabled={Boolean(busy)}>
                {name} left
              </Second>
            ) : (
              <Second onClick={() => onState('NOT_THE_PET')} busy={busy === 'NOT_THE_PET'} disabled={Boolean(busy)}>
                It was not {name}
              </Second>
            )}
            <Second onClick={() => onState('LEFT')} busy={busy === 'LEFT'} disabled={Boolean(busy)}>
              I have to go
            </Second>
          </div>
        )}
        {!live && state !== null && (
          <Second onClick={onAgain}>I see {name} again</Second>
        )}
        <BottomRow owner={withMe ? null : owner}>
          <QuietLink onClick={onDone}>{live ? 'Close' : 'Back to the map'}</QuietLink>
        </BottomRow>
        <p className="text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">
          {ownerName} got the place and the time{signedIn ? ', in your name. Not your number.' : ', not your name or number.'}
        </p>
      </div>
    </div>
  );
}

/** It was earlier, or somewhere else: the street, typed, and when. */
export function SeenEarlier({ name, owner, onSend, onBack, busy, problem, startMinutes = 30, canLocate = true }) {
  const [where, setWhere] = useState(null);
  const [minutes, setMinutes] = useState(startMinutes);
  const [missing, setMissing] = useState('');
  function send() {
    if (!where || !Number.isFinite(Number(where.lat ?? where.latitude))) return setMissing(`Mark where you saw ${name}: search for the street or the corner.`);
    setMissing('');
    return onSend({
      lat: Number(where.lat ?? where.latitude),
      lng: Number(where.lng ?? where.longitude),
      address: where.address || '',
      minutesAgo: minutes,
    });
  }
  return (
    <div className="flex min-h-full flex-col px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-4">
      <Heading className="!text-[25px] !leading-8">Where did you see {name}?</Heading>
      <Lead className="mt-1">Type the street or the corner. Not sure it was {name}? Send it anyway.</Lead>
      <div className="mt-3 overflow-hidden rounded-2xl bg-white p-3 text-midnight-900">
        {/* On a desk the picker never offers the device's position: it would be a guess from the network. */}
        <LocationPicker value={where} onChange={setWhere} variant="lost" canLocate={canLocate} />
      </div>
      <p className="mt-4 text-[17px] font-bold leading-6 text-[var(--mc-ink)]" id="mc-when">
        When?
      </p>
      <div role="radiogroup" aria-labelledby="mc-when" className="mt-2 flex flex-wrap gap-2">
        {WHEN.map((w) => {
          const on = minutes === w.minutes;
          return (
            <button
              key={w.minutes}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setMinutes(w.minutes)}
              className={`min-h-[44px] rounded-full border px-4 text-[15px] font-semibold leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${
                on ? 'border-[var(--mc-ink)] bg-[var(--mc-ink)] text-[var(--mc-surface)]' : 'border-[var(--mc-line-strong)] bg-[var(--mc-raised)] text-[var(--mc-ink)]'
              }`}
            >
              {w.label}
            </button>
          );
        })}
      </div>
      <Problem className="mt-3">{missing || problem}</Problem>
      <div className="mt-auto pt-4">
        <Primary onClick={send} busy={busy}>
          Send the sighting
        </Primary>
        <Note className="mt-2 text-center">It goes to {owner?.firstName || 'the owner'} and to the people who are looking.</Note>
        <div className="flex justify-center">
          <QuietLink onClick={onBack}>Back</QuietLink>
        </div>
      </div>
    </div>
  );
}
