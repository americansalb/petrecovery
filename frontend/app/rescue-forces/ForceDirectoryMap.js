'use client';

/**
 * The directory map (client-only Leaflet). Each Rescue Force's area is a
 * yellow shape: its town's outline when it has one, otherwise its circle.
 * A white chip with the town's name sits on each area and opens the force;
 * a red mark on the chip means pets are missing there now.
 *
 * After a search, the forces outside the list fade, the one covering the
 * place searched from is lit, and the place gets its own marker ("You are
 * here" after Near me). Names must not pile on top of each other: zoomed
 * out to whole states every chip is a dot, and closer in, a chip that
 * would overlap a busier force's chip is a dot until you zoom in.
 *
 * Force and town names are typed by people, so chips and labels are DOM
 * text, never HTML strings.
 */

import { TILE_URL, tileLayerOptions } from '@/app/lib/maps/tiles';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MILES_TO_METERS = 1609.34;
const US_CENTER = [39.5, -98.35];
const FAR_BELOW_ZOOM = 8;

function areaStyle(shown, lit) {
  return {
    color: lit ? '#854d0e' : '#a16207',
    weight: lit ? 3.5 : 2.5,
    opacity: shown ? 1 : 0.3,
    fillColor: '#facc15',
    fillOpacity: shown ? (lit ? 0.38 : 0.16) : 0.05,
    lineJoin: 'round',
    interactive: false,
  };
}

function node(tag, className, value) {
  const el = document.createElement(tag);
  el.className = className;
  if (value != null) el.textContent = value;
  return el;
}

/** The chip: a real link (new tab, keyboard), opened in-app through the marker's click. */
function chipLink(f) {
  const link = node('a', f.missing > 0 ? 'force-chip has-missing' : 'force-chip');
  link.href = `/rescue-forces/${encodeURIComponent(f.id)}`;
  const missing = f.missing > 0 ? `, ${f.missing} ${f.missing === 1 ? 'pet' : 'pets'} missing now` : '';
  link.setAttribute('aria-label', `Open ${f.name}${missing}`);
  link.title = f.name; // names the chip while it is a dot
  if (f.missing > 0) link.appendChild(node('span', 'force-chip-dot'));
  link.appendChild(node('span', 'force-chip-name', f.city || f.name));
  if (f.missing > 0) link.appendChild(node('span', 'force-chip-count', `${f.missing} missing`));
  // A plain click is handled by the marker (which ignores the click that
  // ends a drag); modified clicks keep the browser's new-tab behavior.
  link.addEventListener('click', (e) => {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) e.preventDefault();
  });
  return link;
}

function originIcon(origin) {
  const wrap = node('div', origin.kind === 'me' ? 'force-origin is-me' : 'force-origin');
  wrap.appendChild(node('span', 'force-origin-dot'));
  wrap.appendChild(node('span', 'force-origin-tag', origin.kind === 'me' ? 'You are here' : origin.label));
  return L.divIcon({ className: '', html: wrap, iconSize: null });
}

export default function ForceDirectoryMap({ forces, shownIds, litId, origin, onOpen }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const areasRef = useRef({}); // force id -> Leaflet layer
  const boundsRef = useRef({}); // force id -> LatLngBounds of its area
  const allBoundsRef = useRef(null);
  const chipsRef = useRef(null);
  const chipLinksRef = useRef({}); // force id -> chip element
  const originRef = useRef(null);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const shownRef = useRef(null);
  const litRef = useRef(null);
  const forceByIdRef = useRef({});

  function restyle() {
    const shown = shownRef.current;
    Object.entries(areasRef.current).forEach(([id, layer]) => {
      layer.setStyle(areaStyle(!shown || shown.has(id), id === litRef.current));
    });
    const lit = areasRef.current[litRef.current];
    if (lit) lit.bringToFront();
    Object.entries(chipLinksRef.current).forEach(([id, el]) => el.classList.toggle('is-lit', id === litRef.current));
  }

  // Busiest first (the lit force before all): a chip that would overlap
  // one already placed becomes a dot. Sizes are read with every chip at
  // full size, so the pass gives the same answer however often it runs.
  function declutter() {
    const map = mapRef.current;
    const chips = Object.entries(chipLinksRef.current);
    if (!map || chips.length === 0) return;
    chips.forEach(([, el]) => el.classList.remove('is-dot'));
    if (map.getZoom() < FAR_BELOW_ZOOM) return;
    const lit = litRef.current;
    const order = chips
      .map(([id, el]) => ({ id, el, f: forceByIdRef.current[id], w: el.offsetWidth, h: el.offsetHeight }))
      .sort(
        (a, b) =>
          Number(b.id === lit) - Number(a.id === lit) || b.f.missing - a.f.missing || b.f.members - a.f.members
      );
    // The place searched from goes down first: its marker and label.
    const placed = [];
    const here = originRef.current;
    if (here) {
      const p = map.latLngToContainerPoint(here.getLatLng());
      placed.push({ l: p.x - 12, r: p.x + 12, t: p.y - 12, b: p.y + 12 });
      const tag = here.getElement()?.querySelector('.force-origin-tag');
      if (tag) {
        const w = tag.offsetWidth;
        placed.push({ l: p.x - w / 2 - 3, r: p.x + w / 2 + 3, t: p.y + 14, b: p.y + 16 + tag.offsetHeight + 2 });
      }
    }
    for (const c of order) {
      const p = map.latLngToContainerPoint([c.f.lat, c.f.lng]);
      const box = { l: p.x - c.w / 2 - 3, r: p.x + c.w / 2 + 3, t: p.y - c.h / 2 - 2, b: p.y + c.h / 2 + 2 };
      if (placed.some((q) => box.l < q.r && box.r > q.l && box.t < q.b && box.b > q.t)) c.el.classList.add('is-dot');
      else placed.push(box);
    }
  }

  function frameAll() {
    const map = mapRef.current;
    const all = allBoundsRef.current;
    if (map && all && all.isValid()) map.fitBounds(all.pad(0.05), { maxZoom: 11 });
  }

  // The map and every force's area, once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
    }).setView(US_CENTER, 4);
    L.tileLayer(TILE_URL, tileLayerOptions({ calm: true })).addTo(map);
    // The tile layer brings its own attribution (app/lib/maps/tiles.js).
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;

    const all = L.latLngBounds([]);
    forces.forEach((f) => {
      forceByIdRef.current[f.id] = f;
      let layer = null;
      let bounds = null;
      if (Array.isArray(f.area) && f.area.length > 0) {
        layer = L.polygon(
          f.area.map((ring) => [ring]),
          areaStyle(true, false)
        );
        bounds = layer.getBounds();
      } else if (f.lat != null && f.lng != null) {
        const meters = (f.radiusMiles || 5) * MILES_TO_METERS;
        layer = L.circle([f.lat, f.lng], { radius: meters, ...areaStyle(true, false) });
        bounds = L.latLng(f.lat, f.lng).toBounds(meters * 2);
      }
      if (!layer) return;
      layer.addTo(map);
      areasRef.current[f.id] = layer;
      boundsRef.current[f.id] = bounds;
      all.extend(bounds);
    });
    allBoundsRef.current = all;
    frameAll();

    const onZoom = () => {
      containerRef.current?.classList.toggle('is-far', map.getZoom() < FAR_BELOW_ZOOM);
      declutter();
    };
    map.on('zoomend', onZoom);
    onZoom();

    return () => {
      map.remove();
      mapRef.current = null;
      areasRef.current = {};
      boundsRef.current = {};
      forceByIdRef.current = {};
      chipsRef.current = null;
      chipLinksRef.current = {};
      originRef.current = null;
    };
    // Built once from the first props; the effects below follow changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chips for the listed forces; the others' areas fade.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (chipsRef.current) chipsRef.current.remove();
    chipLinksRef.current = {};
    const shown = shownIds ? new Set(shownIds) : null;
    shownRef.current = shown;

    const group = L.layerGroup();
    forces.forEach((f) => {
      if (f.lat == null || f.lng == null || (shown && !shown.has(f.id))) return;
      const link = chipLink(f);
      chipLinksRef.current[f.id] = link;
      const marker = L.marker([f.lat, f.lng], {
        icon: L.divIcon({ className: 'force-chip-icon', html: link, iconSize: null }),
        keyboard: false, // the link inside takes focus
        riseOnHover: true,
      });
      marker.on('click', () => openRef.current(f.id));
      group.addLayer(marker);
    });
    group.addTo(map);
    chipsRef.current = group;
    restyle();
    declutter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownIds]);

  useEffect(() => {
    litRef.current = litId || null;
    restyle();
    declutter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [litId]);

  // The place searched from, framed with the nearest forces around it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (originRef.current) {
      originRef.current.remove();
      originRef.current = null;
    }
    if (!origin) {
      frameAll();
      declutter();
      return;
    }
    const frame = L.latLngBounds([]);
    if (origin.lat != null && origin.lng != null) {
      originRef.current = L.marker([origin.lat, origin.lng], {
        icon: originIcon(origin),
        interactive: false,
        keyboard: false,
        zIndexOffset: 2000,
      }).addTo(map);
      frame.extend([origin.lat, origin.lng]);
    }
    (shownIds || []).slice(0, 3).forEach((id) => {
      if (boundsRef.current[id]) frame.extend(boundsRef.current[id]);
    });
    if (frame.isValid()) {
      if (frame.getNorthEast().equals(frame.getSouthWest())) map.setView(frame.getCenter(), 11);
      else map.fitBounds(frame.pad(0.1), { maxZoom: 12 });
    }
    // Again after any zoom (zoomend), but a pan alone does not fire it.
    declutter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, shownIds]);

  return <div ref={containerRef} className="force-map h-full w-full" aria-label="Map of Rescue Force areas" />;
}
