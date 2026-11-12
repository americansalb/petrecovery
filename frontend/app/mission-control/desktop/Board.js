'use client';

/**
 * The right of the desk: the search itself, four ways.
 *
 *   People     everyone on the search and what each is doing; for the
 *              owner, give one of them a street or write to them
 *              (People.js)
 *   Streets    every street, in the order the search hands them out
 *   Sightings  each one, numbered in the order they happened
 *   Messages   everything said and everything that happened, in one stream
 *              (Messages.js)
 *
 * The list and the map point at the same thing: pointing at a row lights
 * its street, clicking it picks the street, and picking a street on the
 * map brings its row into view.
 *
 * Names appear exactly where the board and the picture carry them, which
 * is for the owner and the Rescue Forces looking for the pet. Everyone
 * else reads streets, not people.
 */
import { useEffect, useRef, useState } from 'react';
import { Check, Eye } from 'lucide-react';
import { dayAndTime, clockTime, placeWords } from '../lib/words';
import { directionWord, lookFirst, metersWords, stateWords } from '../lib/insight';
import { unanswered } from '../lib/team';
import { distanceMeters } from '@/app/lib/searchGrid';
import People from './People';
import Messages from './Messages';

const TABS = [
  ['people', 'People'],
  ['streets', 'Streets'],
  ['sightings', 'Sightings'],
  ['messages', 'Messages'],
];

const Empty = ({ children }) => <p className="px-4 py-6 text-[15px] font-medium leading-[22px] text-[var(--mc-muted)]">{children}</p>;

/**
 * A street's mark beside its row, saying what its line on the map says:
 * a tick for walked, teal for someone on it, a large dark dot for given
 * out next, a small one for still to walk.
 */
function Dot({ street, next }) {
  if (street.status === 'SEARCHED') {
    return (
      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--mc-done)]" aria-hidden="true">
        <Check size={11} strokeWidth={3.5} className="text-white" />
      </span>
    );
  }
  if (street.status === 'IN_PROGRESS') return <span className="mt-1 h-4 w-4 shrink-0 rounded-full border-[3px] border-dotted border-[var(--mc-teal)]" aria-hidden="true" />;
  if (next || street.first) return <span className="mx-0.5 mt-1.5 h-3 w-3 shrink-0 rounded-full bg-[var(--mc-ink)]" aria-hidden="true" />;
  return <span className="mx-1 mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--mc-muted)]" aria-hidden="true" />;
}

/**
 * What an empty list says. An empty list is not "all done": the streets may
 * not be here yet, or the report may have no place to draw them round.
 */
export function emptyWords({ show, thing, total, walking, placed, name }) {
  if (total === 0) return placed ? `The ${thing}s of this search are not here yet. They show as soon as they load.` : `This search has no ${thing}s: the report does not say where ${name} was lost.`;
  if (show === 'walking') return `Nobody is walking a ${thing} right now.`;
  if (show === 'walked') return `No ${thing} has been walked yet.`;
  return walking > 0 ? `Every ${thing} has been walked or has someone on it.` : `Every ${thing} has been walked.`;
}

/** A street kept for someone the person running the search asked: whose, where names go, and only that it is kept for everyone else. */
function keptWords(street) {
  const open = street.status === 'UNSEARCHED' || street.status === 'NEEDS_REVISIT';
  if (!open || !street.reserved) return '';
  return street.askedOfName ? `kept for ${street.askedOfName}` : 'kept for someone who was asked';
}

function Streets({ picture, items, unit, next, selected, hovered, onSelect, onHover }) {
  const [show, setShow] = useState('all');
  const thing = unit === 'block' ? 'block' : 'street';
  const origin = picture.lastSeen && Number.isFinite(picture.lastSeen.lat) ? picture.lastSeen : null;
  const open = lookFirst(items);
  const walking = items.filter((i) => i.status === 'IN_PROGRESS');
  const walked = items.filter((i) => i.status === 'SEARCHED').sort((a, b) => new Date(b.searchedAt) - new Date(a.searchedAt));
  const groups = { all: [...walking, ...open, ...walked], open, walking, walked };
  const rows = groups[show];
  const picked = useRef(null);
  useEffect(() => {
    // A street picked on the map is brought into view here.
    if (selected && picked.current) picked.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected, show]);
  const chips = [
    ['all', `All ${items.length}`],
    ['open', `Not walked ${open.length}`],
    ['walking', `Being walked ${walking.length}`],
    ['walked', `Walked ${walked.length}`],
  ];
  return (
    <>
      <div className="flex flex-wrap gap-1.5 px-4 pb-2 pt-3" role="radiogroup" aria-label={`Which ${thing}s to list`}>
        {chips.map(([id, words]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={show === id}
            onClick={() => setShow(id)}
            className={`min-h-[32px] rounded-full border px-3 text-[13px] font-bold leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${
              show === id ? 'border-[var(--mc-ink)] bg-[var(--mc-ink)] text-[var(--mc-surface)]' : 'border-[var(--mc-line-strong)] text-[var(--mc-soft)] hover:text-[var(--mc-ink)]'
            }`}
          >
            {words}
          </button>
        ))}
      </div>
      {show !== 'walked' && open.length > 0 && show !== 'walking' && (
        <p className="px-4 pb-1.5 text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">
          Most urgent first: closest to where {picture.pet?.name || 'the pet'} was lost or seen. A helper who asks for a {thing} is given the most urgent one, the nearest to them where several are as urgent.
        </p>
      )}
      {rows.length === 0 && <Empty>{emptyWords({ show, thing, total: items.length, walking: walking.length, placed: Boolean(origin), name: picture.pet?.name || 'the pet' })}</Empty>}
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {rows.map((street) => {
          const on = street.id === selected;
          const away = origin && street.center ? distanceMeters(origin, street.center) : NaN;
          const where = Number.isFinite(away) ? (away < 50 ? 'where lost' : `${metersWords(away)} ${directionWord(origin, street.center)}`) : '';
          return (
            <li key={street.id} ref={on ? picked : null}>
              <button
                type="button"
                onClick={() => onSelect(on ? null : street.id)}
                onMouseEnter={() => onHover(street.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(street.id)}
                onBlur={() => onHover(null)}
                aria-pressed={on}
                className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${
                  on ? 'bg-[var(--mc-pick)] ring-2 ring-[var(--mc-ink)]' : street.id === hovered ? 'bg-[var(--mc-raised)]' : 'hover:bg-[var(--mc-raised)]'
                }`}
              >
                <Dot street={street} next={next?.has(street.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold leading-5 text-[var(--mc-ink)]">{street.title}</span>
                  <span className="block text-[13px] font-medium leading-5 text-[var(--mc-muted)]">
                    {[`about ${street.minutes} min`, where, keptWords(street) || (street.first ? 'asked for first' : next?.has(street.id) ? 'given out next' : '')].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={`shrink-0 pt-0.5 text-[13px] font-bold leading-5 ${street.status === 'IN_PROGRESS' ? 'text-[var(--mc-teal-ink)]' : street.status === 'SEARCHED' ? 'text-[var(--mc-done-ink)]' : 'text-[var(--mc-muted)]'}`}>{stateWords(street)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Sightings({ picture, now, focused, onFocus, onAdd }) {
  const zone = picture.timeZone;
  const name = picture.pet?.name || 'the pet';
  // Numbered in the order they happened, listed newest first.
  const numbered = [...picture.sightings].sort((a, b) => new Date(a.at) - new Date(b.at)).map((s, i) => ({ ...s, n: i + 1 }));
  return (
    <>
      <div className="px-4 pb-1 pt-3">
        <button type="button" onClick={onAdd} className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--mc-line-strong)] bg-[var(--mc-raised)] px-3 text-[15px] font-bold text-[var(--mc-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
          <Eye size={18} className="text-[var(--mc-seen-ink)]" aria-hidden="true" /> Add a sighting
        </button>
      </div>
      {numbered.length === 0 && <Empty>Nobody has reported seeing {name} yet. A sighting sent from any phone shows here and on the map.</Empty>}
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {numbered.reverse().map((s) => {
          const where = placeWords(s.place);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onFocus(focused === s.id ? null : s.id)}
                aria-pressed={focused === s.id}
                className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${focused === s.id ? 'bg-[var(--mc-seen-bg)] ring-1 ring-[var(--mc-seen)]' : 'hover:bg-[var(--mc-raised)]'}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--mc-seen)] text-[13px] font-extrabold text-[var(--mc-on-seen)]" aria-hidden="true">
                  {s.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold leading-5 text-[var(--mc-ink)]">{where ? `Seen ${where}` : 'Marked on the map'}</span>
                  <span className="block text-[13px] font-medium leading-5 text-[var(--mc-muted)]">
                    {dayAndTime(s.at, zone, now)}
                    {s.by ? ` · from ${s.by}` : ''}
                    {s.ownerGoingAt && picture.owner?.firstName ? ` · ${picture.owner.firstName} set off ${clockTime(s.ownerGoingAt, zone)}` : ''}
                  </span>
                  {s.note && !/^Seen by /.test(s.note) && <span className="mt-0.5 block text-[14px] font-medium leading-5 text-[var(--mc-soft)]">{s.note}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function Board({ picture, items, unit, now, tab, onTab, next, selected, hovered, onSelect, onHover, focused, onFocus, onAdd, onTell, overview = null, people = [], talk = [], person = null, onPerson, to = null, onTo, onAsk, onUnask, onWord, onPick, onShare }) {
  const names = Boolean(picture.viewer?.seesNames);
  // How many are on the search where this person may know; otherwise how many are out, which anyone may.
  const counts = { people: names ? people.length : picture.looking?.helpers || 0, streets: items.length, sightings: picture.sightings.length };
  // Words from helpers that nobody running the search has answered: said on the tab, so they are seen from any other.
  const waiting = unanswered(talk).length;
  // Where the search is on squares, that tab says so.
  const named = TABS.map(([id, words]) => [id, id === 'streets' && unit === 'block' ? 'Blocks' : words]);
  // On a narrower screen the left column's cards are the first tab here, and the map keeps the room.
  const tabs = overview ? [['overview', 'Overview'], ...named] : named;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 border-b border-[var(--mc-line)] px-1" role="tablist" aria-label="The search">
        {tabs.map(([id, words]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => onTab(id)}
            className={`-mb-px flex min-h-[48px] flex-auto items-center justify-center gap-1 whitespace-nowrap border-b-[3px] px-1.5 text-[14px] leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${
              tab === id ? 'border-[var(--mc-ink)] font-extrabold text-[var(--mc-ink)]' : 'border-transparent font-semibold text-[var(--mc-muted)] hover:text-[var(--mc-ink)]'
            }`}
          >
            {words}
            {/* A count where there is something to count, and room for it: four tabs share a narrow column. */}
            {!overview && counts[id] > 0 && <span className="text-[13px] font-bold tabular-nums text-[var(--mc-muted)]">{counts[id]}</span>}
            {id === 'messages' && waiting > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--mc-ink)] px-1 text-[13px] font-extrabold tabular-nums text-[var(--mc-surface)]">
                {waiting}
                <span className="sr-only"> not answered</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col" role="tabpanel">
        {tab === 'overview' && overview}
        {tab === 'people' && <People picture={picture} people={people} items={items} unit={unit} now={now} selected={selected} words={talk} open={person} onOpen={onPerson} onAsk={onAsk} onUnask={onUnask} onWord={onWord} onPick={onPick} onShare={onShare} />}
        {tab === 'streets' && <Streets picture={picture} items={items} unit={unit} next={next} selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover} />}
        {tab === 'sightings' && <Sightings picture={picture} now={now} focused={focused} onFocus={onFocus} onAdd={onAdd} />}
        {tab === 'messages' && <Messages picture={picture} items={items} now={now} people={people} words={talk} to={to} onTo={onTo} onSelect={onSelect} onFocus={onFocus} onTell={onTell} onWord={onWord} onAdd={onAdd} />}
      </div>
    </div>
  );
}
