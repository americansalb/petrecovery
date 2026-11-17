'use client';

/**
 * The owner's side of the search, one thing at a time:
 *
 *   OwnerNow       where the search stands, the next step of the plan,
 *                  a way to search too, the link to share, and what to do
 *   OwnerSighting  the pet was seen: where, and one button to get there
 *
 * OwnerNow, for a panicked owner on a phone (founder, 2026-11-17: "Terrible
 * UX over the phone wow"; "Phone experience should be for the phone"). In
 * this order, and nothing behind a link:
 *
 *   1. Where the search stands, in one row of figures: people out now,
 *      the areas searched in the last 12 hours (never every area ever
 *      searched: a search fades, lib/ground.js), and the sightings.
 *   2. The next step of the plan for this animal (app/lib/searchPlan.js,
 *      nextStep: the same step the desk's Sarama says), in the plan's own
 *      words, with what the site made for it (gearFor: the flyer to
 *      print, the numbers to call), and a way to say it is done.
 *   3. A way to search too: the middle of the circle, through the same
 *      claim a helper makes. The owner signs no waiver for their own pet
 *      (app/lib/searcher.js), so nothing comes between. On it, the card is
 *      that area, with what the map shows there, and "I searched it";
 *      after it, how much of it was covered.
 *   4. The link to share.
 *   5. Three steps from the advice engine, in its own words.
 *
 * Opening directions also tells the person who saw the pet that the owner
 * is coming, so on a sighting the owner has one button and not two.
 *
 * On a phone both cards also carry what a helper said to the people
 * running the search, with a line to answer in and "Got it" (`heard`:
 * lib/team.js, wordsForOwner): the oldest one first. It is the helper's
 * own words, shown as theirs. On a desk the same words are in "Needs you"
 * and in Messages, so the card has none; the desk also has the plan's next
 * step in "Needs you", and nobody searches from a desk, so neither is here.
 *
 * Every line of advice here is the advice engine's (app/lib/adviceFor.js
 * reads app/lib/petAdvice.js), under a line that says so. Nothing is
 * written for this screen. To the owner nothing cheers: their pet is
 * missing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Navigation, Share2, TriangleAlert } from 'lucide-react';
import { adviceFor } from '@/app/lib/adviceFor';
import { nextStep, KEPT_KINDS } from '@/app/lib/searchPlan';
import { RING } from '@/app/lib/searchCircle';
import { searchedLately, FRESH_HOURS } from '@/app/lib/trail';
import { Eyebrow, Heading, Lead, Note, Primary, Second, QuietLink, AdviceBlock, Problem, Pinned } from '../components/kit';
import Gear from '../components/Gear';
import Word, { Answer, keepInView } from '../components/Word';
import { SARAMA } from '../lib/sarama';
import { clockTime, dayAndTime, placeWords, agoWords } from '../lib/words';
import { groundNow, AreaName, whereWords, hazardLines } from '../lib/ground';

/**
 * What a helper said to the people running the search, on the owner's phone card: the oldest word nobody has
 * answered, with a line to answer in and a way to put it away without answering. How many wait behind it is said,
 * and a newer one never takes its place while it is being answered.
 */
function Heard({ heard = [], picture, now, onReply, onPutAway }) {
  const word = heard[0];
  if (!word) return null;
  const more = heard.length - 1;
  return (
    <Word word={word} timeZone={picture.timeZone} now={now}>
      {onReply && <Answer key={word.id} id={`mc-reply-${word.id}`} who={word.from} onSay={(text) => onReply(word, text)} />}
      <div className="mt-1 flex items-center justify-between gap-3">
        <QuietLink onClick={() => onPutAway(word)} className="!min-h-[36px]">
          Got it
        </QuietLink>
        {more > 0 && <span className="text-[13px] font-semibold leading-[18px] text-[var(--mc-muted)]">{more === 1 ? '1 more after this' : `${more} more after this`}</span>}
      </div>
    </Word>
  );
}

function useAdvice(picture, now) {
  return useMemo(
    () => adviceFor({ petSpecies: picture.pet?.species, escapeScenario: picture.pet?.howOut, petDescription: picture.pet?.description, lastSeenAt: picture.lastSeen?.at }, now),
    // The section changes with the day, not the minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picture.pet?.species, picture.pet?.howOut, picture.pet?.description, picture.lastSeen?.at, Math.floor(now / 3600000)],
  );
}

/** How long the card waits for the plan before it shows its buttons without it. */
const PLAN_WAIT_MS = 2500;

/**
 * The plan of the search for this animal and the tasks set up so far (GET .../plan, for whoever runs the search),
 * read once when the card opens and again after the owner says a step is done. Not polled: it changes when someone
 * running the search changes it. `settled` is false until the first read has answered, or has taken too long: the
 * buttons under the next step wait for it, so they do not jump down under a finger when it arrives.
 */
function usePlan(readPlan) {
  const [plan, setPlan] = useState(null);
  const [settled, setSettled] = useState(!readPlan);
  const load = useCallback(async () => {
    if (!readPlan) return;
    const got = await readPlan();
    if (got && !got.error) setPlan(got);
    setSettled(true);
  }, [readPlan]);
  useEffect(() => {
    load();
    const late = setTimeout(() => setSettled(true), PLAN_WAIT_MS);
    return () => clearTimeout(late);
  }, [load]);
  return [plan, load, settled];
}

/** How the pet got out, where it was not from home: the middle of the circle is then not "around home". */
const AWAY = ['off_leash', 'away_from_home'];

/** An engine item's reasoning is shown under its lead-in when it is a line or two; a paragraph stays on the pet's page. */
const REST_SHOWN = 140;

/** Where the search stands, in one row: people out now, ground searched in the last 12 hours, and sightings. */
function Standing({ out, ground, total, lately, walked, thing, sightings }) {
  const cells = [
    { figure: String(out), label: out === 1 ? 'person out now' : 'people out now' },
    ground ? { figure: `${lately} of ${total}`, label: `areas searched in the last ${FRESH_HOURS} hours` } : { figure: `${walked} of ${total}`, label: `${thing}s walked` },
    { figure: String(sightings), label: sightings === 1 ? 'sighting' : 'sightings' },
  ];
  return (
    <dl aria-label="Where the search stands" className="grid grid-cols-[1fr_2fr_1fr] gap-3">
      {cells.map((cell) => (
        // The figure over its label, and the figures in one line however many lines a label takes.
        <div key={cell.label} className="flex min-w-0 flex-col-reverse justify-end">
          <dt className="text-[13px] font-semibold leading-[17px] text-[var(--mc-soft)]">{cell.label}</dt>
          <dd className="text-[22px] font-bold leading-7 tabular-nums text-[var(--mc-ink)]">{cell.figure}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The plan's next step, in its own words, with what the site made for it. "Done" sets the task up and finishes it,
 * so the next step comes up; a station, a camera or a trap is looked at again and again, so it is only set up.
 */
function NextStep({ step, onDone, busy }) {
  if (!step) return null;
  const kept = KEPT_KINDS.includes(step.kind);
  return (
    <section aria-label="Next step" className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-[17px] font-bold leading-6 text-[var(--mc-ink)]">{SARAMA.next(step.title)}</h2>
        {onDone && (
          <QuietLink onClick={onDone} className={`shrink-0 ${busy ? 'opacity-60' : ''}`}>
            {kept ? 'It is set up' : 'Done'}
          </QuietLink>
        )}
      </div>
      <p className="text-[15px] font-medium leading-[21px] text-[var(--mc-soft)]">{step.what}</p>
      {/* What the site already made for this step: the flyer to print, the numbers to call. The rest is on the pet's page. */}
      <Gear items={(step.gear || []).slice(0, 2)} className="mt-2" />
    </section>
  );
}

/** What the map shows in the owner's area, with what to do: the one caution a card carries, and only where there is one. */
function Care({ area }) {
  const lines = hazardLines(area);
  if (!lines.length) return null;
  return (
    <div role="note" aria-label="Take care in this area" className="mt-2 rounded-xl border border-[var(--mc-line-strong)] bg-[var(--mc-raised)] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[13px] font-extrabold leading-[18px] text-[var(--mc-ink)]">
        <TriangleAlert size={15} aria-hidden="true" />
        Take care in this area
      </p>
      {lines.map((line) => (
        <p key={line} className="mt-1 text-[15px] font-medium leading-[21px] text-[var(--mc-ink)]">
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
 * The owner's own search, asked about as a helper's is: how much of the area was covered, then anything that could
 * not be reached. A search counts for less where less was covered (lib/ground.js, searchStrength). One tap answers
 * it; nothing waits on it, and nothing cheers.
 */
function Covered({ onSend }) {
  const [covered, setCovered] = useState(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  // On a small phone the question opens under the buttons kept at the bottom of the card: the card moves to show it.
  const box = useRef(null);
  useEffect(() => {
    keepInView(box.current);
  }, [covered]);
  async function send(value, words) {
    if (busy) return;
    setBusy(true);
    setProblem('');
    const result = await onSend(value, words);
    setBusy(false);
    if (result?.error) {
      setProblem(result.error);
      return;
    }
    setCovered(value);
    if (words) setSent(true);
  }
  if (sent) return <Note className="mt-2">Noted.</Note>;
  return (
    <div ref={box} className="mt-2 rounded-2xl bg-[var(--mc-raised)] px-3.5 py-3" role="group" aria-label="About your search">
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
          <label htmlFor="mc-owner-debrief" className="mt-3 block text-[13px] font-semibold leading-5 text-[var(--mc-soft)]">
            Anything you could not get to?
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="mc-owner-debrief"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--mc-line-strong)] !bg-[var(--mc-ground)] px-3 text-[15px] font-medium !text-[var(--mc-ink)] focus:border-flash-400 focus:outline-none focus:ring-2 focus:ring-flash-400/40"
            />
            <button
              type="button"
              onClick={() => note.trim() && send(covered, note.trim())}
              disabled={busy || !note.trim()}
              className="min-h-[44px] shrink-0 rounded-xl border border-[var(--mc-line-strong)] px-3.5 text-[15px] font-bold text-[var(--mc-ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
            >
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
 * Where the search stands, the next step of the plan, a way to search too, the link to share, and three steps of
 * advice. `mine` is the area the owner is on, `done` the name of the one they just searched (with `onDebrief`).
 */
export function OwnerNow({
  picture,
  name,
  now,
  unit,
  items = [],
  counts,
  mine = null,
  done = null,
  onDebrief = null,
  instrument = null,
  readPlan = null,
  writePlan = null,
  onSearchHome = null,
  onSearchMore = null,
  onSearched = null,
  onStop = null,
  busy = null,
  onShare,
  onHome,
  problem,
  heard = [],
  onReply = null,
  onPutAway = null,
}) {
  const advice = useAdvice(picture, now);
  const desk = instrument === 'command';
  const ground = unit === 'area';
  const thing = unit === 'block' ? 'block' : 'street';
  // Three steps, the engine's first, each its own lead-in and, where it is short, its reasoning under it.
  const steps = [...advice.steps, ...advice.more].slice(0, 3);
  const [plan, reloadPlan, settled] = usePlan(desk ? null : readPlan);
  const next = useMemo(() => (plan ? nextStep(plan.kinds, plan.tasks) : null), [plan]);
  const [stepBusy, setStepBusy] = useState(false);
  const [stepProblem, setStepProblem] = useState('');
  // When the owner said the area they were on is searched: a search is never shown without its time.
  const [doneAt, setDoneAt] = useState(null);
  useEffect(() => {
    setDoneAt(done ? Date.now() : null);
  }, [done]);
  const g = groundNow(items, now);
  const out = (picture.looking?.helpers || 0) + (mine ? 1 : 0);
  // The middle of the circle: the ground round where the pet was lost, which is home unless it got out elsewhere.
  const middle = ground ? items.find((i) => i.ring === RING.MIDDLE) || null : null;
  const home = !AWAY.includes(picture.pet?.howOut);
  const homeWords = home ? 'Search the area around home' : `Search where ${name} was lost`;
  // Searched lately, it is not offered again first: the next area is, as a helper is given one.
  const searchWords = middle && !searchedLately(middle, now) ? homeWords : 'Search another area';
  const canSearch = !desk && ground && Boolean(onSearchHome) && items.length > 0;
  // The one yellow button: "I searched it" on an area, otherwise the area to search.
  const search = mine
    ? { words: 'I searched it', onClick: onSearched, busy: 'walked' }
    : canSearch
      ? { words: searchWords, onClick: searchWords === homeWords ? () => onSearchHome(middle) : onSearchMore, busy: 'walk' }
      : null;

  async function stepDone() {
    if (!next || !writePlan || stepBusy) return;
    setStepBusy(true);
    setStepProblem('');
    const made = await writePlan('POST', { kind: next.kind });
    // Done once it is set up, unless it is a station, a camera or a trap: those are kept and looked at again.
    const finished = made.error || KEPT_KINDS.includes(next.kind) || !made.task?.id ? made : await writePlan('PATCH', { id: made.task.id, action: 'done' });
    if (finished.error) setStepProblem(finished.error);
    await reloadPlan();
    setStepBusy(false);
  }

  return (
    <>
      <Heading className="sr-only">Where the search for {name} stands</Heading>
      {counts.total > 0 || picture.sightings?.length || out ? (
        <Standing out={out} ground={ground} total={ground ? g.total : counts.total} lately={g.lately} walked={counts.searched} thing={thing} sightings={picture.sightings?.length || 0} />
      ) : null}
      <Heard heard={heard} picture={picture} now={now} onReply={onReply} onPutAway={onPutAway} />
      {/* Until the plan has answered, nothing under the figures: its next step arriving would push the buttons down
          under a finger. The space is held, so the card does not grow up over the map when it does. */}
      {!settled && (
        <div className="flex min-h-[560px] justify-center pt-8" aria-hidden="true">
          <Loader2 size={24} className="animate-spin text-[var(--mc-muted)]" />
        </div>
      )}
      {settled && (
        <>
          {mine ? (
            // On an area: the area is the card, as a helper's is.
            <section aria-label="Your area" className="mt-3">
              <Eyebrow>You are searching</Eyebrow>
              <h2 className="mt-0.5 text-[19px] font-bold leading-6 text-[var(--mc-ink)]">{AreaName(mine)}</h2>
              <p className="mt-0.5 text-[15px] font-medium leading-[21px] text-[var(--mc-soft)]">
                {whereWords(mine)} About {mine.minutes} minutes.
              </p>
              <Care area={mine} />
            </section>
          ) : done && ground ? (
            <section aria-label="Your search" className="mt-3">
              <p className="text-[17px] font-bold leading-6 text-[var(--mc-ink)]">
                You searched {done.charAt(0).toLowerCase() + done.slice(1)}
                {doneAt ? ` at ${clockTime(doneAt, picture.timeZone)}` : ''}.
              </p>
              {onDebrief && <Covered key={done} onSend={onDebrief} />}
            </section>
          ) : (
            !desk && <NextStep step={next} onDone={writePlan ? stepDone : null} busy={stepBusy} />
          )}
          <Problem className="mt-2">{stepProblem}</Problem>
          {/* On a phone the buttons stay on the screen, whatever is above them. */}
          <Pinned on={!desk}>
            <Problem className={desk ? 'mt-2' : 'pb-2'}>{problem}</Problem>
            {search && (
              <Primary onClick={search.onClick} busy={busy === search.busy} disabled={Boolean(busy)}>
                {search.words}
              </Primary>
            )}
            <Second onClick={onShare} icon={Share2} className={search ? 'mt-2.5' : desk ? 'mt-4' : ''}>
              Text the link to neighbors
            </Second>
          </Pinned>
          {/* Over the strip the kept buttons cover below themselves (kit.js, Pinned), so what follows them reads. */}
          <div className="relative z-20">
            {mine && onStop ? (
              <div className="mt-1 flex justify-end">
                <QuietLink onClick={onStop}>I am stopping</QuietLink>
              </div>
            ) : null}
            {steps.length > 0 && (
              <section aria-label="What to do" className="mt-4">
                <Eyebrow>{advice.source}</Eyebrow>
                <ol className="mt-2 flex flex-col gap-3">
                  {steps.map((item, i) => (
                    <li key={item.full} className="flex gap-3">
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--mc-line-strong)] text-[13px] font-extrabold text-[var(--mc-soft)]"
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold leading-[21px] text-[var(--mc-ink)]">{item.lead}</span>
                        {item.rest && item.rest.length <= REST_SHOWN && <span className="block text-[15px] font-medium leading-[21px] text-[var(--mc-soft)]">{item.rest}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <div className="mt-2 flex items-center justify-between gap-3">
              <QuietLink onClick={onHome}>{name} is back with me</QuietLink>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** The pet was seen: where, the engine's first line, and one button to get there. */
export function OwnerSighting({ picture, name, hot, now, onGoing, onHome, problem, heard = [], onReply = null, onPutAway = null }) {
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
      {/* Under the way there, which comes first on this card. */}
      <Heard heard={heard} picture={picture} now={now} onReply={onReply} onPutAway={onPutAway} />
      <div className="mt-1 flex items-center justify-between gap-3">
        <QuietLink onClick={onHome}>{name} is back with me</QuietLink>
      </div>
    </>
  );
}
