'use client';

/**
 * The force's area on a map, with the pets missing in it and its divisions.
 * Holds the selected division; the Leaflet map itself loads client-only.
 * A division's own page is for members, so only members get the link to it.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

const TerritoryMapInner = dynamic(() => import('./TerritoryMapInner'), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse bg-midnight-100" />,
});

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function TerritoryMapCard({ forceId, center, radiusMiles, zones, pets, isMember }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-midnight-200">
      {/* isolate keeps Leaflet's own z-indexes inside the card */}
      <div className="relative isolate">
        <TerritoryMapInner
          center={center}
          radiusMiles={radiusMiles}
          zones={zones}
          pets={pets}
          selectedId={selected?.id || null}
          onSelectZone={setSelected}
        />
      </div>
      {selected ? (
        <div className="flex items-center justify-between gap-3 border-t border-midnight-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-midnight-900">{selected.name}</p>
            <p className="text-sm text-midnight-500">
              {plural(selected.memberCount, 'member', 'members')}
              {selected.missionCount > 0 && ` · ${plural(selected.missionCount, 'pet missing', 'pets missing')}`}
            </p>
          </div>
          {isMember ? (
            <Link
              href={`/rescue-forces/${forceId}/divisions/${selected.id}`}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-midnight-700 hover:text-midnight-900"
            >
              Open division
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="shrink-0 text-sm font-medium text-midnight-500 hover:text-midnight-900"
            >
              Close
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-midnight-100 px-4 py-2.5 text-sm text-midnight-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
            Pet missing now
          </span>
          <span>Dashed line: the force&apos;s area</span>
          {zones.length > 0 && <span>Tap a division for details</span>}
        </div>
      )}
    </div>
  );
}
