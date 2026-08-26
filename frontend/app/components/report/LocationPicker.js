'use client';

/**
 * LocationPicker - shared "where" step for both report wizards.
 *
 * Search-first: a three-geocoder autocomplete (Apple MapKit + Photon +
 * Nominatim via /api/geocode) plus an explicit "Use my location" button.
 * Geolocation is NEVER requested on mount - only on that tap. The map
 * appears once a spot is chosen, with a draggable pin and tap-to-move.
 *
 * Controlled: value = { lat, lng, address, city } | null. Every position
 * change (search pick, geolocate, pin drag, map tap) calls onChange with a
 * complete value object. With storageKey set, the last confirmed location is
 * restored on mount and kept in sync (legacy `reportLocation` shape).
 */

import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Navigation, MapPin } from 'lucide-react';
import { searchAutocomplete, getPlaceFromAutocomplete } from '@/app/lib/maps/appleMapKit';
import { looksLikeCoordinates } from '@/app/lib/maps/reverseLabel';

async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(`/api/geocode?lat=${lat}&lon=${lon}&addressdetails=1`);
    if (response.ok) {
      const data = await response.json();
      if (data?.display_name) {
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.municipality || '';
        return { address: data.display_name, city };
      }
    }
  } catch (err) {
    console.error('Geocode error:', err);
  }
  return { address: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, city: '' };
}

async function searchWithNominatim(query) {
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '8',
      addressdetails: '1',
      countrycodes: 'us',
      'accept-language': 'en',
      dedupe: '1',
    });
    const response = await fetch(`/api/geocode?${params.toString()}`);
    if (!response.ok) return [];
    const data = await response.json();

    return (Array.isArray(data) ? data : []).map((result) => {
      const addr = result.address || {};
      const parts = [];
      if (result.name && result.name !== addr.road) parts.push(result.name);
      const houseRoad = addr.house_number && addr.road ? `${addr.house_number} ${addr.road}` : addr.road;
      if (houseRoad && houseRoad !== result.name) parts.push(houseRoad);
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
      if (city) parts.push(city);
      if (addr.state) parts.push(addr.state);
      const displayName = parts.length > 0 ? parts.join(', ') : result.display_name;
      return {
        name: result.name || parts[0] || query,
        address: displayName,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
      };
    });
  } catch (err) {
    console.error('Nominatim search error:', err);
    return [];
  }
}

async function searchWithPhoton(query, near) {
  try {
    const params = new URLSearchParams({ q: query, limit: '6', lang: 'en' });
    if (near?.lat && near?.lng) {
      params.append('lat', near.lat.toString());
      params.append('lon', near.lng.toString());
    }
    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.features || [])
      .map((feature) => {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates || [];
        const parts = [];
        if (props.name) parts.push(props.name);
        if (props.housenumber && props.street) parts.push(`${props.housenumber} ${props.street}`);
        else if (props.street) parts.push(props.street);
        if (props.city || props.town || props.village) parts.push(props.city || props.town || props.village);
        if (props.state) parts.push(props.state);
        return {
          name: props.name || parts[0] || query,
          address: parts.join(', '),
          latitude: coords[1],
          longitude: coords[0],
        };
      })
      .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
  } catch (err) {
    console.error('Photon search error:', err);
    return [];
  }
}

export default function LocationPicker({ value, onChange, variant = 'lost', storageKey }) {
  const mapHex = variant === 'found' ? '#10b981' : '#ef4444';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);
  const [noResults, setNoResults] = useState(false);
  const [savedOffer, setSavedOffer] = useState(null); // last confirmed spot, applied only on tap

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Surface the last confirmed location as an OFFER (legacy `reportLocation`
  // shape) - never auto-apply it. A stale pin from a previous report that a
  // stressed user confirms without noticing is worse than one extra tap.
  useEffect(() => {
    if (!storageKey || value) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const [lat, lng] = parsed?.center || [];
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setSavedOffer({ lat, lng, address: parsed.address || '', city: parsed.city || '' });
        }
      }
    } catch (err) {
      console.error('Failed to read saved location:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist on change
  useEffect(() => {
    if (!storageKey || !value) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ center: [value.lat, value.lng], address: value.address, city: value.city, locked: true })
      );
    } catch {
      /* storage full/blocked - non-fatal */
    }
  }, [storageKey, value]);

  const applyPosition = async (lat, lng, knownAddress) => {
    if (knownAddress) {
      const cityGuess = (() => {
        const parts = knownAddress.split(',');
        return parts.length >= 2 ? parts[parts.length - 2]?.trim() : '';
      })();
      onChangeRef.current({ lat, lng, address: knownAddress, city: cityGuess });
    } else {
      onChangeRef.current({ lat, lng, address: '', city: '' });
      const geo = await reverseGeocode(lat, lng);
      onChangeRef.current({ lat, lng, address: geo.address, city: geo.city });
    }
  };

  // Map lifecycle - create once a position exists, then keep pin in sync
  useEffect(() => {
    if (typeof window === 'undefined' || !value) return;
    const center = [value.lat, value.lng];

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, mapInstanceRef.current.getZoom());
      markerRef.current?.setLatLng(center);
      circleRef.current?.setLatLng(center);
      return;
    }

    let cancelled = false;
    const initMap = async () => {
      const container = mapRef.current;
      if (!container) return;
      if (container.offsetHeight === 0) {
        setTimeout(initMap, 50);
        return;
      }
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: false }).setView(center, 17);
      mapInstanceRef.current = map;
      L.control.zoom({ position: 'topright' }).addTo(map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:32px;height:32px;background:${mapHex};border-radius:9999px;border:4px solid white;box-shadow:0 2px 8px rgba(15,23,42,0.35);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;background:white;border-radius:9999px;"></div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(center, { draggable: true, icon: markerIcon }).addTo(map);
      markerRef.current = marker;
      const circle = L.circle(center, {
        color: mapHex,
        fillColor: mapHex,
        fillOpacity: 0.1,
        weight: 2,
        radius: 50,
      }).addTo(map);
      circleRef.current = circle;

      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        circle.setLatLng(pos);
        applyPosition(pos.lat, pos.lng);
      });
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        applyPosition(e.latlng.lat, e.latlng.lng);
      });

      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 500);
    };
    initMap();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  // Destroy map on unmount only
  useEffect(
    () => () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    },
    []
  );

  const runSearch = (q) => {
    setQuery(q);
    setLocateError(null);
    setNoResults(false);
    if (!q.trim() || q.length < 2) {
      setResults([]);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      // An empty answer used to render NOTHING - no message, no spinner,
      // an unchanged panel - whether the address had no matches or every
      // geocoder was unreachable. A person in a panic reads that as "the
      // app is broken". Say so, and point at the by-hand path.
      let found = [];
      try {
        const near = value ? { lat: value.lat, lng: value.lng } : null;
        const [photonResults, nominatimResults, appleResults] = await Promise.allSettled([
          searchWithPhoton(q, near),
          searchWithNominatim(q),
          searchAutocomplete(q, {
            latitude: near?.lat,
            longitude: near?.lng,
            limit: 5,
          }).catch(() => []),
        ]);

        let merged = [];
        if (appleResults.status === 'fulfilled' && appleResults.value?.length > 0) {
          merged = [...appleResults.value];
        }
        const seen = new Set(merged.map((r) => `${r.latitude?.toFixed(4)},${r.longitude?.toFixed(4)}`));
        for (const source of [photonResults, nominatimResults]) {
          if (source.status !== 'fulfilled') continue;
          for (const r of source.value || []) {
            const key = `${r.latitude?.toFixed(4)},${r.longitude?.toFixed(4)}`;
            if (!seen.has(key) && merged.length < 8) {
              merged.push(r);
              seen.add(key);
            }
          }
        }
        found = merged.slice(0, 8);
      } catch (err) {
        console.error('Search error:', err);
        found = await searchWithNominatim(q).catch(() => []);
      } finally {
        setResults(found);
        setNoResults(found.length === 0);
        setIsSearching(false);
      }
    }, 250);
  };

  const selectResult = async (result) => {
    setResults([]);
    setQuery('');
    setNoResults(false);
    setIsSearching(true);
    try {
      let { latitude: lat, longitude: lng } = result;
      let address = result.address || result.name;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const place = await getPlaceFromAutocomplete(result);
        if (place?.latitude && place?.longitude) {
          lat = place.latitude;
          lng = place.longitude;
          address = place.address || result.address;
        }
      }
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        await applyPosition(lat, lng, address);
        mapInstanceRef.current?.setView([lat, lng], 17);
      }
    } catch (err) {
      console.error('Error selecting result:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const useMyLocation = () => {
    setLocateError(null);
    if (!navigator.geolocation) {
      setLocateError("Your browser can't share location - try searching instead.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await applyPosition(latitude, longitude);
        mapInstanceRef.current?.setView([latitude, longitude], 17);
        setIsLocating(false);
      },
      () => {
        setLocateError("Couldn't get your location - try searching for the address instead.");
        setIsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      {/* Search */}
      <div className="relative z-30 shrink-0">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-midnight-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Search an address, park, or cross-streets…"
          className="w-full pl-10 pr-10 py-3.5 bg-white border-2 border-midnight-100 rounded-2xl outline-none transition-colors focus:border-flash-400 focus:ring-2 focus:ring-flash-100"
        />
        {isSearching && (
          <Loader2 size={17} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-midnight-400 animate-spin" />
        )}
        {results.length > 0 && (
          <div className="absolute top-full inset-x-0 mt-1.5 bg-white border border-midnight-100 rounded-2xl shadow-card-hover z-50 max-h-64 overflow-y-auto">
            {results.map((result, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectResult(result)}
                className="w-full px-4 py-3 text-left hover:bg-midnight-50 border-b border-midnight-100 last:border-0 transition-colors"
              >
                <p className="font-semibold text-sm text-midnight-900 truncate">{result.name}</p>
                <p className="text-xs text-midnight-400 truncate">{result.address}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {noResults && !isSearching && query.trim().length >= 2 && (
        <p className="shrink-0 -mt-1 text-sm text-midnight-600">
          No matches for that search. Try a cross-street or a nearby landmark,
          {value
            ? ' or tap the map to move the pin yourself.'
            : " or tap 'Use my location' below and drag the pin to the spot."}
        </p>
      )}

      {/* Map / empty state */}
      <div className="relative z-10 flex-1 min-h-[240px] rounded-2xl overflow-hidden border border-midnight-100 shadow-card">
        <div ref={mapRef} className="absolute inset-0" />
        {!value && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-midnight-50 to-midnight-100">
            <div className="text-center px-6 max-w-xs">
              <span className="w-14 h-14 rounded-full bg-white shadow-card flex items-center justify-center mx-auto mb-4">
                <MapPin size={26} className="text-midnight-400" />
              </span>
              <p className="font-bold text-midnight-900">Search above to drop a pin</p>
              <p className="text-sm text-midnight-500 mt-1 mb-4">or</p>
              <button
                type="button"
                onClick={useMyLocation}
                disabled={isLocating}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-midnight-900 text-white font-semibold shadow-lg hover:bg-midnight-800 transition-colors disabled:opacity-60"
              >
                {isLocating ? <Loader2 size={17} className="animate-spin" /> : <Navigation size={17} />}
                {isLocating ? 'Finding you…' : 'Use my location'}
              </button>
              {savedOffer && (
                <button
                  type="button"
                  onClick={() => onChangeRef.current(savedOffer)}
                  className="mt-3 inline-flex items-center gap-2 max-w-full px-4 py-2.5 rounded-full bg-white border border-midnight-200 text-sm font-medium text-midnight-600 shadow-card hover:border-midnight-400 hover:text-midnight-900 transition-all"
                >
                  <MapPin size={14} className="shrink-0" />
                  <span className="truncate">
                    Use your last spot: {savedOffer.city || savedOffer.address}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
        {value && (
          <>
            <div className="absolute top-3 left-3 z-[500] px-3 py-1.5 rounded-full bg-midnight-900/85 text-white text-xs font-medium backdrop-blur pointer-events-none">
              Drag the pin to the exact spot
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={isLocating}
              aria-label="Use my location"
              className="absolute bottom-3 right-3 z-[500] w-11 h-11 rounded-full bg-white shadow-card-hover flex items-center justify-center text-midnight-600 hover:text-midnight-900 transition-colors disabled:opacity-60"
            >
              {isLocating ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
            </button>
          </>
        )}
      </div>

      {locateError && <p className="shrink-0 text-sm text-red-600">{locateError}</p>}

      {/* Confirmed address */}
      {value && (
        <div className="shrink-0 flex items-center gap-3 p-3.5 rounded-2xl bg-midnight-50 border border-midnight-100">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${mapHex}1a` }}
          >
            <MapPin size={16} style={{ color: mapHex }} />
          </span>
          <p className="text-sm text-midnight-700 truncate">
            {value.address && !looksLikeCoordinates(value.address)
              ? value.address
              : 'Pinned on the map - drag the pin to adjust'}
          </p>
        </div>
      )}
    </div>
  );
}
