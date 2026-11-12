'use client';

/**
 * Mission Control on a desk: the whole search on one screen, and the
 * controls to steer it. A desk sees and plans; nobody searches from one,
 * so it is never asked where it is and is never handed ground
 * (SearchScreen.js). A phone is the opposite: one card, one button.
 *
 *   left    where the search stands, as a dial of its ground and three
 *           numbers (Dial.js); for the person running the search, what
 *           needs them now, each with one thing to do about it (Needs.js),
 *           and for anyone else, that they are only looking and how the
 *           owner signs in; then this person's own card, what the search
 *           shows, and the site's advice for this pet at this stage
 *   middle  the map: the circle of the search, area by area. Ground nobody
 *           has searched is an outline, heaviest where it is given out
 *           next; searched ground is green, deeper for a second search;
 *           ground someone is on has a dashed teal edge. Pointing names an
 *           area, clicking picks it.
 *   right   the people on the search and what each is doing, the ground
 *           area by area (Ground.js), the sightings, and everything said
 *           and done in one stream
 *
 * The owner runs the search from here (`viewer.leads`: app/lib/searcher.js
 * says why it is the owner alone). They ask a named person to search an
 * area and see it asked, seen and started; they write to one person or to
 * everyone (app/lib/searchTalk.js); and they steer: send the next helpers
 * to an area first, put one down as searched for someone who searched it
 * without the site, ask for another look, or widen the circle
 * (app/lib/searchZones.js, ZONE_STEER_ACTIONS). Everyone else sees the
 * same search and can add a sighting.
 *
 * (A search from before it was on areas is drawn as it was: its streets
 * or squares, with the street's own card.)
 *
 * The map fills the screen and the two panels float over it, like
 * instruments on a table. The panels and the top bar are always the dark
 * palette, the phone's own; the map is light by day, like an ordinary map,
 * and dark by its own switch. (Until 2026-11-12 the desk was three white
 * columns. Founder: "The white is super boring and seems incomplete".)
 * Every colour comes from the screen's two palettes (app/globals.css,
 * .mc-light and .mc-dark), which are held to a contrast of 4.5 to 1 or
 * better, and no text here is smaller than 13px.
 */
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, Check, ExternalLink, Eye, Flag, LogIn, Maximize, Maximize2, Moon, RotateCcw, ShieldCheck, Sun, X, Loader2 } from 'lucide-react';
import TopBar from '../components/TopBar';
import usePutAway from '../hooks/usePutAway';
import { DESK_MAP } from '../components/SearchMap';
import { clockTime, dayAndTime, HOT_SIGHTING_MS } from '../lib/words';
import { givenNext, researchFor, stateWords, streetFacts } from '../lib/insight';
import { needsYou, quietLine } from '../lib/needs';
import { unanswered } from '../lib/team';
import { areaState, givenNextAreas, mapLabel, needsForGround, quietGround } from '../lib/ground';
import { Advice, Know, Numbers } from './Know';
import Board from './Board';
import Needs from './Needs';
import Summary from './Dial';
import { AreaCard } from './Ground';

const SearchMap = dynamic(() => import('../components/SearchMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--mc-ground)]" />,
});

const CONTROL =
  'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--mc-line-strong)] bg-[var(--mc-surface)] px-3 text-[13px] font-bold leading-5 text-[var(--mc-ink)] shadow-sm hover:bg-[var(--mc-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400';

/** A panel that floats over the map: the desk's two, and nothing else. */
const PANEL =
  'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--mc-line)] bg-[color-mix(in_srgb,var(--mc-surface)_95%,transparent)] shadow-[var(--mc-shadow)] backdrop-blur-md';

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

const shapeOf = (item) => (item?.outline?.length ? item.outline : item?.path?.length ? item.path : item ? [[item.northLat, item.westLng], [item.southLat, item.eastLng]] : []);

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

export default function Command({ picture, items, unit, circle = null, now, line, petHref, onPhoto, step, full, onBack, onSeen, onShare, picking = false, pin = null, onPick = null, search, mapLabel: mapWords, overlays }) {
  const viewer = picture.viewer;
  const leads = Boolean(viewer?.leads);
  // The search is areas of ground. (Streets or squares, for a search from before it was.)
  const ground = unit === 'area';
  const people = search.people;
  const name = picture.pet?.name || 'the pet';
  const ownerName = picture.owner?.firstName || 'The owner';
  // Back to this search after signing in.
  const signInHref = `/login?callbackUrl=${encodeURIComponent(`/mission-control?mission=${picture.caseNumber || picture.id}`)}`;
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
  // What a helper who asks now is given one of (lib/ground.js, givenNextAreas): the map and the list both mark it.
  const next = useMemo(() => new Set((ground ? givenNextAreas(items) : givenNext(items)).map((i) => i.id)), [items, ground]);
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
  // An area's card is in the list beside the map, where it covers none of the ground. Picking one on the map
  // opens it there, unless this person is in the middle of choosing an area for someone.
  const pickOnMap = (id) => {
    pick(id);
    if (id && ground && !(tab === 'people' && person)) setTab('streets');
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
    if (busy) return undefined;
    setBusy(action);
    setProblem('');
    try {
      const result = await search.act(unit, target.id, action);
      if (result.error) setProblem(result.error);
      return result;
    } finally {
      setBusy(null);
    }
  }
  // ----- What needs the person running the search -----
  const talk = search.talk;
  const cards = useMemo(
    () => (ground ? needsForGround({ picture, areas: items, circle, people, words: talk, leads, put, now }) : needsYou({ picture, items, people, words: talk, leads, put, unit, now })),
    // The cards change with the search, and with the clock twice a minute (how long someone has been free).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picture, items, circle, people, talk, leads, put, unit, Math.floor(now / 30000)]
  );
  const [widening, setWidening] = useState(false);
  async function widen() {
    if (widening) return undefined;
    setWidening(true);
    setProblem('');
    try {
      const result = await search.widen();
      if (result.error) setProblem(result.error);
      else {
        // The whole of the wider search comes into view.
        setSelected(null);
        setFocused(null);
        setRefit((n) => n + 1);
      }
      return result;
    } finally {
      setWidening(false);
    }
  }
  async function doNeed(card, what) {
    setNeedProblem('');
    if (what.type === 'done') return putAway(what.key);
    if (what.type === 'show') return focus(what.sightingId);
    const target = what.areaId || what.streetId || null;
    if (what.type === 'give') return give(what.handle, target);
    if (what.type === 'write') {
      setTab('messages');
      return setTo(what.handle);
    }
    if (!['ask', 'first', 'widen', 'againAll'].includes(what.type) || needBusy || busy) return undefined;
    setNeedBusy(card.id);
    try {
      // Nobody is free: the next person who asks is sent to this one first.
      const result =
        what.type === 'widen' ? await widen() : what.type === 'againAll' ? await search.againAll() : what.type === 'first' ? await search.act(unit, target, 'first') : await search.ask(what.handle, target, '');
      if (result?.error) setNeedProblem(result.error);
      // Asked: the person's panel shows it asked, then seen, then started. Sent to first: its own card says so.
      else if (what.type === 'ask') give(what.handle);
      else if (what.type === 'first') pickOnMap(target);
      // Widened, or put up for another look: the Ground list shows it.
      else setTab('streets');
    } finally {
      setNeedBusy(null);
    }
    return undefined;
  }
  // Words from helpers still to answer, less the ones this person has put away: the count on the Messages tab.
  const waiting = useMemo(() => unanswered(talk).filter((w) => !put.has(`word-${w.id}`)).length, [talk, put]);

  // "Ask Jo" on an area's card: asked at once, and then Jo is opened, where the ask reads asked, seen, started.
  async function askFromCard(handle, areaId) {
    if (busy) return;
    setBusy(`ask:${handle}`);
    setProblem('');
    try {
      const result = await search.ask(handle, areaId, '');
      if (result.error) setProblem(result.error);
      else give(handle);
    } finally {
      setBusy(null);
    }
  }

  async function takeBack(target) {
    // A street carries who it is kept for; an area's card passes the handle of the person asked.
    const handle = typeof target === 'string' ? target : target?.askedOfHandle;
    if (busy || !handle) return;
    setBusy('unask');
    setProblem('');
    try {
      const result = await search.unask(handle);
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
  // The ground, area by area: each with its name on it and, for the people who may know, who is on it.
  const mapAreas = useMemo(
    () =>
      ground
        ? items.map((i) => ({
            id: i.id,
            outline: i.outline,
            ring: i.ring,
            status: i.status,
            searchCount: i.searchCount,
            on: i.on,
            mine: false,
            // Heavy on the map where a few areas are next. With many as urgent as each other (a ring just added),
            // every outline heavy would say nothing: the list still marks each.
            next: next.has(i.id) && next.size <= 4,
            center: i.center,
            label: mapLabel(i),
            who: (i.who || []).map((w) => w.name).join(', ') || null,
            title: i.name,
            words: `${areaState(i)} · about ${i.minutes} min`,
          }))
        : [],
    [ground, items, next]
  );
  const lastSeenTag = useMemo(() => {
    const at = picture.lastSeen;
    if (!at || !Number.isFinite(at.lat) || !Number.isFinite(at.lng)) return null;
    // Over ground its words sit above the mark, clear of the names of the areas on either side of it.
    return { lat: at.lat, lng: at.lng, label: `Lost here ${dayAndTime(at.at, zone, now)}`, ...(ground ? { side: 'above' } : {}) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture.lastSeen?.lat, picture.lastSeen?.lng, picture.lastSeen?.at, zone, ground, Math.floor(now / 60000)]);

  const fit = useMemo(() => {
    const spot = focused ? numbered.find((s) => s.id === focused) : null;
    if (spot) return [[spot.lat, spot.lng], ...around(spot.lat, spot.lng, 260)];
    // A street is small, so picking one brings it close. An area is a fifth of the search: the whole circle stays in view.
    if (street && !ground) return [...shapeOf(street), ...(street.center ? around(street.center.lat, street.center.lng, 160) : [])];
    // The whole search: every street, where the pet was lost, and where it was seen.
    const all = items.flatMap((i) => shapeOf(i));
    const seen = numbered.map((s) => [s.lat, s.lng]);
    // Round a street board, a neighbourhood's worth of room for where the pet was lost. Ground is its own frame: its edge.
    const lost = lastSeenTag && !ground ? around(lastSeenTag.lat, lastSeenTag.lng, 200) : [];
    return [...all, ...seen, ...lost];
  }, [focused, street, ground, items, numbered, lastSeenTag]);
  const fitKey = `${focused ? `seen:${focused}` : street && !ground ? `street:${street.id}` : `all:${items.length}:${numbered.length}`}|${refit}`;

  // The map's key: what a line's weight and colour mean, in the map's own values. It sits above the strip the
  // map's credit has along the bottom, and stops short of the zoom buttons in the corner, wrapping to a second line.
  const anyKept = mapStreets.some((s) => s.keptFor);
  const key = ground
    ? [
        ['edge', look.ink, 'Given out next'],
        ['open', look.later, 'Not searched'],
        ['dash', look.walking, 'Being searched'],
        ['once', look.walked, 'Searched once'],
        ['twice', look.walked, 'Twice or more'],
        ...(items.some((i) => i.status === 'NEEDS_REVISIT') ? [['again', look.walked, 'Another look']] : []),
        ...(items.some((i) => i.ring === 3) ? [['seen', 'var(--mc-seen)', 'Round a sighting']] : []),
      ]
    : [
        ['thick', look.ink, 'Given out next'],
        ['thin', look.later, 'Still to walk'],
        ...(anyKept ? [['kept', look.ink, 'Kept for someone asked']] : []),
        ['dots', look.walking, 'Being walked'],
        ['line', look.walked, 'Walked'],
      ];
  const canWiden = ground && leads && circle && !circle.widened && circle.wide > circle.edge;
  // The distances a study found, drawn round where the pet was lost. One list while nothing changes, so the map is not redrawn.
  const ringList = useMemo(() => (rings && study ? study.rings.map((r) => ({ meters: r.meters, label: r.label })) : NO_RINGS), [rings, study]);

  // This person's own panel: where the search stands, what needs them or how they come to run it, their own
  // card, what the search shows, and the advice.
  const overview = (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="px-4 pb-4 pt-4">{ground ? <Summary picture={picture} items={items} circle={circle} next={next} now={now} selected={selected} hovered={hovered} onSelect={pickOnMap} onHover={setHovered} /> : <Numbers picture={picture} items={items} unit={unit} now={now} />}</div>
      {picture.open && !leads && !full && (
        // Someone only looking is told so, and told how the person whose search it is gets to run it. Without
        // this the desk reads as broken: there is nothing to mark an area searched, widen the circle or write.
        <div className="mx-4 mb-4 rounded-2xl bg-[var(--mc-raised)] px-4 py-3.5" role="status">
          <p className="flex items-center gap-2 text-[14px] font-extrabold leading-5 text-[var(--mc-ink)]">
            <Eye size={15} aria-hidden="true" /> Viewing only
          </p>
          <p className="mt-1 text-[14px] font-medium leading-[21px] text-[var(--mc-soft)]">
            {viewer?.signedIn ? `You are signed in as ${viewer.firstName}. ` : ''}
            {ownerName} runs this search. Marking an area searched, widening the circle and writing to helpers are done from {ownerName}&apos;s account.
            {viewer?.signedIn ? '' : ' If that is you, sign in.'}
          </p>
          <a href={signInHref} className={`${CONTROL} mt-2.5`}>
            <LogIn size={15} aria-hidden="true" /> {viewer?.signedIn ? 'Use another account' : 'Sign in'}
          </a>
        </div>
      )}
      {leads && !full && (
        <div className="border-t border-[var(--mc-line)] px-4 py-4">
          <Needs cards={cards} quiet={ground ? quietGround({ areas: items, people }) : quietLine({ unit, items, people })} busy={needBusy} problem={needProblem} onDo={doNeed} all={allNeeds} onAll={() => setAllNeeds((v) => !v)} />
        </div>
      )}
      <section aria-label="Your step" className={`border-t border-[var(--mc-line)] ${full ? 'overflow-hidden pb-2' : 'p-4'}`}>
        {full && (
          <button type="button" onClick={onBack} className="ml-4 mt-3 inline-flex min-h-[36px] items-center gap-1.5 text-[15px] font-semibold text-[var(--mc-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400">
            <ArrowLeft size={18} aria-hidden="true" /> Back to the map
          </button>
        )}
        {step}
      </section>
      {!full && <Know picture={picture} items={items} unit={unit} circle={circle} now={now} rings={rings} onRings={() => setRings((v) => !v)} />}
      {!full && <Advice picture={picture} now={now} />}
    </div>
  );

  // Where the map's own controls start: clear of the panel on its left.
  const inset = 'left-[396px]';
  return (
    // The desk's panels and top bar are always the dark palette, the phone's own: they sit on the map like
    // instruments on a table. Day and night are the map's: light streets by day, dark by its switch.
    <div className="mc-dark flex h-[100dvh] flex-col overflow-hidden bg-[var(--mc-ground)]">
      <TopBar
        picture={picture}
        line={line}
        backHref={petHref}
        onPhoto={onPhoto}
        wide
        right={
          <>
            {leads && (
              // Who is running it, said once: the owner, or the site's own admin standing in.
              <span className="ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--mc-raised)] px-3 py-1.5 text-[13px] font-bold leading-5 text-[var(--mc-ink)]">
                <ShieldCheck size={15} className="text-[var(--mc-home)]" aria-hidden="true" /> {viewer?.isOwner ? 'You run this search' : 'Running it as site admin'}
              </span>
            )}
            <button type="button" onClick={flipNight} aria-pressed={night} className={`${CONTROL} ml-2 shrink-0`}>
              {night ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />} {night ? 'Day map' : 'Night map'}
            </button>
          </>
        }
      />
      <div className={`relative min-h-0 flex-1 ${roomy ? 'mc-stage-wide' : ''}`}>
        <div className="absolute inset-0 z-0">
          <SearchMap
            theme={night ? 'dark' : 'light'}
            desk
            layer={layer}
            lastSeen={lastSeenTag}
            sightings={mapSightings}
            areas={mapAreas}
            streets={mapStreets}
            cells={mapCells}
            selected={selected}
            hovered={hovered}
            onSelect={pickOnMap}
            onHover={setHovered}
            rings={ringList}
            spot={ground && circle?.center ? { lat: circle.center.lat, lng: circle.center.lng, meters: circle.radius } : null}
            trail
            fit={fit}
            fitKey={fitKey}
            // The whole search between the two panels, with room round it.
            padding={{ top: 76, right: roomy ? 436 : 56, bottom: street && !ground ? 270 : 84, left: 420 }}
            // A dog's circle fills the map near this zoom. A cat's is a third the size, so ground may be shown closer.
            maxFitZoom={ground ? 18 : 16.25}
            zoomControl
            pick={picking}
            pin={pin}
            onPick={onPick}
            label={mapWords}
          />
        </div>

        {roomy && (
          <aside className={`absolute left-3 top-3 z-[450] max-h-[calc(100%-24px)] w-[372px] ${PANEL}`} aria-label="The search in numbers, and your step">
            {overview}
          </aside>
        )}

        <div className={`absolute top-3 z-[400] flex flex-wrap items-center gap-2 ${inset}`}>
          <div className="flex overflow-hidden rounded-xl border border-[var(--mc-line)] bg-[var(--mc-surface)] p-0.5 shadow-[var(--mc-shadow)]" role="radiogroup" aria-label="What the map is drawn on">
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
                className={`min-h-[34px] rounded-[10px] px-3 text-[13px] font-bold leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400 ${layer === id ? 'bg-[var(--mc-ink)] text-[var(--mc-surface)]' : 'text-[var(--mc-soft)] hover:text-[var(--mc-ink)]'}`}
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
            className={`${CONTROL} shadow-[var(--mc-shadow)]`}
          >
            <Maximize2 size={15} aria-hidden="true" /> The whole search
          </button>
          {canWiden && (
            <button type="button" onClick={widen} disabled={widening} className={`${CONTROL} shadow-[var(--mc-shadow)] disabled:opacity-60`}>
              {widening ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Maximize size={15} aria-hidden="true" />} Widen to {circle.wide} m
            </button>
          )}
        </div>
        {picking && (
          // What a click does right now, said on the map itself.
          <p className={`pointer-events-none absolute top-[60px] z-[400] rounded-full bg-[var(--mc-seen)] px-3.5 py-1.5 text-[14px] font-bold leading-5 text-[var(--mc-on-seen)] shadow-[var(--mc-shadow)] ${inset}`}>
            {pin ? 'Drag the pin, or click again, to move it' : `Click where you saw ${name}`}
          </p>
        )}
        <div
          // The key is the map's own, so it is light on the light map: its samples are the colours drawn on it.
          className={`${night ? 'mc-dark' : 'mc-light'} pointer-events-none absolute bottom-7 z-[400] flex-wrap items-center gap-x-3.5 gap-y-1 rounded-xl border border-[var(--mc-line)] bg-[color-mix(in_srgb,var(--mc-surface)_94%,transparent)] px-3 py-2 text-[13px] font-semibold text-[var(--mc-soft)] shadow-[var(--mc-shadow)] backdrop-blur-md ${inset} ${roomy ? 'max-w-[calc(100%-880px)]' : 'max-w-[calc(100%-470px)]'} ${street && !ground ? 'hidden' : 'flex'}`}
        >
          {key.map(([kind, color, words]) => (
            <span key={words} className="flex items-center gap-1.5">
              {kind === 'edge' || kind === 'open' ? (
                <span className="h-3.5 w-5 rounded-[3px]" style={{ border: `${kind === 'edge' ? 3 : 1.5}px solid ${color}` }} aria-hidden="true" />
              ) : kind === 'dash' ? (
                <span className="h-3.5 w-5 rounded-[3px]" style={{ border: `2.5px dashed ${color}` }} aria-hidden="true" />
              ) : kind === 'again' ? (
                <span className="relative h-3.5 w-5 overflow-hidden rounded-[3px]" style={{ border: `2px solid ${look.ink}` }} aria-hidden="true">
                  <span className="absolute inset-0" style={{ background: color, opacity: 0.45 }} />
                </span>
              ) : kind === 'once' || kind === 'twice' ? (
                <span className="h-3.5 w-5 rounded-[3px]" style={{ border: `1.5px solid ${color}`, background: color, opacity: kind === 'twice' ? 0.95 : 0.55 }} aria-hidden="true" />
              ) : kind === 'seen' ? (
                <span className="h-3.5 w-3.5 rounded-full" style={{ border: `2px dashed ${color}` }} aria-hidden="true" />
              ) : kind === 'dots' ? (
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
        {street && !ground && (
          // Bottom left, clear of the zoom buttons and the map's credit in the other corner.
          <div className={`absolute bottom-7 z-[450] w-[min(460px,calc(100%-500px))] ${inset}`}>
            <StreetCard street={street} picture={picture} unit={unit} now={now} leads={leads} busy={busy} problem={problem} free={free} onSteer={steer} onGive={(handle) => give(handle, street.id)} onUnask={takeBack} onClose={() => pick(null)} />
          </div>
        )}

        <aside className={`absolute top-3 z-[450] max-h-[calc(100%-24px)] ${roomy ? 'right-3 w-[388px]' : 'left-3 w-[372px]'} ${PANEL}`} aria-label={`The search for ${name}`}>
          <Board
            next={next}
            overview={roomy ? null : overview}
            picture={picture}
            items={items}
            unit={unit}
            circle={circle}
            onWiden={widen}
            widening={widening}
            onSteer={steer}
            areaCard={
              ground && street ? (
                <AreaCard area={street} picture={picture} circle={circle} now={now} leads={leads} busy={busy} problem={problem} free={free} next={next.has(street.id)} onSteer={steer} onAsk={(handle) => askFromCard(handle, street.id)} onUnask={takeBack} onClose={() => pick(null)} />
              ) : null
            }
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
