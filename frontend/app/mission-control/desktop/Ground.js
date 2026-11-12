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
import { useEffect, useRef } from 'react';
import { ArrowLeft, Check, ExternalLink, Flag, Loader2, Maximize, RotateCcw } from 'lucide-react';
import { metersWords } from '../lib/insight';
import { clockTime } from '../lib/words';
import { searcherBrief } from '../lib/briefLines';
import { areaFacts, areaLine, areaName, areaState, circleAreas, isSeenCircle } from '../lib/ground';

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

/**
 * An area's mark beside its row, saying what its shape on the map says:
 * an empty outline for not searched (heavy where it is given out next),
 * a dashed teal edge for someone on it, green for searched and deeper
 * green for twice, an orange ring for the circle round a sighting. A
 * searched area carries a tick; one put up for another look keeps its
 * green and loses the tick, inside an ink edge: it is to be searched again.
 */
export function Glyph({ area, next = false }) {
  const searched = area.searchCount > 0;
  const again = area.status === 'NEEDS_REVISIT';
  const fill = searched ? (area.searchCount > 1 ? 'color-mix(in srgb, var(--mc-done) 72%, transparent)' : 'color-mix(in srgb, var(--mc-done) 36%, transparent)') : 'transparent';
  const edge =
    area.status === 'IN_PROGRESS'
      ? '2.5px dashed var(--mc-teal)'
      : isSeenCircle(area)
        ? '2px dashed var(--mc-seen)'
        : next || area.first
          ? '2.5px solid var(--mc-ink)'
          : again
            ? '2px solid var(--mc-ink)'
          : searched
            ? '1.5px solid var(--mc-done)'
            : '1.5px solid var(--mc-muted)';
  return (
    <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center ${isSeenCircle(area) ? 'rounded-full' : 'rounded-[5px]'}`} style={{ background: fill, border: edge }} aria-hidden="true">
      {searched && !again && area.status !== 'IN_PROGRESS' && <Check size={11} strokeWidth={3.5} className="text-[var(--mc-ink)]" />}
    </span>
  );
}

/** What a row says of where its area is given out: asked for first, given out next, or nothing. */
function turnWords(area, next) {
  if (area.first) return 'asked for first';
  return next ? 'given out next' : '';
}

export default function Ground({ picture, items, circle, next, now, leads, selected, hovered, onSelect, onHover, onWiden, widening = false }) {
  const name = picture.pet?.name || 'the pet';
  const zone = picture.timeZone;
  const rows = inListOrder(items);
  const own = circleAreas(items);
  const placed = picture.lastSeen && Number.isFinite(picture.lastSeen.lat);
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
      <ul className="px-2">
        {rows.map((area) => {
          const on = area.id === selected;
          const soon = next?.has(area.id);
          const turn = turnWords(area, soon);
          return (
            <li key={area.id} ref={on ? picked : null}>
              <button
                type="button"
                onClick={() => onSelect(on ? null : area.id)}
                onMouseEnter={() => onHover(area.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(area.id)}
                onBlur={() => onHover(null)}
                aria-pressed={on}
                className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${
                  on ? 'bg-[var(--mc-pick)] ring-2 ring-[var(--mc-ink)]' : area.id === hovered ? 'bg-[var(--mc-raised)]' : 'hover:bg-[var(--mc-raised)]'
                }`}
              >
                <Glyph area={area} next={soon} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-bold leading-5 text-[var(--mc-ink)]">{area.name}</span>
                    <span className="shrink-0 text-[13px] font-semibold leading-5 text-[var(--mc-muted)]">about {area.minutes} min</span>
                  </span>
                  <span className={`block text-[14px] font-medium leading-5 ${area.status === 'IN_PROGRESS' ? 'text-[var(--mc-teal-ink)]' : 'text-[var(--mc-soft)]'}`}>
                    {areaLine(area, { timeZone: zone, now, owner: picture.owner?.firstName || null, isOwner: Boolean(picture.viewer?.isOwner) })}
                  </span>
                  {(turn || (area.asked || []).length > 0) && (
                    <span className="block text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">
                      {[turn, ...(area.asked || []).map((a) => `${a.name} asked at ${clockTime(a.at, zone)}${a.seenAt ? ', seen' : ''}`)].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
              </button>
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
        <Glyph area={area} next={next} />
        <div className="min-w-0">
          <h2 className="text-[19px] font-extrabold leading-[25px] text-[var(--mc-ink)]">{area.name}</h2>
          <p className="text-[13px] font-bold leading-[19px] text-[var(--mc-muted)]">
            {areaState(area)}
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
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {mapsHref && (
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={CONTROL}>
            <ExternalLink size={15} aria-hidden="true" /> Open in Google Maps
          </a>
        )}
        {leads && !area.first && !taken && act('first', 'Send people here first', Flag)}
        {leads && area.first && act('normal', 'Back to its place in the order', RotateCcw)}
        {leads && !searching && (area.searchCount === 0 || area.status === 'NEEDS_REVISIT') && act('walked', 'Put down as searched', Check)}
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
