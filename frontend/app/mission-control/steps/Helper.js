'use client';

/**
 * Someone who wants to help, one card at a time:
 *
 *   Main    what anyone with the link sees: two buttons
 *   Join    asked once: a first name and the safety tick
 *   Street  the street that is theirs, and the one button that ends it
 *   Home    the pet is home: thank you
 *
 * There is no step between being given a street and walking it: the
 * street is theirs when they get it. Nothing interrupts a walk either. A
 * sighting shows in the line at the top of every screen, and the product
 * never tells a helper to stop or not to search (founder rule,
 * 2026-11-11).
 *
 * The person running the search can ask a named helper to walk one street
 * (app/lib/searchAsk.js) and can send them a word. Neither is a new card:
 * an ask is the first card saying which street, with the same one button,
 * and a word is a block on the card they already have, with a line to
 * answer in (components/Word.js). A word written to this person is on
 * their card while it is fresh, whatever else the card is showing, with
 * what the owner told everyone under it. Both are someone's own words,
 * shown as theirs. The card says when it has shown an ask or a word, and
 * that is what the desk reads as "seen".
 */
import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { SAFETY_RULES, SAFETY_AGREEMENT } from '@/app/lib/safetyRules';
import { Eyebrow, Heading, Lead, Note, Primary, Second, SeenButton, QuietLink, BottomRow, AdviceBlock, Problem, Stamp } from '../components/kit';
import Word, { Answer, useShown, beatOf } from '../components/Word';
import { clockTime, lookingLine } from '../lib/words';
import { searcherBrief } from '../lib/briefLines';

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '';
// What the button says is what the people running the search are told in this person's name (app/lib/searchAsk.js, CANNOT_WORDS).
const CANNOT_WORDS = "I can't right now";
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '';

/**
 * What was said to this person (lib/team.js, wordsForCard): the words written to them, and what the owner told
 * everyone. Under them, one line to answer in. It is its own piece, in the same place whatever is above it, so a
 * new word arriving does not throw away an answer that is being typed. Each word written to this person says so
 * when it has been shown (`onShown`), which is what the desk reads as "seen".
 */
function Said({ said = [], picture, now, onSay, onShown }) {
  if (!said.length) return null;
  const who = said[0].from || picture.owner?.firstName || 'the people running the search';
  return (
    <>
      {said.map((word) => (
        <Word key={word.id} word={word} timeZone={picture.timeZone} now={now} onShown={onShown} />
      ))}
      {onSay && <Answer key="answer" who={who} onSay={onSay} />}
    </>
  );
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

/**
 * What anyone with the link sees: the streets, and two buttons. For
 * someone the person running the search has asked to walk a street
 * (`asked`), the same card says which street and whose ask it is, and its
 * one button starts it.
 */
export function Main({ picture, name, owner, unit, items, counts, minutes, done, instrument, onWalk, onSeen, onShare, busy, problem, qr, asked = null, onCannot = null, onAskShown = null, said = [], onSay = null, onShown = null, now }) {
  const thing = unit === 'block' ? 'block' : 'street';
  const hasBoard = items.length > 0;
  const desk = instrument === 'command';
  // A desk is never handed a street, so an ask is shown on the phone it was made to.
  const ask = !desk && asked ? asked : null;
  const asker = ask?.askedBy || 'The people running the search';
  // The card says when it has shown the ask, which is what the desk reads as "seen": a phone that only fetched
  // it, or a computer that does not show it, says nothing.
  useShown(ask && ask.askedSeen === false ? ask.id : null, onAskShown, beatOf(now));
  return (
    <>
      <Eyebrow>{ask ? `${asker} asked you` : lookingLine(picture.looking?.helpers || 0)}</Eyebrow>
      <Heading className="mt-1">{ask ? `Walk ${ask.name}` : `Help look for ${name}`}</Heading>
      {ask ? (
        <>
          <Lead className="mt-1.5">
            {spanWords(ask)}About {ask.minutes} minutes.
          </Lead>
          {ask.askedNote && (
            // The asker's own words, shown as theirs.
            <div className="mt-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3">
              <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">{asker}</p>
              <p className="mt-0.5 whitespace-pre-line break-words text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">{ask.askedNote}</p>
            </div>
          )}
        </>
      ) : done ? (
        <Lead className="mt-1.5">
          {done} is searched. Thank you. {counts.searched} of {counts.total} {thing}s {counts.searched === 1 ? 'is' : 'are'} searched so far.
        </Lead>
      ) : desk ? (
        <Lead className="mt-1.5">Walking a {thing} is done on a phone. Open {name}&apos;s search on yours to be given one.</Lead>
      ) : hasBoard ? (
        <Lead className="mt-1.5">
          You get one {thing} near you to walk.{minutes ? ` About ${minutes} minutes.` : ''}
        </Lead>
      ) : (
        <Lead className="mt-1.5">If you see {name}, send where. It reaches {owner?.firstName || 'the owner'} at once.</Lead>
      )}
      {/* With an ask on the card too: a word written to this person is always where they can read it. */}
      <Said said={said} picture={picture} now={now} onSay={onSay} onShown={onShown} />
      <Problem className="mt-2">{problem}</Problem>
      {desk ? (
        // A desk is never given a street: it hands the search to a phone.
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
            {ask ? 'Start' : done ? `I can walk another ${thing}` : `I can walk a ${thing}`}
          </Primary>
        )
      )}
      <SeenButton name={name} onClick={onSeen} className="mt-2.5" />
      <BottomRow owner={owner}>{ask && onCannot ? <QuietLink onClick={onCannot}>{CANNOT_WORDS}</QuietLink> : <ShareLink onShare={onShare} />}</BottomRow>
    </>
  );
}

/** Asked once: a first name and the safety tick. */
export function Join({ picture, name, owner, viewer, unit, instrument, search, onJoined, onBack }) {
  const signedIn = Boolean(viewer?.signedIn);
  // The app records a walk for someone signed in. A browser records nothing, and neither does the app for a guest.
  const records = instrument === 'field' && signedIn;
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
    if (result.error) {
      setBusy(false);
      return setProblem(result.error);
    }
    // Joined. If no street could be given, the first card says why and has the button to try again.
    await onJoined();
    setBusy(false);
    return undefined;
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Heading>Join the search</Heading>
        <QuietLink onClick={onBack} className="!min-h-[28px] shrink-0">
          Back
        </QuietLink>
      </div>
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
      <label className="mt-3.5 flex cursor-pointer items-start gap-3">
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
        Give me a {thing}
      </Primary>
      {/* Who sees what, said once and truthfully for the person reading it. */}
      <Note className="mt-2.5 text-center">
        {picture.forces > 0 ? `${ownerName} and the Rescue Force looking for ${name} see` : `${ownerName} sees`} your first name and the {thing} you walk.{' '}
        {records ? 'The app records your path while you walk it.' : 'Nobody sees where you are.'}
      </Note>
    </>
  );
}

/** "From 45th St to 41st St. " where the street's ends are named. */
function spanWords(street) {
  if (street.fromName && street.toName) return `From ${street.fromName} to ${street.toName}. `;
  if (street.toName) return `As far as ${street.toName}. `;
  if (street.fromName) return `From ${street.fromName} to the end. `;
  return '';
}

/** The street that is theirs: where, how long, and the one button that ends it. */
export function Street({ picture, name, unit, mine, instrument, gps, onWalked, onOther, onStop, onSeen, busy, problem, canOther, asked = null, onAskShown = null, said = [], onSay = null, onShown = null, now }) {
  const brief = searcherBrief(picture);
  // This card shows the ask too, so it says so: the desk is not left reading "asked" until this street is done.
  useShown(asked && asked.askedSeen === false ? asked.id : null, onAskShown, beatOf(now));
  const block = unit === 'block';
  const thing = block ? 'block' : 'street';
  const recording = instrument === 'field' && gps?.recording;
  return (
    <>
      <Heading>Walk {block ? mine.title : mine.name}</Heading>
      <Lead className="mt-1.5">
        {block ? '' : spanWords(mine)}About {mine.minutes} minutes.{recording ? ` ${brief.records}` : ''}
      </Lead>
      {asked && (
        // Asked for another street while on this one: said here, and it is the first card when this street is done.
        <div className="mt-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3">
          <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">{asked.askedBy || 'The people running the search'} asked you</p>
          <p className="mt-0.5 break-words text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">
            Walk {asked.name}.{asked.askedNote ? ` "${asked.askedNote}"` : ''}
          </p>
        </div>
      )}
      <Said said={said} picture={picture} now={now} onSay={onSay} onShown={onShown} />
      <AdviceBlock source="The searcher's brief" lines={[brief.look]} className="mt-3" />
      <Problem className="mt-2">{problem}</Problem>
      <Primary onClick={onWalked} busy={busy === 'walked'} disabled={Boolean(busy)} className="mt-4">
        I walked it
      </Primary>
      <SeenButton name={name} onClick={onSeen} className="mt-2.5" />
      <div className="mt-1 flex items-center justify-between gap-3">
        {canOther ? <QuietLink onClick={onOther}>Different {thing}</QuietLink> : <span />}
        <QuietLink onClick={onStop}>I am stopping</QuietLink>
      </div>
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
