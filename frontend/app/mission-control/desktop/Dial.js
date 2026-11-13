'use client';

/**
 * The search at a glance: the circle of ground drawn small, each area in
 * the colour of its state, beside the few numbers that say where the
 * search stands.
 *
 * It is the same picture as the map, without the streets: the middle,
 * the four sides, the outer ring once the search is widened, where the
 * pet was lost at the centre and each fresh sighting where it lies. So it
 * shows how much ground has been searched, and which, before a word is
 * read. Pointing at an area lights it on the map and in the list, and a
 * click picks it.
 *
 * The colours are the screen's own (app/globals.css): ink for ground
 * nobody has searched, heavier where it is given out next, teal for
 * someone on it, green for searched and deeper for twice, orange for a
 * sighting, red for where the pet was lost.
 */
import { missingFor } from '../lib/insight';
import { areaName, areaState, circleAreas, groundCoverage, isSeenCircle, searchStrength } from '../lib/ground';

const SIZE = 200;
const MID = SIZE / 2;

/** A point `r` from the middle of the dial, on a bearing clockwise from north. */
const at = (r, bearing) => {
  const turn = (bearing * Math.PI) / 180;
  return [MID + r * Math.sin(turn), MID - r * Math.cos(turn)];
};
const xy = (r, bearing) => at(r, bearing).map((n) => n.toFixed(2)).join(' ');

/** Where the rings fall on the dial, in its own units: the middle, the starting circle, and the widened one. */
function radii(circle) {
  const wide = Boolean(circle?.widened);
  const outer = 92;
  if (!circle || !circle.edge) return { inner: 34, edge: outer, far: outer, scale: 0, wide };
  const reach = wide ? circle.wide : circle.edge;
  const scale = outer / reach;
  return { inner: circle.inner * scale, edge: circle.edge * scale, far: outer, scale, wide };
}

/** One area as a path: a disc for the middle, a wedge of a ring for a side or an outer area. */
function shape(area, r) {
  if (area.ring === 0) return `M ${xy(r.inner, 0)} A ${r.inner} ${r.inner} 0 1 1 ${xy(r.inner, 180)} A ${r.inner} ${r.inner} 0 1 1 ${xy(r.inner, 0)} Z`;
  const [from, to] = area.ring === 1 ? [r.inner, r.edge] : [r.edge, r.far];
  const span = (((area.b - area.a) % 360) + 360) % 360 || 360;
  const large = span > 180 ? 1 : 0;
  return `M ${xy(to, area.a)} A ${to} ${to} 0 ${large} 1 ${xy(to, area.a + span)} L ${xy(from, area.a + span)} A ${from} ${from} 0 ${large} 0 ${xy(from, area.a)} Z`;
}

/** Where a place lies on the dial, from the centre of the search: null when the dial has no scale. */
function spot(point, circle, r) {
  if (!r.scale || !circle?.center || !point || !Number.isFinite(point.lat)) return null;
  const north = (point.lat - circle.center.lat) * 111320;
  const east = (point.lng - circle.center.lng) * 111320 * Math.cos((circle.center.lat * Math.PI) / 180);
  const far = Math.hypot(north, east) * r.scale;
  // A sighting past the edge of the search is drawn on the edge, in its direction.
  const pull = far > r.far ? r.far / far : 1;
  return [MID + east * r.scale * pull, MID - north * r.scale * pull];
}

/** How an area is painted: its fill, how strong, and its edge. */
function paint(area, { next, lit, now }) {
  const searched = area.searchCount > 0;
  const busy = area.status === 'IN_PROGRESS';
  const again = area.status === 'NEEDS_REVISIT';
  return {
    fill: busy ? 'var(--mc-teal)' : searched ? 'var(--mc-done)' : 'var(--mc-ink)',
    // Green as strong as the area counts as searched right now: a search fades over a day.
    strength: busy ? 0.32 : searched ? 0.1 + 0.82 * searchStrength(area, now) : next || area.first ? 0.2 : 0.07,
    edge: lit ? 'var(--mc-ink)' : busy ? 'var(--mc-teal)' : again || next || area.first ? 'var(--mc-ink)' : searched ? 'var(--mc-done)' : 'var(--mc-line-strong)',
    weight: lit ? 3 : next || area.first || again ? 2.4 : 1.4,
    dash: busy ? '5 4' : again ? '2 3' : undefined,
  };
}

const LETTER = { north: 'N', east: 'E', south: 'S', west: 'W' };

export function Dial({ items = [], circle = null, next = null, selected = null, hovered = null, onSelect = null, onHover = null, lost = null, size = 132, now = Date.now() }) {
  const r = radii(circle);
  const own = circleAreas(items);
  const seen = items.filter(isSeenCircle);
  // Painted from the outside in, so an inner edge is never under an outer fill; the one pointed at goes on top.
  const order = [...own].sort((a, b) => b.ring - a.ring || Number(a.id === hovered || a.id === selected) - Number(b.id === hovered || b.id === selected));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0" role="group" aria-label="The ground of the search, area by area">
      <defs>
        <clipPath id="mc-dial-edge">
          <circle cx={MID} cy={MID} r={r.far + 5} />
        </clipPath>
      </defs>
      <circle cx={MID} cy={MID} r={r.far + 5} fill="var(--mc-ground)" />
      {order.map((area) => {
        const lit = area.id === hovered || area.id === selected;
        const p = paint(area, { next: Boolean(next?.has(area.id)), lit, now });
        return (
          <path
            key={area.id}
            d={shape(area, r)}
            fill={p.fill}
            fillOpacity={p.strength}
            stroke={p.edge}
            strokeWidth={p.weight}
            strokeDasharray={p.dash}
            strokeLinejoin="round"
            role="button"
            tabIndex={0}
            aria-label={`${area.name}: ${areaState(area, now)}`}
            aria-pressed={area.id === selected}
            className="cursor-pointer outline-none transition-[fill-opacity] focus-visible:stroke-flash-400"
            onMouseEnter={() => onHover?.(area.id)}
            onMouseLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(area.id)}
            onBlur={() => onHover?.(null)}
            onClick={() => onSelect?.(area.id === selected ? null : area.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.(area.id === selected ? null : area.id);
              }
            }}
          />
        );
      })}
      {/* Which side is which: a letter on each of the four sides. */}
      {own
        .filter((a) => a.ring === 1 && LETTER[a.key])
        .map((a) => {
          const span = (((a.b - a.a) % 360) + 360) % 360 || 360;
          const [x, y] = at((r.inner + r.edge) / 2, a.a + span / 2);
          return (
            <text key={a.id} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="800" fill="var(--mc-ink)" opacity="0.72" className="pointer-events-none select-none">
              {LETTER[a.key]}
            </text>
          );
        })}
      {/* Each fresh sighting where it lies, in the orange of a sighting. */}
      {seen.map((s) => {
        const p = spot(s.center, circle, r);
        if (!p) return null;
        const lit = s.id === hovered || s.id === selected;
        return (
          <g key={s.id} clipPath="url(#mc-dial-edge)" role="button" tabIndex={0} aria-label={`${areaName(s)}: ${areaState(s)}`} className="cursor-pointer outline-none" onMouseEnter={() => onHover?.(s.id)} onMouseLeave={() => onHover?.(null)} onClick={() => onSelect?.(s.id === selected ? null : s.id)}>
            <circle cx={p[0]} cy={p[1]} r={Math.max(9, (s.to || 0) * r.scale)} fill="var(--mc-seen)" fillOpacity={s.searchCount > 0 ? 0.12 : 0.22} stroke="var(--mc-seen)" strokeWidth={lit ? 3 : 2} strokeDasharray="5 4" />
            <circle cx={p[0]} cy={p[1]} r="5" fill="var(--mc-seen)" stroke="var(--mc-surface)" strokeWidth="2" />
          </g>
        );
      })}
      {/* Where the pet was lost: the centre of the search. */}
      {(() => {
        const p = lost ? spot(lost, circle, r) : null;
        const [x, y] = p || [MID, MID];
        return <circle cx={x} cy={y} r="6.5" className="pointer-events-none" fill="var(--mc-lost)" stroke="var(--mc-surface)" strokeWidth="2.5" />;
      })()}
    </svg>
  );
}

function Figure({ value, label, tone = 'plain' }) {
  return (
    <p className="min-w-0 flex-1 px-3 first:pl-0 last:pr-0">
      <span className={`block text-[17px] font-extrabold leading-[22px] tabular-nums ${tone === 'seen' ? 'text-[var(--mc-seen-ink)]' : tone === 'on' ? 'text-[var(--mc-teal-ink)]' : 'text-[var(--mc-ink)]'}`}>{value}</span>
      <span className="block text-[13px] font-semibold leading-[17px] text-[var(--mc-muted)]">{label}</span>
    </p>
  );
}

/**
 * The top of the desk's own panel: the dial, how much of the ground has
 * been searched, and how long, how many people and how many sightings.
 */
export default function Summary({ picture, items, circle, next, now, selected, hovered, onSelect, onHover }) {
  const g = groundCoverage(items, now);
  const seen = picture.sightings.length;
  return (
    <section aria-label="Where the search stands">
      <div className="flex items-center gap-4">
        <Dial items={items} circle={circle} next={next} selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover} lost={picture.lastSeen} now={now} />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2" role="img" aria-label={`${g.searched} of ${g.total} areas searched, ${g.searching} being searched now`}>
            <span className="text-[52px] font-extrabold leading-[52px] tracking-tight tabular-nums text-[var(--mc-ink)]">{g.total ? g.searched : '-'}</span>
            {g.total > 0 && <span className="text-[20px] font-bold leading-6 tabular-nums text-[var(--mc-muted)]">of {g.total}</span>}
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-5 text-[var(--mc-soft)]">areas searched</p>
          {g.again > 0 && <p className="text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">{g.again === 1 ? '1 is' : `${g.again} are`} down for another look</p>}
          {g.faded > 0 && <p className="text-[13px] font-medium leading-[18px] text-[var(--mc-muted)]">{g.faded === 1 ? '1 was' : `${g.faded} were`} last searched over a day ago</p>}
        </div>
      </div>
      <div className="mt-4 flex divide-x divide-[var(--mc-line)] rounded-xl bg-[var(--mc-raised)] px-3.5 py-2.5">
        <Figure value={missingFor(picture.lastSeen?.at, now) || '-'} label="missing" />
        <Figure value={g.people} label="searching now" tone={g.people ? 'on' : 'plain'} />
        <Figure value={seen} label={seen === 1 ? 'sighting' : 'sightings'} tone={seen ? 'seen' : 'plain'} />
      </div>
    </section>
  );
}
