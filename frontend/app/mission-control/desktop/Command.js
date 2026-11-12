'use client';

/**
 * Mission Control on a desk: the whole search on one screen, and the
 * controls to steer it. A desk sees and plans; nobody walks from one, so
 * it is never asked where it is and is never handed a street
 * (SearchScreen.js). A phone is the opposite: one card, one button.
 *
 *   left    the numbers, this person's own card, what the search shows,
 *           and the site's advice for this pet at this stage
 *   middle  the map: every street by its state, warmest where the search
 *           goes next. Pointing names a street, clicking picks it.
 *   right   the streets in the order they are handed out, the sightings,
 *           who is out, and a log of what happened
 *
 * The owner, and someone leading a Rescue Force that is looking, can also
 * steer: send the next helpers to a street first, put a street down as
 * walked for someone who walked it without the site, or ask for another
 * look (app/lib/searchBoard.js, STEER_ACTIONS). Everyone else sees the
 * same search and can add a sighting.
 */
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, Check, ExternalLink, Flag, Maximize2, RotateCcw, X, Loader2 } from 'lucide-react';
import TopBar from '../components/TopBar';
import { HEAT } from '../components/SearchMap';
import { dayAndTime } from '../lib/words';
import { researchFor, stateWords, streetFacts } from '../lib/insight';
import { Advice, Know, Numbers } from './Know';
import Board from './Board';

const SearchMap = dynamic(() => import('../components/SearchMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--mc-ground)]" />,
});

const CONTROL =
  'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--mc-line-strong)] bg-[var(--mc-surface)] px-3 text-[13px] font-bold leading-5 text-[var(--mc-ink)] shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';

/** Four points round a centre, so a single mark is shown with its neighbourhood. */
function around(lat, lng, meters) {
  const dLat = meters / 111320;
  const dLng = meters / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat + dLat, lng],
    [lat - dLat, lng],
    [lat, lng + dLng],
    [lat, lng - dLng],
  ];
}

/** Whether the window has room for three columns. Below it, the left column's cards become the first tab of the right one. */
function useRoomy() {
  const [roomy, setRoomy] = useState(true);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1280px)');
    const read = () => setRoomy(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);
  return roomy;
}

const shapeOf = (item) => (item?.path?.length ? item.path : item ? [[item.northLat, item.westLng], [item.southLat, item.eastLng]] : []);

/** The street that is picked: what is known about it, the way there, and what the owner or a lead can do about it. */
function StreetCard({ street, picture, unit, now, leads, busy, problem, onSteer, onClose }) {
  const name = picture.pet?.name || 'the pet';
  const thing = unit === 'block' ? 'block' : 'street';
  const facts = streetFacts(street, { lastSeen: picture.lastSeen, sightings: picture.sightings, timeZone: picture.timeZone, now, name, unit });
  const open = street.status === 'UNSEARCHED' || street.status === 'NEEDS_REVISIT';
  const mapsHref = street.center ? `https://www.google.com/maps/dir/?api=1&destination=${street.center.lat},${street.center.lng}&travelmode=walking` : null;
  const act = (action, words, Icon) => (
    <button key={action} type="button" onClick={() => onSteer(street, action)} disabled={Boolean(busy)} className={`${CONTROL} disabled:opacity-60`}>
      {busy === action ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />} {words}
    </button>
  );
  return (
    <section aria-label={`${street.title}`} className="rounded-2xl border border-[var(--mc-line-strong)] bg-[var(--mc-surface)] p-4 shadow-[0_12px_40px_rgba(2,6,23,0.55)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase leading-4 tracking-[0.1em] text-[var(--mc-muted)]">
            {stateWords(street)} · about {street.minutes} min{street.first ? ' · asked for first' : ''}
          </p>
          <h2 className="mt-0.5 text-[19px] font-bold leading-6 text-[var(--mc-ink)]">{street.title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--mc-soft)] hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {facts.map((fact) => (
          <li key={fact} className="text-[15px] font-medium leading-[22px] text-[var(--mc-soft)]">
            {fact}
          </li>
        ))}
        {street.first && <li className="text-[15px] font-medium leading-[22px] text-[var(--mc-soft)]">The next people who ask for a {thing} are sent here first.</li>}
      </ul>
      {problem && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-400">
          {problem}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {mapsHref && (
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={CONTROL}>
            <ExternalLink size={15} aria-hidden="true" /> Open in Google Maps
          </a>
        )}
        {leads && open && !street.first && act('first', 'Send people here first', Flag)}
        {leads && street.first && act('normal', 'Back to its place in the order', RotateCcw)}
        {leads && open && act('walked', 'Put down as walked', Check)}
        {leads && street.status === 'SEARCHED' && act('again', 'Needs another look', RotateCcw)}
      </div>
      {!leads && (
        <p className="mt-2 text-[13px] font-medium leading-5 text-[var(--mc-muted)]">
          {picture.owner?.firstName || 'The owner'} and the people leading the search decide where helpers are sent first.
        </p>
      )}
    </section>
  );
}

export default function Command({ picture, items, unit, now, line, petHref, onPhoto, step, full, onBack, onSeen, search, mapLabel, overlays }) {
  const viewer = picture.viewer;
  const leads = Boolean(viewer?.leads);
  const name = picture.pet?.name || 'the pet';
  const zone = picture.timeZone;
  const roomy = useRoomy();
  const [tabPicked, setTab] = useState(null);
  // With three columns the list opens on the streets. With two, on the overview, which is where this person's own card is.
  const tab = tabPicked && (roomy ? tabPicked !== 'overview' : true) ? tabPicked : roomy ? 'streets' : 'overview';
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [focused, setFocused] = useState(null); // a sighting picked from the list or the log
  const [layer, setLayer] = useState('map');
  const [rings, setRings] = useState(false);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState('');
  const [refit, setRefit] = useState(0);
  const study = researchFor(picture.pet?.species);

  const street = useMemo(() => items.find((i) => i.id === selected) || null, [items, selected]);
  // A street that is no longer on the board lets go of itself.
  useEffect(() => {
    if (selected && !street) setSelected(null);
  }, [selected, street]);

  const pick = (id) => {
    setProblem('');
    setSelected(id);
    if (id) {
      setFocused(null);
      setTab('streets');
    }
  };
  const focus = (id) => {
    setFocused(id);
    if (id) setSelected(null);
  };

  async function steer(target, action) {
    if (busy) return;
    setBusy(action);
    setProblem('');
    try {
      const result = await search.act(unit, target.id, action);
      if (result.error) setProblem(result.error);
    } finally {
      setBusy(null);
    }
  }

  // ----- The map -----
  const numbered = useMemo(
    () => [...picture.sightings].sort((a, b) => new Date(a.at) - new Date(b.at)).map((s, i) => ({ ...s, n: i + 1 })),
    [picture.sightings]
  );
  const newest = numbered[numbered.length - 1] || null;
  const mapSightings = useMemo(
    () => numbered.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, n: s.n, label: `Seen ${dayAndTime(s.at, zone, now)}`, hot: s.id === (focused || newest?.id) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [numbered, zone, focused, newest?.id, Math.floor(now / 60000)]
  );
  const mapStreets = useMemo(
    () =>
      unit === 'street'
        ? items.map((i) => ({ id: i.id, path: i.path, status: i.status, mine: false, who: i.claimedByName || null, title: i.title, words: `${stateWords(i)} · about ${i.minutes} min`, priority: i.priority, first: i.first }))
        : [],
    [unit, items]
  );
  const mapCells = useMemo(() => (unit === 'block' ? items.map((i) => ({ ...i, mine: false, words: `${stateWords(i)} · about ${i.minutes} min` })) : []), [unit, items]);
  const lastSeenTag = useMemo(() => {
    const at = picture.lastSeen;
    if (!at || !Number.isFinite(at.lat) || !Number.isFinite(at.lng)) return null;
    return { lat: at.lat, lng: at.lng, label: `Lost here ${dayAndTime(at.at, zone, now)}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture.lastSeen?.lat, picture.lastSeen?.lng, picture.lastSeen?.at, zone, Math.floor(now / 60000)]);

  const fit = useMemo(() => {
    const spot = focused ? numbered.find((s) => s.id === focused) : null;
    if (spot) return [[spot.lat, spot.lng], ...around(spot.lat, spot.lng, 260)];
    if (street) return [...shapeOf(street), ...(street.center ? around(street.center.lat, street.center.lng, 160) : [])];
    // The whole search: every street, where the pet was lost, and where it was seen.
    const all = items.flatMap((i) => shapeOf(i));
    const seen = numbered.map((s) => [s.lat, s.lng]);
    const lost = lastSeenTag ? around(lastSeenTag.lat, lastSeenTag.lng, 200) : [];
    return [...all, ...seen, ...lost];
  }, [focused, street, items, numbered, lastSeenTag]);
  const fitKey = `${focused ? `seen:${focused}` : street ? `street:${street.id}` : `all:${items.length}:${numbered.length}`}|${refit}`;

  const key = [
    ['line', HEAT.first, 'Given out first'],
    ['line', HEAT.next, 'Next'],
    ['line', HEAT.later, 'Later'],
    ['dots', '#2dd4bf', 'Being walked'],
    ['line', 'rgba(203,213,225,0.5)', 'Walked'],
  ];

  // The numbers, this person's own card, what the search shows, and the advice.
  const overview = (
    <div className={`flex flex-col gap-3 overflow-y-auto ${roomy ? 'p-4' : 'min-h-0 flex-1 p-3'}`}>
      <Numbers picture={picture} items={items} unit={unit} now={now} />
      <section aria-label="Your step" className={`rounded-2xl border border-[var(--mc-line)] ${roomy ? 'bg-[var(--mc-surface)]' : 'bg-[var(--mc-ground)]'} ${full ? 'overflow-hidden pb-2' : 'p-4'}`}>
        {full && (
          <button type="button" onClick={onBack} className="ml-4 mt-3 inline-flex min-h-[36px] items-center gap-1.5 text-[15px] font-semibold text-[var(--mc-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
            <ArrowLeft size={18} aria-hidden="true" /> Back to the map
          </button>
        )}
        {step}
      </section>
      {!full && <Know picture={picture} items={items} unit={unit} now={now} rings={rings} onRings={() => setRings((v) => !v)} />}
      {!full && <Advice picture={picture} now={now} />}
    </div>
  );

  return (
    <div className="mc-dark flex h-[100dvh] flex-col overflow-hidden bg-[var(--mc-ground)]">
      <TopBar picture={picture} line={line} backHref={petHref} onPhoto={onPhoto} wide />
      <div className="flex min-h-0 flex-1">
        {roomy && (
          <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto" aria-label="The search in numbers, and your step">
            {overview}
          </aside>
        )}

        <div className="relative min-w-0 flex-1 border-x border-[var(--mc-line)]">
          <div className="absolute inset-0 z-0">
            <SearchMap
              theme="dark"
              desk
              layer={layer}
              lastSeen={lastSeenTag}
              sightings={mapSightings}
              streets={mapStreets}
              cells={mapCells}
              selected={selected}
              hovered={hovered}
              onSelect={pick}
              onHover={setHovered}
              rings={rings && study ? study.rings.map((r) => ({ meters: r.meters, label: `${r.label}: ${r.share}` })) : []}
              trail
              fit={fit}
              fitKey={fitKey}
              padding={{ top: 70, right: 60, bottom: street ? 260 : 70, left: 60 }}
              maxFitZoom={16.25}
              zoomControl
              label={mapLabel}
            />
          </div>
          <div className="absolute left-3 top-3 z-[400] flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-[var(--mc-line-strong)] shadow" role="radiogroup" aria-label="What the map is drawn on">
              {[
                ['map', 'Streets'],
                ['satellite', 'From above'],
              ].map(([id, words]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={layer === id}
                  onClick={() => setLayer(id)}
                  className={`min-h-[36px] px-3 text-[13px] font-bold leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${layer === id ? 'bg-[var(--mc-ink)] text-[var(--mc-surface)]' : 'bg-[var(--mc-surface)] text-[var(--mc-ink)]'}`}
                >
                  {words}
                </button>
              ))}
            </div>
            {study && (
              <button type="button" onClick={() => setRings((v) => !v)} aria-pressed={rings} className={`${CONTROL} ${rings ? '!border-flash-400' : ''}`}>
                {rings ? 'Hide the study rings' : 'Study rings'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setFocused(null);
                setRefit((n) => n + 1);
              }}
              className={CONTROL}
            >
              <Maximize2 size={15} aria-hidden="true" /> The whole search
            </button>
          </div>
          <div className={`pointer-events-none absolute bottom-3 left-3 z-[400] flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--mc-line)] bg-[var(--mc-surface)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--mc-soft)] ${street ? 'hidden' : 'flex'}`}>
            {key.map(([kind, color, words]) => (
              <span key={words} className="flex items-center gap-1.5">
                {kind === 'dots' ? <span className="w-5 border-t-4 border-dotted" style={{ borderColor: color }} aria-hidden="true" /> : <span className="h-1.5 w-5 rounded-full" style={{ background: color }} aria-hidden="true" />}
                {words}
              </span>
            ))}
          </div>
          {street && (
            // Bottom left, clear of the zoom buttons and the map's credit in the other corner.
            <div className="absolute bottom-3 left-3 z-[450] w-[min(460px,calc(100%-96px))]">
              <StreetCard street={street} picture={picture} unit={unit} now={now} leads={leads} busy={busy} problem={problem} onSteer={steer} onClose={() => pick(null)} />
            </div>
          )}
        </div>

        <aside className={`${roomy ? 'w-[380px]' : 'order-first w-[372px] border-r border-[var(--mc-line)]'} shrink-0 bg-[var(--mc-surface)]`} aria-label={`The search for ${name}`}>
          <Board
            overview={roomy ? null : overview}
            picture={picture}
            items={items}
            unit={unit}
            now={now}
            tab={tab}
            onTab={setTab}
            selected={selected}
            hovered={hovered}
            onSelect={pick}
            onHover={setHovered}
            focused={focused}
            onFocus={(id) => {
              focus(id);
              if (id) setTab('sightings');
            }}
            onAdd={() => {
              onSeen();
              // The form is this person's own card, which on a narrower screen is under Overview.
              if (!roomy) setTab('overview');
            }}
            onTell={search.tell}
          />
        </aside>
      </div>
      {overlays}
    </div>
  );
}
