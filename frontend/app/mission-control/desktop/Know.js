'use client';

/**
 * The left of the desk, under the person's own card: what the search's
 * numbers say.
 *
 *   Numbers  how long, how much ground, how many people, how many sightings
 *   Know     what the sightings have in common, the ground left and how
 *            long it takes, and what published studies found about how
 *            far lost pets were from where they went missing
 *   Advice   the site's own advice for this pet at this stage
 *
 * Every line under "What the search shows" is a count, a time, a distance
 * or a published finding with its source (lib/insight.js). The advice is
 * the advice engine's and the searcher's brief's, word for word. Nothing
 * here says where the pet is, and nothing tells anyone to stop.
 */
import { useMemo, useState } from 'react';
import { adviceFor } from '@/app/lib/adviceFor';
import { coverage, groundLines, missingFor, researchFor, sightingLines } from '../lib/insight';
import { groundCoverage, groundLines as areaLines } from '../lib/ground';
import { searcherBrief } from '../lib/briefLines';

export function Card({ title, right = null, children, className = '' }) {
  return (
    <section className={`border-t border-[var(--mc-line)] px-4 pb-4 pt-3.5 ${className}`}>
      {title && (
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[14px] font-extrabold leading-5 text-[var(--mc-ink)]">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function Stat({ value, label, tone = 'plain' }) {
  return (
    <div className="min-w-0 basis-[calc(50%-4px)] rounded-xl border border-[var(--mc-line)] bg-[var(--mc-surface)] px-3 py-2">
      <p className={`truncate text-[22px] font-extrabold leading-7 tabular-nums ${tone === 'seen' ? 'text-[var(--mc-seen-ink)]' : 'text-[var(--mc-ink)]'}`}>{value}</p>
      <p className="truncate text-[13px] font-semibold leading-[18px] text-[var(--mc-muted)]">{label}</p>
    </div>
  );
}

/** Four numbers, and the ground as a bar. */
export function Numbers({ picture, items, unit, now }) {
  const seen = picture.sightings.length;
  if (unit === 'area') {
    // Ground: how many of the circle's areas have been searched at least once, and how many people are on any now.
    const g = groundCoverage(items);
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          <Stat value={missingFor(picture.lastSeen?.at, now) || '-'} label="missing" />
          <Stat value={g.total ? `${g.searched}/${g.total}` : '-'} label="areas searched" />
          <Stat value={g.people} label="searching now" />
          <Stat value={seen} label={seen === 1 ? 'sighting' : 'sightings'} tone={seen ? 'seen' : 'plain'} />
        </div>
        {g.total > 0 && (
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[var(--mc-line)]" role="img" aria-label={`${g.searched} of ${g.total} areas searched, ${g.searching} being searched now`}>
            <span className="h-full bg-[var(--mc-done)]" style={{ width: `${(g.done / g.total) * 100}%` }} />
            <span className="h-full bg-[var(--mc-teal)]" style={{ width: `${(g.searching / g.total) * 100}%` }} />
          </div>
        )}
      </div>
    );
  }
  const c = coverage(items);
  const thing = unit === 'block' ? 'blocks' : 'streets';
  return (
    <div>
      {/* Two rows of two. Flex, not grid: globals.css gives every .grid a 1rem gap. */}
      <div className="flex flex-wrap gap-2">
        <Stat value={missingFor(picture.lastSeen?.at, now) || '-'} label="missing" />
        <Stat value={c.total ? `${c.searched}/${c.total}` : '-'} label={`${thing} walked`} />
        {/* People on a street right now, which the streets themselves say: one street each. Not everyone who was out today. */}
        <Stat value={c.walking} label="walking now" />
        <Stat value={seen} label={seen === 1 ? 'sighting' : 'sightings'} tone={seen ? 'seen' : 'plain'} />
      </div>
      {c.total > 0 && (
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[var(--mc-line)]" role="img" aria-label={`${c.searched} of ${c.total} ${thing} walked, ${c.walking} being walked now`}>
          <span className="h-full bg-[var(--mc-done)]" style={{ width: `${(c.done / c.total) * 100}%` }} />
          <span className="h-full bg-[var(--mc-teal)]" style={{ width: `${(c.walking / c.total) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

/** What the sightings have in common, the ground that is left, and what studies found. */
export function Know({ picture, items, unit, circle = null, now, rings, onRings }) {
  const name = picture.pet?.name || 'the pet';
  const seen = useMemo(
    () => sightingLines({ sightings: picture.sightings, lastSeen: picture.lastSeen, timeZone: picture.timeZone, now, name }),
    // The sentences change with the sightings, and with the day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picture.sightings, picture.lastSeen, picture.timeZone, name, Math.floor(now / 600000)]
  );
  const ground = unit === 'area' ? areaLines({ areas: items, circle, name }) : groundLines({ items, unit, name });
  const study = researchFor(picture.pet?.species);
  return (
    <Card title="What the search shows">
      <ul className="mt-2 flex flex-col gap-2">
        {[...seen, ...ground].map((line) => (
          <li key={line} className="text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">
            {line}
          </li>
        ))}
      </ul>
      {study && (
        <div className="mt-3 border-t border-[var(--mc-line)] pt-3">
          <p className="text-[15px] font-medium leading-[22px] text-[var(--mc-soft)]">{study.line}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold leading-5 text-[var(--mc-muted)]">
            <a href={study.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--mc-ink)]">
              {study.source}
            </a>
            <button type="button" onClick={onRings} aria-pressed={rings} className="text-left font-bold text-[var(--mc-ink)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
              {rings ? 'Hide the rings' : `${study.show} around where ${name} was lost`}
            </button>
          </p>
        </div>
      )}
    </Card>
  );
}

/**
 * The site's own advice. The owner reads the advice engine's steps for
 * this pet at this stage; everyone else reads the searcher's brief. Both
 * word for word, under the line that says whose they are.
 */
export function Advice({ picture, now }) {
  const [open, setOpen] = useState(false);
  const isOwner = Boolean(picture.viewer?.isOwner);
  const advice = useMemo(
    () => adviceFor({ petSpecies: picture.pet?.species, escapeScenario: picture.pet?.howOut, petDescription: picture.pet?.description, lastSeenAt: picture.lastSeen?.at }, now),
    // The section changes with the day, not the minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picture.pet?.species, picture.pet?.howOut, picture.pet?.description, picture.lastSeen?.at, Math.floor(now / 3600000)]
  );
  const brief = searcherBrief(picture);
  const lines = isOwner ? [...advice.steps, ...advice.more].map((s) => s.lead) : [brief.look, brief.call, brief.never];
  if (!lines.filter(Boolean).length) return null;
  const shown = open ? lines : lines.slice(0, 2);
  return (
    <Card title={isOwner ? advice.source : "The searcher's brief"}>
      <ol className="mt-2 flex flex-col gap-2">
        {shown.filter(Boolean).map((line, i) => (
          <li key={line} className="flex gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--mc-line-strong)] text-[13px] font-extrabold text-[var(--mc-soft)]" aria-hidden="true">
              {i + 1}
            </span>
            <span className="min-w-0 text-[15px] font-medium leading-[22px] text-[var(--mc-ink)]">{line}</span>
          </li>
        ))}
      </ol>
      {isOwner && open && advice.mistakes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-[var(--mc-line)] pt-3">
          {advice.mistakes.map((m) => (
            <li key={m.full} className="text-[14px] font-medium leading-5 text-[var(--mc-soft)]">
              {m.full}
            </li>
          ))}
        </ul>
      )}
      {lines.length > 2 && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-2.5 text-[13px] font-bold leading-5 text-[var(--mc-ink)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
          {open ? 'Show less' : 'Read all of it'}
        </button>
      )}
    </Card>
  );
}
