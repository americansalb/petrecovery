'use client';

/**
 * Case Map Panel - Center panel of Command Center
 *
 * Enhanced map view with:
 * - Last seen location marker
 * - Sighting markers with timeline
 * - Search area overlays
 * - Probability zones (expanding circles based on time)
 * - Heat map for sighting density
 * - Nearby shelter/vet locations
 * - Dark theme styling
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Pet travel speed estimates (miles per hour)
const PET_SPEEDS = {
  DOG: { wander: 3, run: 15 },
  CAT: { wander: 1.5, run: 8 },
  DEFAULT: { wander: 2, run: 10 }
};

// Calculate probability radius based on time elapsed (in miles)
function calculateSearchRadius(hoursElapsed, petSpecies) {
  const speeds = PET_SPEEDS[petSpecies] || PET_SPEEDS.DEFAULT;

  // Probability zones based on time and pet behavior research
  if (hoursElapsed <= 6) {
    // Critical period - pet likely nearby
    return { inner: 0.5, middle: 1, outer: speeds.wander * 2 };
  } else if (hoursElapsed <= 24) {
    // First day - expanding search
    return { inner: 1, middle: 3, outer: speeds.wander * 6 };
  } else if (hoursElapsed <= 72) {
    // Extended search
    return { inner: 2, middle: 5, outer: speeds.wander * 12 };
  } else {
    // Long-term search
    return { inner: 3, middle: 8, outer: speeds.wander * 24 };
  }
}

// Convert miles to meters for Leaflet
const milesToMeters = (miles) => miles * 1609.34;

export default function CaseMapPanel({ caseData, searchAreas = [], onSightingClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const searchAreasLayerRef = useRef(null);
  const probabilityLayerRef = useRef(null);
  const heatLayerRef = useRef(null);
  const resourcesLayerRef = useRef(null);
  const [sightings, setSightings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapView, setMapView] = useState('hybrid'); // 'standard', 'satellite', 'hybrid'
  const [showSearchAreas, setShowSearchAreas] = useState(true);
  const [showProbabilityZones, setShowProbabilityZones] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [nearbyResources, setNearbyResources] = useState([]);
  const [weather, setWeather] = useState(null);

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

      // Create layers in order (bottom to top)
      probabilityLayerRef.current = L.layerGroup().addTo(map);
      searchAreasLayerRef.current = L.layerGroup().addTo(map);
      resourcesLayerRef.current = L.layerGroup().addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);

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

  // Draw probability zones based on time elapsed
  useEffect(() => {
    if (!mapInstanceRef.current || !probabilityLayerRef.current) return;
    if (!caseData?.lastSeenLatitude || !caseData?.lastSeenLongitude) return;

    import('leaflet').then((L) => {
      probabilityLayerRef.current.clearLayers();

      if (!showProbabilityZones) return;

      // Calculate hours elapsed since last seen
      const lastSeenTime = caseData.lastSeenAt ? new Date(caseData.lastSeenAt) : new Date(caseData.createdAt);
      const hoursElapsed = Math.max(1, (Date.now() - lastSeenTime.getTime()) / 3600000);

      // Get search radius based on pet type and time
      const radius = calculateSearchRadius(hoursElapsed, caseData.petSpecies);
      const center = [caseData.lastSeenLatitude, caseData.lastSeenLongitude];

      // Outer zone (lowest probability)
      const outerCircle = L.circle(center, {
        radius: milesToMeters(radius.outer),
        color: '#6366f1', // Indigo
        weight: 1,
        opacity: 0.5,
        fillColor: '#6366f1',
        fillOpacity: 0.05,
        dashArray: '10, 10',
      });
      outerCircle.bindPopup(`
        <div class="p-2">
          <div class="font-bold text-indigo-600 mb-1">Extended Search Zone</div>
          <div class="text-sm text-gray-600">${radius.outer.toFixed(1)} mile radius</div>
          <div class="text-xs text-gray-500 mt-1">Lower probability - check if pet was spooked or chased</div>
        </div>
      `);
      outerCircle.addTo(probabilityLayerRef.current);

      // Middle zone (medium probability)
      const middleCircle = L.circle(center, {
        radius: milesToMeters(radius.middle),
        color: '#f59e0b', // Amber
        weight: 2,
        opacity: 0.6,
        fillColor: '#f59e0b',
        fillOpacity: 0.08,
        dashArray: '5, 5',
      });
      middleCircle.bindPopup(`
        <div class="p-2">
          <div class="font-bold text-amber-600 mb-1">Moderate Search Zone</div>
          <div class="text-sm text-gray-600">${radius.middle.toFixed(1)} mile radius</div>
          <div class="text-xs text-gray-500 mt-1">Medium probability - thorough search recommended</div>
        </div>
      `);
      middleCircle.addTo(probabilityLayerRef.current);

      // Inner zone (highest probability)
      const innerCircle = L.circle(center, {
        radius: milesToMeters(radius.inner),
        color: '#ef4444', // Red
        weight: 2,
        opacity: 0.8,
        fillColor: '#ef4444',
        fillOpacity: 0.1,
      });
      innerCircle.bindPopup(`
        <div class="p-2">
          <div class="font-bold text-red-600 mb-1">Priority Search Zone</div>
          <div class="text-sm text-gray-600">${radius.inner.toFixed(1)} mile radius</div>
          <div class="text-xs text-gray-500 mt-1">Highest probability - search every hiding spot!</div>
        </div>
      `);
      innerCircle.addTo(probabilityLayerRef.current);
    });
  }, [caseData, showProbabilityZones]);

  // Fetch nearby shelters/vets
  const fetchNearbyResources = useCallback(async () => {
    if (!caseData?.lastSeenLatitude || !caseData?.lastSeenLongitude) return;

    try {
      // Use Overpass API to find nearby animal shelters and vets
      const lat = caseData.lastSeenLatitude;
      const lon = caseData.lastSeenLongitude;
      const radius = 8000; // 8km radius

      const query = `
        [out:json][timeout:10];
        (
          node["amenity"="veterinary"](around:${radius},${lat},${lon});
          node["amenity"="animal_shelter"](around:${radius},${lat},${lon});
          node["shop"="pet"](around:${radius},${lat},${lon});
        );
        out body;
      `;

      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
      });

      if (res.ok) {
        const data = await res.json();
        setNearbyResources(data.elements || []);
      }
    } catch (err) {
      console.error('Error fetching nearby resources:', err);
    }
  }, [caseData?.lastSeenLatitude, caseData?.lastSeenLongitude]);

  useEffect(() => {
    if (showResources && nearbyResources.length === 0) {
      fetchNearbyResources();
    }
  }, [showResources, nearbyResources.length, fetchNearbyResources]);

  // Draw nearby resources
  useEffect(() => {
    if (!mapInstanceRef.current || !resourcesLayerRef.current) return;

    import('leaflet').then((L) => {
      resourcesLayerRef.current.clearLayers();

      if (!showResources || nearbyResources.length === 0) return;

      nearbyResources.forEach((resource) => {
        if (!resource.lat || !resource.lon) return;

        const type = resource.tags?.amenity || resource.tags?.shop;
        const name = resource.tags?.name || 'Unknown';
        const phone = resource.tags?.phone || resource.tags?.['contact:phone'];

        const iconConfig = {
          veterinary: { emoji: '🏥', color: 'from-emerald-400 to-teal-500', label: 'Veterinarian' },
          animal_shelter: { emoji: '🏠', color: 'from-purple-400 to-violet-500', label: 'Animal Shelter' },
          pet: { emoji: '🐾', color: 'from-orange-400 to-amber-500', label: 'Pet Store' },
        }[type] || { emoji: '📍', color: 'from-gray-400 to-gray-500', label: 'Resource' };

        const icon = L.divIcon({
          className: 'custom-marker-resource',
          html: `
            <div class="w-8 h-8 bg-gradient-to-br ${iconConfig.color} rounded-lg shadow-lg flex items-center justify-center border border-white/50">
              <span class="text-sm">${iconConfig.emoji}</span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([resource.lat, resource.lon], { icon });

        marker.bindPopup(`
          <div class="p-2 min-w-[180px]">
            <div class="font-bold text-gray-800 mb-1">${iconConfig.emoji} ${name}</div>
            <div class="text-xs text-gray-500 mb-2">${iconConfig.label}</div>
            ${phone ? `
              <a href="tel:${phone}" class="text-sm text-cyan-600 hover:underline block mb-1">
                📞 ${phone}
              </a>
            ` : ''}
            ${resource.tags?.['addr:street'] ? `
              <div class="text-xs text-gray-500">
                📍 ${resource.tags['addr:street']}${resource.tags['addr:city'] ? `, ${resource.tags['addr:city']}` : ''}
              </div>
            ` : ''}
            <div class="text-xs text-cyan-600 mt-2">
              Check if they've seen ${caseData?.petName || 'the pet'}!
            </div>
          </div>
        `, { className: 'custom-popup' });

        marker.addTo(resourcesLayerRef.current);
      });
    });
  }, [nearbyResources, showResources, caseData?.petName]);

  // Fetch weather conditions
  useEffect(() => {
    if (!caseData?.lastSeenLatitude || !caseData?.lastSeenLongitude) return;

    const fetchWeather = async () => {
      try {
        const lat = caseData.lastSeenLatitude;
        const lon = caseData.lastSeenLongitude;

        // Use Open-Meteo free API (no key required)
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&temperature_unit=fahrenheit&timezone=auto`
        );

        if (res.ok) {
          const data = await res.json();
          setWeather(data.current);
        }
      } catch (err) {
        console.error('Error fetching weather:', err);
      }
    };

    fetchWeather();
    // Refresh weather every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [caseData?.lastSeenLatitude, caseData?.lastSeenLongitude]);

  // Get weather icon and description
  const getWeatherInfo = (code) => {
    // WMO Weather interpretation codes
    const weatherCodes = {
      0: { icon: '☀️', desc: 'Clear', concern: null },
      1: { icon: '🌤️', desc: 'Mainly clear', concern: null },
      2: { icon: '⛅', desc: 'Partly cloudy', concern: null },
      3: { icon: '☁️', desc: 'Overcast', concern: null },
      45: { icon: '🌫️', desc: 'Fog', concern: 'low visibility' },
      48: { icon: '🌫️', desc: 'Freezing fog', concern: 'dangerous conditions' },
      51: { icon: '🌧️', desc: 'Light drizzle', concern: 'pet may seek shelter' },
      53: { icon: '🌧️', desc: 'Drizzle', concern: 'pet may seek shelter' },
      55: { icon: '🌧️', desc: 'Heavy drizzle', concern: 'pet likely hiding' },
      61: { icon: '🌧️', desc: 'Light rain', concern: 'pet may seek shelter' },
      63: { icon: '🌧️', desc: 'Rain', concern: 'pet likely hiding' },
      65: { icon: '🌧️', desc: 'Heavy rain', concern: 'pet likely hiding' },
      71: { icon: '🌨️', desc: 'Light snow', concern: 'cold - urgent search' },
      73: { icon: '🌨️', desc: 'Snow', concern: 'cold - urgent search' },
      75: { icon: '🌨️', desc: 'Heavy snow', concern: 'dangerous for pet' },
      80: { icon: '🌧️', desc: 'Rain showers', concern: 'pet may seek shelter' },
      95: { icon: '⛈️', desc: 'Thunderstorm', concern: 'pet scared - hiding' },
    };
    return weatherCodes[code] || { icon: '🌡️', desc: 'Unknown', concern: null };
  };

  // Draw heat map for sightings
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      // Remove existing heat layer if any
      if (heatLayerRef.current) {
        mapInstanceRef.current.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }

      if (!showHeatmap || sightings.length < 2) return;

      // Create heat data points with intensity based on recency
      const heatData = sightings
        .filter(s => s.latitude && s.longitude)
        .map(s => {
          const ageHours = (Date.now() - new Date(s.createdAt).getTime()) / 3600000;
          const intensity = Math.max(0.3, 1 - (ageHours / 168)); // Decay over 1 week
          const confidenceBoost = s.confidence === 'HIGH' ? 0.3 : s.confidence === 'LOW' ? -0.2 : 0;
          return {
            lat: s.latitude,
            lng: s.longitude,
            intensity: Math.min(1, intensity + confidenceBoost)
          };
        });

      // Since we don't have leaflet.heat, create a custom visualization
      // using overlapping circles with varying opacity
      const heatGroup = L.layerGroup();

      heatData.forEach(point => {
        // Create gradient circles
        [300, 200, 100].forEach((radius, i) => {
          const circle = L.circle([point.lat, point.lng], {
            radius,
            stroke: false,
            fillColor: i === 0 ? '#fbbf24' : i === 1 ? '#f59e0b' : '#dc2626',
            fillOpacity: point.intensity * (0.1 + i * 0.05),
          });
          circle.addTo(heatGroup);
        });
      });

      heatGroup.addTo(mapInstanceRef.current);
      heatLayerRef.current = heatGroup;
    });
  }, [sightings, showHeatmap]);

  // Calculate total acreage searched
  const totalAcreage = searchAreas.reduce((sum, area) => sum + (area.acreage || 0), 0);

  // Calculate hours elapsed for display
  const hoursElapsed = caseData?.lastSeenAt
    ? Math.floor((Date.now() - new Date(caseData.lastSeenAt).getTime()) / 3600000)
    : null;

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

        {/* Layer toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Probability zones toggle */}
          {caseData?.lastSeenLatitude && (
            <button
              onClick={() => setShowProbabilityZones(!showProbabilityZones)}
              className={`px-3 py-1.5 text-xs rounded-lg transition ${
                showProbabilityZones
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              title="Probability zones based on pet travel patterns"
            >
              {showProbabilityZones ? '✓ Zones' : 'Zones'}
            </button>
          )}

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

          {/* Heat map toggle */}
          {sightings.length >= 2 && (
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`px-3 py-1.5 text-xs rounded-lg transition ${
                showHeatmap
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              title="Heat map showing sighting concentration"
            >
              {showHeatmap ? '✓ Heat' : 'Heat'}
            </button>
          )}

          {/* Resources toggle */}
          <button
            onClick={() => setShowResources(!showResources)}
            className={`px-3 py-1.5 text-xs rounded-lg transition ${
              showResources
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            title="Show nearby shelters, vets, and pet stores"
          >
            {showResources ? `✓ Resources${nearbyResources.length ? ` (${nearbyResources.length})` : ''}` : 'Resources'}
          </button>

          {/* Center button */}
          <button
            onClick={() => {
              if (mapInstanceRef.current && caseData?.lastSeenLatitude) {
                mapInstanceRef.current.setView(
                  [caseData.lastSeenLatitude, caseData.lastSeenLongitude],
                  15
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

        {/* Weather widget */}
        {weather && (
          <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur rounded-xl p-3 border border-slate-700/50 z-10">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getWeatherInfo(weather.weather_code).icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">
                    {Math.round(weather.temperature_2m)}°F
                  </span>
                  <span className="text-xs text-slate-400">
                    {getWeatherInfo(weather.weather_code).desc}
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span>💨 {Math.round(weather.wind_speed_10m)} mph</span>
                  <span>💧 {weather.relative_humidity_2m}%</span>
                </div>
              </div>
            </div>
            {/* Weather concern alert */}
            {getWeatherInfo(weather.weather_code).concern && (
              <div className="mt-2 px-2 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400">
                  ⚠️ {getWeatherInfo(weather.weather_code).concern}
                </p>
              </div>
            )}
            {/* Temperature-based alerts */}
            {weather.temperature_2m < 32 && (
              <div className="mt-2 px-2 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-400">
                  🥶 Freezing temps - pet may be seeking warmth
                </p>
              </div>
            )}
            {weather.temperature_2m > 85 && (
              <div className="mt-2 px-2 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg">
                <p className="text-xs text-red-400">
                  🥵 Hot temps - pet may seek shade/water
                </p>
              </div>
            )}
          </div>
        )}

        {/* Map legend */}
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur rounded-xl p-3 border border-slate-700/50 z-10 max-w-[200px]">
          <div className="text-xs space-y-2">
            {/* Markers */}
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

            {/* Probability zones - show when enabled */}
            {showProbabilityZones && caseData?.lastSeenLatitude && (
              <>
                <div className="border-t border-slate-700/50 my-2 pt-2">
                  <span className="text-slate-500 font-medium">Search Zones</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/50 border border-red-500" />
                  <span className="text-slate-300">Priority (high prob.)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500" />
                  <span className="text-slate-300">Moderate</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-500/20 border border-indigo-500 border-dashed" />
                  <span className="text-slate-300">Extended</span>
                </div>
              </>
            )}

            {/* Resources - show when enabled */}
            {showResources && nearbyResources.length > 0 && (
              <>
                <div className="border-t border-slate-700/50 my-2 pt-2">
                  <span className="text-slate-500 font-medium">Resources</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏥</span>
                  <span className="text-slate-300">Vet</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏠</span>
                  <span className="text-slate-300">Shelter</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">🐾</span>
                  <span className="text-slate-300">Pet store</span>
                </div>
              </>
            )}
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
