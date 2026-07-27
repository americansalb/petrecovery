'use client';

/**
 * The Lantern Map card (docs/RESCUE_FORCES_REDESIGN.md §5.2.1): a dark
 * window into the operational layer, set inside the light civic page.
 * Holds the selected-zone state; the Leaflet map itself loads client-only.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';

const TerritoryMapInner = dynamic(() => import('./TerritoryMapInner'), {
  ssr: false,
  loading: () => <div className="h-64 bg-[#0b1526] animate-pulse" />,
});

export default function TerritoryMapCard({ forceId, center, radiusMiles, zones, flares }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="rounded-2xl overflow-hidden border border-midnight-800 bg-[#0b1526] shadow-card">
      <TerritoryMapInner
        center={center}
        radiusMiles={radiusMiles}
        zones={zones}
        flares={flares}
        selectedId={selected?.id || null}
        onSelectZone={setSelected}
      />
      {selected ? (
        <div className="px-4 py-3 border-t border-white/10 animate-fade-in">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-midnight-400">
            Division · {selected.name}
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-sm text-midnight-200 inline-flex items-center gap-1.5 min-w-0">
              <Users className="w-3.5 h-3.5 shrink-0 text-midnight-400" />
              <span className="truncate">
                {selected.memberCount} {selected.memberCount === 1 ? 'member' : 'members'}
                {selected.onDuty > 0 && ` · ${selected.onDuty} on duty`}
                {selected.missionCount > 0 && ` · ${selected.missionCount} live`}
              </span>
            </p>
            <Link
              href={`/rescue-forces/${forceId}/divisions/${selected.id}`}
              className="inline-flex items-center gap-1 text-[13px] font-bold text-flash-300 hover:text-flash-200 transition shrink-0"
            >
              Open <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <p className="px-4 py-2.5 text-[11px] text-midnight-400 border-t border-white/10">
          lit&nbsp;=&nbsp;volunteers on duty · <span className="text-flash-400">✦</span>&nbsp;=&nbsp;mission live
          {zones.length > 0 && ' · tap a zone'}
        </p>
      )}
    </div>
  );
}
