'use client';

/**
 * Mission Map - Real-time Search Area Visualization
 *
 * Shows:
 * - Search zones with coverage status
 * - Active volunteer positions
 * - Sighting locations
 * - Pet's last seen location
 * - Trap positions (if applicable)
 *
 * Uses Leaflet for mapping (lighter than Google Maps, free)
 */

import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useRef, useMemo } from 'react';
import { TOUCH_TARGETS, COLORS } from '@/app/lib/missionControl/accessibility';

// Zone status colors (colorblind-safe)
const ZONE_COLORS = {
  UNSEARCHED: 'rgba(100, 100, 100, 0.3)',
  IN_PROGRESS: 'rgba(33, 150, 243, 0.4)',  // Blue
  SEARCHED_RECENTLY: 'rgba(76, 175, 80, 0.3)', // Green
  SEARCHED_STALE: 'rgba(255, 152, 0, 0.3)', // Orange
  HIGH_PROBABILITY: 'rgba(156, 39, 176, 0.4)', // Purple
  SIGHTING: 'rgba(244, 67, 54, 0.5)', // Red
};

const ZONE_PATTERNS = {
  UNSEARCHED: 'none',
  IN_PROGRESS: 'url(#diagonal)',
  SEARCHED_RECENTLY: 'url(#dots)',
  SEARCHED_STALE: 'url(#crosshatch)',
};

export default function MissionMap({
  mission,
  zones = [],
  volunteers = [],
  sightings = [],
  traps = [],
  userLocation = null,
  onZoneClick = null,
  onVolunteerClick = null,
  compact = false,
}) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [leafletMap, setLeafletMap] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  // Center point (last seen location or first zone)
  const center = useMemo(() => {
    if (mission?.lastSeen?.lat && mission?.lastSeen?.lng) {
      return [mission.lastSeen.lat, mission.lastSeen.lng];
    }
    if (zones.length > 0 && zones[0].centerLat) {
      return [zones[0].centerLat, zones[0].centerLng];
    }
    return [40.7128, -74.0060]; // Default NYC
  }, [mission, zones]);

  // Load Leaflet dynamically (client-side only). The bundled package
  // replaces the old unpkg script tag; the effects below still read
  // window.L, so mirror what that script did and set the global.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.L) {
      setMapLoaded(true);
      return;
    }

    let cancelled = false;
    import('leaflet').then((mod) => {
      if (cancelled) return;
      window.L = mod.default || mod;
      setMapLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || leafletMap) return;

    const L = window.L;
    const map = L.map(mapRef.current, {
      center,
      zoom: 15,
      zoomControl: !compact,
      attributionControl: false,
    });

    // Dark tile layer for better visibility
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    setLeafletMap(map);

    return () => {
      map.remove();
      setLeafletMap(null);
    };
  }, [mapLoaded, center, compact]);

  // Update zones on map
  useEffect(() => {
    if (!leafletMap || !window.L) return;
    const L = window.L;

    // Clear existing zone layers
    leafletMap.eachLayer((layer) => {
      if (layer.options?.isZone) {
        leafletMap.removeLayer(layer);
      }
    });

    // Add zone polygons
    zones.forEach((zone) => {
      if (!zone.bounds) return;

      const bounds = typeof zone.bounds === 'string'
        ? JSON.parse(zone.bounds)
        : zone.bounds;

      const color = getZoneColor(zone);
      const polygon = L.polygon(bounds, {
        color: color.replace('0.3', '0.8').replace('0.4', '0.9'),
        fillColor: color,
        fillOpacity: 0.5,
        weight: 2,
        isZone: true,
      }).addTo(leafletMap);

      // Zone label
      const centerPoint = polygon.getBounds().getCenter();
      const label = L.divIcon({
        className: 'zone-label',
        html: `<div style="
          background: rgba(0,0,0,0.7);
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        ">${zone.name || `Zone ${zone.gridRef}`}</div>`,
      });
      L.marker(centerPoint, { icon: label, isZone: true }).addTo(leafletMap);

      polygon.on('click', () => {
        setSelectedZone(zone);
        onZoneClick?.(zone);
      });
    });
  }, [leafletMap, zones, onZoneClick]);

  // Update volunteer markers
  useEffect(() => {
    if (!leafletMap || !window.L) return;
    const L = window.L;

    // Clear existing volunteer markers
    leafletMap.eachLayer((layer) => {
      if (layer.options?.isVolunteer) {
        leafletMap.removeLayer(layer);
      }
    });

    // Add volunteer markers
    volunteers.forEach((vol) => {
      if (!vol.lastLat || !vol.lastLng) return;

      const isActive = vol.status === 'ACTIVE';
      const icon = L.divIcon({
        className: 'volunteer-marker',
        html: `<div style="
          width: 24px;
          height: 24px;
          background: ${isActive ? '#4CAF50' : '#666'};
          border: 3px solid #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">${vol.name?.[0]?.toUpperCase() || '?'}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([vol.lastLat, vol.lastLng], {
        icon,
        isVolunteer: true,
      }).addTo(leafletMap);

      marker.on('click', () => onVolunteerClick?.(vol));
    });
  }, [leafletMap, volunteers, onVolunteerClick]);

  // Add sighting markers
  useEffect(() => {
    if (!leafletMap || !window.L) return;
    const L = window.L;

    // Clear existing sighting markers
    leafletMap.eachLayer((layer) => {
      if (layer.options?.isSighting) {
        leafletMap.removeLayer(layer);
      }
    });

    // Add sighting markers
    sightings.forEach((sighting) => {
      if (!sighting.lat || !sighting.lng) return;

      const isVerified = sighting.verified;
      const icon = L.divIcon({
        className: 'sighting-marker',
        html: `<div style="
          width: 32px;
          height: 32px;
          background: ${isVerified ? '#D32F2F' : '#FF9800'};
          border: 3px solid #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          animation: ${isVerified ? 'pulse 1s infinite' : 'none'};
        ">👁</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([sighting.lat, sighting.lng], {
        icon,
        isSighting: true,
      }).addTo(leafletMap);
    });
  }, [leafletMap, sightings]);

  // Add trap markers
  useEffect(() => {
    if (!leafletMap || !window.L || traps.length === 0) return;
    const L = window.L;

    // Clear existing trap markers
    leafletMap.eachLayer((layer) => {
      if (layer.options?.isTrap) {
        leafletMap.removeLayer(layer);
      }
    });

    traps.forEach((trap) => {
      if (!trap.lat || !trap.lng) return;

      const icon = L.divIcon({
        className: 'trap-marker',
        html: `<div style="
          width: 28px;
          height: 28px;
          background: #9C27B0;
          border: 2px solid #fff;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        ">🪤</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([trap.lat, trap.lng], {
        icon,
        isTrap: true,
      }).addTo(leafletMap);
    });
  }, [leafletMap, traps]);

  // Add last seen marker
  useEffect(() => {
    if (!leafletMap || !window.L || !mission?.lastSeen) return;
    const L = window.L;

    const { lat, lng } = mission.lastSeen;
    if (!lat || !lng) return;

    // Clear existing last seen marker
    leafletMap.eachLayer((layer) => {
      if (layer.options?.isLastSeen) {
        leafletMap.removeLayer(layer);
      }
    });

    const icon = L.divIcon({
      className: 'last-seen-marker',
      html: `<div style="
        width: 40px;
        height: 40px;
        background: #FF5722;
        border: 3px solid #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      ">📍</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    L.marker([lat, lng], {
      icon,
      isLastSeen: true,
    }).addTo(leafletMap);
  }, [leafletMap, mission?.lastSeen]);

  // Add user location marker
  useEffect(() => {
    if (!leafletMap || !window.L || !userLocation) return;
    const L = window.L;

    // Clear existing user marker
    leafletMap.eachLayer((layer) => {
      if (layer.options?.isUser) {
        leafletMap.removeLayer(layer);
      }
    });

    const icon = L.divIcon({
      className: 'user-marker',
      html: `<div style="
        width: 20px;
        height: 20px;
        background: #2196F3;
        border: 4px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(33, 150, 243, 0.3);
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    L.marker([userLocation.lat, userLocation.lng], {
      icon,
      isUser: true,
    }).addTo(leafletMap);
  }, [leafletMap, userLocation]);

  // Recenter on user location
  const recenterOnUser = () => {
    if (leafletMap && userLocation) {
      leafletMap.setView([userLocation.lat, userLocation.lng], 16);
    }
  };

  return (
    <div style={{ ...styles.container, height: compact ? '200px' : '400px' }}>
      <div ref={mapRef} style={styles.map} />

      {!mapLoaded && (
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p>Loading map...</p>
        </div>
      )}

      {/* Map legend */}
      {!compact && (
        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: '#666' }} />
            <span>Unsearched</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: '#2196F3' }} />
            <span>In Progress</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: '#4CAF50' }} />
            <span>Searched</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: '#FF9800' }} />
            <span>Stale</span>
          </div>
        </div>
      )}

      {/* Recenter button */}
      {userLocation && (
        <button onClick={recenterOnUser} style={styles.recenterButton}>
          📍
        </button>
      )}

      {/* Zone details popup */}
      {selectedZone && (
        <div style={styles.zonePopup}>
          <div style={styles.zonePopupHeader}>
            <h3 style={styles.zonePopupTitle}>{selectedZone.name || `Zone ${selectedZone.gridRef}`}</h3>
            <button onClick={() => setSelectedZone(null)} style={styles.closeButton}>×</button>
          </div>
          <div style={styles.zonePopupContent}>
            <p style={styles.zoneStatus}>Status: {formatZoneStatus(selectedZone.status)}</p>
            {selectedZone.assignedTo && (
              <p style={styles.zoneAssigned}>Assigned: {selectedZone.assignedTo}</p>
            )}
            {selectedZone.searchedAt && (
              <p style={styles.zoneSearched}>Last searched: {formatTimeAgo(selectedZone.searchedAt)}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getZoneColor(zone) {
  if (zone.hasSighting) return ZONE_COLORS.SIGHTING;
  if (zone.highProbability) return ZONE_COLORS.HIGH_PROBABILITY;

  switch (zone.status) {
    case 'IN_PROGRESS':
      return ZONE_COLORS.IN_PROGRESS;
    case 'SEARCHED':
      // Check if stale (over 2 hours old)
      if (zone.searchedAt) {
        const hoursAgo = (Date.now() - new Date(zone.searchedAt).getTime()) / (1000 * 60 * 60);
        return hoursAgo > 2 ? ZONE_COLORS.SEARCHED_STALE : ZONE_COLORS.SEARCHED_RECENTLY;
      }
      return ZONE_COLORS.SEARCHED_RECENTLY;
    default:
      return ZONE_COLORS.UNSEARCHED;
  }
}

function formatZoneStatus(status) {
  switch (status) {
    case 'IN_PROGRESS': return 'Being searched';
    case 'SEARCHED': return 'Searched';
    case 'UNSEARCHED': return 'Not yet searched';
    default: return status;
  }
}

function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },

  map: {
    width: '100%',
    height: '100%',
  },

  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    color: '#888',
    gap: '12px',
  },

  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #333',
    borderTop: '3px solid #4CAF50',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  legend: {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: '8px',
    padding: '8px 12px',
    display: 'flex',
    gap: '16px',
    fontSize: '11px',
    color: '#fff',
  },

  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },

  legendDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
  },

  recenterButton: {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    width: '44px',
    height: '44px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  zonePopup: {
    position: 'absolute',
    bottom: '60px',
    left: '12px',
    right: '12px',
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  },

  zonePopupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#2A2A2A',
  },

  zonePopupTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
  },

  closeButton: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '24px',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },

  zonePopupContent: {
    padding: '12px 16px',
  },

  zoneStatus: {
    margin: '0 0 4px 0',
    fontSize: '14px',
    color: '#fff',
  },

  zoneAssigned: {
    margin: '0 0 4px 0',
    fontSize: '13px',
    color: '#888',
  },

  zoneSearched: {
    margin: 0,
    fontSize: '13px',
    color: '#888',
  },
};
