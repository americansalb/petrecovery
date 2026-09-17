'use client';

/**
 * The three shapes of the game that are not the default and not a
 * contest: a country streak, one continent, one country.
 *
 * They were options on the deleted setup page and went with it, so the
 * game has been advertising them in MODES and offering no way to start
 * one. Streak needs nothing but a link. Continent and country need a
 * region, which is the one place in the game where a choice really is
 * required: "one country" is not a mode until you say which.
 *
 * So it is a label, a control and a button, three rows, on the page
 * about the rest of the game rather than in front of the Play button.
 * It is deliberately not the wall of cards this replaced: nobody meets
 * it on the way in, and nobody has to read it to play.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Flag, Globe2, MapPin } from 'lucide-react';
import { CONTINENTS, CONTINENT_ORDER } from '@/app/lib/geo/modes';
import { APPLE_COVERAGE_NAMES } from '@/app/lib/geo/coverage';

const FIELD = 'rounded-xl border border-white/15 bg-ocean-950/60 px-3 py-2 text-sm text-white';
const GO = 'inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10';

/** The covered countries, by name, so the list reads as places. */
const COUNTRIES = Object.entries(APPLE_COVERAGE_NAMES)
  .map(([code, name]) => ({ code, name: name.replace(/^the /, '') }))
  .sort((a, b) => a.name.localeCompare(b.name));

function Row({ icon: Icon, title, children, control }) {
  return (
    <div className="flex flex-col gap-3 border-t border-white/10 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold">
          <Icon className="h-4 w-4 text-clay-300" />
          {title}
        </p>
        <p className="mt-1 text-sm text-white/60">{children}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{control}</div>
    </div>
  );
}

export default function OtherModes() {
  const [continent, setContinent] = useState('europe');
  const [country, setCountry] = useState('JP');

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">More ways to play</h2>
      <p className="mt-1 max-w-2xl text-sm text-white/60">
        The same street imagery, scored the same way. Nothing here is rated.
      </p>

      <div className="mt-2">
        <Row icon={Flag} title="Country streak" control={<Link href="/geo/play?mode=streak" className={GO} data-start-streak>Play a streak</Link>}>
          Name the country instead of placing a pin. The game ends at your first miss.
        </Row>

        <Row
          icon={Globe2}
          title="One continent"
          control={
            <>
              <select value={continent} onChange={(e) => setContinent(e.target.value)} aria-label="Continent" className={FIELD}>
                {CONTINENT_ORDER.map((id) => (
                  <option key={id} value={id}>
                    {CONTINENTS[id].label}
                  </option>
                ))}
              </select>
              <Link href={`/geo/play?mode=continent&region=${continent}`} className={GO} data-start-continent>
                Play
              </Link>
            </>
          }
        >
          Random covered countries inside one continent.
        </Row>

        <Row
          icon={MapPin}
          title="One country"
          control={
            <>
              <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" className={FIELD}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Link href={`/geo/play?mode=country&region=${country}`} className={GO} data-start-country>
                Play
              </Link>
            </>
          }
        >
          Random streets in the cities of one country.
        </Row>
      </div>
    </section>
  );
}
