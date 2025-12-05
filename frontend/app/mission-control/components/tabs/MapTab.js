'use client';

/**
 * MapTab - Full Map View
 *
 * Features preserved from original:
 * - Full-screen map with last seen location
 * - Sighting markers
 * - GPS path display
 * - Report sighting button
 * - Sightings count indicator
 */

import dynamic from 'next/dynamic';
import { Eye, Navigation } from 'lucide-react';

// Lazy load map for performance
const MapView = dynamic(() => import('@/app/components/case/SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="animate-pulse text-slate-500">Loading map...</div>
    </div>
  )
});

export default function MapTab({
  mission,
  sightings = [],
  gpsPath = [],
  onReportSighting,
  onStartGPSTracking,
  onStopGPSTracking,
  isGPSTracking,
}) {
  if (!mission) return null;

  return (
    <div className="space-y-4 pb-20">
      {/* Full Map View */}
      <div className="bg-slate-900 border border-flash-500/30 rounded-xl overflow-hidden" style={{ height: '55vh', minHeight: '350px' }}>
        <MapView
          center={mission.lastSeenLatitude && mission.lastSeenLongitude
            ? [mission.lastSeenLatitude, mission.lastSeenLongitude]
            : [41.8781, -87.6298]}
          zoom={15}
          lastSeen={mission.lastSeenLatitude ? {
            lat: mission.lastSeenLatitude,
            lng: mission.lastSeenLongitude,
            address: mission.lastSeenAddress,
          } : null}
          sightings={sightings}
          petSpecies={mission.petSpecies}
          gpsPath={gpsPath}
          showControls
        />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onReportSighting}
          className="py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 hover:scale-105 transition flex items-center justify-center gap-2"
        >
          <Eye size={20} />
          Report Sighting
        </button>

        {!isGPSTracking ? (
          <button
            onClick={onStartGPSTracking}
            className="py-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:scale-105 transition flex items-center justify-center gap-2"
          >
            <Navigation size={20} />
            Track My Path
          </button>
        ) : (
          <button
            onClick={onStopGPSTracking}
            className="py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:scale-105 transition flex items-center justify-center gap-2 animate-pulse"
          >
            <Navigation size={20} />
            Stop ({gpsPath.length} pts)
          </button>
        )}
      </div>

      {/* Sightings Summary */}
      {sightings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400">
              <Eye size={18} />
              <span className="font-bold">{sightings.length} Sighting{sightings.length !== 1 ? 's' : ''} Reported</span>
            </div>
            <span className="text-amber-300/70 text-sm">Shown on map</span>
          </div>

          {/* Recent sightings list */}
          <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
            {sightings.slice(0, 3).map((sighting, idx) => (
              <div key={sighting.id || idx} className="flex items-center justify-between text-sm p-2 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300 truncate flex-1">
                  {sighting.description || sighting.address || 'Sighting reported'}
                </span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                  sighting.confidence === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400' :
                  sighting.confidence === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {sighting.confidence || 'Reported'}
                </span>
              </div>
            ))}
            {sightings.length > 3 && (
              <p className="text-slate-500 text-xs text-center">+ {sightings.length - 3} more</p>
            )}
          </div>
        </div>
      )}

      {/* GPS Path Info */}
      {gpsPath.length > 0 && !isGPSTracking && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-purple-400">
            <Navigation size={18} />
            <span className="font-bold">Search Path Recorded</span>
          </div>
          <p className="text-purple-300/70 text-sm mt-1">
            {gpsPath.length} GPS points tracked. Your search path is shown as a purple line on the map.
          </p>
        </div>
      )}
    </div>
  );
}
