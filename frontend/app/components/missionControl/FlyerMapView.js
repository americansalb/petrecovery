'use client';

/**
 * FlyerMapView Component
 *
 * Interactive Leaflet map for flyer tracking with:
 * - Flyer pin markers (green)
 * - Cold spot overlay circles (red/orange/yellow by priority)
 * - User location marker (blue pulsing)
 * - Last seen location marker
 * - Cluster support for many flyers
 *
 * Per Actions_Guide.md Phase 4 specification.
 */

import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// =============================================================================
// MARKER ICONS
// =============================================================================

// Flyer pin icon (green pushpin)
const flyerIcon = L.divIcon({
  className: 'flyer-marker',
  html: `
    <div style="
      width: 24px;
      height: 24px;
      background: #10B981;
      border: 2px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="transform: rotate(45deg); font-size: 10px;">📌</span>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

// User location icon (blue pulsing dot)
const userIcon = L.divIcon({
  className: 'user-marker',
  html: `
    <div style="
      width: 20px;
      height: 20px;
      background: #3B82F6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
      animation: pulse 2s ease-in-out infinite;
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Last seen icon (red marker)
const lastSeenIcon = L.divIcon({
  className: 'last-seen-marker',
  html: `
    <div style="
      width: 30px;
      height: 30px;
      background: #EF4444;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    ">📍</div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// =============================================================================
// COMPONENT
// =============================================================================

export default function FlyerMapView({
  center = [41.8781, -87.6298],
  zoom = 15,
  lastSeenLocation = null,
  userLocation = null,
  flyers = [],
  coldSpots = [],
  onMapClick = null,
  showLegend = true,
  interactive = true,
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const coldSpotLayersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const lastSeenMarkerRef = useRef(null);

  // Compute map center - prefer user location, then last seen, then default
  const mapCenter = useMemo(() => {
    if (userLocation) return [userLocation.lat, userLocation.lng];
    if (lastSeenLocation) return [lastSeenLocation.lat, lastSeenLocation.lng];
    return center;
  }, [userLocation, lastSeenLocation, center]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, {
      center: mapCenter,
      zoom,
      zoomControl: interactive,
      attributionControl: false,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
    });

    // Add satellite layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(mapInstance.current);

    // Add street labels overlay
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      pane: 'overlayPane',
    }).addTo(mapInstance.current);

    // Handle map clicks for posting flyers
    if (onMapClick) {
      mapInstance.current.on('click', (e) => {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }

    // Add CSS for animations
    if (typeof document !== 'undefined' && !document.getElementById('flyer-map-styles')) {
      const style = document.createElement('style');
      style.id = 'flyer-map-styles';
      style.textContent = `
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3); }
          50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.1); }
        }
        .flyer-marker, .user-marker, .last-seen-marker {
          background: transparent !important;
          border: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update center when location changes
  useEffect(() => {
    if (mapInstance.current && mapCenter) {
      mapInstance.current.setView(mapCenter, zoom);
    }
  }, [mapCenter, zoom]);

  // Update user location marker
  useEffect(() => {
    if (!mapInstance.current) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      mapInstance.current.removeLayer(userMarkerRef.current);
    }

    // Add new user marker
    if (userLocation) {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
      })
        .addTo(mapInstance.current)
        .bindPopup(`
          <div style="text-align: center;">
            <strong>Your Location</strong><br/>
            <small>Accuracy: ${Math.round(userLocation.accuracy || 0)}m</small>
          </div>
        `);
    }
  }, [userLocation]);

  // Update last seen marker
  useEffect(() => {
    if (!mapInstance.current) return;

    // Remove existing marker
    if (lastSeenMarkerRef.current) {
      mapInstance.current.removeLayer(lastSeenMarkerRef.current);
    }

    // Add new marker
    if (lastSeenLocation) {
      lastSeenMarkerRef.current = L.marker([lastSeenLocation.lat, lastSeenLocation.lng], {
        icon: lastSeenIcon,
        zIndexOffset: 500,
      })
        .addTo(mapInstance.current)
        .bindPopup(`
          <div style="text-align: center;">
            <strong>Last Seen Location</strong><br/>
            <small>${lastSeenLocation.address || 'Unknown address'}</small>
          </div>
        `);
    }
  }, [lastSeenLocation]);

  // Update flyer markers
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => mapInstance.current.removeLayer(m));
    markersRef.current = [];

    // Add flyer markers
    flyers.forEach((flyer) => {
      if (!flyer.latitude || !flyer.longitude) return;

      const marker = L.marker([flyer.latitude, flyer.longitude], {
        icon: flyerIcon,
      })
        .addTo(mapInstance.current)
        .bindPopup(`
          <div style="min-width: 150px;">
            <strong>Flyer Posted</strong><br/>
            <small>By: ${flyer.postedBy?.firstName || 'Unknown'}</small><br/>
            <small>${formatTime(flyer.createdAt)}</small>
            ${flyer.photoUrl ? `<br/><img src="${flyer.photoUrl}" style="width: 100%; max-width: 150px; margin-top: 8px; border-radius: 4px;" />` : ''}
          </div>
        `);

      markersRef.current.push(marker);
    });
  }, [flyers]);

  // Update cold spot overlays
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing cold spots
    coldSpotLayersRef.current.forEach((layer) => mapInstance.current.removeLayer(layer));
    coldSpotLayersRef.current = [];

    // Add cold spot circles
    coldSpots.forEach((spot) => {
      if (!spot.centerLat || !spot.centerLng) return;

      // Color based on priority
      const color = spot.priority >= 70 ? '#EF4444' : spot.priority >= 40 ? '#F97316' : '#FBBF24';
      const fillOpacity = spot.priority >= 70 ? 0.3 : spot.priority >= 40 ? 0.2 : 0.1;

      const circle = L.circle([spot.centerLat, spot.centerLng], {
        radius: spot.radiusMeters || 200,
        color,
        fillColor: color,
        fillOpacity,
        weight: 2,
        dashArray: '5, 5',
      })
        .addTo(mapInstance.current)
        .bindPopup(`
          <div style="text-align: center;">
            <strong style="color: ${color};">Cold Spot</strong><br/>
            <small>Priority: ${spot.priority >= 70 ? 'High' : spot.priority >= 40 ? 'Medium' : 'Low'}</small><br/>
            <small>No flyers in this area</small>
          </div>
        `);

      coldSpotLayersRef.current.push(circle);
    });
  }, [coldSpots]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Map container */}
      <div
        ref={mapRef}
        style={{
          height: '100%',
          width: '100%',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      />

      {/* Legend overlay */}
      {showLegend && (
        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: '#3B82F6' }} />
            <span>You</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: '#EF4444' }} />
            <span>Last Seen</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: '#10B981' }} />
            <span>Flyers ({flyers.length})</span>
          </div>
          <div style={styles.legendItem}>
            <span style={{ ...styles.legendCircle, borderColor: '#EF4444' }} />
            <span>Cold Spots ({coldSpots.length})</span>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  legend: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
    padding: '8px 12px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    zIndex: 1000,
    fontSize: '12px',
    color: 'white',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendCircle: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '2px dashed',
    background: 'transparent',
    flexShrink: 0,
  },
};
