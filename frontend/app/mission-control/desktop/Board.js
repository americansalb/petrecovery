'use client';

/**
 * The right of the desk: the search itself, four ways.
 *
 *   Streets    every street, in the order the search hands them out
 *   Sightings  each one, numbered in the order they happened
 *   People     who is on which street
 *   Log        what happened, newest first
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
import { Check, Eye, Footprints, MessageSquare, PawPrint, Send, Loader2 } from 'lucide-react';
import { dayAndTime, clockTime, placeWords } from '../lib/words';
import { activity, directionWord, lookFirst, metersWords, stateWords } from '../lib/insight';
import { distanceMeters } from '@/app/lib/searchGrid';

const TABS = [
  ['streets', 'Streets'],
  ['sightings', 'Sightings'],
  ['people', 'People'],
  ['log', 'Log'],
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
          Most urgent first: closest to where {picture.pet?.name || 'the pet'} was lost or seen. A helper who asks for a {thing} is given the most urgent one near them.
        </p>
      )}
      {rows.length === 0 && <Empty>{show === 'walking' ? `Nobody is walking a ${thing} right now.` : show === 'walked' ? `No ${thing} has been walked yet.` : `Every ${thing} has been walked.`}</Empty>}
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
                    {[`about ${street.minutes} min`, where, street.first ? 'asked for first' : next?.has(street.id) ? 'given out next' : ''].filter(Boolean).join(' · ')}
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

function People({ picture, items, unit, onSelect }) {
  const zone = picture.timeZone;
  const thing = unit === 'block' ? 'block' : 'street';
  const name = picture.pet?.name || 'the pet';
  const out = items.filter((i) => i.status === 'IN_PROGRESS');
  const count = picture.looking?.helpers || 0;
  if (!picture.viewer?.seesNames) {
    return (
      <Empty>
        {count === 0 ? 'Nobody is out looking right now.' : count === 1 ? '1 person is out looking.' : `${count} people are out looking.`} Who they are is shown to {picture.owner?.firstName || 'the owner'} and the Rescue Force looking for {name}. Everyone else sees {thing}s, not people.
      </Empty>
    );
  }
  return (
    <>
      {out.length === 0 && <Empty>Nobody is walking a {thing} right now.</Empty>}
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-2">
        {out.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => onSelect(i.id)} className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--mc-teal)] text-sm font-extrabold text-[var(--mc-on-teal)]" aria-hidden="true">
                {String(i.claimedByName || '?').charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold leading-5 text-[var(--mc-ink)]">
                  {i.claimedByName || 'A helper'}
                  <span className="font-medium text-[var(--mc-muted)]"> since {clockTime(i.claimedAt, zone)}</span>
                </span>
                <span className="block text-[14px] font-medium leading-5 text-[var(--mc-soft)]">{i.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

const ICON = { seen: Eye, walk: Footprints, start: Footprints, said: MessageSquare, owner: Eye, lost: PawPrint };

function Log({ picture, items, now, onSelect, onFocus, onTell }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const zone = picture.timeZone;
  const events = activity({ items, picture, now });
  async function tell() {
    const words = text.trim();
    if (!words || busy) return;
    setBusy(true);
    setProblem('');
    const result = await onTell(words);
    setBusy(false);
    if (result?.error) return setProblem(result.error);
    return setText('');
  }
  return (
    <>
      {picture.viewer?.isOwner && (
        <div className="px-4 pb-2 pt-3">
          <label htmlFor="mc-tell" className="block text-[13px] font-semibold leading-5 text-[var(--mc-soft)]">
            Tell everyone helping
          </label>
          <textarea
            id="mc-tell"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder={`What helps someone find ${picture.pet?.name || 'the pet'}?`}
            className="mt-1 w-full resize-none rounded-xl border border-[var(--mc-line-strong)] !bg-[var(--mc-ground)] px-3 py-2 text-[15px] font-medium leading-[22px] !text-[var(--mc-ink)] placeholder:text-[var(--mc-muted)] focus:border-flash-400 focus:outline-none focus:ring-2 focus:ring-flash-400/40"
          />
          {problem && (
            <p role="alert" className="mt-1 text-sm font-semibold text-[var(--mc-danger)]">
              {problem}
            </p>
          )}
          <button type="button" onClick={tell} disabled={busy || !text.trim()} className="mt-1.5 inline-flex min-h-[36px] items-center gap-2 rounded-lg bg-[var(--mc-ink)] px-3 text-[14px] font-bold text-[var(--mc-surface)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />} Post it
          </button>
          <p className="mt-1 text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">It goes on {picture.pet?.name || 'the pet'}&apos;s page and in this log.</p>
        </div>
      )}
      {events.length === 0 && <Empty>Nothing has happened yet.</Empty>}
      <ol className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
        {events.map((e) => {
          const Icon = ICON[e.kind] || PawPrint;
          const act = e.streetId ? () => onSelect(e.streetId) : e.sightingId ? () => onFocus(e.sightingId) : null;
          const body = (
            <>
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${e.kind === 'seen' ? 'bg-[var(--mc-seen)] text-[var(--mc-on-seen)]' : e.kind === 'lost' ? 'bg-red-600 text-white' : 'bg-[var(--mc-raised)] text-[var(--mc-soft)]'}`} aria-hidden="true">
                <Icon size={13} strokeWidth={2.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium leading-5 text-[var(--mc-ink)]">{e.text}</span>
                <span className="block text-[13px] font-semibold leading-[18px] text-[var(--mc-muted)]">{dayAndTime(e.at, zone, now)}</span>
              </span>
            </>
          );
          return (
            <li key={e.id}>
              {act ? (
                <button type="button" onClick={act} className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
                  {body}
                </button>
              ) : (
                <div className="flex items-start gap-2.5 px-2.5 py-2">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

export default function Board({ picture, items, unit, now, tab, onTab, next, selected, hovered, onSelect, onHover, focused, onFocus, onAdd, onTell, overview = null }) {
  const counts = { streets: items.length, sightings: picture.sightings.length, people: picture.looking?.helpers || 0 };
  // On a narrower screen the left column's cards are the first tab here, and the map keeps the room.
  const tabs = overview ? [['overview', 'Overview'], ...TABS] : TABS;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 border-b border-[var(--mc-line)] px-2" role="tablist" aria-label="The search">
        {tabs.map(([id, words]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => onTab(id)}
            className={`-mb-px flex min-h-[48px] flex-1 items-center justify-center gap-1.5 border-b-[3px] px-1 text-[15px] leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${
              tab === id ? 'border-[var(--mc-ink)] font-extrabold text-[var(--mc-ink)]' : 'border-transparent font-semibold text-[var(--mc-muted)] hover:text-[var(--mc-ink)]'
            }`}
          >
            {words}
            {!overview && counts[id] != null && <span className="text-[13px] font-bold tabular-nums text-[var(--mc-muted)]">{counts[id]}</span>}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col" role="tabpanel">
        {tab === 'overview' && overview}
        {tab === 'streets' && <Streets picture={picture} items={items} unit={unit} next={next} selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover} />}
        {tab === 'sightings' && <Sightings picture={picture} now={now} focused={focused} onFocus={onFocus} onAdd={onAdd} />}
        {tab === 'people' && <People picture={picture} items={items} unit={unit} onSelect={onSelect} />}
        {tab === 'log' && <Log picture={picture} items={items} now={now} onSelect={onSelect} onFocus={onFocus} onTell={onTell} />}
      </div>
    </div>
  );
}
