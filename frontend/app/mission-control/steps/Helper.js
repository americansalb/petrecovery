'use client';

/**
 * Someone who wants to help, one card at a time:
 *
 *   Main    what anyone with the link sees: two buttons
 *   Join    asked once: a first name and the safety tick
 *   Area    the area of ground that is theirs, and the one button that ends it
 *   Home    the pet is home: thank you
 *
 * The search is a circle of ground in areas (app/lib/searchCircle.js),
 * because a pet does not keep to streets: someone is given an area to
 * search, the yards and sheds and creek banks in it, and not a street to
 * walk. (`Street` is the card of a search from before it was on areas.)
 *
 * There is no step between being given an area and searching it: it is
 * theirs when they get it. Nothing interrupts a search either. A
 * sighting shows in the line at the top of every screen, and the product
 * never tells a helper to stop or not to search (founder rule,
 * 2026-11-11).
 *
 * The person running the search can ask a named helper to search one area
 * (app/lib/searchZones.js) and can send them a word. Neither is a new card:
 * an ask is the first card saying which area, with the same one button,
 * and a word is a block on the card they already have, with a line to
 * answer in (components/Word.js). A word written to this person is on
 * their card while it is fresh, whatever else the card is showing, with
 * what the owner told everyone under it. Both are someone's own words,
 * shown as theirs. The card says when it has shown an ask or a word, and
 * that is what the desk reads as "seen".
 */
import { useEffect, useRef, useState } from 'react';
import { Share2, TriangleAlert } from 'lucide-react';
import { SAFETY_RULES, SAFETY_AGREEMENT, searchTraining } from '@/app/lib/safetyRules';
import { Eyebrow, Heading, Lead, Note, Primary, Second, SeenButton, QuietLink, BottomRow, AdviceBlock, Problem, Pinned, Stamp } from '../components/kit';
import Word, { Answer, useShown, beatOf, keepInView } from '../components/Word';
import { clockTime, lookingLine } from '../lib/words';
import { searcherBrief } from '../lib/briefLines';
import { areaName, isSeenCircle, whereWords, hazardLines } from '../lib/ground';
import { whenWords } from '../lib/insight';

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '';
// What the button says is what the people running the search are told in this person's name (app/lib/searchAsk.js, CANNOT_WORDS).
const CANNOT_WORDS = "I can't right now";
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '';

/**
 * What was said to this person (lib/team.js, wordsForCard): the words written to them, and what the owner told
 * everyone. Under them, one line to answer in. It is its own piece, in the same place whatever is above it, so a
 * new word arriving does not throw away an answer that is being typed. Each word written to this person says so
 * when it has been shown (`onShown`), which is what the desk reads as "seen".
 *
 * Words stay for twelve hours, and on a small phone a card that tall leaves a strip of map. So once every word
 * has been dealt with (answered, or put away with "Got it") they fold into one line that says what happened
 * last (`line`), and that line opens them again. A new word opens them by itself.
 */
function Said({ said = [], picture, now, onSay, onShown, onPutAway = null, line = '', also = null }) {
  const end = useRef(null);
  const [opened, setOpened] = useState(false);
  const waiting = said.filter((word) => word.waiting);
  const open = waiting.length > 0 || opened || !line;
  // A new word is read where it lands: a phone's sheet moves so the word, and the line to answer in, are above
  // the buttons kept at its bottom. Only when what was said changes, so reading further up is left alone.
  // `also` is anything else that arrives above the words and pushes them down (the street someone was asked to walk).
  const which = open ? said.map((word) => word.id).join(' ') : '';
  useEffect(() => {
    if (which) keepInView(end.current);
  }, [which, also]);
  if (!said.length) return null;
  const who = said[0].from || picture.owner?.firstName || 'the people running the search';
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpened(true)}
        aria-expanded="false"
        className="mt-3 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
      >
        <span className="min-w-0 text-[15px] font-semibold leading-5 text-[var(--mc-ink)]">{line}</span>
        <span className="shrink-0 text-[15px] font-semibold leading-5 text-[var(--mc-ink)] underline underline-offset-4">Read</span>
      </button>
    );
  }
  return (
    <>
      {said.map((word) => (
        <Word key={word.id} word={word} timeZone={picture.timeZone} now={now} onShown={onShown} />
      ))}
      {onSay && <Answer key="answer" who={who} onSay={onSay} />}
      {waiting.length > 0 && onPutAway ? (
        // Read, and nothing to write back.
        <QuietLink key="got" onClick={() => onPutAway(waiting)} className="!min-h-[36px]">
          Got it
        </QuietLink>
      ) : (
        opened && line && (
          <QuietLink key="close" onClick={() => setOpened(false)} className="!min-h-[36px]">
            Close
          </QuietLink>
        )
      )}
      <span ref={end} key="end" className="block h-0" aria-hidden="true" />
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
 * What the map shows in an area that a person on foot should know of (a
 * main road, a rail line, water), with what to do about it. Shown only
 * where the map shows something: a card with nothing to name carries no
 * caution at all. Founder, 2026-11-12: "Are we inadvertantly telling
 * people to search ... near the highway"; and 2026-11-13: "If you put too
 * many warnings you are putting the idea in people's heads", so this is
 * the one caution on the card, and the limits of the map are said in the
 * waiver. It does not tell anyone to stop searching.
 */
function Care({ area, className = '' }) {
  const lines = hazardLines(area);
  if (!lines.length) return null;
  return (
    <div role="note" aria-label="Take care in this area" className={`rounded-2xl border-2 border-[var(--mc-line-strong)] bg-[var(--mc-raised)] px-3.5 py-3 ${className}`}>
      <p className="flex items-center gap-1.5 text-[13px] font-extrabold leading-[18px] text-[var(--mc-ink)]">
        <TriangleAlert size={15} aria-hidden="true" />
        Take care in this area
      </p>
      {lines.map((line) => (
        <p key={line} className="mt-1.5 text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">
          {line}
        </p>
      ))}
    </div>
  );
}

const COVER_CHOICES = [
  ['ALL', 'All of it'],
  ['MOST', 'Most of it'],
  ['PART', 'Part of it'],
];

/**
 * The debrief, asked once on the card that says thank you: how much of the
 * area they covered, then anything they could not get to, in their own
 * words. It is what a search team asks of everyone who comes back, because
 * "searched" by itself says nothing the next decision can be made on
 * (founder, 2026-11-13: "A real search and rescue team would find this
 * superficial and comical"). One tap answers it; nothing waits on it.
 */
function Debrief({ onSend }) {
  const [covered, setCovered] = useState(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  async function send(value, words) {
    if (busy) return;
    setBusy(true);
    setProblem('');
    const result = await onSend(value, words);
    setBusy(false);
    if (result?.error) return setProblem(result.error);
    setCovered(value);
    if (words) setSent(true);
    return undefined;
  }
  if (sent) return <Note className="mt-3">Noted. Thank you.</Note>;
  return (
    <div className="mt-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3" role="group" aria-label="About your search">
      <p className="text-[15px] font-bold leading-[21px] text-[var(--mc-ink)]">How much of it did you cover?</p>
      <div className="mt-2 flex gap-2">
        {COVER_CHOICES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => send(value, '')}
            aria-pressed={covered === value}
            disabled={busy}
            className={`min-h-[44px] flex-1 rounded-xl border px-2 text-[15px] font-bold leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${covered === value ? 'border-[var(--mc-ink)] bg-[var(--mc-ink)] text-[var(--mc-ground)]' : 'border-[var(--mc-line-strong)] text-[var(--mc-ink)]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {covered && (
        <>
          <label htmlFor="mc-debrief" className="mt-3 block text-[13px] font-semibold leading-5 text-[var(--mc-soft)]">
            Anything you could not get to?
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="mc-debrief"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--mc-line-strong)] !bg-[var(--mc-ground)] px-3 text-[15px] font-medium !text-[var(--mc-ink)] focus:border-flash-400 focus:outline-none focus:ring-2 focus:ring-flash-400/40"
            />
            <button type="button" onClick={() => note.trim() && send(covered, note.trim())} disabled={busy || !note.trim()} className="min-h-[44px] shrink-0 rounded-xl border border-[var(--mc-line-strong)] px-3.5 text-[15px] font-bold text-[var(--mc-ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
              Add
            </button>
          </div>
        </>
      )}
      <Problem className="mt-2">{problem}</Problem>
    </div>
  );
}

/**
 * What anyone with the link sees: the streets, and two buttons. For
 * someone the person running the search has asked to walk a street
 * (`asked`), the same card says which street and whose ask it is, and its
 * one button starts it.
 */
export function Main({ picture, name, owner, unit, items, counts, minutes, done, doneAtSighting = false, onDebrief = null, instrument, onWalk, onSeen, onShare, busy, problem, qr, asked = null, onCannot = null, onAskShown = null, said = [], saidLine = '', onSay = null, onShown = null, onPutAway = null, now }) {
  const ground = unit === 'area';
  const thing = ground ? 'area' : unit === 'block' ? 'block' : 'street';
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
      <Heading className="mt-1">{ask ? (ground ? `Search ${areaName(ask)}` : `Walk ${ask.name}`) : `Help look for ${name}`}</Heading>
      {ask ? (
        <>
          <Lead className="mt-1.5">
            {ground ? `${whereWords(ask)} ` : spanWords(ask)}About {ask.minutes} minutes.
          </Lead>
          {ask.askedNote && (
            // The asker's own words, shown as theirs.
            <div className="mt-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3">
              <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">{asker}</p>
              <p className="mt-0.5 whitespace-pre-line break-words text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">{ask.askedNote}</p>
            </div>
          )}
          {/* Before they say yes: what the map shows there. */}
          {ground && <Care area={ask} className="mt-3" />}
        </>
      ) : done && ground ? (
        <>
        <Lead className="mt-1.5">
          {/* The count is of the circle's own areas. The circle round a sighting is not one of them, so it is not counted after one. */}
          {done} is searched. Thank you.{doneAtSighting ? '' : ` ${counts.searched} of the ${counts.total} areas ${counts.searched === 1 ? 'has' : 'have'} been searched so far.`}
        </Lead>
        {/* The debrief: what a search is worth depends on how much of the ground was covered. */}
        {onDebrief && <Debrief key={done} onSend={onDebrief} />}
        </>
      ) : done ? (
        <Lead className="mt-1.5">
          {done} is searched. Thank you. {counts.searched} of {counts.total} {thing}s {counts.searched === 1 ? 'is' : 'are'} searched so far.
        </Lead>
      ) : desk ? (
        <Lead className="mt-1.5">{ground ? `Searching an area is done on a phone. Open ${name}'s search on yours to be given one.` : `Walking a ${thing} is done on a phone. Open ${name}'s search on yours to be given one.`}</Lead>
      ) : hasBoard && ground ? (
        <Lead className="mt-1.5">
          You get one area of ground to search.{minutes ? ` About ${minutes} minutes.` : ''}
        </Lead>
      ) : hasBoard ? (
        <Lead className="mt-1.5">
          You get one {thing} near you to walk.{minutes ? ` About ${minutes} minutes.` : ''}
        </Lead>
      ) : (
        <Lead className="mt-1.5">If you see {name}, send where. It reaches {owner?.firstName || 'the owner'} at once.</Lead>
      )}
      {/* With an ask on the card too: a word written to this person is always where they can read it. */}
      <Said said={said} line={saidLine} picture={picture} now={now} onSay={onSay} onShown={onShown} onPutAway={onPutAway} also={ask?.id || null} />
      {/* On a phone the buttons stay on the screen, whatever was said above them. */}
      <Pinned on={!desk}>
        <Problem className={desk ? 'mt-2' : 'pb-2'}>{problem}</Problem>
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
            <Primary onClick={onWalk} busy={busy}>
              {ask ? 'Start' : ground ? (done ? 'I can search another area' : 'I can search an area') : done ? `I can walk another ${thing}` : `I can walk a ${thing}`}
            </Primary>
          )
        )}
        <SeenButton name={name} onClick={onSeen} className={desk || hasBoard ? 'mt-2.5' : ''} />
      </Pinned>
      <BottomRow owner={owner}>{ask && onCannot ? <QuietLink onClick={onCannot}>{CANNOT_WORDS}</QuietLink> : <ShareLink onShare={onShare} />}</BottomRow>
    </>
  );
}

/**
 * Asked once, and again when the waiver changes: a first name and the
 * safety tick, with the rules and the waiver one tap away under "Read
 * them". The card does not print the release itself (founder, 2026-11-13:
 * "If you put too many warnings you are putting the idea in people's
 * heads").
 * Then "Before you go out", the short training, whose one button gives
 * them their area. The screen never calls the training optional, and the
 * server refuses nobody for want of it (founder, 2026-11-12).
 */
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
  // 'agree' is the tick; 'training' is what they read once they have agreed.
  const [stage, setStage] = useState('agree');
  const ground = unit === 'area';
  const thing = ground ? 'area' : unit === 'block' ? 'block' : 'street';
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
    const result = signedIn ? await search.acceptWaiver({ waiverVersion: waiver?.version || null }) : await search.join({ name: first, waiverVersion: waiver?.version || null });
    setBusy(false);
    if (result.error) return setProblem(result.error);
    // Agreed. What to know before going out comes next, and its button gives them their ground.
    setStage('training');
    return undefined;
  }

  async function setOff() {
    if (busy) return;
    setBusy(true);
    // Recorded if it can be. Nobody is kept from a search by it.
    search.trained?.().catch(() => {});
    // If no ground could be given, the first card says why and has the button to try again.
    await onJoined();
    setBusy(false);
  }

  if (stage === 'training') return <Training name={name} unit={unit} instrument={instrument} busy={busy} onGo={setOff} />;

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
        I agree
      </Primary>
      {/* Who sees what, said once and truthfully for the person reading it. */}
      <Note className="mt-2.5 text-center">
        {picture.forces > 0 ? `${ownerName} and the Rescue Force looking for ${name} see` : `${ownerName} sees`} your first name and the {thing} you {ground ? 'search' : 'walk'}.{' '}
        {records ? 'The app records your path while you walk it.' : 'Nobody sees where you are.'}
      </Note>
    </>
  );
}

/**
 * "Before you go out": what someone reads once they have agreed, and
 * before their first ground. A card of its own, reached only from Join,
 * with the one button that gives them their area. It is never called
 * optional and has no way round it on the screen; the server refuses
 * nobody for want of it (founder, 2026-11-12: "a bit of optional training
 * on rescue ... but not say its optional").
 */
export function Training({ name, unit, instrument, busy, onGo }) {
  const ground = unit === 'area';
  const thing = ground ? 'area' : unit === 'block' ? 'block' : 'street';
  return (
    <>
      <Heading>Before you go out</Heading>
      <ol className="mt-3 flex flex-col gap-3">
        {searchTraining(name).map((point, i) => (
          <li key={point.title} className="flex gap-3">
            <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--mc-raised)] text-[13px] font-extrabold leading-none text-[var(--mc-ink)]">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-[21px] text-[var(--mc-ink)]">{point.title}</span>
              {point.text && <span className="block text-[15px] font-medium leading-[21px] text-[var(--mc-soft)]">{point.text}</span>}
            </span>
          </li>
        ))}
      </ol>
      <Pinned on={instrument !== 'command'}>
        <Primary onClick={onGo} busy={busy} className="mt-4">
          I understand. Give me {ground ? 'an area' : `a ${thing}`}
        </Primary>
      </Pinned>
    </>
  );
}

/**
 * The area of ground that is theirs: where it is, how long it takes, what
 * the site's own brief says about looking, and the one button that ends it.
 * The circle round a sighting is the same card, with the brief's line on
 * what to do on seeing the pet first.
 */
export function Area({ picture, name, mine, instrument, gps, onSearched, onOther, onStop, onSeen, busy, problem, canOther, asked = null, onAskShown = null, said = [], saidLine = '', onSay = null, onShown = null, onPutAway = null, now }) {
  const brief = searcherBrief(picture);
  // This card shows the ask too, so it says so: the desk is not left reading "asked" until this area is done.
  const askBox = useRef(null);
  useShown(asked && asked.askedSeen === false ? asked.id : null, onAskShown, beatOf(now), askBox);
  const recording = instrument === 'field' && gps?.recording;
  const desk = instrument === 'command';
  const sighting = isSeenCircle(mine);
  // With its day when it was not today: a sighting keeps its circle for three days.
  const seenWhen = sighting && mine.sightingAt ? whenWords(mine.sightingAt, picture.timeZone, now) : '';
  // The site's own brief, word for word. At a sighting, what to do on seeing the pet comes first.
  const advice = sighting ? [brief.never, brief.look] : [brief.look];
  return (
    <>
      <Eyebrow>Your area</Eyebrow>
      <Heading className="mt-1">Search {areaName(mine)}</Heading>
      <Lead className="mt-1.5">
        {whereWords(mine)}
        {seenWhen ? ` Seen ${seenWhen}.` : ''} About {mine.minutes} minutes.{recording ? ` ${brief.records}` : ''}
      </Lead>
      {asked && (
        // Asked for another area while on this one: said here, and it is the first card when this one is done.
        <div ref={askBox} className="mt-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3">
          <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">{asked.askedBy || 'The people running the search'} asked you</p>
          <p className="mt-0.5 break-words text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">
            Search {areaName(asked)}.{asked.askedNote ? ` "${asked.askedNote}"` : ''}
          </p>
        </div>
      )}
      <Care area={mine} className="mt-3" />
      <Said said={said} line={saidLine} picture={picture} now={now} onSay={onSay} onShown={onShown} onPutAway={onPutAway} also={asked?.id || null} />
      <AdviceBlock source="The searcher's brief" lines={advice} className="mt-3" />
      {/* On a phone the buttons stay on the screen, whatever was said above them. */}
      <Pinned on={!desk}>
        <Problem className={desk ? 'mt-2' : 'pb-2'}>{problem}</Problem>
        <Primary onClick={onSearched} busy={busy === 'walked'} disabled={Boolean(busy)} className={desk ? 'mt-4' : ''}>
          I searched it
        </Primary>
        <SeenButton name={name} onClick={onSeen} className="mt-2.5" />
      </Pinned>
      <div className="mt-1 flex items-center justify-between gap-3">
        {canOther ? <QuietLink onClick={onOther}>Different area</QuietLink> : <span />}
        <QuietLink onClick={onStop}>I am stopping</QuietLink>
      </div>
      {instrument === 'bridge' && (APP_STORE_URL || PLAY_STORE_URL) && (
        <Note className="mt-1">
          The app records your path with GPS as you search.{' '}
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

/** "From 45th St to 41st St. " where the street's ends are named. */
function spanWords(street) {
  if (street.fromName && street.toName) return `From ${street.fromName} to ${street.toName}. `;
  if (street.toName) return `As far as ${street.toName}. `;
  if (street.fromName) return `From ${street.fromName} to the end. `;
  return '';
}

/** The street that is theirs: where, how long, and the one button that ends it. */
export function Street({ picture, name, unit, mine, instrument, gps, onWalked, onOther, onStop, onSeen, busy, problem, canOther, asked = null, onAskShown = null, said = [], saidLine = '', onSay = null, onShown = null, onPutAway = null, now }) {
  const brief = searcherBrief(picture);
  // This card shows the ask too, so it says so: the desk is not left reading "asked" until this street is done.
  // Only once the ask is where it can be read, and not while it is scrolled out of the card.
  const askBox = useRef(null);
  useShown(asked && asked.askedSeen === false ? asked.id : null, onAskShown, beatOf(now), askBox);
  const block = unit === 'block';
  const thing = block ? 'block' : 'street';
  const recording = instrument === 'field' && gps?.recording;
  const desk = instrument === 'command';
  return (
    <>
      <Heading>Walk {block ? mine.title : mine.name}</Heading>
      <Lead className="mt-1.5">
        {block ? '' : spanWords(mine)}About {mine.minutes} minutes.{recording ? ` ${brief.records}` : ''}
      </Lead>
      {asked && (
        // Asked for another street while on this one: said here, and it is the first card when this street is done.
        <div ref={askBox} className="mt-3 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3">
          <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">{asked.askedBy || 'The people running the search'} asked you</p>
          <p className="mt-0.5 break-words text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">
            Walk {asked.name}.{asked.askedNote ? ` "${asked.askedNote}"` : ''}
          </p>
        </div>
      )}
      <Said said={said} line={saidLine} picture={picture} now={now} onSay={onSay} onShown={onShown} onPutAway={onPutAway} also={asked?.id || null} />
      <AdviceBlock source="The searcher's brief" lines={[brief.look]} className="mt-3" />
      {/* On a phone the buttons stay on the screen, whatever was said above them. */}
      <Pinned on={!desk}>
        <Problem className={desk ? 'mt-2' : 'pb-2'}>{problem}</Problem>
        <Primary onClick={onWalked} busy={busy === 'walked'} disabled={Boolean(busy)} className={desk ? 'mt-4' : ''}>
          I walked it
        </Primary>
        <SeenButton name={name} onClick={onSeen} className="mt-2.5" />
      </Pinned>
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
  // "3 areas", and "5 streets" or "2 blocks" beside it where the search began before it was on areas.
  const count = (n, word) => (n > 0 ? `${n} ${word}${n === 1 ? '' : 's'}` : '');
  const parts = searched && searched.people > 0 ? [count(searched.areas || 0, 'area'), count(searched.streets, 'street'), count(searched.blocks || 0, 'block')].filter(Boolean) : [];
  const ground = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || '';
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
