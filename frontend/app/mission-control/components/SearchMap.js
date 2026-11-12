'use client';

/**
 * The map of a search: a quiet street map with a few lit things on it.
 *
 *   red      where the pet was lost
 *   orange   where it has been seen, the newest loudest
 *   yellow   the street this person is walking
 *   grey     streets already searched
 *   dotted   streets someone is on now
 *   white    this person's own path, where the app is recording one
 *
 * Every mark has words beside it, so nobody decodes a colour. It draws
 * streets, not people: no dot of any helper is ever on it. The only
 * person shown is the one holding the phone, to themselves.
 *
 * Labels are built from DOM nodes with textContent: street names come
 * from OpenStreetMap and place names from the public, and neither is
 * ever set as HTML.
 */
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { TILE_URL, tileLayerOptions } from '@/app/lib/maps/tiles';
import { PET_COLOR } from '@/app/lib/petColors';

const FLASH = '#facc15';
const TEAL = '#2dd4bf';

function node(tag, css, text) {
  const el = document.createElement(tag);
  if (css) el.style.cssText = css;
  if (text != null) el.textContent = text;
  return el;
}

const TAG_TONES = {
  plain: { dark: 'background:#0f172a;color:#f8fafc;border:1px solid rgba(148,163,184,0.45)', light: 'background:#ffffff;color:#0f172a;border:1px solid #cbd5e1' },
  seen: { dark: 'background:#0f172a;color:#fdba74;border:1px solid rgba(234,88,12,0.7)', light: 'background:#ffffff;color:#c2410c;border:1px solid rgba(234,88,12,0.6)' },
  flash: { dark: `background:${FLASH};color:#0f172a;border:1px solid ${FLASH}`, light: `background:${FLASH};color:#0f172a;border:1px solid #0f172a` },
};

/** A marker that is a dot (or nothing) with a word tag beside it. */
function tagged(L, { dot = null, text, tone = 'plain', theme = 'dark', side = 'right' }) {
  const root = node('div', 'position:relative;width:0;height:0');
  if (dot) root.appendChild(dot);
  if (text) {
    // Beside the point, or centred above or below it where a line runs through the point sideways.
    const place =
      side === 'left'
        ? 'top:-13px;right:16px;'
        : side === 'above'
          ? 'bottom:14px;left:0;transform:translateX(-50%);'
          : side === 'below'
            ? 'top:14px;left:0;transform:translateX(-50%);'
            : 'top:-13px;left:16px;';
    root.appendChild(
      node(
        'span',
        `position:absolute;${place}white-space:nowrap;padding:3px 8px;border-radius:8px;font:700 13px/19px Inter,system-ui,sans-serif;box-shadow:0 1px 4px rgba(2,6,23,0.35);${TAG_TONES[tone][theme]}`,
        text
      )
    );
  }
  return L.divIcon({ className: '', html: root, iconSize: [0, 0], iconAnchor: [0, 0] });
}

function disc(color, size, { ring = '#ffffff', pulse = false } = {}) {
  const wrap = node('span', `position:absolute;left:${-size / 2}px;top:${-size / 2}px;width:${size}px;height:${size}px`);
  if (pulse) {
    const halo = node('span', `position:absolute;inset:-10px;border-radius:9999px;background:${color};opacity:0.28`);
    halo.className = 'animate-pulse';
    wrap.appendChild(halo);
  }
  wrap.appendChild(node('span', `position:absolute;inset:0;border-radius:9999px;background:${color};border:3px solid ${ring};box-shadow:0 1px 6px rgba(2,6,23,0.45)`));
  return wrap;
}

export default function SearchMap({
  theme = 'dark',
  lastSeen = null, // { lat, lng, label }
  sightings = [], // [{ id, lat, lng, label, hot }]
  streets = [], // [{ id, path, status, mine, who }]
  cells = [], // [{ id, northLat, southLat, eastLng, westLng, status, mine }]
  me = null, // { lat, lng }
  track = [], // [{ lat, lng }, ...] this person's own recorded path (the app only)
  tags = [], // extra word tags: [{ lat, lng, text, tone, side }]
  fit = [], // [[lat, lng], ...] what must be in view
  fitKey = '',
  padding = { top: 16, right: 16, bottom: 16, left: 16 },
  zoomControl = false,
  label = 'Map of the search',
}) {
  const holder = useRef(null);
  const state = useRef({ map: null, L: null, layers: null });

  // The map itself, once.
  useEffect(() => {
    let cancelled = false;
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !holder.current || state.current.map) return;
      const start = lastSeen ? [lastSeen.lat, lastSeen.lng] : fit[0] || [39.5, -98.35];
      const map = L.map(holder.current, { zoomControl: false, attributionControl: true, zoomSnap: 0.25 }).setView(start, lastSeen ? 16 : 4);
      map.attributionControl.setPrefix(false);
      if (zoomControl) L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer(TILE_URL, tileLayerOptions(theme === 'dark' ? { dark: true } : { calm: true })).addTo(map);
      state.current = { map, L, layers: L.layerGroup().addTo(map) };
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
      state.current = { map: null, L: null, layers: null };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Everything drawn on it, redrawn when the search changes.
  useEffect(() => {
    const el = holder.current;
    const draw = () => {
      const { map, L, layers } = state.current;
      if (!map || !L) return;
      layers.clearLayers();
      const dark = theme === 'dark';
      const casing = dark ? '#020617' : '#ffffff';

      for (const cell of cells) {
        const bounds = [[cell.southLat, cell.westLng], [cell.northLat, cell.eastLng]];
        const lit = Boolean(cell.mine);
        const style = lit
          ? { color: FLASH, weight: 3, fillColor: FLASH, fillOpacity: 0.22 }
          : cell.status === 'SEARCHED'
            ? { color: '#94a3b8', weight: 1, fillColor: '#94a3b8', fillOpacity: dark ? 0.28 : 0.3 }
            : cell.status === 'IN_PROGRESS'
              ? { color: TEAL, weight: 2, dashArray: '2 8', fillColor: TEAL, fillOpacity: 0.08 }
              : { color: dark ? 'rgba(148,163,184,0.25)' : 'rgba(51,65,85,0.2)', weight: 1, fillOpacity: 0 };
        // The map is looked at, not tapped: a street or a square is given by the card's one button.
        L.rectangle(bounds, { ...style, interactive: false }).addTo(layers);
      }

      // Searched and in-progress streets first, the lit one on top.
      const ordered = [...streets].sort((a, b) => Number(Boolean(a.mine)) - Number(Boolean(b.mine)));
      for (const street of ordered) {
        if (!Array.isArray(street.path) || street.path.length < 2) continue;
        const lit = Boolean(street.mine);
        if (lit) {
          L.polyline(street.path, { color: casing, weight: 13, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layers);
          L.polyline(street.path, { color: FLASH, weight: 8, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layers);
        } else if (street.status === 'IN_PROGRESS') {
          L.polyline(street.path, { color: TEAL, weight: 5, opacity: 0.95, dashArray: '1 10', lineCap: 'round', interactive: false }).addTo(layers);
        } else if (street.status === 'SEARCHED') {
          L.polyline(street.path, { color: dark ? '#cbd5e1' : '#1e293b', weight: 6, opacity: dark ? 0.42 : 0.34, lineCap: 'round', interactive: false }).addTo(layers);
        }
        // A free street is the map's own street: nothing is drawn over it.
        if (street.who && street.status === 'IN_PROGRESS' && !lit) {
          // The name sits toward the end of the street that is farther from where the pet was lost, so it
          // stays clear of that mark's own words: streets near the middle of a search all pass close to it.
          const path = street.path;
          const from = lastSeen && Number.isFinite(lastSeen.lat) ? lastSeen : null;
          const away = (p) => (from ? (p[0] - from.lat) ** 2 + ((p[1] - from.lng) * Math.cos((from.lat * Math.PI) / 180)) ** 2 : 0);
          const share = from ? (away(path[0]) > away(path[path.length - 1]) ? 0.2 : 0.8) : 0.5;
          const at = path[Math.round((path.length - 1) * share)];
          L.marker(at, { icon: tagged(L, { text: street.who, theme, side: 'right' }), interactive: false, keyboard: false }).addTo(layers);
        }
      }

      for (const s of [...sightings].reverse()) {
        if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) continue;
        const dot = disc(PET_COLOR.seen, s.hot ? 22 : 14, { pulse: Boolean(s.hot), ring: dark ? '#0f172a' : '#ffffff' });
        L.marker([s.lat, s.lng], { icon: tagged(L, { dot, text: s.label, tone: 'seen', theme, side: s.side || 'right' }), interactive: false, keyboard: false, zIndexOffset: s.hot ? 900 : 300 }).addTo(layers);
      }

      if (lastSeen && Number.isFinite(lastSeen.lat) && Number.isFinite(lastSeen.lng)) {
        const dot = disc(PET_COLOR.lost, 18, { pulse: !sightings.some((s) => s.hot), ring: dark ? '#0f172a' : '#ffffff' });
        L.marker([lastSeen.lat, lastSeen.lng], { icon: tagged(L, { dot, text: lastSeen.label, theme, side: lastSeen.side || 'right' }), interactive: false, keyboard: false, zIndexOffset: 600 }).addTo(layers);
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
  }, [theme, lastSeen, sightings, streets, cells, me, tags, track]);

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
        maxZoom: 17,
        animate: true,
      });
      // The credit sits above whatever covers the bottom of the map.
      const credit = map.attributionControl?.getContainer();
      if (credit) credit.style.marginBottom = `${Math.max(0, padding.bottom - 12)}px`;
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

  // The colour behind the tiles is set inline: Leaflet's own stylesheet paints its container light grey.
  return <div ref={holder} className="h-full w-full" style={{ background: theme === 'dark' ? '#0b1220' : '#e2e8f0' }} role="img" aria-label={label} />;
}
