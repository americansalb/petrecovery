'use client';

/**
 * MapCanvas - the map IS the mission
 *
 * Always mounted, full-bleed under the header, never hidden behind a
 * tab. Owns the probability-zone controls so they sit clear of
 * whatever instrument panel is on screen (bottomInset).
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import ProbabilityZoneToggle from './simple/ProbabilityZoneToggle';
import ProbabilityZoneSlider from '@/app/components/mission/ProbabilityZoneSlider';

const SARMapView = dynamic(() => import('@/app/components/mission/SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <Loader2 size={32} className="animate-spin text-slate-400" />
    </div>
  ),
});

export default function MapCanvas({
  mission,
  lastSeenLocation,
  sightings,
  searchPath,
  coverageData,
  pois,
  showPOIs,
  probabilityZones,
  originalZoneSettings,
  zoneMultiplier,
  onZoneMultiplierChange,
  hoursElapsed,
  focusPoint,
  isSearching,
  bottomInset = 170,
  leftOffset = 12,
  controlsOffset = null,
  legendOffset = null,
}) {
  const [showZones, setShowZones] = useState(true);

  return (
    <div className="absolute inset-x-0 top-14 bottom-0">
      <SARMapView
        center={lastSeenLocation ? [lastSeenLocation.lat, lastSeenLocation.lng] : [41.8781, -87.6298]}
        lastSeen={lastSeenLocation}
        sightings={sightings}
        petSpecies={mission?.petSpecies}
        hoursElapsed={hoursElapsed}
        searchPath={searchPath}
        coverageTrails={coverageData?.trails || []}
        activeSearchersCount={coverageData?.activeSearchersCount || 0}
        pois={pois}
        showPOIs={showPOIs}
        showLegend={!isSearching}
        interactive
        showProbabilityZones={showZones}
        probabilityZones={probabilityZones}
        focusPoint={focusPoint}
        controlsOffset={controlsOffset}
        legendOffset={legendOffset}
      />

      {/* Zone controls, kept clear of the sheet or panels */}
      {!isSearching && lastSeenLocation && (
        <div
          className="absolute z-[500] flex flex-col gap-2 max-w-[240px]"
          style={{ bottom: bottomInset, left: leftOffset }}
        >
          <ProbabilityZoneToggle show={showZones} onToggle={() => setShowZones(!showZones)} />
          {showZones && (
            <ProbabilityZoneSlider
              originalSettings={originalZoneSettings}
              currentMultiplier={zoneMultiplier}
              onMultiplierChange={onZoneMultiplierChange}
              onReset={() => onZoneMultiplierChange(1)}
              petSpecies={mission?.petSpecies}
            />
          )}
        </div>
      )}
    </div>
  );
}
