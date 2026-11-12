'use client';

/**
 * Mission Control on a desk: the whole search on one screen, and the
 * controls to steer it. A desk sees and plans; nobody walks from one, so
 * it is never asked where it is and is never handed a street
 * (SearchScreen.js). A phone is the opposite: one card, one button.
 *
 *   left    for the person running the search, what needs them now, each
 *           with one thing to do about it (Needs.js); then the numbers,
 *           this person's own card, what the search shows, and the site's
 *           advice for this pet at this stage
 *   middle  the map: every street by its state. A street still to walk is
 *           dark, the ones given out next are the thickest, a walked one
 *           is green. Pointing names a street, clicking picks it.
 *   right   the people on the search and what each is doing, the streets
 *           in the order they are handed out, the sightings, and
 *           everything said and done in one stream
 *
 * The owner runs the search from here (`viewer.leads`: app/lib/searcher.js
 * says why it is the owner alone). They give a named person a street and
 * see it asked, seen and walked (app/lib/searchAsk.js); they write to one
 * person or to everyone (app/lib/searchTalk.js); and they steer: send the
 * next helpers to a street first, put a street down as walked for someone
 * who walked it without the site, or ask for another look
 * (app/lib/searchBoard.js, STEER_ACTIONS). Everyone else sees the same
 * search and can add a sighting.
 *
 * It is light by day, like an ordinary map, and dark at night by its own
 * switch. Every colour comes from the screen's two palettes
 * (app/globals.css, .mc-light and .mc-dark), which are held to a contrast
 * of 4.5 to 1 or better, and no text here is smaller than 13px.
 */
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, Check, ExternalLink, Flag, Maximize2, Moon, RotateCcw, Sun, X, Loader2 } from 'lucide-react';
import TopBar from '../components/TopBar';
import usePutAway from '../hooks/usePutAway';
import { DESK_MAP } from '../components/SearchMap';
import { clockTime, dayAndTime, HOT_SIGHTING_MS } from '../lib/words';
import { givenNext, researchFor, stateWords, streetFacts } from '../lib/insight';
import { needsYou, quietLine } from '../lib/needs';
import { unanswered } from '../lib/team';
import { Advice, Know, Numbers } from './Know';
import Board from './Board';
import Needs from './Needs';

const SearchMap = dynamic(() => import('../components/SearchMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--mc-ground)]" />,
});

const CONTROL =
  'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--mc-line-strong)] bg-[var(--mc-surface)] px-3 text-[13px] font-bold leading-5 text-[var(--mc-ink)] shadow-sm hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';

const NIGHT_KEY = 'rp_mc_night';
const NO_RINGS = [];

/** Day or night for the desk. Day, unless this person chose night on this computer before. */
function useNight() {
  const [night, setNight] = useState(false);
  useEffect(() => {
    try {
      setNight(window.localStorage.getItem(NIGHT_KEY) === '1');
    } catch {
      // A browser that keeps nothing still gets the day desk.
    }
  }, []);
  const flip = () =>
    setNight((was) => {
      try {
        window.localStorage.setItem(NIGHT_KEY, was ? '0' : '1');
      } catch {
        // Not kept: the switch still works until the page is closed.
      }
      return !was;
    });
  return [night, flip];
}

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

/** The street that is picked: what is known about it, the way there, and what the person running the search can do about it. */
function StreetCard({ street, picture, unit, now, leads, busy, problem, free = [], onSteer, onGive, onUnask, onClose }) {
  const name = picture.pet?.name || 'the pet';
  const thing = unit === 'block' ? 'block' : 'street';
  const facts = streetFacts(street, { lastSeen: picture.lastSeen, sightings: picture.sightings, timeZone: picture.timeZone, now, name, unit });
  const open = street.status === 'UNSEARCHED' || street.status === 'NEEDS_REVISIT';
  // Kept for someone the person running the search asked to walk it (app/lib/searchAsk.js).
  const kept = open && street.reserved;
  const mapsHref = street.center ? `https://www.google.com/maps/dir/?api=1&destination=${street.center.lat},${street.center.lng}&travelmode=walking` : null;
  const act = (action, words, Icon) => (
    <button key={action} type="button" onClick={() => onSteer(street, action)} disabled={Boolean(busy)} className={`${CONTROL} disabled:opacity-60`}>
      {busy === action ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />} {words}
    </button>
  );
  return (
    <section aria-label={`${street.title}`} className="rounded-2xl border border-[var(--mc-line-strong)] bg-[var(--mc-surface)] p-4 shadow-[var(--mc-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-[18px] text-[var(--mc-muted)]">
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
        {street.first && !kept && <li className="text-[15px] font-medium leading-[22px] text-[var(--mc-soft)]">The next people who ask for a {thing} are sent here first.</li>}
        {kept && (
          <li className="text-[15px] font-medium leading-[22px] text-[var(--mc-soft)]">
            {street.askedOfName
              ? `Kept for ${street.askedOfName}, who was asked to walk it at ${clockTime(street.askedAt, picture.timeZone)}${street.askedSeenAt ? ' and has seen that' : ''}.`
              : 'Kept for someone who was asked to walk it.'}
          </li>
        )}
      </ul>
      {problem && (
        <p role="alert" className="mt-2 text-sm font-semibold text-[var(--mc-danger)]">
          {problem}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {mapsHref && (
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={CONTROL}>
            <ExternalLink size={15} aria-hidden="true" /> Open in Google Maps
          </a>
        )}
        {leads && open && !kept && !street.first && act('first', 'Send people here first', Flag)}
        {leads && street.first && act('normal', 'Back to its place in the order', RotateCcw)}
        {leads && kept && street.askedOfHandle && (
          <button type="button" onClick={() => onUnask(street)} disabled={Boolean(busy)} className={`${CONTROL} disabled:opacity-60`}>
            {busy === 'unask' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={15} aria-hidden="true" />} Take it back from {street.askedOfName}
          </button>
        )}
        {leads && open && act('walked', 'Put down as walked', Check)}
        {leads && street.status === 'SEARCHED' && act('again', 'Needs another look', RotateCcw)}
      </div>
      {leads && unit === 'street' && open && !kept && free.length > 0 && (
        // From a street to a person: the same ask as from the People list, started the other way round.
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--mc-line)] pt-3">
          <span className="text-[13px] font-bold leading-5 text-[var(--mc-muted)]">Ask someone to walk it</span>
          {free.slice(0, 3).map((p) => (
            <button key={p.handle} type="button" onClick={() => onGive(p.handle)} className={CONTROL}>
              {p.name}
            </button>
          ))}
        </div>
      )}
      {!leads && (
        <p className="mt-2 text-[13px] font-medium leading-5 text-[var(--mc-muted)]">
          {picture.owner?.firstName || 'The owner'} decides where helpers are sent first.
        </p>
      )}
    </section>
  );
}

export default function Command({ picture, items, unit, now, line, petHref, onPhoto, step, full, onBack, onSeen, onShare, search, mapLabel, overlays }) {
  const viewer = picture.viewer;
  const leads = Boolean(viewer?.leads);
  const people = search.people;
  const name = picture.pet?.name || 'the pet';
  const zone = picture.timeZone;
  const roomy = useRoomy();
  const [night, flipNight] = useNight();
  const look = DESK_MAP[night ? 'dark' : 'light'];
  const [tabPicked, setTab] = useState(null);
  // With three columns the list opens on the people, for someone who may see them, and on the streets for anyone
  // else. With two, on the overview, which is where this person's own card is.
  const tab = tabPicked && (roomy ? tabPicked !== 'overview' : true) ? tabPicked : roomy ? (viewer?.seesNames ? 'people' : 'streets') : 'overview';
  const [person, setPerson] = useState(null); // the person open in People, by handle
  const [to, setTo] = useState(null); // who the Messages box is writing to: a handle, or 'everyone'
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [focused, setFocused] = useState(null); // a sighting picked from the list or the log
  const [layer, setLayer] = useState('map');
  const [rings, setRings] = useState(false);
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState('');
  const [refit, setRefit] = useState(0);
  const study = researchFor(picture.pet?.species);
  const [put, putAway] = usePutAway(picture.id);
  const [allNeeds, setAllNeeds] = useState(false);
  const [needBusy, setNeedBusy] = useState(null);
  const [needProblem, setNeedProblem] = useState('');

  const street = useMemo(() => items.find((i) => i.id === selected) || null, [items, selected]);
  // The streets a helper who asks now is given one of (lib/insight.js, givenNext): the map and the list both mark them.
  const next = useMemo(() => new Set(givenNext(items).map((i) => i.id)), [items]);
  const free = useMemo(() => people.filter((p) => p.state === 'free'), [people]);
  // A street that is no longer on the board lets go of itself.
  useEffect(() => {
    if (selected && !street) setSelected(null);
  }, [selected, street]);

  // Picking a street shows it on the map with its card. The list stays where it is: someone giving a person a
  // street, or reading the messages, is not moved off what they were doing.
  const pick = (id) => {
    setProblem('');
    setSelected(id);
    if (id) setFocused(null);
  };
  // Open a person with a street already chosen for them.
  const give = (handle, streetId = null) => {
    setProblem('');
    setTab('people');
    setPerson(handle);
    if (streetId) pick(streetId);
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
  // ----- What needs the person running the search -----
  const talk = search.talk;
  const cards = useMemo(
    () => needsYou({ picture, items, people, words: talk, leads, put, unit, now }),
    // The cards change with the search, and with the clock twice a minute (how long someone has been free).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picture, items, people, talk, leads, put, unit, Math.floor(now / 30000)]
  );
  async function doNeed(card, what) {
    setNeedProblem('');
    if (what.type === 'done') return putAway(what.key);
    if (what.type === 'show') return focus(what.sightingId);
    if (what.type === 'give') return give(what.handle, what.streetId);
    if (what.type === 'write') {
      setTab('messages');
      return setTo(what.handle);
    }
    if (!['ask', 'first'].includes(what.type) || needBusy || busy) return undefined;
    setNeedBusy(card.id);
    try {
      // Nobody is free: the next person who asks for a street is sent to this one first.
      const result = what.type === 'first' ? await search.act('street', what.streetId, 'first') : await search.ask(what.handle, what.streetId, '');
      if (result.error) setNeedProblem(result.error);
      // Asked: the person's panel shows it asked, then seen, then walking. Sent to first: the street's own card says so.
      else if (what.type === 'ask') give(what.handle);
      else pick(what.streetId);
    } finally {
      setNeedBusy(null);
    }
    return undefined;
  }
  // Words from helpers still to answer, less the ones this person has put away: the count on the Messages tab.
  const waiting = useMemo(() => unanswered(talk).filter((w) => !put.has(`word-${w.id}`)).length, [talk, put]);

  async function takeBack(target) {
    if (busy || !target.askedOfHandle) return;
    setBusy('unask');
    setProblem('');
    try {
      const result = await search.unask(target.askedOfHandle);
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
    // The one that is picked stands out, and so does the newest while it is fresh. An old sighting does not keep pulsing.
    () => numbered.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, n: s.n, label: `Seen ${dayAndTime(s.at, zone, now)}`, hot: focused ? s.id === focused : s.id === newest?.id && now - new Date(s.at).getTime() < HOT_SIGHTING_MS })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [numbered, zone, focused, newest?.id, Math.floor(now / 60000)]
  );
  const mapStreets = useMemo(
    () =>
      unit === 'street'
        ? items.map((i) => {
            // Kept for someone who was asked to walk it: the map says whose, where this person may know.
            const keptFor = i.reserved && i.askedOfName && (i.status === 'UNSEARCHED' || i.status === 'NEEDS_REVISIT') ? i.askedOfName : null;
            return { id: i.id, path: i.path, status: i.status, mine: false, who: i.claimedByName || null, keptFor, title: i.title, words: `${keptFor ? `Kept for ${keptFor}` : stateWords(i)} · about ${i.minutes} min`, next: next.has(i.id) };
          })
        : [],
    [unit, items, next]
  );
  const mapCells = useMemo(() => (unit === 'block' ? items.map((i) => ({ ...i, mine: false, next: next.has(i.id), words: `${stateWords(i)} · about ${i.minutes} min` })) : []), [unit, items, next]);
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

  // The map's key: what a line's weight and colour mean, in the map's own values.
  const anyKept = mapStreets.some((s) => s.keptFor);
  const key = [
    ['thick', look.ink, 'Given out next'],
    ['thin', look.later, 'Still to walk'],
    ...(anyKept ? [['kept', look.ink, 'Kept for someone asked']] : []),
    ['dots', look.walking, 'Being walked'],
    ['line', look.walked, 'Walked'],
  ];
  // The distances a study found, drawn round where the pet was lost. One list while nothing changes, so the map is not redrawn.
  const ringList = useMemo(() => (rings && study ? study.rings.map((r) => ({ meters: r.meters, label: r.label })) : NO_RINGS), [rings, study]);

  // The numbers, this person's own card, what the search shows, and the advice.
  const overview = (
    <div className={`flex flex-col gap-3 overflow-y-auto ${roomy ? 'p-4' : 'min-h-0 flex-1 p-3'}`}>
      {leads && !full && (
        <Needs cards={cards} quiet={quietLine({ unit, items, people })} busy={needBusy} problem={needProblem} onDo={doNeed} all={allNeeds} onAll={() => setAllNeeds((v) => !v)} />
      )}
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
    <div className={`${night ? 'mc-dark' : 'mc-light'} flex h-[100dvh] flex-col overflow-hidden bg-[var(--mc-ground)]`}>
      <TopBar
        picture={picture}
        line={line}
        backHref={petHref}
        onPhoto={onPhoto}
        wide
        right={
          <button type="button" onClick={flipNight} aria-pressed={night} className={`${CONTROL} ml-2 shrink-0`}>
            {night ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />} {night ? 'Day' : 'Night'}
          </button>
        }
      />
      <div className="flex min-h-0 flex-1">
        {roomy && (
          <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto" aria-label="The search in numbers, and your step">
            {overview}
          </aside>
        )}

        <div className="relative min-w-0 flex-1 border-x border-[var(--mc-line)]">
          <div className="absolute inset-0 z-0">
            <SearchMap
              theme={night ? 'dark' : 'light'}
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
              rings={ringList}
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
                ['map', 'Map'],
                ['satellite', 'Satellite'],
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
          <div className={`pointer-events-none absolute bottom-7 left-3 z-[400] flex-wrap items-center gap-x-3.5 gap-y-1 rounded-lg border border-[var(--mc-line)] bg-[var(--mc-surface)] px-3 py-1.5 text-[13px] font-semibold text-[var(--mc-soft)] shadow-sm ${street ? 'hidden' : 'flex'}`}>
            {key.map(([kind, color, words]) => (
              <span key={words} className="flex items-center gap-1.5">
                {kind === 'dots' ? (
                  <span className="w-5 border-t-[5px] border-dotted" style={{ borderColor: color }} aria-hidden="true" />
                ) : kind === 'kept' ? (
                  <span className="flex h-[6px] w-5 items-center rounded-full" style={{ background: color }} aria-hidden="true">
                    <span className="w-full border-t-[3px] border-dashed border-flash-400" />
                  </span>
                ) : (
                  <span className="w-5 rounded-full" style={{ background: color, height: kind === 'thick' ? 6 : kind === 'thin' ? 3 : 5 }} aria-hidden="true" />
                )}
                {words}
              </span>
            ))}
          </div>
          {street && (
            // Bottom left, clear of the zoom buttons and the map's credit in the other corner.
            <div className="absolute bottom-7 left-3 z-[450] w-[min(460px,calc(100%-96px))]">
              <StreetCard street={street} picture={picture} unit={unit} now={now} leads={leads} busy={busy} problem={problem} free={free} onSteer={steer} onGive={(handle) => give(handle, street.id)} onUnask={takeBack} onClose={() => pick(null)} />
            </div>
          )}
        </div>

        <aside className={`${roomy ? 'w-[380px]' : 'order-first w-[372px] border-r border-[var(--mc-line)]'} shrink-0 bg-[var(--mc-surface)]`} aria-label={`The search for ${name}`}>
          <Board
            next={next}
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
            onFocus={focus}
            onAdd={() => {
              onSeen();
              // The form is this person's own card, which on a narrower screen is under Overview.
              if (!roomy) setTab('overview');
            }}
            onTell={search.tell}
            people={people}
            talk={talk}
            waiting={waiting}
            person={person}
            onPerson={setPerson}
            to={to}
            onTo={setTo}
            onAsk={(who, target, note) => search.ask(who.handle, target.id, note)}
            onUnask={(who) => search.unask(who.handle)}
            onWord={(who, text) => search.say(text, who.handle)}
            onPick={pick}
            onShare={onShare}
          />
        </aside>
      </div>
      {overlays}
    </div>
  );
}
