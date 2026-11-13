'use client';

/**
 * The desk's Ground: the search as areas of ground, and the card of the
 * one that is picked.
 *
 *   Ground    every area of the circle with what has happened on it: not
 *             searched, who is on it and since when, or when it was last
 *             searched, how many times and by whom. A circle round a fresh
 *             sighting is listed first. Under them, what widening the
 *             search would add.
 *   AreaCard  the area picked on the map or in the list, in the list's own
 *             place so it covers none of the map: where it is, how long
 *             it takes, what the site tells whoever searches it, and for
 *             the person running the search, who to ask and where the
 *             next helpers go.
 *
 * A search is a circle of ground and not a list of streets, because a pet
 * does not keep to streets (app/lib/searchCircle.js). An area is never
 * "done": the list says how many times each was searched, and the person
 * running the search decides what gets another look.
 *
 * The list is in a fixed order (the circle round a sighting, the middle,
 * then clockwise from north), so a row does not jump when its state
 * changes. What is given out next is marked on its row.
 *
 * Names appear exactly where the board carries them, which is for the
 * owner and the Rescue Forces looking for the pet.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Flag, Loader2, Maximize, RotateCcw } from 'lucide-react';
import { metersWords } from '../lib/insight';
import { clockTime } from '../lib/words';
import { searcherBrief } from '../lib/briefLines';
import { areaFacts, areaLine, areaName, areaState, circleAreas, isSeenCircle, searchLog, searchStrength } from '../lib/ground';

const CONTROL =
  'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--mc-line-strong)] bg-[var(--mc-surface)] px-3 text-[13px] font-bold leading-5 text-[var(--mc-ink)] shadow-sm hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';

const Empty = ({ children }) => <p className="px-4 py-6 text-[15px] font-medium leading-[22px] text-[var(--mc-muted)]">{children}</p>;

/** The bearing an area lies on: 0 for the north side, 90 for the east. */
const midBearing = (area) => {
  const span = (((area.b - area.a) % 360) + 360) % 360 || 360;
  return (area.a + span / 2) % 360;
};

/** The list's own order: a sighting's circle, the middle, then each ring clockwise from north. */
export function inListOrder(areas = []) {
  return [...areas].sort(
    (x, y) => Number(isSeenCircle(y)) - Number(isSeenCircle(x)) || (isSeenCircle(x) ? new Date(y.sightingAt || 0) - new Date(x.sightingAt || 0) : x.ring - y.ring || midBearing(x) - midBearing(y))
  );
}

/** A point on the glyph's own circle: `r` from its middle, on a bearing clockwise from north. */
const at = (r, bearing) => {
  const turn = (bearing * Math.PI) / 180;
  return `${(12 + r * Math.sin(turn)).toFixed(2)} ${(12 - r * Math.cos(turn)).toFixed(2)}`;
};
/** The outline of one area on the glyph: a disc for the middle, a wedge of a ring for a side or an outer area. */
function wedge(area, wide) {
  // Where the three rings fall on a 24 px glyph. Not widened, the sides reach its edge.
  const [inner, edge, far] = wide ? [3.6, 7.4, 11] : [4.4, 11, 11];
  if (area.ring === 0) return `M ${at(inner, 0)} A ${inner} ${inner} 0 1 1 ${at(inner, 180)} A ${inner} ${inner} 0 1 1 ${at(inner, 0)} Z`;
  const [r1, r2] = area.ring === 1 ? [inner, edge] : [edge, far];
  const span = (((area.b - area.a) % 360) + 360) % 360 || 360;
  const large = span > 180 ? 1 : 0;
  return `M ${at(r2, area.a)} A ${r2} ${r2} 0 ${large} 1 ${at(r2, area.a + span)} L ${at(r1, area.a + span)} A ${r1} ${r1} 0 ${large} 0 ${at(r1, area.a)} Z`;
}

/**
 * An area's mark beside its row: the circle of the search, small, with
 * this area's own part of it filled in. So a row shows where its area
 * lies before its name is read, and its colour says what its shape on the
 * map says: ink for not searched (heavier where it is given out next),
 * teal for someone on it, green for searched and deeper green for twice.
 * An area put up for another look keeps its green inside an ink edge. The
 * circle round a sighting is an orange ring. It is a picture and never a
 * box to tick: what can be done to an area is a button with words on it.
 */
export function Glyph({ area, next = false, wide = false, size = 26, now = Date.now() }) {
  if (isSeenCircle(area)) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="var(--mc-seen-bg)" stroke="var(--mc-seen)" strokeWidth="2" strokeDasharray="3.2 2.6" />
        <circle cx="12" cy="12" r="3.2" fill="var(--mc-seen)" />
      </svg>
    );
  }
  const searched = area.searchCount > 0;
  const busy = area.status === 'IN_PROGRESS';
  const again = area.status === 'NEEDS_REVISIT';
  const fill = busy ? 'var(--mc-teal)' : searched ? 'var(--mc-done)' : 'var(--mc-ink)';
  // Green as strong as the area counts as searched right now: a search fades over a day.
  const strength = busy ? 0.3 : searched ? 0.12 + 0.8 * searchStrength(area, now) : next || area.first ? 0.85 : 0.22;
  const edge = busy ? 'var(--mc-teal)' : again || next || area.first ? 'var(--mc-ink)' : searched ? 'var(--mc-done)' : 'var(--mc-muted)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="none" stroke="var(--mc-line-strong)" strokeWidth="1" opacity="0.7" />
      <path d={wedge(area, wide)} fill={fill} fillOpacity={strength} stroke={edge} strokeWidth={busy || again ? 1.6 : 1.2} strokeDasharray={busy ? '2 1.6' : undefined} strokeLinejoin="round" />
    </svg>
  );
}

/** What a row says of where its area is given out: asked for first, given out next, or nothing. */
function turnWords(area, next) {
  if (area.first) return 'asked for first';
  return next ? 'given out next' : '';
}

export default function Ground({ picture, items, circle, next, now, leads, selected, hovered, onSelect, onHover, onWiden, widening = false, onSteer = null }) {
  const name = picture.pet?.name || 'the pet';
  const zone = picture.timeZone;
  const rows = inListOrder(items);
  const own = circleAreas(items);
  const placed = picture.lastSeen && Number.isFinite(picture.lastSeen.lat);
  const wide = Boolean(circle?.widened);
  // The row whose button was pressed, until the search has answered.
  const [pending, setPending] = useState(null);
  const [fault, setFault] = useState('');
  const mark = async (area, action) => {
    if (pending || !onSteer) return;
    setPending(area.id);
    setFault('');
    try {
      const result = await onSteer(area, action);
      if (result?.error) setFault(result.error);
    } finally {
      setPending(null);
    }
  };
  const picked = useRef(null);
  useEffect(() => {
    // An area picked on the map is brought into view here.
    if (selected && picked.current) picked.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);
  if (!rows.length) {
    return <Empty>{placed ? 'The areas of this search are not here yet. They show as soon as they load.' : `This search has no areas: the report does not say where ${name} was lost.`}</Empty>;
  }
  const canWiden = circle && !circle.widened && circle.wide > circle.edge;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-3">
      <div className="px-4 pb-2 pt-3">
        <h2 className="text-[16px] font-bold leading-[22px] text-[var(--mc-ink)]">{circle ? `Within ${metersWords(circle.radius)} of where ${name} was lost` : `Around where ${name} was lost`}</h2>
        <p className="mt-0.5 text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">
          {own.length} areas of ground. A helper who asks is given the one that needs it most. Several people can search one area at once.
        </p>
      </div>
      {fault && (
        <p role="alert" className="px-4 pb-1 text-sm font-semibold text-[var(--mc-danger)]">
          {fault}
        </p>
      )}
      <ul className="px-2">
        {rows.map((area) => {
          const on = area.id === selected;
          const soon = next?.has(area.id);
          const turn = turnWords(area, soon);
          // What the person running the search most often does to an area, on its own row: say it has been
          // searched (by them, or by someone who looked without the site), or ask for another look at it.
          const sighting = isSeenCircle(area);
          const canMark = leads && area.status !== 'IN_PROGRESS' && (area.searchCount === 0 || area.status === 'NEEDS_REVISIT');
          const canAgain = leads && area.status === 'SEARCHED';
          const tone = area.status === 'IN_PROGRESS' ? 'text-[var(--mc-teal-ink)]' : area.searchCount > 0 && area.status !== 'NEEDS_REVISIT' ? 'text-[var(--mc-done-ink)]' : 'text-[var(--mc-soft)]';
          return (
            <li key={area.id} ref={on ? picked : null} className={`group relative rounded-xl ${on ? 'bg-[var(--mc-pick)] ring-2 ring-[var(--mc-ink)]' : area.id === hovered ? 'bg-[var(--mc-raised)]' : 'hover:bg-[var(--mc-raised)]'}`}>
              <button
                type="button"
                onClick={() => onSelect(on ? null : area.id)}
                onMouseEnter={() => onHover(area.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(area.id)}
                onBlur={() => onHover(null)}
                aria-pressed={on}
                className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
              >
                <Glyph area={area} next={soon} wide={wide} now={now} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-bold leading-5 text-[var(--mc-ink)]">{area.name}</span>
                    <span className="shrink-0 text-[13px] font-semibold leading-5 text-[var(--mc-muted)]">about {area.minutes} min</span>
                  </span>
                  <span className={`block text-[14px] font-medium leading-5 ${tone}`}>
                    {areaLine(area, { timeZone: zone, now, owner: picture.owner?.firstName || null, isOwner: Boolean(picture.viewer?.isOwner) })}
                  </span>
                  {(turn || (area.asked || []).length > 0) && (
                    <span className="block text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">
                      {[turn, ...(area.asked || []).map((a) => `${a.name} asked at ${clockTime(a.at, zone)}${a.seenAt ? ', seen' : ''}`)].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  {/* Room for the button below, which is its own control and cannot sit inside this one. */}
                  {(canMark || canAgain) && <span className="block h-9" aria-hidden="true" />}
                </span>
              </button>
              {(canMark || canAgain) && (
                <button
                  type="button"
                  onClick={() => mark(area, canMark ? 'walked' : 'again')}
                  disabled={Boolean(pending)}
                  className="absolute bottom-2 left-[50px] inline-flex min-h-[30px] items-center gap-1.5 rounded-lg border border-[var(--mc-line-strong)] bg-[var(--mc-surface)] px-2.5 text-[13px] font-bold leading-5 text-[var(--mc-ink)] shadow-sm hover:border-[var(--mc-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 disabled:opacity-60"
                >
                  {pending === area.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : canMark ? <Check size={14} strokeWidth={3} className="text-[var(--mc-done-ink)]" aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />}
                  {canMark ? (sighting ? 'Mark as checked' : 'Mark searched') : 'Needs another look'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {canWiden && (
        <div className="mx-4 mt-2 rounded-xl border border-dashed border-[var(--mc-line-strong)] px-3 py-2.5">
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-[15px] font-bold leading-5 text-[var(--mc-ink)]">Further out</span>
            <span className="shrink-0 text-[13px] font-semibold leading-5 text-[var(--mc-muted)]">
              {metersWords(circle.edge)} to {metersWords(circle.wide)}
            </span>
          </p>
          <p className="text-[14px] font-medium leading-5 text-[var(--mc-soft)]">8 more areas. Not part of the search yet.</p>
          {leads ? (
            <button type="button" onClick={onWiden} disabled={widening} className={`${CONTROL} mt-2 disabled:opacity-60`}>
              {widening ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Maximize size={15} aria-hidden="true" />} Widen to {metersWords(circle.wide)}
            </button>
          ) : (
            <p className="mt-1 text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">{picture.owner?.firstName || 'The owner'} decides when the search is widened.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The area that is picked: what is known about it, what the site tells
 * whoever searches it, and what the person running the search can do
 * about it.
 */
export function AreaCard({ area, picture, circle, now, leads, busy, problem, free = [], next = false, onSteer, onAsk, onUnask, onClose }) {
  const zone = picture.timeZone;
  const facts = areaFacts(area, { picture, circle, now });
  const log = searchLog(area, { timeZone: picture.timeZone, now });
  const brief = searcherBrief(picture);
  const sighting = isSeenCircle(area);
  const searching = area.status === 'IN_PROGRESS';
  const mapsHref = area.center ? `https://www.google.com/maps/dir/?api=1&destination=${area.center.lat},${area.center.lng}&travelmode=walking` : null;
  const act = (action, words, Icon) => (
    <button key={action} type="button" onClick={() => onSteer(area, action)} disabled={Boolean(busy)} className={`${CONTROL} disabled:opacity-60`}>
      {busy === action ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />} {words}
    </button>
  );
  // A sighting's circle takes one person: with someone there, on the way or asked, nobody else is sent.
  const taken = sighting && (area.on > 0 || (area.asked || []).some((a) => a.holds) || Boolean(area.going));
  return (
    <section aria-label={area.name} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
      <button type="button" onClick={onClose} className="-ml-1 mt-3 inline-flex min-h-[32px] items-center gap-1.5 self-start rounded-lg px-1 text-[13px] font-bold text-[var(--mc-soft)] hover:text-[var(--mc-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
        <ArrowLeft size={16} aria-hidden="true" /> All the ground
      </button>
      <div className="mt-2 flex items-start gap-3">
        <Glyph area={area} next={next} wide={Boolean(circle?.widened)} size={30} now={now} />
        <div className="min-w-0">
          <h2 className="text-[19px] font-extrabold leading-[25px] text-[var(--mc-ink)]">{area.name}</h2>
          <p className="text-[13px] font-bold leading-[19px] text-[var(--mc-muted)]">
            {areaState(area, now)}
            {area.first ? ' · asked for first' : next ? ' · given out next' : ''}
          </p>
        </div>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {facts.map((fact) => (
          <li key={fact} className="text-[15px] font-medium leading-[22px] text-[var(--mc-soft)]">
            {fact}
          </li>
        ))}
        {sighting && <li className="text-[15px] font-medium leading-[22px] text-[var(--mc-soft)]">One person goes to a sighting, never a group.</li>}
      </ul>
      {/* The record: every search of this area, newest first. When, who, how long, how much of it, what was missed. */}
      {log.length > 0 && (
        <div className="mt-3 rounded-xl bg-[var(--mc-raised)] px-3 py-2.5" aria-label="Searches of this area">
          <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">{log.length === 1 ? 'The search of this area' : `The last ${log.length} searches of this area`}</p>
          <ol className="mt-1 flex flex-col gap-1.5">
            {log.map((line) => (
              <li key={line} className="break-words text-[14px] font-medium leading-5 text-[var(--mc-ink)]">
                {line}
              </li>
            ))}
          </ol>
          <p className="mt-1.5 text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">A search counts for less as the hours pass, and for nothing after a day.</p>
        </div>
      )}
      {/* The site's own brief, word for word: what whoever is given this area reads on their phone. */}
      <div className="mt-3 rounded-xl bg-[var(--mc-raised)] px-3 py-2.5">
        <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">What the helper is told, in the site&apos;s own words</p>
        {(sighting ? [brief.never, brief.look] : [brief.look]).filter(Boolean).map((line) => (
          <p key={line} className="mt-0.5 text-[14px] font-medium leading-5 text-[var(--mc-ink)]">
            {line}
          </p>
        ))}
      </div>
      {problem && (
        <p role="alert" className="mt-2 text-sm font-semibold text-[var(--mc-danger)]">
          {problem}
        </p>
      )}
      {leads && !taken && (
        // From an area to a person. The button asks them at once, as the same button under "Needs you" does, and
        // then opens them, where the ask shows as asked, seen, started. An ask with a note is made from People.
        <div className="mt-3 border-t border-[var(--mc-line)] pt-3">
          <p className="text-[13px] font-bold leading-5 text-[var(--mc-muted)]">Who searches it</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {free.slice(0, 4).map((p) => (
              <button key={p.handle} type="button" onClick={() => onAsk(p.handle)} disabled={Boolean(busy)} className={`${CONTROL} disabled:opacity-60`}>
                {busy === `ask:${p.handle}` && <Loader2 size={15} className="animate-spin" aria-hidden="true" />} Ask {p.name}
              </button>
            ))}
            {free.length === 0 && <span className="text-[14px] font-medium leading-5 text-[var(--mc-soft)]">Nobody is free right now.</span>}
          </div>
          {next && <p className="mt-1.5 text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">Whoever asks for ground next is given {areaName(area)}.</p>}
          {area.first && <p className="mt-1.5 text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">Helpers who offer to search are sent here before any other area, until it is searched.</p>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {mapsHref && (
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={CONTROL}>
            <ExternalLink size={15} aria-hidden="true" /> Open in Google Maps
          </a>
        )}
        {leads && !area.first && !taken && act('first', 'Send the next helpers here first', Flag)}
        {leads && area.first && act('normal', 'Back to its place in the order', RotateCcw)}
        {leads && !searching && (area.searchCount === 0 || area.status === 'NEEDS_REVISIT') && act('walked', sighting ? 'Mark as checked' : 'Mark searched', Check)}
        {leads && !searching && area.status === 'SEARCHED' && act('again', 'Needs another look', RotateCcw)}
        {leads &&
          (area.asked || []).map((a) => (
            <button key={a.handle} type="button" onClick={() => onUnask(a.handle)} disabled={Boolean(busy)} className={`${CONTROL} disabled:opacity-60`}>
              {busy === 'unask' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={15} aria-hidden="true" />} Take it back from {a.name}
            </button>
          ))}
      </div>
      {!leads && <p className="mt-2 text-[13px] font-medium leading-5 text-[var(--mc-muted)]">{picture.owner?.firstName || 'The owner'} decides where helpers are sent first.</p>}
    </section>
  );
}
