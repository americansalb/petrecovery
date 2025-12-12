'use client';

/**
 * MapTabV2 - V4 Full-Screen Map View
 *
 * Features:
 * - Full-screen map with all layers
 * - Floating action buttons (GPS, Sighting, Flyer)
 * - Active search display with timer and distance
 * - Marker info panel
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Navigation,
  Eye,
  MapPin,
  Play,
  Square,
  Loader2,
  Clock,
  Route,
  X,
  Layers,
  Building2,
  FileText,
  ChevronUp,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';

// Dynamically import map to avoid SSR issues
const MapView = dynamic(() => import('@/app/components/mission/SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
      <Loader2 className="text-flash-400 animate-spin" size={32} />
    </div>
  ),
});

// ============================================================================
// GPS SEARCH PANEL
// ============================================================================
function GPSSearchPanel({ isActive, duration, distance, onStart, onStop, starting, stopping }) {
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isActive) {
    return (
      <div className="absolute top-4 left-4 right-4 bg-blue-500/95 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-blue-400/50 z-20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <span className="text-white font-semibold">GPS Search Active</span>
          </div>
          <button
            onClick={onStop}
            disabled={stopping}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white font-bold text-sm rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            {stopping ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
            Stop
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <Clock size={18} className="text-white/80 mx-auto mb-1" />
            <div className="text-2xl font-bold text-white font-mono">{formatDuration(duration)}</div>
            <div className="text-xs text-white/70">Duration</div>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <Route size={18} className="text-white/80 mx-auto mb-1" />
            <div className="text-2xl font-bold text-white">{distance.toFixed(2)}</div>
            <div className="text-xs text-white/70">Miles</div>
          </div>
        </div>

        <div className="mt-3 text-center text-white/70 text-xs">
          ~{Math.round(distance * 100)} points when you stop
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onStart}
      disabled={starting}
      className="absolute top-4 left-4 bg-blue-500 hover:bg-blue-400 text-white font-bold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-20 disabled:opacity-50"
    >
      {starting ? (
        <Loader2 size={20} className="animate-spin" />
      ) : (
        <Navigation size={20} />
      )}
      <span>Start GPS Search</span>
    </button>
  );
}

// ============================================================================
// FLOATING ACTION BUTTONS
// ============================================================================
function FloatingActions({ onReportSighting, onMarkFlyer, isGPSActive }) {
  const [expanded, setExpanded] = useState(false);

  if (isGPSActive) {
    // Only show minimal FABs when GPS is active
    return (
      <div className="absolute bottom-6 right-4 z-20">
        <button
          onClick={onReportSighting}
          className="w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-400 text-white shadow-lg flex items-center justify-center"
        >
          <Eye size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 right-4 z-20 flex flex-col items-end gap-3">
      {expanded && (
        <>
          <button
            onClick={onMarkFlyer}
            className="flex items-center gap-2 px-4 py-3 rounded-full bg-purple-500 hover:bg-purple-400 text-white shadow-lg"
          >
            <FileText size={20} />
            <span className="font-medium">Mark Flyer</span>
          </button>
          <button
            onClick={onReportSighting}
            className="flex items-center gap-2 px-4 py-3 rounded-full bg-orange-500 hover:bg-orange-400 text-white shadow-lg"
          >
            <Eye size={20} />
            <span className="font-medium">Report Sighting</span>
          </button>
        </>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          expanded ? 'bg-slate-700 text-white rotate-45' : 'bg-flash-500 text-slate-900'
        }`}
      >
        <MapPin size={24} className={expanded ? 'rotate-[-45deg]' : ''} />
      </button>
    </div>
  );
}

// ============================================================================
// MAP LEGEND
// ============================================================================
function MapLegend({ visible, onToggle }) {
  if (!visible) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-4 right-4 p-2 bg-slate-800/90 backdrop-blur rounded-lg text-slate-400 hover:text-white z-20"
      >
        <Layers size={20} />
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 bg-slate-800/95 backdrop-blur-lg rounded-xl p-3 shadow-xl border border-slate-700 z-20 min-w-[160px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-medium text-sm">Legend</span>
        <button onClick={onToggle} className="text-slate-400 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
          <span className="text-slate-300">Last Seen</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-400"></div>
          <span className="text-slate-300">Sightings</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
          <span className="text-slate-300">Flyers Posted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-400"></div>
          <span className="text-slate-300">Shelters</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 bg-purple-500 rounded"></div>
          <span className="text-slate-300">Search Path</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MARKER INFO PANEL
// ============================================================================
function MarkerInfoPanel({ marker, onClose }) {
  if (!marker) return null;

  const getMarkerContent = () => {
    switch (marker.type) {
      case 'lastSeen':
        return {
          icon: '📍',
          title: 'Last Seen Location',
          subtitle: marker.address || 'Unknown location',
          color: 'border-yellow-500/50',
        };
      case 'sighting':
        return {
          icon: '👀',
          title: 'Sighting Reported',
          subtitle: marker.address || 'Unknown location',
          extra: marker.confidence ? `Confidence: ${marker.confidence}` : null,
          color: 'border-orange-500/50',
        };
      case 'flyer':
        return {
          icon: '📄',
          title: 'Flyer Posted',
          subtitle: marker.postedBy || 'Unknown',
          color: 'border-green-500/50',
        };
      case 'shelter':
        return {
          icon: '🏥',
          title: marker.name || 'Shelter',
          subtitle: marker.status || 'Not contacted',
          color: 'border-blue-500/50',
        };
      default:
        return {
          icon: '📍',
          title: 'Location',
          subtitle: '',
          color: 'border-slate-500/50',
        };
    }
  };

  const content = getMarkerContent();

  return (
    <div className={`absolute bottom-24 left-4 right-4 bg-slate-800/95 backdrop-blur-lg rounded-xl p-4 shadow-xl border ${content.color} z-20`}>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3">
        <div className="text-2xl">{content.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold">{content.title}</div>
          <div className="text-slate-400 text-sm truncate">{content.subtitle}</div>
          {content.extra && (
            <div className="text-slate-500 text-xs mt-1">{content.extra}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN MAP TAB
// ============================================================================
export default function MapTabV2({
  mission,
  sightings,
  gpsPath,
  isGPSTracking,
  onStartGPS,
  onStopGPS,
  onReportSighting,
  showNotification,
}) {
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [showLegend, setShowLegend] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const durationInterval = useRef(null);

  // Duration timer
  useEffect(() => {
    if (isGPSTracking) {
      durationInterval.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } else {
      clearInterval(durationInterval.current);
      setDuration(0);
    }
    return () => clearInterval(durationInterval.current);
  }, [isGPSTracking]);

  // Calculate distance from GPS path
  useEffect(() => {
    if (gpsPath && gpsPath.length > 1) {
      let totalDistance = 0;
      for (let i = 1; i < gpsPath.length; i++) {
        const p1 = gpsPath[i - 1];
        const p2 = gpsPath[i];
        // Haversine formula
        const R = 3959; // Earth's radius in miles
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lng - p1.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        totalDistance += R * c;
      }
      setDistance(totalDistance);
    } else {
      setDistance(0);
    }
  }, [gpsPath]);

  const handleStartGPS = async () => {
    setStarting(true);
    try {
      await onStartGPS();
    } finally {
      setStarting(false);
    }
  };

  const handleStopGPS = async () => {
    setStopping(true);
    try {
      await onStopGPS();
      const points = Math.round(distance * 100);
      if (points > 0 && showNotification) {
        showNotification({
          type: 'success',
          message: `+${points} points for ${distance.toFixed(2)} miles searched!`,
        });
      }
    } finally {
      setStopping(false);
    }
  };

  const handleMarkFlyer = () => {
    // TODO: Open flyer marking modal
    showNotification?.({ type: 'info', message: 'Flyer marking coming soon!' });
  };

  // Prepare map data
  const hasLocation = mission?.lastSeenLatitude && mission?.lastSeenLongitude;
  const mapCenter = hasLocation
    ? [mission.lastSeenLatitude, mission.lastSeenLongitude]
    : [41.8781, -87.6298]; // Default to Chicago

  const lastSeen = hasLocation
    ? {
        lat: mission.lastSeenLatitude,
        lng: mission.lastSeenLongitude,
        address: mission.lastSeenAddress,
      }
    : null;

  // Format sightings for SARMapView
  const formattedSightings = (sightings || [])
    .filter(s => s.latitude && s.longitude)
    .map(s => ({
      lat: s.latitude,
      lng: s.longitude,
      address: s.address,
      confidence: s.confidence,
      createdAt: s.createdAt,
    }));

  return (
    <div className="h-full relative">
      {/* Map */}
      {hasLocation ? (
        <MapView
          center={mapCenter}
          lastSeen={lastSeen}
          sightings={formattedSightings}
          gpsPath={gpsPath || []}
          petSpecies={mission?.petSpecies || 'DOG'}
          showProbabilityCircles={false}
          showLegend={false}
          interactive={true}
        />
      ) : (
        <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-6">
          <AlertCircle className="text-slate-500 mb-3" size={48} />
          <p className="text-slate-400 text-center">No location data available</p>
          <p className="text-slate-500 text-sm text-center mt-1">
            Last seen location not set for this case
          </p>
        </div>
      )}

      {/* GPS Search Panel */}
      <GPSSearchPanel
        isActive={isGPSTracking}
        duration={duration}
        distance={distance}
        onStart={handleStartGPS}
        onStop={handleStopGPS}
        starting={starting}
        stopping={stopping}
      />

      {/* Map Legend */}
      {!isGPSTracking && (
        <MapLegend visible={showLegend} onToggle={() => setShowLegend(!showLegend)} />
      )}

      {/* Floating Action Buttons */}
      <FloatingActions
        onReportSighting={onReportSighting}
        onMarkFlyer={handleMarkFlyer}
        isGPSActive={isGPSTracking}
      />

      {/* Selected Marker Info */}
      <MarkerInfoPanel marker={selectedMarker} onClose={() => setSelectedMarker(null)} />
    </div>
  );
}
