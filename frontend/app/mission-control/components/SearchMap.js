'use client';

/**
 * The map of a search: a quiet street map with a few lit things on it.
 *
 *   red      where the pet was lost
 *   orange   where it has been seen, the newest loudest
 *   yellow   the area of ground this person is searching
 *   green    ground already searched, deeper where it was searched twice
 *   dashed   ground someone is on now
 *   white    this person's own path, where the app is recording one
 *
 * The search is a circle of ground cut into areas (`areas`:
 * app/lib/searchCircle.js). Streets are the map's own and nothing is
 * drawn along them: a pet does not keep to streets. (`streets` and
 * `cells` draw a search from before it was on areas.)
 *
 * Every mark has words beside it, so nobody decodes a colour. It draws
 * ground, not people: no dot of any helper is ever on it. The only
 * person shown is the one holding the phone, to themselves.
 *
 * On a phone the map is looked at, not tapped: the card's one button does
 * the choosing. On a desk (`desk`) it is the instrument: every area of
 * the search is drawn, outlined heaviest where the search goes next, and
 * answers to the pointer. Pointing at one names it, clicking picks it, and
 * the list beside the map and the map point at the same area. The desk can
 * also draw how far lost pets were found in published studies (`rings`),
 * join the sightings in the order they happened (`trail`), and show the
 * ground from above (`layer`).
 *
 * Labels are built from DOM nodes with textContent: street names come
 * from OpenStreetMap and place names from the public, and neither is
 * ever set as HTML.
 */
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { TILE_URL, tileLayerOptions, SATELLITE_URL, SATELLITE_LABELS_URL, SATELLITE_ATTRIBUTION } from '@/app/lib/maps/tiles';
import { PET_COLOR } from '@/app/lib/petColors';

const FLASH = '#facc15';
const TEAL = '#2dd4bf';
/**
 * How the desk's map is drawn, by day and by night. Weight says what is
 * left: a street still to walk is drawn in ink, the ones given out next
 * are the thickest, and a walked street turns green. Colour is kept for
 * meaning and never used for rank: red where the pet was lost, orange
 * where it was seen, teal for someone at work, green for done, yellow for
 * the street in hand: the one that is picked, and one kept for a person
 * who was asked to walk it, which carries their name. The list beside the
 * map uses the same values.
 */
export const DESK_MAP = {
  light: { ink: '#0f172a', later: '#64748b', walked: '#3f9f79', walking: '#0d9488', casing: '#ffffff' },
  dark: { ink: '#f8fafc', later: '#8493a8', walked: '#34916d', walking: '#2dd4bf', casing: '#020617' },
};

/**
 * What a list is when none is passed. One array for all of them, and never
 * a new one: these are what the drawing effects compare, so a new empty
 * list on every render would clear and redraw the whole map every time
 * anything on the screen changed.
 */
const NONE = Object.freeze([]);

function node(tag, css, text) {
  const el = document.createElement(tag);
  if (css) el.style.cssText = css;
  if (text != null) el.textContent = text;
  return el;
}

const TAG_TONES = {
  plain: { dark: 'background:#0f172a;color:#f8fafc;border:1px solid rgba(148,163,184,0.45)', light: 'background:#ffffff;color:#0f172a;border:1px solid #cbd5e1' },
  // Someone is on this ground: the teal of the line round it.
  on: { dark: 'background:#0f172a;color:#5eead4;border:1px solid rgba(45,212,191,0.7)', light: 'background:#ffffff;color:#115e59;border:1px solid rgba(13,148,136,0.7)' },
  // An area's own name, written on the ground with no box: ink with a halo of the map's casing.
  bare: {
    dark: 'background:transparent;color:#f8fafc;border:0;box-shadow:none;padding:0 2px;text-shadow:0 0 3px #020617,0 0 3px #020617,0 0 6px #020617,0 0 6px #020617',
    light: 'background:transparent;color:#0f172a;border:0;box-shadow:none;padding:0 2px;text-shadow:0 0 3px #ffffff,0 0 3px #ffffff,0 0 6px #ffffff,0 0 6px #ffffff',
  },
  seen: { dark: 'background:#0f172a;color:#fdba74;border:1px solid rgba(234,88,12,0.7)', light: 'background:#ffffff;color:#c2410c;border:1px solid rgba(234,88,12,0.6)' },
  flash: { dark: `background:${FLASH};color:#0f172a;border:1px solid ${FLASH}`, light: `background:${FLASH};color:#0f172a;border:1px solid #0f172a` },
};

/** A marker that is a dot (or nothing) with a word tag beside it. */
function tagged(L, { dot = null, text, tone = 'plain', theme = 'dark', side = 'right', cls = '' }) {
  const root = node('div', 'position:relative;width:0;height:0');
  if (dot) root.appendChild(dot);
  if (text) {
    // Beside the point, or centred above or below it where a line runs through the point sideways.
    const place =
      side === 'left'
        ? 'top:-13px;right:16px;'
        : side === 'center'
          ? 'top:-13px;left:0;transform:translateX(-50%);'
          : side === 'under'
            ? 'top:10px;left:0;transform:translateX(-50%);'
        : side === 'above'
          ? 'bottom:14px;left:0;transform:translateX(-50%);'
          : side === 'below'
            ? 'top:14px;left:0;transform:translateX(-50%);'
            : 'top:-13px;left:16px;';
    const words = node(
      'span',
      `position:absolute;${place}white-space:nowrap;padding:2px 7px;border-radius:4px;font:600 13px/19px Inter,system-ui,sans-serif;box-shadow:0 1px 3px rgba(2,6,23,0.3);${TAG_TONES[tone][theme]}`,
      text
    );
    if (cls) words.className = cls;
    root.appendChild(words);
  }
  return L.divIcon({ className: '', html: root, iconSize: [0, 0], iconAnchor: [0, 0] });
}

function disc(color, size, { ring = '#ffffff', pulse = false, text = null } = {}) {
  const wrap = node('span', `position:absolute;left:${-size / 2}px;top:${-size / 2}px;width:${size}px;height:${size}px`);
  if (pulse) {
    const halo = node('span', `position:absolute;inset:-10px;border-radius:9999px;background:${color};opacity:0.28`);
    halo.className = 'animate-pulse';
    wrap.appendChild(halo);
  }
  wrap.appendChild(node('span', `position:absolute;inset:0;border-radius:9999px;background:${color};border:3px solid ${ring};box-shadow:0 1px 6px rgba(2,6,23,0.45)`));
  // A number inside it: the sightings in the order they happened.
  if (text != null) wrap.appendChild(node('span', 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 13px/1 Inter,system-ui,sans-serif;color:#ffffff', String(text)));
  return wrap;
}

/** The words that follow the pointer over a street: its name, and its state. Text nodes only. */
function tip(title, words) {
  // As wide as its words up to a limit: inside Leaflet's own box, which does not wrap, a bare max-width collapses to one word a line.
  const box = node('div', 'font:600 13px/18px Inter,system-ui,sans-serif;color:#0f172a;width:max-content;max-width:260px;white-space:normal');
  box.appendChild(node('div', 'font-weight:700', title));
  if (words) box.appendChild(node('div', 'color:#475569', words));
  return box;
}

export default function SearchMap({
  theme = 'dark',
  lastSeen = null, // { lat, lng, label }
  sightings = NONE, // [{ id, lat, lng, label, hot, n }]: `n` numbers them in the order they happened
  // The search's ground: [{ id, outline, ring, status, searchCount, on, mine, next, label, center, who, title, words }].
  // `outline` is a closed [[lat, lng], ...], `label` the short name written on it, `who` the first names of the people on it.
  areas = NONE,
  streets = NONE, // [{ id, path, status, mine, who, keptFor, title, words, next }]: `next` is given out next, `keptFor` names who it is kept for
  cells = NONE, // [{ id, northLat, southLat, eastLng, westLng, status, mine, title, words }]
  me = null, // { lat, lng }
  track = NONE, // [{ lat, lng }, ...] this person's own recorded path (the app only)
  tags = NONE, // extra word tags: [{ lat, lng, text, tone, side }]
  fit = NONE, // [[lat, lng], ...] what must be in view
  fitKey = '',
  padding = { top: 16, right: 16, bottom: 16, left: 16 },
  zoomControl = false,
  label = 'Map of the search',
  desk = false, // every street drawn, and the map answers to the pointer
  creditBottom = 0, // how far above the map's bottom edge its credit sits: what the screen lays over that edge
  selected = null, // id of the street or square that is picked
  hovered = null, // id pointed at from the list beside the map
  onSelect = null, // (id | null) => void
  onHover = null, // (id | null) => void
  rings = NONE, // [{ meters, label }] around where the pet was lost
  spot = null, // { lat, lng, meters }: the circle of the search. Everything outside it is dimmed, so the search stands out
  trail = false, // join the sightings in the order they happened
  layer = 'map', // 'map' | 'satellite'
  maxFitZoom = 17, // how close a fit may go
  pick = false, // a place is being chosen: a click anywhere on the map puts the pin there
  pin = null, // { lat, lng }: the place chosen so far, which can be dragged
  onPick = null, // ({ lat, lng }) => void
}) {
  const holder = useRef(null);
  const state = useRef({ map: null, L: null, layers: null, focus: null, tiles: {} });
  const select = useRef(onSelect);
  select.current = onSelect;
  const hover = useRef(onHover);
  hover.current = onHover;
  const picking = useRef(pick);
  picking.current = pick;
  const putPin = useRef(onPick);
  putPin.current = onPick;
  const layerNow = useRef(layer);
  layerNow.current = layer;
  const themeNow = useRef(theme);
  themeNow.current = theme;

  // How far apart the names of the areas are on the ground, in metres: the widest gap between two of them.
  const nameSpan = useRef(0);
  // Whether the areas' names have room. Zoomed far out the whole circle is a few pixels across, and five names on
  // one spot read as a smudge: below about a hundred and forty pixels between them they are left off.
  const crowd = () => {
    const { map } = state.current;
    const el = holder.current;
    if (!map || !el) return;
    const metersPerPixel = (156543.03392 * Math.cos((map.getCenter().lat * Math.PI) / 180)) / 2 ** map.getZoom();
    el.classList.toggle('mc-far', nameSpan.current > 0 && nameSpan.current / metersPerPixel < 140);
  };

  // The ground under everything: the street map, or the view from above with the roads named over it.
  const showLayer = () => {
    const { map, L, tiles } = state.current;
    if (!map || !L) return;
    // The street map is drawn light or dark to match the screen: when the desk goes from day to night it is made again.
    if (tiles.streets && tiles.drawnFor !== themeNow.current) {
      map.removeLayer(tiles.streets);
      tiles.streets = null;
    }
    if (!tiles.streets) {
      tiles.streets = L.tileLayer(TILE_URL, tileLayerOptions(themeNow.current === 'dark' ? { dark: true } : { calm: true }));
      tiles.drawnFor = themeNow.current;
    }
    if (layerNow.current === 'satellite') {
      if (!tiles.photo) {
        tiles.photo = L.tileLayer(SATELLITE_URL, { maxZoom: 19, attribution: SATELLITE_ATTRIBUTION });
        tiles.names = L.tileLayer(SATELLITE_LABELS_URL, { maxZoom: 19, opacity: 0.9 });
      }
      map.removeLayer(tiles.streets);
      tiles.photo.addTo(map);
      tiles.names.addTo(map);
    } else {
      if (tiles.photo) {
        map.removeLayer(tiles.photo);
        map.removeLayer(tiles.names);
      }
      tiles.streets.addTo(map);
    }
  };

  // The map itself, once.
  useEffect(() => {
    let cancelled = false;
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !holder.current || state.current.map) return;
      const start = lastSeen ? [lastSeen.lat, lastSeen.lng] : fit[0] || [39.5, -98.35];
      const map = L.map(holder.current, { zoomControl: false, attributionControl: true, zoomSnap: 0.25 }).setView(start, lastSeen ? 16 : 4);
      map.attributionControl.setPrefix(false);
      if (zoomControl) L.control.zoom({ position: 'bottomright' }).addTo(map);
      state.current = { map, L, layers: L.layerGroup().addTo(map), focus: L.layerGroup().addTo(map), tiles: {} };
      showLayer();
      // On a desk, a click on the map itself, and not on a street, lets go of the street that was picked.
      // While a place is being chosen, the click is the place.
      if (desk) map.on('click', (event) => (picking.current ? putPin.current?.({ lat: event.latlng.lat, lng: event.latlng.lng }) : select.current?.(null)));
      // Far out, the areas are a few pixels across and their names would lie on top of each other: they are left off.
      map.on('zoomend', () => crowd());
      // The zoom, readable from outside, so a test can tell what is in view.
      const note = () => {
        if (holder.current) holder.current.dataset.zoom = String(map.getZoom());
      };
      map.on('zoomend', note);
      note();
      // Let the layers effect below run now that the map exists.
      holder.current.dispatchEvent(new Event('searchmap:ready'));
    });
    return () => {
      cancelled = true;
      if (state.current.map) state.current.map.remove();
      state.current = { map: null, L: null, layers: null, focus: null, tiles: {} };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    showLayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, theme]);

  // Everything drawn on it, redrawn when the search changes.
  useEffect(() => {
    const el = holder.current;
    const draw = () => {
      const { map, L, layers } = state.current;
      if (!map || !L) return;
      layers.clearLayers();
      const dark = theme === 'dark';
      const casing = dark ? '#020617' : '#ffffff';

      // On a desk a street or a square answers to the pointer: its name follows it, and a click picks it.
      const answer = (shape, item) => {
        shape.bindTooltip(tip(item.title || '', item.words || ''), { sticky: true, direction: 'top', offset: [0, -10], opacity: 1 });
        shape.on('mouseover', () => hover.current?.(item.id));
        shape.on('mouseout', () => hover.current?.(null));
        shape.on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          // While a place is being chosen, a click on an area is still a click on the ground.
          if (picking.current) putPin.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
          else select.current?.(item.id);
        });
      };

      const look = DESK_MAP[dark ? 'dark' : 'light'];

      // The ground of the search, area by area. What has been searched is filled green, deeper for a second
      // search; what someone is on now has a dashed teal edge; what nobody has searched is left as the map, inside
      // an outline. The circle round a sighting is the orange of the sighting.
      const seenLine = dark ? '#fb923c' : '#c2410c';
      // The circle round a sighting lies inside the circle's own areas, so it is drawn after them: on a desk
      // the shape on top is the one the pointer finds, and drawn first it could never be pointed at or picked.
      const drawn = [...areas].sort((a, b) => Number(a.ring === 3) - Number(b.ring === 3));
      const named = drawn.filter((a) => a.label && a.center && Number.isFinite(a.center.lat));
      nameSpan.current = named.reduce((far, a) => Math.max(far, ...named.map((b) => map.distance([a.center.lat, a.center.lng], [b.center.lat, b.center.lng]))), 0);
      crowd();
      if (spot && Number.isFinite(spot.lat) && spot.meters > 0) {
        // The ground of the search stands out from the town round it: everything outside the circle is dimmed.
        // One shape, the size of a country, with the circle cut out of it.
        const far = 4;
        const world = [[spot.lat - far, spot.lng - far], [spot.lat - far, spot.lng + far], [spot.lat + far, spot.lng + far], [spot.lat + far, spot.lng - far]];
        const hole = [];
        for (let turn = 0; turn < 360; turn += 4) {
          const t = (turn * Math.PI) / 180;
          hole.push([spot.lat + (spot.meters * Math.cos(t)) / 111320, spot.lng + (spot.meters * Math.sin(t)) / (111320 * Math.cos((spot.lat * Math.PI) / 180))]);
        }
        L.polygon([world, hole], { stroke: false, fillColor: dark ? '#020617' : '#0f172a', fillOpacity: dark ? 0.5 : 0.28, interactive: false }).addTo(layers);
        // And its edge, drawn once and firmly, under the areas' own lines.
        L.polygon(hole, { color: look.ink, weight: desk ? 1.5 : 3, opacity: 0.9, fill: false, interactive: false }).addTo(layers);
      }
      for (const area of drawn) {
        if (!Array.isArray(area.outline) || area.outline.length < 4) continue;
        const lit = Boolean(area.mine);
        const sightingCircle = area.ring === 3;
        const searched = Number(area.searchCount) > 0;
        const busy = area.status === 'IN_PROGRESS';
        // Searched, and put up for another look: it keeps its green and gets an ink edge, since it is open again.
        const again = area.status === 'NEEDS_REVISIT';
        const fill = searched
          ? // How strongly it counts as searched right now: a search fades over a day, and a short or partial one
            // counts for less (lib/ground.js, searchStrength). An area sent without it is drawn mid-green.
            { fillColor: look.walked, fillOpacity: 0.06 + 0.6 * (typeof area.strength === 'number' ? area.strength : 0.55) }
          : sightingCircle
            ? { fillColor: seenLine, fillOpacity: 0.14 }
            : busy && desk
              ? { fillColor: look.walking, fillOpacity: 0.14 }
              : { fillOpacity: 0 };
        const edge = lit
          ? { color: FLASH, weight: desk ? 2.5 : 4, fillColor: FLASH, fillOpacity: searched ? 0.3 : 0.2 }
          : busy
            ? { color: look.walking, weight: desk ? 3.5 : 3, dashArray: '2 9', lineCap: 'round' }
            : sightingCircle
              ? { color: seenLine, weight: 2.5, dashArray: '6 6' }
              : desk
                ? { color: look.ink, opacity: area.next || again ? 1 : 0.55, weight: area.next ? (desk ? 2.5 : 4) : again ? (desk ? 1.75 : 2.5) : desk ? 1 : 1.75, ...(again ? { dashArray: '3 6' } : {}) }
                : { color: dark ? 'rgba(203,213,225,0.55)' : 'rgba(51,65,85,0.5)', weight: 1.5 };
        if (lit) L.polygon(area.outline, { color: casing, weight: desk ? 4.5 : 8, opacity: 0.9, fill: false, lineJoin: 'round', interactive: false }).addTo(layers);
        const shape = L.polygon(area.outline, { lineJoin: 'round', ...fill, ...edge, interactive: desk }).addTo(layers);
        if (desk) answer(shape, area);
        if (area.center && Number.isFinite(area.center.lat)) {
          const at = [area.center.lat, area.center.lng];
          // Its name on the ground. A sighting's circle is named by the sighting's own mark.
          // The middle's name sits under the mark of where the pet was lost, which is at its centre.
          if (area.label && !sightingCircle) L.marker(at, { icon: tagged(L, { text: area.label, tone: lit ? 'flash' : 'bare', theme, side: area.ring === 0 ? 'below' : 'center', cls: 'mc-area-name' }), interactive: false, keyboard: false, zIndexOffset: 100 }).addTo(layers);
          // Who is on it, for the people who may know: first names, under the area's own.
          if (area.who && !lit) L.marker(at, { icon: tagged(L, { text: area.who, tone: 'on', theme, side: sightingCircle ? 'below' : 'under', cls: 'mc-area-name' }), interactive: false, keyboard: false, zIndexOffset: 150 }).addTo(layers);
          // When it was last searched, under its name: the age is what the search is run on.
          else if (area.age && !sightingCircle && area.ring !== 0) L.marker(at, { icon: tagged(L, { text: area.age, tone: 'bare', theme, side: 'under', cls: 'mc-area-name mc-area-age' }), interactive: false, keyboard: false, zIndexOffset: 90 }).addTo(layers);
        }
      }

      for (const cell of cells) {
        const bounds = [[cell.southLat, cell.westLng], [cell.northLat, cell.eastLng]];
        const lit = Boolean(cell.mine);
        const soon = cell.next;
        const style = lit
          ? { color: FLASH, weight: 3, fillColor: FLASH, fillOpacity: 0.22 }
          : desk
            ? cell.status === 'SEARCHED'
              ? { color: look.walked, weight: 1.5, fillColor: look.walked, fillOpacity: 0.35 }
              : cell.status === 'IN_PROGRESS'
                ? { color: look.walking, weight: 3, dashArray: '2 8', fillColor: look.walking, fillOpacity: 0.12 }
                : { color: soon ? look.ink : look.later, weight: soon ? 3.5 : 1, fillOpacity: 0 }
            : cell.status === 'SEARCHED'
              ? { color: '#94a3b8', weight: 1, fillColor: '#94a3b8', fillOpacity: dark ? 0.28 : 0.3 }
              : cell.status === 'IN_PROGRESS'
                ? { color: TEAL, weight: 2, dashArray: '2 8', fillColor: TEAL, fillOpacity: 0.08 }
                : { color: dark ? 'rgba(148,163,184,0.25)' : 'rgba(51,65,85,0.2)', weight: 1, fillOpacity: 0 };
        // On a phone the map is looked at, not tapped: a street or a square is given by the card's one button.
        const rect = L.rectangle(bounds, { ...style, interactive: desk }).addTo(layers);
        if (desk) answer(rect, cell);
      }

      // Searched and in-progress streets first, the lit one on top.
      const ordered = [...streets].sort((a, b) => Number(Boolean(a.mine)) - Number(Boolean(b.mine)));
      for (const street of ordered) {
        if (!Array.isArray(street.path) || street.path.length < 2) continue;
        const lit = Boolean(street.mine);
        if (lit) {
          L.polyline(street.path, { color: casing, weight: 13, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layers);
          L.polyline(street.path, { color: FLASH, weight: 8, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layers);
        } else if (desk) {
          // The desk draws every street, each over a casing so it stands clear of the map under it.
          const cased = (weight) => L.polyline(street.path, { color: look.casing, weight: weight + 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layers);
          if (street.status === 'IN_PROGRESS') {
            cased(5.5);
            L.polyline(street.path, { color: look.walking, weight: 5.5, opacity: 1, dashArray: '1 10', lineCap: 'round', interactive: false }).addTo(layers);
          } else if (street.status === 'SEARCHED') {
            cased(5);
            L.polyline(street.path, { color: look.walked, weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layers);
          } else if (street.keptFor) {
            // Kept for someone who was asked to walk it: ink with yellow along it, and their name beside it.
            cased(6);
            L.polyline(street.path, { color: look.ink, weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layers);
            L.polyline(street.path, { color: FLASH, weight: 3, opacity: 1, dashArray: '9 9', lineCap: 'butt', interactive: false }).addTo(layers);
          } else if (street.next) {
            // Given out next: the thickest line on the map. (One the owner asked for first is given out next.)
            cased(6);
            L.polyline(street.path, { color: look.ink, weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layers);
          } else {
            cased(2.5);
            L.polyline(street.path, { color: look.later, weight: 2.5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layers);
          }
        } else if (street.status === 'IN_PROGRESS') {
          L.polyline(street.path, { color: TEAL, weight: 5, opacity: 0.95, dashArray: '1 10', lineCap: 'round', interactive: false }).addTo(layers);
        } else if (street.status === 'SEARCHED') {
          L.polyline(street.path, { color: dark ? '#cbd5e1' : '#1e293b', weight: 6, opacity: dark ? 0.42 : 0.34, lineCap: 'round', interactive: false }).addTo(layers);
        }
        // On a phone a free street is the map's own street: nothing is drawn over it.
        if (desk) answer(L.polyline(street.path, { color: '#000000', weight: 20, opacity: 0, lineCap: 'round' }).addTo(layers), street);
        const walking = street.who && street.status === 'IN_PROGRESS';
        if ((walking || (desk && street.keptFor)) && !lit) {
          // The name sits toward the end of the street that is farther from where the pet was lost, so it
          // stays clear of that mark's own words: streets near the middle of a search all pass close to it.
          const path = street.path;
          const from = lastSeen && Number.isFinite(lastSeen.lat) ? lastSeen : null;
          const away = (p) => (from ? (p[0] - from.lat) ** 2 + ((p[1] - from.lng) * Math.cos((from.lat * Math.PI) / 180)) ** 2 : 0);
          // A walker's name sits toward the far end. "For {name}" sits at the middle of the street it is kept on,
          // where it reads as the whole street's.
          const share = !walking ? 0.5 : from ? (away(path[0]) > away(path[path.length - 1]) ? 0.2 : 0.8) : 0.5;
          const at = path[Math.round((path.length - 1) * share)];
          L.marker(at, { icon: tagged(L, walking ? { text: street.who, theme, side: 'right' } : { text: `For ${street.keptFor}`, tone: 'flash', theme, side: 'right' }), interactive: false, keyboard: false }).addTo(layers);
        }
      }

      if (trail) {
        // The sightings joined in the order they happened. A line between marks, and no claim about the way between them.
        const line = sightings.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && Number.isFinite(s.n)).sort((a, b) => a.n - b.n).map((s) => [s.lat, s.lng]);
        if (line.length > 1) L.polyline(line, { color: PET_COLOR.seen, weight: 2.5, opacity: 0.9, dashArray: '3 9', lineCap: 'round', interactive: false }).addTo(layers);
      }

      for (const s of [...sightings].reverse()) {
        if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) continue;
        const numbered = Number.isFinite(s.n);
        // A numbered mark carries a white figure, so its orange is the deeper one: 5.2 to 1, where the brighter gives 3.6.
        const dot = disc(numbered ? '#c2410c' : PET_COLOR.seen, numbered ? 24 : s.hot ? 22 : 14, { pulse: Boolean(s.hot), ring: dark ? '#0f172a' : '#ffffff', text: numbered ? s.n : null });
        L.marker([s.lat, s.lng], { icon: tagged(L, { dot, text: s.label, tone: 'seen', theme, side: s.side || 'right' }), interactive: false, keyboard: false, zIndexOffset: s.hot ? 900 : 300 }).addTo(layers);
      }

      if (lastSeen && Number.isFinite(lastSeen.lat) && Number.isFinite(lastSeen.lng)) {
        const dot = disc(PET_COLOR.lost, 18, { pulse: !sightings.some((s) => s.hot), ring: dark ? '#0f172a' : '#ffffff' });
        L.marker([lastSeen.lat, lastSeen.lng], { icon: tagged(L, { dot, text: lastSeen.label, theme, side: lastSeen.side || 'right' }), interactive: false, keyboard: false, zIndexOffset: 600 }).addTo(layers);
      }

      if (lastSeen && Number.isFinite(lastSeen.lat) && Number.isFinite(lastSeen.lng)) {
        for (const ring of rings) {
          if (!Number.isFinite(ring.meters)) continue;
          L.circle([lastSeen.lat, lastSeen.lng], { radius: ring.meters, color: dark ? '#e2e8f0' : '#334155', weight: 1.5, opacity: 0.7, dashArray: '2 8', fill: false, interactive: false }).addTo(layers);
          // Its words sit on the ring's north point.
          L.marker([lastSeen.lat + ring.meters / 111320, lastSeen.lng], { icon: tagged(L, { text: ring.label, theme, side: 'above' }), interactive: false, keyboard: false, zIndexOffset: 200 }).addTo(layers);
        }
      }

      for (const tag of tags) {
        if (!Number.isFinite(tag.lat) || !Number.isFinite(tag.lng)) continue;
        L.marker([tag.lat, tag.lng], { icon: tagged(L, { text: tag.text, tone: tag.tone || 'plain', theme, side: tag.side || 'right' }), interactive: false, keyboard: false, zIndexOffset: 700 }).addTo(layers);
      }

      const walked = track.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => [p.lat, p.lng]);
      if (walked.length > 1) {
        L.polyline(walked, { color: casing, weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layers);
        L.polyline(walked, { color: dark ? '#f8fafc' : '#0f172a', weight: 3, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layers);
      }

      if (me && Number.isFinite(me.lat) && Number.isFinite(me.lng)) {
        const dot = disc(dark ? '#f8fafc' : '#0f172a', 16, { ring: dark ? '#0f172a' : '#ffffff' });
        L.marker([me.lat, me.lng], { icon: tagged(L, { dot, text: 'You', theme, side: 'left' }), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(layers);
      }
    };
    draw();
    el?.addEventListener('searchmap:ready', draw);
    return () => el?.removeEventListener('searchmap:ready', draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, lastSeen, sightings, areas, streets, cells, me, tags, track, desk, rings, trail, spot?.lat, spot?.lng, spot?.meters]);

  // The street that is picked, and the one pointed at from the list: drawn over everything else, and redrawn
  // alone, so pointing at a row does not repaint the whole search.
  useEffect(() => {
    const el = holder.current;
    const draw = () => {
      const { L, focus } = state.current;
      if (!L || !focus) return;
      focus.clearLayers();
      const dark = theme === 'dark';
      const casing = dark ? '#020617' : '#ffffff';
      const shape = (id) => areas.find((x) => x.id === id) || streets.find((x) => x.id === id) || cells.find((x) => x.id === id) || null;
      const pointed = hovered && hovered !== selected ? shape(hovered) : null;
      // The street pointed at is ringed in the map's ink: white at night, dark by day.
      const ring = dark ? '#ffffff' : '#0f172a';
      if (pointed?.outline) L.polygon(pointed.outline, { color: ring, weight: 4, opacity: dark ? 0.9 : 0.75, fillColor: ring, fillOpacity: 0.07, lineJoin: 'round', interactive: false }).addTo(focus);
      else if (pointed?.path) L.polyline(pointed.path, { color: ring, weight: 13, opacity: dark ? 0.55 : 0.28, lineCap: 'round', interactive: false }).addTo(focus);
      else if (pointed) L.rectangle([[pointed.southLat, pointed.westLng], [pointed.northLat, pointed.eastLng]], { color: ring, weight: 3, fillOpacity: 0.12, interactive: false }).addTo(focus);
      const picked = selected ? shape(selected) : null;
      if (picked?.outline) {
        // Yellow inside a ring of ink: the one yellow edge on the map is the area that is picked.
        L.polygon(picked.outline, { color: ring, weight: desk ? 4.5 : 8, opacity: 1, fill: false, lineJoin: 'round', interactive: false }).addTo(focus);
        L.polygon(picked.outline, { color: FLASH, weight: desk ? 2.5 : 4.5, opacity: 1, fillColor: FLASH, fillOpacity: 0.2, lineJoin: 'round', interactive: false }).addTo(focus);
      } else if (picked?.path) {
        // Yellow inside a ring of ink: the one yellow line on the map is the street that is picked.
        L.polyline(picked.path, { color: casing, weight: 18, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(focus);
        L.polyline(picked.path, { color: ring, weight: 13, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(focus);
        L.polyline(picked.path, { color: FLASH, weight: 7, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(focus);
      } else if (picked) {
        L.rectangle([[picked.southLat, picked.westLng], [picked.northLat, picked.eastLng]], { color: FLASH, weight: 4, fillColor: FLASH, fillOpacity: 0.25, interactive: false }).addTo(focus);
      }
    };
    draw();
    el?.addEventListener('searchmap:ready', draw);
    return () => el?.removeEventListener('searchmap:ready', draw);
  }, [theme, areas, streets, cells, selected, hovered]);

  // What is in view: refit when the thing to look at changes, not on every poll.
  //
  // The fit waits a moment before it runs. A step change alters what to
  // look at and, a frame later, how tall the sheet over the map is; two
  // fits in a row lose the second one, because Leaflet drops a move that
  // arrives while a zoom is still animating. Waiting makes them one fit.
  useEffect(() => {
    const el = holder.current;
    let timer = null;
    const frame = () => {
      const { map, L } = state.current;
      if (!map || !L || !fit.length) return;
      if (map._animatingZoom) {
        map.once('zoomend', frame);
        return;
      }
      map.invalidateSize();
      const bounds = L.latLngBounds(fit);
      map.fitBounds(bounds.pad(0.08), {
        paddingTopLeft: [padding.left, padding.top],
        paddingBottomRight: [padding.right, padding.bottom],
        maxZoom: maxFitZoom,
        animate: true,
      });
    };
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(frame, 90);
    };
    soon();
    el?.addEventListener('searchmap:ready', soon);
    return () => {
      clearTimeout(timer);
      el?.removeEventListener('searchmap:ready', soon);
      state.current.map?.off('zoomend', frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, padding.top, padding.bottom, padding.left, padding.right]);

  // Where the map's credit sits: above whatever the screen lays over the bottom of the map (a phone's sheet and
  // the key above it), so the two never share a line. It is its own step, so it follows the sheet as it grows
  // and not only when the map is fitted again.
  useEffect(() => {
    const el = holder.current;
    const place = () => {
      const credit = state.current.map?.attributionControl?.getContainer();
      if (credit) credit.style.marginBottom = `${Math.max(0, Math.round(creditBottom))}px`;
    };
    place();
    el?.addEventListener('searchmap:ready', place);
    return () => el?.removeEventListener('searchmap:ready', place);
  }, [creditBottom]);

  // A place being chosen: the pointer is a cross, and the pin stands where the last click was. It can be dragged.
  // The pin is its own layer, so the rest of the map being drawn again leaves it where it is.
  useEffect(() => {
    const el = holder.current;
    const show = () => {
      const { map, L } = state.current;
      if (!map || !L) return;
      el?.classList.toggle('mc-picking', Boolean(pick));
      if (state.current.pin) {
        map.removeLayer(state.current.pin);
        state.current.pin = null;
      }
      if (!pick || !pin || !Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) return;
      const dark = themeNow.current === 'dark';
      const marker = L.marker([pin.lat, pin.lng], {
        draggable: true,
        keyboard: false,
        zIndexOffset: 2000,
        icon: tagged(L, { dot: disc(dark ? '#fb923c' : '#c2410c', 26, { ring: dark ? '#0f172a' : '#ffffff', pulse: true }), text: 'Seen here', tone: 'seen', theme: themeNow.current }),
      }).addTo(map);
      marker.on('dragend', () => {
        const at = marker.getLatLng();
        putPin.current?.({ lat: at.lat, lng: at.lng });
      });
      state.current.pin = marker;
      // A typed street can be off the edge of what is in view: the map goes to it. A click never is.
      if (!map.getBounds().pad(-0.1).contains([pin.lat, pin.lng])) map.panTo([pin.lat, pin.lng]);
    };
    show();
    el?.addEventListener('searchmap:ready', show);
    return () => el?.removeEventListener('searchmap:ready', show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick, pin?.lat, pin?.lng, theme]);

  // The colour behind the tiles is set inline: Leaflet's own stylesheet paints its container light grey.
  return <div ref={holder} className="h-full w-full" style={{ background: theme === 'dark' ? '#0b1220' : '#e2e8f0' }} role="img" aria-label={label} />;
}
