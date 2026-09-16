'use client';

/**
 * The world, drawn as the background of the front door.
 *
 * The old front door was a settings form on a white page: a site about
 * photographs of the earth, made entirely of text. This is the earth.
 *
 * It needs no key and no tile server, which is the point. Apple's token
 * is not set on every deployment, Google's costs money per view, and a
 * front page that is blank until a third party answers is a front page
 * that is sometimes blank. The outline here is the same Natural Earth
 * 1:110m polygon set the game already scores against, already in the
 * bundle for the keyless round map, projected by hand: equirectangular
 * is four lines of arithmetic and exact enough for something nobody
 * measures.
 *
 * It drifts. Slowly, and never far, because the job is to feel alive
 * rather than to be watched. Anyone who has asked their browser for
 * less motion gets none.
 */

import { useEffect, useRef, useState } from 'react';

/** Equirectangular, into a 360 x 180 box. The viewBox scales it. */
function toPath(geometry) {
  const rings = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let d = '';
  for (const polygon of rings) {
    for (const ring of polygon) {
      if (ring.length < 4) continue;
      d += ring
        .map(([lng, lat], i) => `${i ? 'L' : 'M'}${(lng + 180).toFixed(2)} ${(90 - lat).toFixed(2)}`)
        .join('');
      d += 'Z';
    }
  }
  return d;
}

export default function WorldBackdrop() {
  const [paths, setPaths] = useState([]);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    // Both are already dependencies, and both are only wanted once the
    // page is on screen, so they load after the first paint rather than
    // sitting in the entry bundle.
    Promise.all([import('world-atlas/countries-110m.json'), import('topojson-client')])
      .then(([world, topojson]) => {
        if (!alive.current) return;
        const atlas = world.default || world;
        const collection = topojson.feature(atlas, atlas.objects.countries);
        setPaths(collection.features.map((feature) => toPath(feature.geometry)).filter(Boolean));
      })
      .catch(() => {
        // A backdrop that failed to load is a plain ocean, which is
        // still a background. Nothing above it depends on this.
      });
    return () => {
      alive.current = false;
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-ocean-950" aria-hidden="true">
      {/* Deep water, lighter towards the equator, so the sea has a floor. */}
      <div className="absolute inset-0 bg-[radial-gradient(130%_95%_at_50%_42%,theme(colors.ocean.700),theme(colors.ocean.950)_72%)]" />
      <svg
        className="geo-drift absolute left-1/2 top-1/2 h-[135%] w-[135%] -translate-x-1/2 -translate-y-1/2"
        viewBox="0 8 360 150"
        preserveAspectRatio="xMidYMid slice"
      >
        <g>
          {paths.map((d, i) => (
            <path key={i} d={d} className="fill-forest-700 stroke-forest-400/70" strokeWidth="0.75" vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      </svg>
      {/* The text sits on this rather than straight on the map. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,theme(colors.ocean.950/0.25),theme(colors.ocean.950/0.45)_45%,theme(colors.ocean.950/0.8))]" />
    </div>
  );
}
