'use client';

/**
 * Case Map Panel - Center panel of Command Center
 *
 * Enhanced map view with:
 * - Last seen location marker
 * - Sighting markers with timeline
 * - Search area overlays
 * - Shelter locations
 * - Dark theme styling
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export default function CaseMapPanel({ caseData, searchAreas = [], onSightingClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const searchAreasLayerRef = useRef(null);
  const [sightings, setSightings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapView, setMapView] = useState('hybrid'); // 'standard', 'satellite', 'hybrid'
  const [showSearchAreas, setShowSearchAreas] = useState(true);

  // Fetch sightings for this case
  const fetchSightings = useCallback(async () => {
    if (!caseData?.id) return;

    try {
      const res = await fetch(`/api/cases/${caseData.id}/sightings`);
      if (res.ok) {
        const data = await res.json();
        setSightings(data.sightings || []);
      }
    } catch (err) {
      console.error('Error fetching sightings:', err);
    } finally {
      setLoading(false);
    }
  }, [caseData?.id]);

  useEffect(() => {
    fetchSightings();
    // Poll for new sightings
    const interval = setInterval(fetchSightings, 60000);
    return () => clearInterval(interval);
  }, [fetchSightings]);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    import('leaflet').then((L) => {
      import('leaflet/dist/leaflet.css');

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Center on last seen location or default
      const center = caseData?.lastSeenLatitude && caseData?.lastSeenLongitude
        ? [caseData.lastSeenLatitude, caseData.lastSeenLongitude]
        : [41.8781, -87.6298];

      // Create map with dark theme
      const map = L.map(mapRef.current, {
        zoomControl: false,
        scrollWheelZoom: true,
      }).setView(center, 15);

      // Add zoom control to bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Dark tile layer (CartoDB Dark Matter)
      const darkLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '© OpenStreetMap contributors © CARTO',
          maxZoom: 19,
        }
      );

      // Standard layer
      const standardLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution: '© OpenStreetMap contributors © CARTO',
          maxZoom: 19,
        }
      );

      // Add default dark layer
      darkLayer.addTo(map);

      // Store layers for toggling
      map._tileLayers = { dark: darkLayer, standard: standardLayer };

      // Create markers layer
      markersLayerRef.current = L.layerGroup().addTo(map);

      // Create search areas layer
      searchAreasLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;

      // Add markers
      addMarkers(L, map);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [caseData]);

  // Update markers when sightings change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    import('leaflet').then((L) => {
      addMarkers(L, mapInstanceRef.current);
    });
  }, [sightings, caseData]);

  // Draw search areas
  useEffect(() => {
    if (!mapInstanceRef.current || !searchAreasLayerRef.current) return;

    import('leaflet').then((L) => {
      // Clear existing search areas
      searchAreasLayerRef.current.clearLayers();

      if (!showSearchAreas || !searchAreas.length) return;

      searchAreas.forEach((area) => {
        if (!area.geometry?.coordinates) return;

        try {
          // Parse geometry if it's a string
          const geometry = typeof area.geometry === 'string'
            ? JSON.parse(area.geometry)
            : area.geometry;

          // Create polygon from coordinates
          // GeoJSON uses [lng, lat] but Leaflet uses [lat, lng]
          const coords = geometry.coordinates[0]?.map(coord => [coord[1], coord[0]]);

          if (coords && coords.length > 2) {
            const polygon = L.polygon(coords, {
              color: '#22c55e', // Green border
              weight: 2,
              opacity: 0.8,
              fillColor: '#22c55e',
              fillOpacity: 0.15,
              dashArray: null,
            });

            // Add popup with area info
            polygon.bindPopup(`
              <div class="p-2">
                <div class="font-bold text-green-600 mb-1">✓ Searched Area</div>
                ${area.acreage ? `<div class="text-sm text-gray-600">${area.acreage.toFixed(2)} acres</div>` : ''}
                ${area.notes ? `<div class="text-sm text-gray-500 mt-1">${area.notes}</div>` : ''}
                ${area.user?.firstName ? `
                  <div class="text-xs text-gray-400 mt-2 border-t pt-1">
                    Searched by ${area.user.firstName}
                  </div>
                ` : ''}
                ${area.createdAt ? `
                  <div class="text-xs text-gray-400">
                    ${new Date(area.createdAt).toLocaleDateString()}
                  </div>
                ` : ''}
              </div>
            `, { className: 'custom-popup' });

            polygon.addTo(searchAreasLayerRef.current);
          }
        } catch (err) {
          console.error('Error drawing search area:', err);
        }
      });
    });
  }, [searchAreas, showSearchAreas]);

  // Calculate total acreage searched
  const totalAcreage = searchAreas.reduce((sum, area) => sum + (area.acreage || 0), 0);

  const addMarkers = (L, map) => {
    if (!markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    // Last seen location - main marker
    if (caseData?.lastSeenLatitude && caseData?.lastSeenLongitude) {
      const lastSeenIcon = L.divIcon({
        className: 'custom-marker-last-seen',
        html: `
          <div class="relative">
            <div class="absolute -inset-4 bg-red-500/20 rounded-full animate-ping"></div>
            <div class="absolute -inset-2 bg-red-500/30 rounded-full animate-pulse"></div>
            <div class="relative w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-full shadow-lg shadow-red-500/50 flex items-center justify-center border-2 border-white">
              <span class="text-xl">${caseData.petSpecies === 'DOG' ? '🐕' : caseData.petSpecies === 'CAT' ? '🐈' : '🐾'}</span>
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      const lastSeenMarker = L.marker(
        [caseData.lastSeenLatitude, caseData.lastSeenLongitude],
        { icon: lastSeenIcon, zIndexOffset: 1000 }
      );

      lastSeenMarker.bindPopup(`
        <div class="p-2">
          <div class="font-bold text-red-600 mb-1">📍 Last Seen Location</div>
          <div class="text-sm text-gray-600">${caseData.lastSeenAddress || 'Unknown address'}</div>
          ${caseData.lastSeenAt ? `
            <div class="text-xs text-gray-500 mt-1">
              ${new Date(caseData.lastSeenAt).toLocaleString()}
            </div>
          ` : ''}
        </div>
      `, { className: 'custom-popup' });

      lastSeenMarker.addTo(markersLayerRef.current);
    }

    // Sighting markers
    sightings.forEach((sighting, index) => {
      if (!sighting.latitude || !sighting.longitude) return;

      const isRecent = Date.now() - new Date(sighting.createdAt).getTime() < 24 * 60 * 60 * 1000;

      const sightingIcon = L.divIcon({
        className: 'custom-marker-sighting',
        html: `
          <div class="relative">
            ${isRecent ? '<div class="absolute -inset-2 bg-yellow-500/30 rounded-full animate-pulse"></div>' : ''}
            <div class="relative w-8 h-8 bg-gradient-to-br ${isRecent ? 'from-yellow-400 to-amber-500 shadow-yellow-500/50' : 'from-cyan-400 to-blue-500 shadow-cyan-500/50'} rounded-full shadow-lg flex items-center justify-center border-2 border-white">
              <span class="text-sm">👁️</span>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([sighting.latitude, sighting.longitude], { icon: sightingIcon });

      const confidence = sighting.confidence || 'Unknown';
      const confidenceColor = {
        HIGH: 'text-green-600',
        MEDIUM: 'text-yellow-600',
        LOW: 'text-gray-500',
      }[confidence] || 'text-gray-500';

      marker.bindPopup(`
        <div class="p-2 min-w-[200px]">
          <div class="font-bold text-cyan-600 mb-1">👁️ Sighting #${sightings.length - index}</div>
          <div class="text-xs text-gray-500 mb-2">${new Date(sighting.createdAt).toLocaleString()}</div>
          ${sighting.description ? `<div class="text-sm text-gray-700 mb-2">"${sighting.description}"</div>` : ''}
          <div class="flex items-center gap-2 text-xs">
            <span class="${confidenceColor} font-medium">Confidence: ${confidence}</span>
          </div>
          ${sighting.reporter ? `
            <div class="text-xs text-gray-500 mt-2 border-t pt-2">
              Reported by ${sighting.reporter.firstName || 'Anonymous'}
            </div>
          ` : ''}
        </div>
      `, { className: 'custom-popup' });

      marker.on('click', () => {
        setSelectedMarker(sighting);
        onSightingClick?.(sighting);
      });

      marker.addTo(markersLayerRef.current);
    });
  };

  // Calculate time since last sighting
  const getLastSightingTime = () => {
    if (sightings.length === 0) return null;
    const lastSighting = sightings[0];
    const hours = Math.floor((Date.now() - new Date(lastSighting.createdAt).getTime()) / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Map controls bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-4">
          <h3 className="font-medium text-white text-sm">Search Area Map</h3>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {caseData?.lastSeenLatitude && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Last seen
              </span>
            )}
            {sightings.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                {sightings.length} sighting{sightings.length !== 1 ? 's' : ''}
                {getLastSightingTime() && ` (${getLastSightingTime()})`}
              </span>
            )}
            {searchAreas.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {totalAcreage.toFixed(1)} acres searched
              </span>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          {/* Search areas toggle */}
          {searchAreas.length > 0 && (
            <button
              onClick={() => setShowSearchAreas(!showSearchAreas)}
              className={`px-3 py-1.5 text-xs rounded-lg transition ${
                showSearchAreas
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {showSearchAreas ? '✓ Coverage' : 'Coverage'}
            </button>
          )}
          <button
            onClick={() => {
              if (mapInstanceRef.current && caseData?.lastSeenLatitude) {
                mapInstanceRef.current.setView(
                  [caseData.lastSeenLatitude, caseData.lastSeenLongitude],
                  16
                );
              }
            }}
            className="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition"
          >
            📍 Center
          </button>
        </div>
      </div>

      {/* Map container */}
      <div className="flex-1 relative">
        <div
          ref={mapRef}
          className="absolute inset-0"
          style={{ background: '#1e293b' }}
        />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-400">Loading map data...</p>
            </div>
          </div>
        )}

        {/* Map legend */}
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur rounded-xl p-3 border border-slate-700/50 z-10">
          <div className="text-xs space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gradient-to-br from-red-500 to-rose-600 border border-white/50" />
              <span className="text-slate-300">Last seen</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 border border-white/50" />
              <span className="text-slate-300">Recent sighting (&lt;24h)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 border border-white/50" />
              <span className="text-slate-300">Older sighting</span>
            </div>
          </div>
        </div>

        {/* No location warning */}
        {!caseData?.lastSeenLatitude && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="bg-slate-800/90 backdrop-blur rounded-2xl p-6 text-center max-w-sm border border-slate-700">
              <span className="text-4xl mb-3 block">📍</span>
              <h3 className="font-bold text-white mb-2">No Location Data</h3>
              <p className="text-sm text-slate-400">
                This case doesn't have a precise last-seen location recorded.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sightings quick list (collapsible) */}
      {sightings.length > 0 && (
        <div className="border-t border-slate-700/50 bg-slate-800/50 max-h-32 overflow-y-auto">
          <div className="px-4 py-2 text-xs font-medium text-slate-400 border-b border-slate-700/30">
            Recent Sightings
          </div>
          <div className="divide-y divide-slate-700/30">
            {sightings.slice(0, 3).map((sighting, i) => (
              <button
                key={sighting.id}
                onClick={() => {
                  if (mapInstanceRef.current && sighting.latitude) {
                    mapInstanceRef.current.setView([sighting.latitude, sighting.longitude], 17);
                  }
                  onSightingClick?.(sighting);
                }}
                className="w-full px-4 py-2 flex items-center gap-3 hover:bg-slate-700/30 transition text-left"
              >
                <span className="text-lg">👁️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {sighting.description || 'Sighting reported'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(sighting.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  sighting.confidence === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                  sighting.confidence === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {sighting.confidence || 'Unknown'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
