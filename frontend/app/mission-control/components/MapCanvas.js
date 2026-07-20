'use client';

/**
 * MapCanvas - the map IS the mission
 *
 * Fills its container edge-to-edge (the shell puts that container
 * directly under the header, so there is no dead band), defaults to
 * dark cartography so mission layers are the brightest thing on
 * screen, and owns the only two pieces of map furniture: the control
 * stack (inside SARMapView) and the MapKey.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import MapKey from './MapKey';

// The flashlight beam: warm amber-to-ember, brightest where the pet
// most likely is. Opacities come from searchProbability per zone.
const FLASHLIGHT_ZONE_COLORS = {
  HIGH: '#facc15',
  MEDIUM: '#f59e0b',
  LOW: '#ea580c',
  EXTENDED: '#b91c1c',
};

const SARMapView = dynamic(() => import('@/app/components/mission/SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-950">
      <Loader2 size={32} className="animate-spin text-slate-500" />
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
  defaultShowPOIs = false,
  probabilityZones,
  zoneMultiplier,
  onZoneMultiplierChange,
  hoursElapsed,
  focusPoint,
  isSearching,
  keyOffset = { bottom: 24, left: 16 },
  controlsOffset = null,
  archived = false,
}) {
  // A finished mission's map rests: the flashlight beam starts off
  // (still available from the Map key for anyone curious)
  const [showZones, setShowZones] = useState(!archived);
  const [showPOIs, setShowPOIs] = useState(defaultShowPOIs && !archived);

  return (
    <div className="absolute inset-0">
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
        showLegend={false}
        interactive
        defaultLayer="street"
        zoneColors={FLASHLIGHT_ZONE_COLORS}
        showProbabilityZones={showZones}
        probabilityZones={probabilityZones}
        focusPoint={focusPoint}
        controlsOffset={controlsOffset}
      />

      {/* The one piece of floating furniture; hidden while a leg records */}
      {!isSearching && lastSeenLocation && (
        <MapKey
          style={{ bottom: keyOffset.bottom, left: keyOffset.left }}
          showZones={showZones}
          onToggleZones={() => setShowZones((v) => !v)}
          zoneMultiplier={zoneMultiplier}
          onZoneMultiplierChange={onZoneMultiplierChange}
          showPOIs={showPOIs}
          onTogglePOIs={() => setShowPOIs((v) => !v)}
          hasSightings={(sightings?.length || 0) > 0}
          hasTrails={(coverageData?.trails?.length || 0) > 0 || (searchPath?.length || 0) > 0}
          hasPOIs={(pois?.length || 0) > 0}
        />
      )}
    </div>
  );
}
