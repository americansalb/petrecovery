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
 *
 * `canLocate={false}` takes "Use my location" away, for a screen that
 * must not ask where the device is (the search screen on a desktop,
 * whose position is a guess from the network). `search={false}` hides
 * the search box, for a screen that already has the spot and offers
 * typing as a second way (the search screen's sighting form). `near`
 * is a point the typed search leans toward when there is no pin and no
 * device fix yet: on a pet's search, "W 41st St" means the one by the pet.
 * With `near`, the picker also offers to put the pin on a map by hand,
 * opened at that point: a phone with location turned off, whose street
 * lookup failed, still has a way to say where (2026-11-16).
 *
 * `maxAccuracy` (metres): a device reading rougher than this does not set
 * the pin. The sighting form passes the search's own rule
 * (app/lib/sightingLimits.js), so "Use my location" here holds to the same
 * limit as the reading the search screen takes itself.
 *
 * The typed search asks three geocoders and shows what answered, each
 * given a few seconds (app/lib/maps/placeLookup.js); when none answered it
 * says the lookup did not work, not that there was no match. Ways forward
 * are offered only where the person can take them: no "use your location"
 * once the browser has said location is off for the page.
 */

import { TILE_URL, tileLayerOptions } from '@/app/lib/maps/tiles';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useRef } from 'react';
import { searchBiasParams } from '@/app/lib/geo/searchBias';
import { Search, Loader2, Navigation, MapPin } from 'lucide-react';
import { searchAutocomplete, getPlaceFromAutocomplete } from '@/app/lib/maps/appleMapKit';
import { looksLikeCoordinates } from '@/app/lib/maps/reverseLabel';
import { lookUpPlaces, within } from '@/app/lib/maps/placeLookup';

/** The words for a phone's reading that is too rough to be a place, with the ways that are left. */
export function roughWords(canPin) {
  return `Your phone only gave a rough location. Type the street or the corner${canPin ? ', or put the pin on the map' : ''}.`;
}

/**
 * What the picker says under a typed search that found nothing, and the
 * ways forward the person can take from there: `failed` when no geocoder
 * answered at all, `placed` when a pin is already on the map, `canPin`
 * when a map can be opened to put one, `canLocate` when the device's
 * location can still be asked for.
 */
export function emptySearchWords({ failed = false, placed = false, canPin = false, canLocate = false } = {}) {
  const way = placed ? 'tap the map to move the pin yourself' : canPin ? 'put the pin on the map yourself' : canLocate ? 'use your location and drag the pin to the spot' : '';
  const start = failed ? 'Looking up the street did not work just now. Try again in a moment' : 'No matches for that search. Try a cross-street or a nearby landmark';
  return `${start}${way ? `, or ${way}` : ''}.`;
}

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

// The two lookups below throw when the geocoder does not answer (a 503, a rate limit, no signal), so the picker
// can tell that from an answer with no places in it.
async function searchWithNominatim(query, near = null) {
  // Biased toward where the person is, never fenced to one country: the
  // old countrycodes=us made a typed address useless outside the US.
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '8',
    addressdetails: '1',
    'accept-language': 'en',
    dedupe: '1',
    ...searchBiasParams({ near }),
  });
  const response = await fetch(`/api/geocode?${params.toString()}`);
  if (!response.ok) throw new Error(`The street lookup answered ${response.status}`);
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
}

async function searchWithPhoton(query, near) {
  const params = new URLSearchParams({ q: query, limit: '6', lang: 'en' });
  if (near?.lat && near?.lng) {
    params.append('lat', near.lat.toString());
    params.append('lon', near.lng.toString());
  }
  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
  if (!response.ok) throw new Error(`Photon answered ${response.status}`);
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
}

export default function LocationPicker({
  value,
  onChange,
  variant = 'lost',
  storageKey,
  onLocated, // (spot) after "Use my location" lands: the screen can move on by itself
  controlRef, // a ref the parent fills to call locate() from its own button
  canLocate = true, // false: never offer or ask for the device's position
  search = true, // false: no search box; the pin is placed from outside and can be dragged
  near: nearby = null, // { lat, lng }: where a typed search leans when nothing else says where, and where a map to pin on opens
  mapless = false, // true: the search box alone; the place is shown on a map the screen already has
  maxAccuracy = null, // metres: a device reading rougher than this does not set the pin
}) {
  const mapHex = variant === 'found' ? '#10b981' : '#ef4444';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);
  const [noResults, setNoResults] = useState(false);
  // No geocoder answered at all: "did not work just now", never "no matches".
  const [lookupFailed, setLookupFailed] = useState(false);
  // The browser has said location is off for this page: "Use my location" is not offered.
  const [locateDenied, setLocateDenied] = useState(false);
  // The map is open with no pin yet, for the pin to be put on it by hand.
  const [pinning, setPinning] = useState(false);
  const [savedOffer, setSavedOffer] = useState(null); // last confirmed spot, applied only on tap

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const leafletRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  // Each typed search is numbered: an answer for an older one is not shown over a newer one.
  const searchSeqRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onLocatedRef = useRef(onLocated);
  onLocatedRef.current = onLocated;
  const lastFixRef = useRef(null); // the last device fix, to bias a typed search before a pin exists

  const nearPoint = nearby && Number.isFinite(nearby.lat) && Number.isFinite(nearby.lng) ? { lat: nearby.lat, lng: nearby.lng } : null;
  // Putting the pin on by hand needs a map, and somewhere sensible to open it.
  const canPin = !mapless && Boolean(nearPoint);
  // Only what the person can do: no "Use my location" where it is never asked for, or the browser has said no.
  const offerLocate = canLocate && !locateDenied;

  // Whether the browser has already said no to location for this page. Asking this shows the person nothing.
  useEffect(() => {
    if (!canLocate || typeof navigator === 'undefined' || !navigator.permissions?.query) return undefined;
    let status = null;
    let gone = false;
    const read = () => {
      if (!gone && status) setLocateDenied(status.state === 'denied');
    };
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((answer) => {
        status = answer;
        read();
        answer.onchange = read;
      })
      .catch(() => {});
    return () => {
      gone = true;
      if (status) status.onchange = null;
    };
  }, [canLocate]);

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
      const spot = { lat, lng, address: knownAddress, city: cityGuess };
      onChangeRef.current(spot);
      return spot;
    }
    onChangeRef.current({ lat, lng, address: '', city: '' });
    const geo = await reverseGeocode(lat, lng);
    const spot = { lat, lng, address: geo.address, city: geo.city };
    onChangeRef.current(spot);
    return spot;
  };

  // The pin and its ring, made the first time there is a place to put them, then moved.
  const placeMarker = (center) => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng(center);
      circleRef.current?.setLatLng(center);
      return;
    }
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
  };

  // Map lifecycle - create once a position exists, or once the person asks to put the pin on by hand (opened at
  // `near`, with no pin until they tap), then keep the pin in sync.
  const pinStart = !value && pinning && nearPoint ? nearPoint : null;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const start = value ? [value.lat, value.lng] : pinStart ? [pinStart.lat, pinStart.lng] : null;
    if (!start) return;

    if (mapInstanceRef.current) {
      if (value) {
        mapInstanceRef.current.setView(start, mapInstanceRef.current.getZoom());
        placeMarker(start);
      }
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

      const map = L.map(mapRef.current, { zoomControl: false }).setView(start, value ? 17 : 16);
      mapInstanceRef.current = map;
      leafletRef.current = L;
      L.control.zoom({ position: 'topright' }).addTo(map);
      L.tileLayer(TILE_URL, tileLayerOptions()).addTo(map);
      if (value) placeMarker(start);

      // A tap puts the pin there, or moves it.
      map.on('click', (e) => {
        placeMarker([e.latlng.lat, e.latlng.lng]);
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
  }, [value?.lat, value?.lng, pinStart?.lat, pinStart?.lng]);

  // The place taken off from outside (the form cleared it): the pin leaves the map too, and the next one is made new.
  useEffect(() => {
    if (value || !markerRef.current) return;
    markerRef.current.remove();
    circleRef.current?.remove();
    markerRef.current = null;
    circleRef.current = null;
  }, [value]);

  // Destroy map on unmount only
  useEffect(
    () => () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        leafletRef.current = null;
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
    setLookupFailed(false);
    // Whatever was being looked up is for an older query now: its answer is not shown.
    searchSeqRef.current += 1;
    const seq = searchSeqRef.current;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!q.trim() || q.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      // An empty answer used to render NOTHING - no message, no spinner,
      // an unchanged panel - whether the address had no matches or every
      // geocoder was unreachable. A person in a panic reads that as "the
      // app is broken". Say which it is, and point at the by-hand path.
      const near = value ? { lat: value.lat, lng: value.lng } : lastFixRef.current || nearPoint;
      // Apple first, then Photon, then Nominatim, each given a few seconds: one that never answers holds nothing up.
      const { results: found, answered } = await lookUpPlaces([
        searchAutocomplete(q, { latitude: near?.lat, longitude: near?.lng, limit: 5 }),
        searchWithPhoton(q, near),
        searchWithNominatim(q, near),
      ]);
      if (seq !== searchSeqRef.current) return;
      setResults(found);
      setNoResults(found.length === 0 && answered);
      setLookupFailed(found.length === 0 && !answered);
      setIsSearching(false);
    }, 250);
  };

  const selectResult = async (result) => {
    // A search still being looked up is not shown over the place just picked.
    searchSeqRef.current += 1;
    setResults([]);
    setQuery('');
    setNoResults(false);
    setLookupFailed(false);
    setIsSearching(true);
    try {
      let { latitude: lat, longitude: lng } = result;
      let address = result.address || result.name;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const place = await within(getPlaceFromAutocomplete(result)).catch(() => null);
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

  // What is left to do when the device cannot say where it is: type, or put the pin on by hand where a map can open.
  const otherWays = canPin ? 'Type the street, or put the pin on the map.' : 'Type the street or a nearby landmark.';

  const useMyLocation = () => {
    setLocateError(null);
    if (!navigator.geolocation) {
      setLocateDenied(true);
      setLocateError(`This browser cannot share your location. ${otherWays}`);
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        // A rough fix still leans a typed search the right way.
        lastFixRef.current = { lat: latitude, lng: longitude };
        // Rougher than the screen allows is not a place (app/lib/sightingLimits.js): the pin is not set from it.
        if (Number.isFinite(maxAccuracy) && !(accuracy <= maxAccuracy)) {
          setIsLocating(false);
          setLocateError(roughWords(canPin));
          return;
        }
        const spot = await applyPosition(latitude, longitude);
        mapInstanceRef.current?.setView([latitude, longitude], 17);
        setIsLocating(false);
        onLocatedRef.current?.(spot);
      },
      (error) => {
        // Turned off for this page: the button is not offered again, and the screen says what still works.
        if (error?.code === 1) {
          setLocateDenied(true);
          setLocateError(`Location is turned off for this page. ${otherWays}`);
        } else {
          setLocateError(`Your phone could not say where it is just now. ${otherWays}`);
        }
        setIsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  if (controlRef) controlRef.current = { locate: useMyLocation };

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      {/* Search */}
      <div className={`relative z-30 shrink-0 ${search ? '' : 'hidden'}`}>
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-midnight-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          onKeyDown={(e) => {
            // Enter takes the first match; the list needed a click before.
            if (e.key === 'Enter' && results.length > 0) {
              e.preventDefault();
              selectResult(results[0]);
            }
          }}
          aria-label="Street, park or cross streets"
          enterKeyHint="search"
          placeholder="Street, park or cross streets"
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
                <p className="text-[13px] text-midnight-400 truncate">{result.address}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {(noResults || lookupFailed) && !isSearching && query.trim().length >= 2 && (
        <p className="shrink-0 -mt-1 text-sm text-midnight-600" role="status">
          {emptySearchWords({ failed: lookupFailed, placed: Boolean(value), canPin, canLocate: offerLocate })}
        </p>
      )}

      {/* Map / empty state */}
      <div className={`relative z-10 flex-1 min-h-[240px] rounded-2xl overflow-hidden border border-midnight-100 shadow-card ${mapless ? 'hidden' : ''}`}>
        <div ref={mapRef} className="absolute inset-0" />
        {!value && !pinning && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-midnight-50 to-midnight-100">
            <div className="text-center px-6 max-w-xs">
              <span className="w-14 h-14 rounded-full bg-white shadow-card flex items-center justify-center mx-auto mb-4">
                <MapPin size={26} className="text-midnight-400" />
              </span>
              <p className="font-bold text-midnight-900">Type the street above</p>
              {(offerLocate || canPin) && <p className="text-sm text-midnight-500 mt-1 mb-4">or</p>}
              {offerLocate && (
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={isLocating}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-midnight-900 text-white font-semibold shadow-lg hover:bg-midnight-800 transition-colors disabled:opacity-60"
                >
                  {isLocating ? <Loader2 size={17} className="animate-spin" /> : <Navigation size={17} />}
                  {isLocating ? 'Finding you…' : 'Use my location'}
                </button>
              )}
              {canPin && (
                // With location off and the street lookup down, this is still a way to say where.
                <button
                  type="button"
                  onClick={() => {
                    setLocateError(null);
                    setPinning(true);
                  }}
                  className={`${offerLocate ? 'mt-3' : ''} inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-midnight-200 text-sm font-semibold text-midnight-700 shadow-card hover:border-midnight-400 hover:text-midnight-900 transition-all`}
                >
                  <MapPin size={15} className="shrink-0" />
                  Put the pin on the map
                </button>
              )}
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
        {(value || pinning) && (
          <>
            <div className="absolute top-3 left-3 z-[500] px-3 py-1.5 rounded-full bg-midnight-900/85 text-white text-[13px] font-medium backdrop-blur pointer-events-none">
              {value ? 'Not the exact spot? Drag the pin.' : 'Tap the map to put the pin.'}
            </div>
            {offerLocate && (
              <button
                type="button"
                onClick={useMyLocation}
                disabled={isLocating}
                aria-label="Use my location"
                className="absolute bottom-3 right-3 z-[500] w-11 h-11 rounded-full bg-white shadow-card-hover flex items-center justify-center text-midnight-600 hover:text-midnight-900 transition-colors disabled:opacity-60"
              >
                {isLocating ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
              </button>
            )}
          </>
        )}
      </div>

      {locateError && <p className="shrink-0 text-sm text-red-600">{locateError}</p>}

      {/* Confirmed address */}
      {value && !mapless && (
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
