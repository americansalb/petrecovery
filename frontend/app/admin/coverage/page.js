'use client';

/**
 * Admin Coverage Map
 *
 * One map of everything local we can point owners at: areas with community
 * groups in the directory (navy circles sized by group count) and active
 * shelters (green dots). The empty stretches are the point — that's where to
 * pre-warm the group directory or grow shelter data next.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Map as MapIcon, RefreshCw } from 'lucide-react';

const GROUP_COLOR = '#0B1133';
const SHELTER_COLOR = '#15803d';

export default function AdminCoveragePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showGroups, setShowGroups] = useState(true);
  const [showShelters, setShowShelters] = useState(true);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const groupLayerRef = useRef(null);
  const shelterLayerRef = useRef(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin/coverage');
    } else if (session && session.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/coverage');
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Failed to load coverage');
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const buildMap = useCallback(async () => {
    if (!mapRef.current || !data) return;
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true }).setView(
        [39.5, -98.35],
        4
      );
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }
    const map = mapInstanceRef.current;

    if (groupLayerRef.current) groupLayerRef.current.remove();
    if (shelterLayerRef.current) shelterLayerRef.current.remove();

    const shelterLayer = L.layerGroup();
    for (const s of data.shelters || []) {
      L.circleMarker([s.latitude, s.longitude], {
        radius: 3,
        color: SHELTER_COLOR,
        fillColor: SHELTER_COLOR,
        fillOpacity: 0.55,
        weight: 1,
      })
        .bindPopup(`<strong>${escapeHtml(s.name)}</strong><br/>${escapeHtml(s.city || '')}, ${escapeHtml(s.state || '')}<br/>Shelter`)
        .addTo(shelterLayer);
    }
    shelterLayerRef.current = shelterLayer;

    const groupLayer = L.layerGroup();
    for (const a of data.areas || []) {
      L.circleMarker([a.lat, a.lng], {
        radius: Math.min(18, 7 + a.groups * 1.4),
        color: GROUP_COLOR,
        fillColor: GROUP_COLOR,
        fillOpacity: 0.35,
        weight: 2,
      })
        .bindPopup(
          `<strong>${escapeHtml(a.city)}, ${escapeHtml(a.state)}</strong><br/>` +
            `${a.groups} group${a.groups === 1 ? '' : 's'} (${a.lostPet} lost-pet, ${a.community} community)<br/>` +
            `${a.names.map(escapeHtml).join('<br/>')}`
        )
        .addTo(groupLayer);
    }
    groupLayerRef.current = groupLayer;

    if (showShelters) shelterLayer.addTo(map);
    if (showGroups) groupLayer.addTo(map);

    // Zoom to the data when there is any; the whole-US view is the empty state.
    const points = [
      ...(showGroups ? (data.areas || []).map((a) => [a.lat, a.lng]) : []),
      ...(showShelters ? (data.shelters || []).map((s) => [s.latitude, s.longitude]) : []),
    ];
    if (points.length > 0) map.fitBounds(L.latLngBounds(points).pad(0.25), { maxZoom: 9 });
  }, [data, showGroups, showShelters]);

  useEffect(() => {
    buildMap();
  }, [buildMap]);

  useEffect(
    () => () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    },
    []
  );

  if (status === 'loading' || session?.user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-2">
          <MapIcon className="w-7 h-7 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Coverage Map</h1>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Where we have local resources for owners, and where we don&apos;t. Empty regions are the next places
          to run a group search or grow shelter data.
        </p>

        <div className="flex flex-wrap items-center gap-4 bg-white rounded-lg shadow p-4 mb-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showGroups} onChange={(e) => setShowGroups(e.target.checked)} />
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: GROUP_COLOR }} />
            Group areas {data ? `(${(data.areas || []).length})` : ''}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showShelters} onChange={(e) => setShowShelters(e.target.checked)} />
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: SHELTER_COLOR }} />
            Shelters {data ? `(${(data.shelters || []).length})` : ''}
          </label>
          {data?.unmappedGroups > 0 && (
            <span className="text-xs text-gray-500">
              {data.unmappedGroups} group{data.unmappedGroups === 1 ? '' : 's'} without coordinates yet; re-run
              their city search to place them.
            </span>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div ref={mapRef} className="w-full" style={{ height: '70vh' }}>
            {!data && !error && (
              <div className="h-full flex items-center justify-center text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
