'use client';

/**
 * MapTabV4 - Clean Full-Screen Map
 *
 * Features:
 * - Full-screen satellite map
 * - Case pins with photos
 * - Simple filter button (not overlay)
 * - Tap pin to see case details
 * - Clean, uncluttered design
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Filter,
  MapPin,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';

// ============================================================================
// Helper Functions - Must be defined before components to avoid hoisting issues
// ============================================================================

function getSpeciesEmoji(species) {
  const emojis = { DOG: '🐕', CAT: '🐈', BIRD: '🐦', RABBIT: '🐰', OTHER: '🐾' };
  return emojis[species] || '🐾';
}

function safeFormatTime(dateValue) {
  if (!dateValue) return null;
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    if (!isValid(date)) return null;
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return null;
  }
}

export default function MapTabV4({ cases, divisions, squad, membership, stats }) {
  const router = useRouter();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const cityBoundaryRef = useRef(null);
  const leafletRef = useRef(null);

  // UI State
  const [selectedCase, setSelectedCase] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('active'); // 'all', 'active', 'reunited'
  const [mapReady, setMapReady] = useState(false);

  // Filtered cases
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (filterStatus === 'active') {
        return c.status === 'ACTIVE' || c.status === 'IN_PROGRESS' || c.status === 'PENDING';
      }
      if (filterStatus === 'reunited') {
        return c.status === 'REUNITED';
      }
      return true; // all
    });
  }, [cases, filterStatus]);

  // Load Leaflet dynamically
  useEffect(() => {
    if (leafletRef.current) return;

    import('leaflet').then((L) => {
      import('leaflet/dist/leaflet.css');

      // Fix for default marker icons
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      });

      leafletRef.current = L;
      setMapReady(true);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    const L = leafletRef.current;
    if (!mapRef.current || mapInstanceRef.current || !L) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      attributionControl: false,
    }).setView([squad.centerLat || 41.8781, squad.centerLng || -87.6298], 13);

    // Satellite tiles
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(map);

    // Zoom control - top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [squad.centerLat, squad.centerLng, mapReady]);

  // Draw city boundary (subtle)
  useEffect(() => {
    const L = leafletRef.current;
    if (!mapInstanceRef.current || !squad.cityName || !L) return;

    const fetchBoundary = async () => {
      try {
        if (cityBoundaryRef.current) {
          cityBoundaryRef.current.remove();
          cityBoundaryRef.current = null;
        }

        const query = squad.state
          ? `${squad.cityName}, ${squad.state}, USA`
          : `${squad.cityName}, USA`;

        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&format=geojson&polygon_geojson=1&limit=1`);
        if (!res.ok) return;

        const data = await res.json();
        if (!data.features?.[0]?.geometry) return;

        cityBoundaryRef.current = L.geoJSON(data.features[0].geometry, {
          style: {
            color: '#3b82f6',
            weight: 2,
            opacity: 0.6,
            fillOpacity: 0.03,
          }
        }).addTo(mapInstanceRef.current);

        cityBoundaryRef.current.bringToBack();
      } catch (err) {
        console.error('Failed to fetch boundary:', err);
      }
    };

    fetchBoundary();

    return () => {
      if (cityBoundaryRef.current) {
        cityBoundaryRef.current.remove();
        cityBoundaryRef.current = null;
      }
    };
  }, [squad.cityName, squad.state]);

  // Update markers
  useEffect(() => {
    const L = leafletRef.current;
    if (!mapInstanceRef.current || !L) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Group by location
    const groups = new Map();
    filteredCases.forEach(c => {
      if (!c.lastSeenLat || !c.lastSeenLng) return;
      const key = `${c.lastSeenLat.toFixed(5)},${c.lastSeenLng.toFixed(5)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    });

    // Add markers
    groups.forEach((casesAtLoc) => {
      casesAtLoc.forEach((caseData, idx) => {
        // Offset overlapping
        let lat = caseData.lastSeenLat;
        let lng = caseData.lastSeenLng;
        if (idx > 0) {
          const angle = (idx * 45) * (Math.PI / 180);
          const radius = 0.0003;
          lat += Math.sin(angle) * radius;
          lng += Math.cos(angle) * radius;
        }

        // Marker color
        let color = '#ef4444';
        if (caseData.status === 'PENDING') color = '#f59e0b';
        if (caseData.status === 'REUNITED') color = '#10b981';

        const hasPhoto = caseData.photoUrl?.trim();
        const isUrgent = (() => {
          if (!caseData.lastSeenAt) return false;
          try {
            const date = typeof caseData.lastSeenAt === 'string' ? parseISO(caseData.lastSeenAt) : new Date(caseData.lastSeenAt);
            if (!isValid(date)) return false;
            return (Date.now() - date.getTime()) / 3600000 < 24;
          } catch {
            return false;
          }
        })();
        const emoji = getSpeciesEmoji(caseData.species);

        const icon = L.divIcon({
          className: 'map-marker',
          html: `
            <div style="
              width: 44px;
              height: 44px;
              background: ${color};
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              overflow: hidden;
              ${isUrgent ? 'animation: pulse 2s infinite;' : ''}
            ">
              ${hasPhoto
                ? `<img src="${caseData.photoUrl}" style="width:100%;height:100%;object-fit:cover;" />`
                : `<span style="font-size:20px;">${emoji}</span>`
              }
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);

        marker.on('click', () => {
          setSelectedCase(caseData);
        });

        markersRef.current.push(marker);
      });
    });
  }, [filteredCases]);

  const activeCount = cases.filter(c =>
    c.status === 'ACTIVE' || c.status === 'IN_PROGRESS' || c.status === 'PENDING'
  ).length;

  return (
    <div className="relative w-full h-full">
      {/* Map */}
      <div ref={mapRef} className="absolute inset-0" />

      {/* Filter Button - Top Left */}
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg
            ${showFilters ? 'bg-flash-500 text-slate-900' : 'bg-slate-900/90 text-white'}
            backdrop-blur-sm font-medium text-sm transition-all
          `}
        >
          <Filter size={16} />
          <span>{filterStatus === 'all' ? 'All Cases' : filterStatus === 'active' ? 'Active' : 'Reunited'}</span>
          <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">{filteredCases.length}</span>
        </button>

        {/* Filter Dropdown */}
        {showFilters && (
          <div className="absolute top-full left-0 mt-2 bg-slate-900/95 backdrop-blur-lg rounded-xl border border-slate-700/50 shadow-xl overflow-hidden min-w-[160px]">
            <FilterOption
              label="Active Cases"
              count={activeCount}
              selected={filterStatus === 'active'}
              onClick={() => { setFilterStatus('active'); setShowFilters(false); }}
              color="red"
            />
            <FilterOption
              label="Reunited"
              count={cases.filter(c => c.status === 'REUNITED').length}
              selected={filterStatus === 'reunited'}
              onClick={() => { setFilterStatus('reunited'); setShowFilters(false); }}
              color="green"
            />
            <FilterOption
              label="All Cases"
              count={cases.length}
              selected={filterStatus === 'all'}
              onClick={() => { setFilterStatus('all'); setShowFilters(false); }}
              color="blue"
            />
          </div>
        )}
      </div>

      {/* Stats Badge - Top Right (below zoom) */}
      <div className="absolute top-20 right-4 z-10">
        <div className="bg-slate-900/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white font-bold">{activeCount}</span>
            <span className="text-slate-400 text-xs">active</span>
          </div>
        </div>
      </div>

      {/* Selected Case Sheet */}
      {selectedCase && (
        <CaseSheet
          caseData={selectedCase}
          onClose={() => setSelectedCase(null)}
          onOpen={() => router.push(`/mission-control?mission=${selectedCase.caseNumber}`)}
        />
      )}

      {/* Styles */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .map-marker { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
      `}</style>
    </div>
  );
}

// ============================================================================
// Filter Option
// ============================================================================

function FilterOption({ label, count, selected, onClick, color }) {
  const colors = {
    red: 'bg-red-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
        ${selected ? 'bg-flash-500/20 text-flash-400' : 'text-white hover:bg-slate-800'}
      `}
    >
      <div className={`w-2 h-2 rounded-full ${colors[color]}`} />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="text-xs text-slate-400">{count}</span>
    </button>
  );
}

// ============================================================================
// Case Sheet
// ============================================================================

function CaseSheet({ caseData, onClose, onOpen }) {
  const emoji = getSpeciesEmoji(caseData.species);

  const statusColors = {
    PENDING: 'text-amber-400 bg-amber-500/20',
    IN_PROGRESS: 'text-red-400 bg-red-500/20',
    ACTIVE: 'text-red-400 bg-red-500/20',
    REUNITED: 'text-green-400 bg-green-500/20',
  };

  const statusLabels = {
    PENDING: 'Incoming',
    IN_PROGRESS: 'Active',
    ACTIVE: 'Active',
    REUNITED: 'Reunited',
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-20 md:pb-4">
      <div className="max-w-lg mx-auto bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[caseData.status]}`}>
            {statusLabels[caseData.status]}
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex gap-4 mb-4">
            {caseData.photoUrl ? (
              <img
                src={caseData.photoUrl}
                alt={caseData.petName}
                className="w-20 h-20 rounded-xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-slate-800 flex items-center justify-center text-3xl">
                {emoji}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-white mb-1">{caseData.petName}</h3>
              <p className="text-slate-400 text-sm mb-2">Case #{caseData.caseNumber}</p>
              <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                <MapPin size={14} />
                <span className="truncate">{caseData.lastSeenAddress || 'Unknown'}</span>
              </div>
            </div>
          </div>

          {safeFormatTime(caseData.lastSeenAt) && (
            <p className="text-slate-500 text-sm mb-4">
              Last seen {safeFormatTime(caseData.lastSeenAt)}
            </p>
          )}

          <button
            onClick={onOpen}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-flash-500 text-slate-900 font-bold rounded-xl hover:bg-flash-400 transition-colors"
          >
            Open Mission Control
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

