'use client';

/**
 * The world, turning, behind the front door.
 *
 * The first version of this was a flat map: the same Natural Earth
 * outlines, projected equirectangular, drifting a little. The founder's
 * verdict was "a shitty uninteractive 2D cartoon made on MS Paint", and
 * he was right. A flat rectangle of the world is a diagram. It is also
 * the one thing a site about standing somewhere on Earth should not
 * open with, because it says nothing about being anywhere.
 *
 * So it is a globe. Orthographic, tilted, turning slowly, and you can
 * take hold of it and spin it. The dots are the 117 cities a round can
 * actually start in, so what is lit up is the game's real reach rather
 * than decoration.
 *
 * It still needs no key and no tile server, which was always the point:
 * Apple's token is not set on every deployment, and a front page that
 * is blank until a third party answers is a front page that is
 * sometimes blank. The outlines are the same 1:110m polygons the game
 * scores against, already in the bundle.
 *
 * Anyone who has asked their browser for less motion gets a still
 * globe they can still turn by hand.
 *
 * It draws by writing the path attribute from the animation frame
 * rather than through React state. At 30fps through state this would
 * re-render the whole front door sixty times a second to move some
 * coastline.
 */

import { useEffect, useRef } from 'react';
import { citiesFor } from '@/app/lib/geo/coverage';

const RAD = Math.PI / 180;
/** A square viewBox, so the globe is round at any window shape. */
const SIZE = 1000;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = SIZE * 0.46;
/** Degrees of north tilted toward the viewer. Straight on reads flat. */
const TILT = 16;
const SPIN_PER_FRAME = 0.22;
const FRAME_MS = 33;

/** Orthographic. Null when the point is round the back. */
function project(lng, lat, lam0, sinP0, cosP0) {
  const lam = lng * RAD - lam0;
  const phi = lat * RAD;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosLam = Math.cos(lam);
  if (sinP0 * sinPhi + cosP0 * cosPhi * cosLam < 0) return null;
  return [CX + R * cosPhi * Math.sin(lam), CY - R * (cosP0 * sinPhi - sinP0 * cosPhi * cosLam)];
}

/** The meridians and parallels, which is what makes it read as a sphere. */
function graticule(pr) {
  let d = '';
  const line = (points) => {
    let open = false;
    for (const [lng, lat] of points) {
      const p = pr(lng, lat);
      if (!p) {
        open = false;
        continue;
      }
      d += `${open ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      open = true;
    }
  };
  for (let lng = -180; lng < 180; lng += 30) {
    const points = [];
    for (let lat = -90; lat <= 90; lat += 4) points.push([lng, lat]);
    line(points);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const points = [];
    for (let lng = -180; lng <= 180; lng += 4) points.push([lng, lat]);
    line(points);
  }
  return d;
}

export default function WorldBackdrop() {
  const landRef = useRef(null);
  const gratRef = useRef(null);
  const dotsRef = useRef(null);
  const frameRef = useRef(0);
  const ringsRef = useRef([]);
  const viewRef = useRef({ lon: -28, drag: null, last: 0 });

  useEffect(() => {
    let alive = true;
    const cities = citiesFor().map((c) => [c.lng, c.lat]);
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const draw = () => {
      const view = viewRef.current;
      const lam0 = view.lon * RAD;
      const p0 = TILT * RAD;
      const sinP0 = Math.sin(p0);
      const cosP0 = Math.cos(p0);
      const pr = (lng, lat) => project(lng, lat, lam0, sinP0, cosP0);

      let land = '';
      for (const ring of ringsRef.current) {
        let open = false;
        for (let i = 0; i < ring.length; i += 2) {
          const p = pr(ring[i], ring[i + 1]);
          if (!p) {
            open = false;
            continue;
          }
          land += `${open ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
          open = true;
        }
        if (open) land += 'Z';
      }
      landRef.current?.setAttribute('d', land);
      gratRef.current?.setAttribute('d', graticule(pr));

      let dots = '';
      for (const [lng, lat] of cities) {
        const p = pr(lng, lat);
        if (!p) continue;
        const r = 3.2;
        dots += `M${(p[0] - r).toFixed(1)} ${p[1].toFixed(1)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
      }
      dotsRef.current?.setAttribute('d', dots);
    };

    const tick = (t) => {
      frameRef.current = requestAnimationFrame(tick);
      const view = viewRef.current;
      if (t - view.last < FRAME_MS) return;
      view.last = t;
      // Held still while somebody is turning it, and never on its own
      // for anyone who asked for less motion.
      if (!view.drag && !reduced) view.lon = (view.lon + SPIN_PER_FRAME) % 360;
      draw();
    };

    // Both are only wanted once the page is on screen, so they load
    // after the first paint rather than sitting in the entry bundle.
    Promise.all([import('world-atlas/countries-110m.json'), import('topojson-client')])
      .then(([world, topojson]) => {
        if (!alive) return;
        const atlas = world.default || world;
        const collection = topojson.feature(atlas, atlas.objects.countries);
        // Flattened to [lng, lat, lng, lat, ...] per ring, because this
        // is walked thirty times a second.
        const rings = [];
        for (const feature of collection.features) {
          const geometry = feature.geometry;
          if (!geometry) continue;
          const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
          for (const polygon of polygons) {
            for (const ring of polygon) {
              if (ring.length < 4) continue;
              const flat = new Float64Array(ring.length * 2);
              for (let i = 0; i < ring.length; i++) {
                flat[i * 2] = ring[i][0];
                flat[i * 2 + 1] = ring[i][1];
              }
              rings.push(flat);
            }
          }
        }
        ringsRef.current = rings;
        frameRef.current = requestAnimationFrame(tick);
      })
      .catch(() => {
        // A backdrop that failed to load is deep water, which is still
        // a background. Nothing above it depends on this.
      });

    return () => {
      alive = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const onPointerDown = (event) => {
    viewRef.current.drag = { x: event.clientX, lon: viewRef.current.lon };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    const view = viewRef.current;
    if (!view.drag) return;
    view.lon = view.drag.lon + (event.clientX - view.drag.x) * 0.32;
  };
  const endDrag = () => {
    viewRef.current.drag = null;
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-ocean-950">
      {/* Deep water behind everything, so a slow connection is still a
          sea rather than a white page. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_38%,theme(colors.ocean.800),theme(colors.ocean.950)_70%)]" />
      {/* The whole sphere, with room around it. Bled off the edges it is
          just a green wall; the rim and the halo are what say planet. */}
      <svg
        className="absolute left-1/2 top-1/2 aspect-square h-[122vmin] w-[122vmin] -translate-x-1/2 -translate-y-1/2 cursor-grab touch-pan-y active:cursor-grabbing sm:h-[82vmin] sm:w-[82vmin]"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-hidden="true"
      >
        <defs>
          {/* The lit side. A flat disc is a coin, not a planet. */}
          <radialGradient id="geo-globe-sea" cx="38%" cy="30%" r="78%">
            <stop offset="0%" stopColor="#1d5f7d" />
            <stop offset="62%" stopColor="#123f57" />
            <stop offset="100%" stopColor="#0a2231" />
          </radialGradient>
          <radialGradient id="geo-globe-halo" cx="50%" cy="50%" r="50%">
            <stop offset="72%" stopColor="rgba(143,195,218,0)" />
            <stop offset="93%" stopColor="rgba(143,195,218,0.22)" />
            <stop offset="100%" stopColor="rgba(143,195,218,0)" />
          </radialGradient>
          <clipPath id="geo-globe-clip">
            <circle cx={CX} cy={CY} r={R} />
          </clipPath>
        </defs>

        <circle cx={CX} cy={CY} r={R * 1.09} fill="url(#geo-globe-halo)" />
        <circle cx={CX} cy={CY} r={R} fill="url(#geo-globe-sea)" />
        <g clipPath="url(#geo-globe-clip)">
          <path ref={gratRef} d="" fill="none" stroke="rgba(143,195,218,0.16)" strokeWidth="1" />
          <path ref={landRef} d="" className="fill-forest-700/90 stroke-forest-400/60" strokeWidth="1" />
          <path ref={dotsRef} d="" className="fill-clay-400" opacity="0.9" />
        </g>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(143,195,218,0.35)" strokeWidth="1.5" />
      </svg>
      {/* The headline sits on this rather than straight on the world. */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,theme(colors.ocean.950/0.35),theme(colors.ocean.950/0.15)_38%,theme(colors.ocean.950/0.72))]" />
    </div>
  );
}
