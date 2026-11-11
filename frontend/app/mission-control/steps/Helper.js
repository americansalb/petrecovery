'use client';

/**
 * A helper's path through a search, one step to a screen:
 *
 *   Main        what anyone with the link sees, and the one ask
 *   Join        a first name and the safety tick, and who sees what
 *   Street      the street they are offered, and "I am going"
 *   Walking     the street they hold, the brief, and "I reached ..."
 *   SightingIn  a sighting came in: what was seen, and what the owner asks
 *   Home        the pet is home: thank you
 *
 * The product never tells a helper to stop or not to search (founder
 * rule, 2026-11-11). A sighting screen says what was seen and shows the
 * brief's own line for seeing the pet. If helpers are asked to stay
 * back, the ask is the owner's, shown in the owner's name, with two
 * equal answers.
 */
import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { SAFETY_RULES, SAFETY_AGREEMENT } from '@/app/lib/safetyRules';
import { walkTitle } from '@/app/lib/streetWalks';
import { Eyebrow, Heading, Lead, Note, Primary, Second, SeenButton, QuietLink, BottomRow, AdviceBlock, AskCard, Problem, Stamp } from '../components/kit';
import { clockTime, lookingLine, placeWords, goingWords } from '../lib/words';
import { searcherBrief } from '../lib/briefLines';

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '';
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '';

/** "350 m" or "0.8 mi", the way the pet's page already writes distances. */
export function distanceWords(meters) {
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) return `${Math.max(50, Math.round(meters / 50) * 50)} m`;
  return `${(meters / 1609.344).toFixed(1)} mi`;
}

function ShareLink({ onShare }) {
  return (
    <button
      type="button"
      onClick={onShare}
      className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold leading-5 text-[var(--mc-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
    >
      <Share2 size={18} aria-hidden="true" /> Share
    </button>
  );
}

/** What anyone with the link sees: the streets, the one ask, and the sighting button. */
export function Main({ picture, name, owner, unit, items, counts, offer, done, instrument, onWalk, onSeen, onShare, busy, problem, qr }) {
  const thing = unit === 'block' ? 'block' : 'street';
  const hasBoard = items.length > 0;
  const desk = instrument === 'command';
  return (
    <>
      <Eyebrow>{lookingLine(picture.looking?.helpers || 0)}</Eyebrow>
      <Heading className="mt-1">Help look for {name}</Heading>
      {done ? (
        <Lead className="mt-1.5">
          {done} is marked searched. Thank you. {counts.searched} of {counts.total} {thing}s {counts.searched === 1 ? 'is' : 'are'} searched so far.
        </Lead>
      ) : desk ? (
        <Lead className="mt-1.5">Walking a {thing} is done on a phone. Open {name}&apos;s search on yours to be handed one.</Lead>
      ) : hasBoard ? (
        <Lead className="mt-1.5">
          You get one {thing} near you to walk.{offer ? ` About ${offer.minutes} minutes in all.` : ''}
        </Lead>
      ) : (
        <Lead className="mt-1.5">If you see {name}, send where. It reaches {owner?.firstName || 'the owner'} at once.</Lead>
      )}
      <Problem className="mt-2">{problem}</Problem>
      {desk ? (
        // A desk is never handed a street: it hands the search to a phone.
        qr && (
          <div className="mt-4 flex items-center gap-4 rounded-2xl bg-[var(--mc-raised)] p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`QR code that opens ${name}'s search on a phone`} className="h-28 w-28 shrink-0 rounded-lg bg-white p-1.5" />
            <Note>Point your phone&apos;s camera at this. It opens this page there.</Note>
          </div>
        )
      ) : (
        hasBoard && (
          <Primary onClick={onWalk} busy={busy} className="mt-4">
            {done ? `I can walk another ${thing}` : `I can walk a ${thing}`}
          </Primary>
        )
      )}
      <SeenButton name={name} onClick={onSeen} className="mt-2.5" />
      <BottomRow owner={owner}>
        <ShareLink onShare={onShare} />
      </BottomRow>
    </>
  );
}

/** Joining: a first name, the safety tick, and who sees what. */
export function Join({ picture, name, owner, viewer, unit, search, onJoined, onBack }) {
  const signedIn = Boolean(viewer?.signedIn);
  const [first, setFirst] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [reading, setReading] = useState(false);
  const [waiver, setWaiver] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const thing = unit === 'block' ? 'block' : 'street';
  const ownerName = owner?.firstName || 'The owner';

  useEffect(() => {
    let cancelled = false;
    fetch('/api/legal/documents/liability-waiver')
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => !cancelled && doc && setWaiver(doc))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (busy) return;
    if (!signedIn && !first.trim()) return setProblem('Your first name, so the owner knows who is out.');
    if (!agreed) return setProblem('Tick the box to say you have read the safety rules and the waiver.');
    setBusy(true);
    setProblem('');
    const result = signedIn ? await search.acceptWaiver() : await search.join({ name: first, waiverVersion: waiver?.version || null });
    setBusy(false);
    if (result.error) return setProblem(result.error);
    onJoined();
    return undefined;
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Heading>Join the search party</Heading>
        <QuietLink onClick={onBack} className="!min-h-[28px] shrink-0">
          Back
        </QuietLink>
      </div>
      <Lead className="mt-1.5">
        ReunitePets is the lost pet site {ownerName === 'The owner' ? 'the owner' : ownerName} posted {name} on.
        {signedIn ? '' : ' It needs your first name.'}
      </Lead>
      <p className="mt-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3 text-[15px] font-semibold leading-[22px] text-[var(--mc-ink)]">
        {ownerName} sees your first name and the {thing} you walk. Nobody sees where you are.
      </p>
      {!signedIn && (
        <>
          <label htmlFor="mc-first-name" className="mt-3 block text-[13px] font-semibold leading-5 text-[var(--mc-soft)]">
            First name
          </label>
          <input
            id="mc-first-name"
            type="text"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            maxLength={40}
            autoComplete="given-name"
            className="mt-1 h-[52px] w-full rounded-xl border border-[var(--mc-line-strong)] !bg-[var(--mc-ground)] px-3.5 text-[17px] font-medium !text-[var(--mc-ink)] focus:border-flash-400 focus:outline-none focus:ring-2 focus:ring-flash-400/40"
          />
        </>
      )}
      <label className="mt-3 flex cursor-pointer items-start gap-3">
        <span className="relative mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg border-2 border-[var(--mc-check)]" style={agreed ? { background: 'var(--mc-check)' } : undefined}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="absolute -inset-2.5 h-11 w-11 cursor-pointer opacity-0" />
          {agreed && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mc-check-ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span className="text-[15px] font-medium leading-[22px] text-[var(--mc-soft)]">{SAFETY_AGREEMENT}</span>
      </label>
      <button
        type="button"
        onClick={() => setReading((v) => !v)}
        aria-expanded={reading}
        className="ml-[38px] inline-flex min-h-[36px] items-center text-[15px] font-bold leading-5 text-[var(--mc-ink)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
      >
        {reading ? 'Hide them' : 'Read them'}
      </button>
      {reading && (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-2xl bg-[var(--mc-raised)] p-3.5 text-sm leading-5 text-[var(--mc-soft)]">
          <p className="font-bold text-[var(--mc-ink)]">Safety rules</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {SAFETY_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="mt-3 font-bold text-[var(--mc-ink)]">Liability waiver{waiver?.version ? ` (version ${waiver.version})` : ''}</p>
          <p className="mt-1.5 whitespace-pre-wrap">{waiver?.content || 'Loading the waiver.'}</p>
        </div>
      )}
      <Problem className="mt-2">{problem}</Problem>
      <Primary onClick={submit} busy={busy} className="mt-3">
        Show me a {thing} to walk
      </Primary>
      <Note className="mt-2 text-center">Your phone will ask where you are, to pick a {thing} near you. Where you are stays on this phone.</Note>
    </>
  );
}

/** The street someone is offered: where, how long door to door, and the one button. */
export function Street({ name, owner, unit, offer, counts, onGo, onOther, onSeen, busy, problem, canOther }) {
  const thing = unit === 'block' ? 'block' : 'street';
  if (!offer) {
    return (
      <>
        <Heading>Every {thing} has someone on it</Heading>
        <Lead className="mt-1.5">
          {counts.searched} of {counts.total} are searched and the rest are being walked now.
        </Lead>
        <SeenButton name={name} onClick={onSeen} className="mt-4" />
        <BottomRow owner={owner} />
      </>
    );
  }
  const again = offer.status === 'SEARCHED';
  return (
    <>
      <Heading>Walk {unit === 'block' ? offer.title : walkTitle(offer)}</Heading>
      <Lead className="mt-1.5">
        About {offer.minutes} minutes in all{unit === 'block' ? '' : ', with the walk back'}.{' '}
        {again ? `It was walked at ${offer.searchedClock}. ${name} may have moved since.` : `${counts.searched} of ${counts.total} ${thing}s ${counts.searched === 1 ? 'is' : 'are'} searched so far.`}
      </Lead>
      <Problem className="mt-2">{problem}</Problem>
      <Primary onClick={onGo} busy={busy} className="mt-4">
        I am going
      </Primary>
      <Note className="mt-2 text-center">Tap it when you set off, so nobody else is sent here.</Note>
      <SeenButton name={name} onClick={onSeen} className="mt-2.5" />
      <BottomRow owner={owner}>{canOther && <QuietLink onClick={onOther}>Other {thing}</QuietLink>}</BottomRow>
    </>
  );
}

/** Walking: the street they hold, the site's own brief, and how it ends. */
export function Walking({ picture, name, owner, unit, mine, instrument, gps, onReached, onStop, onSeen, busy, problem }) {
  const brief = searcherBrief(picture);
  const end = unit === 'block' ? null : mine.toName;
  const recording = instrument === 'field' && gps?.recording;
  return (
    <>
      <Heading>{unit === 'block' ? `Walk ${mine.title}` : `Keep walking on ${mine.name}${end ? ` until ${end}` : ' to the end'}`}</Heading>
      <Lead className="mt-1.5">{recording ? brief.records : `Tap the button when you ${end ? `reach ${end}` : 'finish'}. That marks the ${unit === 'block' ? 'block' : 'street'} searched.`}</Lead>
      <AdviceBlock source="The searcher's brief" lines={[brief.look, brief.call, brief.never]} className="mt-3" />
      <Problem className="mt-2">{problem}</Problem>
      <Primary onClick={onReached} busy={busy} className="mt-4">
        {unit === 'block' ? 'I walked it' : end ? `I reached ${end}` : 'I reached the end'}
      </Primary>
      <SeenButton name={name} onClick={onSeen} className="mt-2.5" />
      <BottomRow owner={owner}>
        <QuietLink onClick={onStop}>I am stopping</QuietLink>
      </BottomRow>
      {instrument === 'bridge' && (APP_STORE_URL || PLAY_STORE_URL) && (
        <Note className="mt-1">
          The app records your path with GPS as you walk.{' '}
          {APP_STORE_URL && (
            <a href={APP_STORE_URL} className="font-bold underline underline-offset-4">
              App Store
            </a>
          )}
          {APP_STORE_URL && PLAY_STORE_URL ? ' or ' : ''}
          {PLAY_STORE_URL && (
            <a href={PLAY_STORE_URL} className="font-bold underline underline-offset-4">
              Google Play
            </a>
          )}
        </Note>
      )}
    </>
  );
}

/**
 * A sighting came in. It says what was seen and shows the brief's line
 * for seeing the pet. It tells nobody to stop. Where the owner has asked
 * the helpers to stay back, that ask is shown in the owner's name, and
 * someone walking a street gets two equal answers. Without an ask, or for
 * someone who is only looking, there is nothing to answer.
 */
export function SightingIn({ picture, name, owner, hot, ask, mine, awayMeters, answered, onAnswer, onSeen, onBack, onShare }) {
  const brief = searcherBrief(picture);
  const where = placeWords(hot.place);
  const going = goingWords(hot);
  const withThem = hot.state === 'WITH_WITNESS';
  const mineThing = mine ? `the ${mine.name ? 'street' : 'block'} you are walking` : null;
  return (
    <>
      <Heading>{withThem ? `${name} is with someone${where ? ` ${where}` : ''}` : `${name} was seen${where ? ` ${where}` : ''}`}</Heading>
      <Lead className="mt-1.5">
        {clockTime(hot.at, picture.timeZone)}
        {going && !withThem ? `, ${going}` : ''}.{mineThing && Number.isFinite(awayMeters) ? ` About ${distanceWords(awayMeters)} from ${mineThing}.` : ''}
      </Lead>
      {ask && <AskCard from={ask.from || owner?.firstName} text={ask.text} className="mt-3" />}
      {!withThem && <AdviceBlock source="The searcher's brief" lines={[brief.never]} className="mt-3" />}
      {ask && mine && !answered && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Second onClick={() => onAnswer('back')} className="!px-2 !text-[15px]">
            I will stay back
          </Second>
          <Second onClick={() => onAnswer('looking')} className="!px-2 !text-[15px]">
            I will keep looking
          </Second>
        </div>
      )}
      {ask && mine && answered && (
        <Note className="mt-3">
          You said you will {answered === 'back' ? 'stay back' : 'keep looking'}.{' '}
          <button type="button" onClick={() => onAnswer(null)} className="font-bold underline underline-offset-4">
            Change
          </button>
        </Note>
      )}
      {(!ask || !mine || answered) && (
        <Second onClick={onBack} className="mt-4">
          {mine ? 'Back to my street' : 'Back to the map'}
        </Second>
      )}
      <SeenButton name={name} onClick={onSeen} className="mt-2.5" />
      <BottomRow owner={owner}>{onShare && <ShareLink onShare={onShare} />}</BottomRow>
    </>
  );
}

/** The pet is home: everyone is told and thanked. */
export function Home({ picture, name, owner, petHref }) {
  const pet = picture.pet || {};
  const searched = picture.searched;
  const at = picture.resolvedAt ? clockTime(picture.resolvedAt, picture.timeZone) : '';
  // "5 streets", "2 blocks", or both where the streets came after the search began.
  const count = (n, word) => (n > 0 ? `${n} ${word}${n === 1 ? '' : 's'}` : '');
  const ground = searched && searched.people > 0 ? [count(searched.streets, 'street'), count(searched.blocks || 0, 'block')].filter(Boolean).join(' and ') : '';
  return (
    <div className="flex flex-1 flex-col">
      {pet.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pet.photoUrl} alt={`${name}${pet.color ? `, ${String(pet.color).toLowerCase()}` : ''}`} className="h-56 w-full shrink-0 object-cover" />
      )}
      <div className="flex flex-1 flex-col px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
        <div>
          <Stamp kind={picture.reunited ? 'home' : 'closed'} />
        </div>
        <Heading className="mt-2 !text-[27px] !leading-8">{picture.reunited ? `${name} is home` : 'This search has ended'}</Heading>
        <Lead className="mt-1.5">
          {picture.reunited
            ? `${owner?.firstName || 'The owner'} marked ${name} home${at ? ` at ${at}` : ''}. The search is over.`
            : `${owner?.firstName || 'The owner'} closed this search. Thank you for wanting to help.`}
        </Lead>
        {ground && (
          <p className="mt-4 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3 text-base font-semibold leading-[22px] text-[var(--mc-ink)]">
            {searched.mine && searched.people === 1
              ? `You searched ${ground}. Thank you.`
              : `${searched.people === 1 ? '1 person' : `${searched.people} people`} searched ${ground}.${searched.mine ? ' You were one of them. Thank you.' : ''}`}
          </p>
        )}
        <div className="mt-auto pt-6">
          <Second href="/patrol/join">Alert me when a pet is lost near me</Second>
          <div className="flex justify-center">
            <QuietLink href={petHref}>Open {name}&apos;s page</QuietLink>
          </div>
        </div>
      </div>
    </div>
  );
}
