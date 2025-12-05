'use client';

/**
 * TeamTab - Search & Rescue Coordination
 *
 * CORE PURPOSE: Help volunteers coordinate ground searches
 * - See where has been searched
 * - Track your own search
 * - See who's actively searching
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Navigation, Users, Check, MapPin } from 'lucide-react';

// Lazy load map
const MapView = dynamic(() => import('@/app/components/case/SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
      <div className="animate-pulse text-slate-500">Loading map...</div>
    </div>
  )
});

export default function TeamTab({
  team = [],
  mission,
  gpsPath = [],
  setGpsPath,
  isGPSTracking,
  setIsGPSTracking,
  showNotification,
}) {
  const [searchStats, setSearchStats] = useState({ distance: 0, duration: 0 });

  // Calculate distance/duration
  useEffect(() => {
    if (gpsPath.length < 2) return;

    let totalDistance = 0;
    for (let i = 1; i < gpsPath.length; i++) {
      const R = 3959; // miles
      const dLat = (gpsPath[i].lat - gpsPath[i-1].lat) * Math.PI / 180;
      const dLon = (gpsPath[i].lng - gpsPath[i-1].lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) ** 2 + Math.cos(gpsPath[i-1].lat * Math.PI / 180) * Math.cos(gpsPath[i].lat * Math.PI / 180) * Math.sin(dLon/2) ** 2;
      totalDistance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    const duration = Math.round((gpsPath[gpsPath.length-1].timestamp - gpsPath[0].timestamp) / 60000);
    setSearchStats({ distance: totalDistance.toFixed(2), duration });
  }, [gpsPath]);

  const startSearch = () => {
    if (!('geolocation' in navigator)) {
      showNotification?.('error', 'GPS not available');
      return;
    }
    setIsGPSTracking(true);
    setGpsPath([]);
    showNotification?.('info', 'Tracking your search path');

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsPath(prev => [...prev, { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() }]),
      () => { setIsGPSTracking(false); showNotification?.('error', 'GPS access denied'); },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    window._gpsWatchId = watchId;
  };

  const stopSearch = () => {
    if (window._gpsWatchId) {
      navigator.geolocation.clearWatch(window._gpsWatchId);
      window._gpsWatchId = null;
    }
    setIsGPSTracking(false);
    if (gpsPath.length > 0) {
      showNotification?.('success', `Search saved - ${searchStats.distance} mi covered`);
    }
  };

  const mapCenter = mission?.lastSeenLatitude
    ? [mission.lastSeenLatitude, mission.lastSeenLongitude]
    : [41.8781, -87.6298];

  const activeSearchers = team.filter(m => m.isActive);

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px]">

      {/* MAP - Takes most of the space */}
      <div className="flex-1 rounded-xl overflow-hidden border border-slate-700 relative">
        <MapView
          center={mapCenter}
          lastSeen={mission?.lastSeenLatitude ? {
            lat: mission.lastSeenLatitude,
            lng: mission.lastSeenLongitude,
            address: mission.lastSeenAddress,
          } : null}
          gpsPath={gpsPath}
          petSpecies={mission?.petSpecies}
          showControls={true}
          showLegend={true}
          interactive={true}
        />

        {/* Active searchers overlay */}
        {activeSearchers.length > 0 && (
          <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur rounded-lg px-3 py-2 flex items-center gap-2 z-[400]">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-emerald-400 text-sm font-medium">
              {activeSearchers.length} searching now
            </span>
          </div>
        )}

        {/* Live stats while searching */}
        {isGPSTracking && (
          <div className="absolute bottom-4 left-4 right-4 bg-purple-600 rounded-xl p-3 z-[400] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white font-medium">Tracking</span>
            </div>
            <span className="text-white/80 text-sm">{searchStats.distance} mi • {searchStats.duration} min</span>
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS - Compact */}
      <div className="mt-3 space-y-3">

        {/* Search Button */}
        {!isGPSTracking ? (
          <button
            onClick={startSearch}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg rounded-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition shadow-lg shadow-purple-500/30"
          >
            <Navigation size={24} />
            Start Searching
          </button>
        ) : (
          <button
            onClick={stopSearch}
            className="w-full py-4 bg-emerald-500 text-white font-bold text-lg rounded-xl flex items-center justify-center gap-3 hover:bg-emerald-400 transition"
          >
            <Check size={24} />
            Done - Save Search
          </button>
        )}

        {/* Team row - compact */}
        {team.length > 0 && (
          <div className="flex items-center justify-between bg-slate-800/50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-slate-400" />
              <span className="text-slate-300 text-sm">{team.length} helpers</span>
            </div>
            <div className="flex -space-x-2">
              {team.slice(0, 5).map(m => (
                <div
                  key={m.id}
                  className={`w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center text-xs font-bold ${
                    m.isActive ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'
                  }`}
                  title={m.name}
                >
                  {m.firstName?.[0]}{m.lastName?.[0] || ''}
                </div>
              ))}
              {team.length > 5 && (
                <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-slate-400 text-xs">
                  +{team.length - 5}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
