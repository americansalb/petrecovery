'use client';

/**
 * MapPreview - Preview of the search area matching Mission Control style
 *
 * Uses the same visual styling as SARMapView but without GPS dependencies.
 * Shows: last seen marker, sighting markers, search radius circles.
 */

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Simple map component without GPS dependencies
function SimpleMap({ center, lastSeen, sightings = [], petSpecies = 'DOG', hoursElapsed = 24 }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    // Dynamically import Leaflet
    import('leaflet').then((L) => {
      // Clean up existing map
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }

      // Create map - same settings as SARMapView
      const map = L.map(mapRef.current, {
        center,
        zoom: 15,
        zoomControl: true,
        attributionControl: true,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
      });

      // Same tile layer as SARMapView (CartoDB Voyager for light theme)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap © CARTO'
      }).addTo(map);

      // Add search radius circle (simplified)
      const radiusMiles = hoursElapsed <= 6 ? 0.5 : hoursElapsed <= 24 ? 1 : hoursElapsed <= 72 ? 2 : 3;
      const radiusMeters = radiusMiles * 1609.34;

      L.circle(center, {
        radius: radiusMeters,
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 5'
      }).addTo(map);

      // Last seen marker - same style as SARMapView
      if (lastSeen) {
        const lastSeenIcon = L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="
              position: relative;
              width: 36px;
              height: 36px;
            ">
              <div style="
                position: absolute;
                width: 36px;
                height: 36px;
                background: #ef4444;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              "></div>
              <div style="
                position: absolute;
                top: 7px;
                left: 7px;
                width: 22px;
                height: 22px;
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <span style="font-size: 14px;">📍</span>
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        });

        L.marker([lastSeen.latitude, lastSeen.longitude], { icon: lastSeenIcon })
          .bindPopup(`<b>Last Seen</b><br/>${lastSeen.address || 'Location'}`)
          .addTo(map);
      }

      // Sighting markers - same style as SARMapView
      sightings.forEach((sighting, index) => {
        if (!sighting.latitude || !sighting.longitude) return;

        // Color based on recency (same logic as SARMapView)
        const hoursAgo = sighting.sightedAt
          ? (Date.now() - new Date(sighting.sightedAt).getTime()) / (1000 * 60 * 60)
          : 999;

        let color = '#94a3b8'; // gray for old
        if (hoursAgo < 1) color = '#ef4444'; // red for very recent
        else if (hoursAgo < 6) color = '#f97316'; // orange
        else if (hoursAgo < 24) color = '#eab308'; // yellow

        const sightingIcon = L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="
              width: 24px;
              height: 24px;
              background: ${color};
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <span style="font-size: 12px;">👁️</span>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        L.marker([sighting.latitude, sighting.longitude], { icon: sightingIcon })
          .bindPopup(`<b>Sighting ${index + 1}</b><br/>${sighting.description || sighting.address || 'Reported sighting'}`)
          .addTo(map);
      });

      // Fit bounds if we have sightings
      if (sightings.length > 0) {
        const bounds = L.latLngBounds([center]);
        sightings.forEach(s => {
          if (s.latitude && s.longitude) {
            bounds.extend([s.latitude, s.longitude]);
          }
        });
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      }

      mapInstance.current = map;
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [center, lastSeen, sightings, hoursElapsed]);

  return <div ref={mapRef} className="w-full h-full" />;
}

// Dynamic import wrapper
const MapComponent = dynamic(
  () => Promise.resolve(SimpleMap),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-midnight-100 animate-pulse" />
  }
);

export default function MapPreview({
  caseNumber,
  lastSeenLatitude,
  lastSeenLongitude,
  lastSeenAddress,
  sightings = [],
  petSpecies = 'DOG',
  hoursElapsed = 24
}) {
  const hasLocation = lastSeenLatitude && lastSeenLongitude;
  const sightingsCount = sightings?.length || 0;

  const lastSeen = hasLocation ? {
    latitude: lastSeenLatitude,
    longitude: lastSeenLongitude,
    address: lastSeenAddress
  } : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-white rounded-2xl shadow-lg border border-midnight-100 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-midnight-100">
        {/* min-w-0 on the left, shrink-0 on the count. Without them the
            address column refuses to shrink below its content width and
            pushes the count past the card edge, which read as "2 sigh" at
            390px even though the count already says whitespace-nowrap. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-bold text-midnight-900 text-lg">Search Area</h2>
            {lastSeenAddress && (
              <p className="text-sm text-midnight-500 mt-0.5 line-clamp-2">{lastSeenAddress}</p>
            )}
          </div>
          {sightingsCount > 0 && (
            <span className="shrink-0 text-sm text-amber-600 font-medium whitespace-nowrap">
              {sightingsCount} sighting{sightingsCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Map */}
      {hasLocation ? (
        <div className="h-64 md:h-80">
          <MapComponent
            center={[lastSeenLatitude, lastSeenLongitude]}
            lastSeen={lastSeen}
            sightings={sightings}
            petSpecies={petSpecies}
            hoursElapsed={hoursElapsed}
          />
        </div>
      ) : (
        <div className="h-64 bg-midnight-50 flex items-center justify-center">
          <p className="text-midnight-400">No location data available</p>
        </div>
      )}

      {/* Footer - Link to Mission Control */}
      {hasLocation && (
        <Link
          href={`/mission-control?mission=${caseNumber}`}
          className="block px-5 py-3 bg-midnight-50 border-t border-midnight-100 text-center text-sm font-medium text-midnight-600 hover:text-midnight-900 hover:bg-midnight-100 transition"
        >
          Open Full Map in Mission Control →
        </Link>
      )}
    </motion.div>
  );
}
