'use client';

/**
 * Report Lost Pet - Beautiful Step-by-Step Wizard
 *
 * Modern, clean design with one focus per screen
 */

import { useState, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import {
  Dog, Cat, Bird, Rabbit, MapPin, Clock,
  Camera, Check, ChevronLeft, ChevronRight,
  AlertTriangle, Loader2, X, Navigation, ExternalLink,
  Sparkles, Heart, Mail, User, Search, Home, Trees, Phone
} from 'lucide-react';
import ColorSelector from '../../components/ColorSelector';
import { SARAMA_AVATAR } from '@/lib/brandAssets';
import { searchAutocomplete, getPlaceFromAutocomplete } from '@/app/lib/maps/appleMapKit';

const PET_TYPES = [
  { type: 'dog', label: 'Dog', icon: Dog, emoji: '🐕' },
  { type: 'cat', label: 'Cat', icon: Cat, emoji: '🐈' },
  { type: 'bird', label: 'Bird', icon: Bird, emoji: '🦜' },
  { type: 'other', label: 'Other', icon: Rabbit, emoji: '🐰' },
];

// Size options - different for dogs vs cats
const DOG_SIZE_OPTIONS = [
  { value: 'TINY', label: 'Tiny', sublabel: 'Under 10 lbs', example: 'Chihuahua, Yorkie' },
  { value: 'SMALL', label: 'Small', sublabel: '10-25 lbs', example: 'Beagle, Pug' },
  { value: 'MEDIUM', label: 'Medium', sublabel: '25-60 lbs', example: 'Border Collie, Bulldog' },
  { value: 'LARGE', label: 'Large', sublabel: '60-90 lbs', example: 'Lab, Golden Retriever' },
  { value: 'GIANT', label: 'Giant', sublabel: 'Over 90 lbs', example: 'Great Dane, Mastiff' },
];

const CAT_LIVING_OPTIONS = [
  { value: 'indoor', label: 'Indoor Only', sublabel: 'Never goes outside', icon: Home },
  { value: 'outdoor', label: 'Goes Outside', sublabel: 'Has outdoor access', icon: Trees },
];

const TIME_OPTIONS = [
  { value: 'less_than_hour', label: 'Just now', sublabel: 'Less than an hour', urgent: true },
  { value: '1_to_6_hours', label: 'Few hours', sublabel: '1-6 hours ago', urgent: true },
  { value: '6_to_24_hours', label: 'Today', sublabel: '6-24 hours ago', urgent: false },
  { value: '1_to_3_days', label: 'Few days', sublabel: '1-3 days ago', urgent: false },
  { value: '3_to_7_days', label: 'This week', sublabel: '3-7 days ago', urgent: false },
  { value: 'more_than_2_weeks', label: 'Longer', sublabel: 'More than a week', urgent: false },
];

export default function ReportLostPet() {
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = authStatus === 'authenticated';

  // Wizard state - everyone starts at step 1 (location first for engagement)
  const [step, setStep] = useState(1); // 1=location, 2=pet, 3=name, 4=details, 5=when, 6=color, 7=photo, 8=contact (if not logged in), 9=confirm
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reportResult, setReportResult] = useState(null);

  // Contact info (for non-logged-in users)
  const [contactEmail, setContactEmail] = useState('');
  const [contactEmailConfirm, setContactEmailConfirm] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPhoneConfirm, setContactPhoneConfirm] = useState('');
  const [contactName, setContactName] = useState('');
  const [createAccount, setCreateAccount] = useState(true); // Always create account for reporters
  const [password, setPassword] = useState('');

  // Data state
  const [center, setCenter] = useState(null);
  const [detectedLocation, setDetectedLocation] = useState(null); // Browser GPS at time of report [lat, lon]
  const [locationDenied, setLocationDenied] = useState(false); // true if user denied geolocation permission
  const [locationAccuracy, setLocationAccuracy] = useState(null); // GPS accuracy in meters
  const [lastSeenAddress, setLastSeenAddress] = useState('');
  const [cityName, setCityName] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(true);
  const [locationLocked, setLocationLocked] = useState(false); // Once user confirms location, lock it
  const [myPets, setMyPets] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [petType, setPetType] = useState('');
  const [petName, setPetName] = useState('');
  const [petSize, setPetSize] = useState(''); // For dogs: TINY, SMALL, MEDIUM, LARGE, GIANT
  const [isIndoorCat, setIsIndoorCat] = useState(null); // For cats: true = indoor only, false = goes outside
  const [timeElapsed, setTimeElapsed] = useState('');
  const [color, setColor] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load saved location from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('reportLocation');
      if (saved) {
        const { center: savedCenter, address, city, locked } = JSON.parse(saved);
        if (savedCenter && locked) {
          setCenter(savedCenter);
          setLastSeenAddress(address || '');
          setCityName(city || '');
          setLocationLocked(true);
          setIsGettingLocation(false);
        }
      }
    } catch (e) {
      console.error('Failed to load saved location:', e);
    }
  }, []);

  // Save location to localStorage when locked
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (locationLocked && center) {
      localStorage.setItem('reportLocation', JSON.stringify({
        center,
        address: lastSeenAddress,
        city: cityName,
        locked: true
      }));
    }
  }, [locationLocked, center, lastSeenAddress, cityName]);

  // Map refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const watchIdRef = useRef(null); // GPS watchPosition ID

  // Unique session ID for this wizard visit (persists across re-detections)
  const wizardSessionId = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  const locationLogIdRef = useRef(null); // ID of the latest location log entry

  // Fire-and-forget: log a GPS detection to the server
  const logLocationDetection = (lat, lon, accuracy, address, city) => {
    fetch('/api/location-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        accuracy,
        address,
        city,
        sessionId: wizardSessionId.current,
      }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.id) locationLogIdRef.current = data.id; })
      .catch(() => {}); // Silent fail — don't block the wizard
  };

  // Everyone starts at step 1 (location) for better engagement
  // Only set on initial load, not when auth changes mid-flow (e.g. auto-login after submit)
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      setStep(1);
    }
  }, [authStatus]);

  // Get effective contact info
  const effectiveEmail = isLoggedIn ? session?.user?.email : contactEmail;
  const effectiveName = isLoggedIn ? (session?.user?.name || 'Pet Owner') : contactName;
  const effectivePhone = isLoggedIn ? '' : contactPhone;

  // Fetch user's pets
  useEffect(() => {
    if (session?.user) {
      fetch('/api/pets')
        .then(res => res.ok ? res.json() : { pets: [] })
        .then(data => setMyPets(data.pets || []))
        .catch(() => setMyPets([]));
    }
  }, [session]);

  // Pre-load Leaflet CSS on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!document.getElementById('leaflet-css')) {
      const leafletCSS = document.createElement('link');
      leafletCSS.id = 'leaflet-css';
      leafletCSS.rel = 'stylesheet';
      leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(leafletCSS);
    }
  }, []);

  // Auto-detect location via GPS - uses watchPosition for progressive accuracy
  // On mobile, first reading is often cell-tower (1-10km accuracy).
  // watchPosition keeps refining until GPS lock (~10-50m accuracy).
  const detectLocation = async () => {
    if (locationLocked) return;

    // Clear any previous watch
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsGettingLocation(true);
    setLocationDenied(false);
    setLocationAccuracy(null);

    if (!navigator.geolocation) {
      setIsGettingLocation(false);
      setLocationDenied(true);
      return;
    }

    let bestAccuracy = Infinity;
    let settled = false; // true once we have a good-enough reading

    const onPosition = async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      console.log('[Location] Got position, accuracy:', Math.round(accuracy), 'm');

      // Only update if this reading is more accurate than what we have
      if (accuracy < bestAccuracy) {
        bestAccuracy = accuracy;
        setCenter([latitude, longitude]);
        setDetectedLocation([latitude, longitude]);
        setLocationAccuracy(Math.round(accuracy));
        setLocationDenied(false);

        const result = await reverseGeocode(latitude, longitude);
        setLastSeenAddress(result.address);
        setCityName(result.city);
        setIsGettingLocation(false); // Show the map as soon as we have any reading

        // Log this detection to the server (fire-and-forget)
        logLocationDetection(latitude, longitude, Math.round(accuracy), result.address, result.city);
      }

      // Stop watching once we have good GPS accuracy (<150m)
      if (accuracy < 150 && !settled) {
        settled = true;
        if (watchIdRef.current != null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      }
    };

    const onError = (err) => {
      console.error('[Location] Geolocation error:', err.code, err.message);
      // Only show denied state if we never got any reading
      if (bestAccuracy === Infinity) {
        setIsGettingLocation(false);
        setLocationDenied(true);
      }
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      onError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    // Safety: stop watching after 25 seconds no matter what
    setTimeout(() => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      // If we never got any position, show denied
      if (bestAccuracy === Infinity) {
        setIsGettingLocation(false);
        setLocationDenied(true);
      }
    }, 25000);
  };

  // Cleanup watchPosition on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Only auto-detect if no saved location
    if (!locationLocked && !center) {
      detectLocation();
    }
  }, [locationLocked]);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !center || step !== 1) return;

    // If map already exists, just update marker position (preserve zoom level)
    if (mapInstanceRef.current) {
      const currentZoom = mapInstanceRef.current.getZoom();
      mapInstanceRef.current.setView(center, currentZoom);
      if (markerRef.current) markerRef.current.setLatLng(center);
      if (circleRef.current) circleRef.current.setLatLng(center);
      return;
    }

    const initMap = async () => {
      // Wait for container to be rendered
      const container = mapRef.current;
      if (!container || container.offsetHeight === 0) {
        setTimeout(initMap, 50);
        return;
      }

      const L = (await import('leaflet')).default;

      // Double-check container still exists and map not already created
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: false }).setView(center, 17);
      mapInstanceRef.current = map;

      L.control.zoom({ position: 'topright' }).addTo(map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="w-8 h-8 bg-red-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
          <div class="w-2 h-2 bg-white rounded-full"></div>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(center, { draggable: true, icon: markerIcon }).addTo(map);
      markerRef.current = marker;

      const circle = L.circle(center, {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.1,
        weight: 2,
        radius: 50, // 50 meter radius
      }).addTo(map);
      circleRef.current = circle;

      marker.on('dragend', async (e) => {
        const pos = e.target.getLatLng();
        setCenter([pos.lat, pos.lng]);
        setLocationLocked(true); // Lock location after manual adjustment
        circle.setLatLng(pos);
        const result = await reverseGeocode(pos.lat, pos.lng);
        setLastSeenAddress(result.address);
        setCityName(result.city);
      });

      map.on('click', async (e) => {
        const pos = e.latlng;
        setCenter([pos.lat, pos.lng]);
        setLocationLocked(true); // Lock location after manual selection
        marker.setLatLng(pos);
        circle.setLatLng(pos);
        const result = await reverseGeocode(pos.lat, pos.lng);
        setLastSeenAddress(result.address);
        setCityName(result.city);
      });

      setTimeout(() => map.invalidateSize(), 100);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center, step]);

  const reverseGeocode = async (lat, lon) => {
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
  };

  // Debounce search
  const searchTimeoutRef = useRef(null);

  // Fallback to Nominatim (OpenStreetMap) for autocomplete
  // Uses structured query parameters for better results
  const searchWithNominatim = async (query) => {
    try {
      // Try structured search first for better address matching
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

      return (Array.isArray(data) ? data : []).map(result => {
        // Build a cleaner display name
        const addr = result.address || {};
        const parts = [];

        // Add place name if different from road
        if (result.name && result.name !== addr.road) {
          parts.push(result.name);
        }

        // Add house number and road
        if (addr.house_number && addr.road) {
          parts.push(`${addr.house_number} ${addr.road}`);
        } else if (addr.road) {
          parts.push(addr.road);
        }

        // Add city
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
        if (city) parts.push(city);

        // Add state
        if (addr.state) parts.push(addr.state);

        const displayName = parts.length > 0 ? parts.join(', ') : result.display_name;

        return {
          name: result.name || parts[0] || query,
          address: displayName,
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          _source: 'nominatim',
          _type: result.type,
          _class: result.class,
        };
      });
    } catch (err) {
      console.error('Nominatim search error:', err);
      return [];
    }
  };

  // Photon geocoder (komoot) - often better for POI/business search
  const searchWithPhoton = async (query) => {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '6',
        lang: 'en',
      });
      // Bias toward user's location if available
      if (center?.[0] && center?.[1]) {
        params.append('lat', center[0].toString());
        params.append('lon', center[1].toString());
      }

      const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
      if (!response.ok) return [];
      const data = await response.json();

      return (data.features || []).map(feature => {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates || [];

        // Build display name
        const parts = [];
        if (props.name) parts.push(props.name);
        if (props.housenumber && props.street) {
          parts.push(`${props.housenumber} ${props.street}`);
        } else if (props.street) {
          parts.push(props.street);
        }
        if (props.city || props.town || props.village) {
          parts.push(props.city || props.town || props.village);
        }
        if (props.state) parts.push(props.state);

        return {
          name: props.name || parts[0] || query,
          address: parts.join(', '),
          latitude: coords[1],
          longitude: coords[0],
          _source: 'photon',
          _type: props.osm_value,
        };
      }).filter(r => r.latitude && r.longitude);
    } catch (err) {
      console.error('Photon search error:', err);
      return [];
    }
  };

  const searchAddress = async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    // Debounce: clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Wait 250ms before searching
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Use multiple geocoding services in parallel for best results
        const [photonResults, nominatimResults, appleResults] = await Promise.allSettled([
          searchWithPhoton(query),
          searchWithNominatim(query),
          searchAutocomplete(query, {
            latitude: center?.[0],
            longitude: center?.[1],
            limit: 5
          }).catch(() => []),
        ]);

        // Combine results, prioritizing Apple > Photon > Nominatim
        let results = [];

        // Add Apple results first (if any)
        if (appleResults.status === 'fulfilled' && appleResults.value?.length > 0) {
          results = [...appleResults.value];
        }

        // Add Photon results
        if (photonResults.status === 'fulfilled' && photonResults.value?.length > 0) {
          // Avoid duplicates by checking coordinates
          const existing = new Set(results.map(r => `${r.latitude?.toFixed(4)},${r.longitude?.toFixed(4)}`));
          for (const r of photonResults.value) {
            const key = `${r.latitude?.toFixed(4)},${r.longitude?.toFixed(4)}`;
            if (!existing.has(key)) {
              results.push(r);
              existing.add(key);
            }
          }
        }

        // Add Nominatim results if we still don't have enough
        if (results.length < 5 && nominatimResults.status === 'fulfilled' && nominatimResults.value?.length > 0) {
          const existing = new Set(results.map(r => `${r.latitude?.toFixed(4)},${r.longitude?.toFixed(4)}`));
          for (const r of nominatimResults.value) {
            const key = `${r.latitude?.toFixed(4)},${r.longitude?.toFixed(4)}`;
            if (!existing.has(key) && results.length < 8) {
              results.push(r);
              existing.add(key);
            }
          }
        }

        setSearchResults(results.slice(0, 8));
      } catch (err) {
        console.error('Search error:', err);
        // Last resort: try Nominatim directly
        try {
          const fallbackResults = await searchWithNominatim(query);
          setSearchResults(fallbackResults);
        } catch {
          setSearchResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);
  };

  const selectSearchResult = async (result) => {
    setIsSearching(true);
    setSearchResults([]);
    setAddressSearch('');

    try {
      let lat, lon, address;

      // If result already has coordinates (from Nominatim or Apple autocomplete with coords)
      if (result.latitude && result.longitude) {
        lat = result.latitude;
        lon = result.longitude;
        address = result.address || result.name;
      } else {
        // Get full place details from Apple Maps (for results without coords)
        const place = await getPlaceFromAutocomplete(result);
        if (place && place.latitude && place.longitude) {
          lat = place.latitude;
          lon = place.longitude;
          address = place.address || result.address;
        }
      }

      if (lat && lon) {
        setCenter([lat, lon]);
        setLocationLocked(true); // Lock location after search selection
        setLastSeenAddress(address);

        // Extract city from address
        const addressParts = (address || '').split(',');
        const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2]?.trim() : '';
        setCityName(city);

        // Update map if it exists
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lon], 17);
          if (markerRef.current) markerRef.current.setLatLng([lat, lon]);
          if (circleRef.current) circleRef.current.setLatLng([lat, lon]);
        }
      }
    } catch (err) {
      console.error('Error selecting result:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const openInMaps = () => {
    const lat = center?.[0] || 0;
    const lng = center?.[1] || 0;
    const isApple = /iPad|iPhone|iPod|Mac/.test(navigator.userAgent);
    if (isApple) {
      window.open(`https://maps.apple.com/?ll=${lat},${lng}&q=Last%20Seen&z=17`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    }
  };

  const handleSelectPet = (pet) => {
    setSelectedPet(pet);
    const typeMap = { 'DOG': 'dog', 'CAT': 'cat', 'BIRD': 'bird' };
    const species = typeMap[pet.species] || 'other';
    setPetType(species);
    setPetName(pet.name);
    setColor(pet.color || '');
    if (pet.primaryPhotoUrl) setPhotos([pet.primaryPhotoUrl]);
    // Set size/indoor from existing pet data if available
    if (species === 'dog' && pet.size) {
      setPetSize(pet.size);
    }
    if (species === 'cat' && pet.isIndoor !== undefined && pet.isIndoor !== null) {
      setIsIndoorCat(pet.isIndoor);
    }
    setStep(5); // Skip name and pet details steps since we have that info
  };

  const handleSelectPetType = (type) => {
    setSelectedPet(null);
    setPetType(type);
    setPetName('');
    setPetSize('');
    setIsIndoorCat(null);
    setColor('');
    setPhotos([]);
    setStep(3); // Go to name step
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Photo must be under 10MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', 'pet');
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        if (data.url) setPhotos([data.url]);
      }
    } catch (err) {
      setError('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    // Validate required fields before submission
    const hasContact = effectiveEmail || effectivePhone;
    if (!hasContact || !effectiveName || !petName || !color || !lastSeenAddress || !center) {
      const missing = [];
      if (!hasContact) missing.push('email or phone');
      if (!effectiveName) missing.push('name');
      if (!petName) missing.push('pet name');
      if (!color) missing.push('color');
      if (!lastSeenAddress) missing.push('location');
      if (!center) missing.push('map location');
      setError(`Please provide: ${missing.join(', ')}`);
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: effectiveEmail,
          phone: effectivePhone,
          firstName: effectiveName,
          petName,
          color,
          lastSeenAddress,
          center,
          radiusMiles: 0.1,
          timeElapsed,
          petType: petType.toUpperCase(),
          petSize: petType === 'dog' ? petSize : undefined,
          isIndoorCat: petType === 'cat' ? isIndoorCat : undefined,
          photos,
          locationType: 'address',
          cityName,
          selectedPetId: selectedPet?.id,
          detectedLocation, // Browser GPS at time of report [lat, lon]
          locationLogSessionId: wizardSessionId.current, // Link to location detection logs
          createAccount: !isLoggedIn && createAccount,
          password: !isLoggedIn && createAccount ? password : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create report');

      // Clear saved location for fresh start on next report
      localStorage.removeItem('reportLocation');

      // Auto-login if account was created with password
      if (data.accountCreated && createAccount && password && effectiveEmail) {
        try {
          await signIn('credentials', {
            email: effectiveEmail,
            password: password,
            redirect: false,
          });
        } catch (e) {
          // Sign-in failed silently - user can login manually later
          console.error('Auto-login failed:', e);
        }
      }

      setReportResult(data);
      setStep(10); // Success step
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const canProceed = () => {
    switch (step) {
      case 1: return !!center && !!detectedLocation;
      case 2: return !!petType;
      case 3: return !!petName.trim();
      case 4: // Pet details - size for dogs, indoor/outdoor for cats
        if (petType === 'dog') return !!petSize;
        if (petType === 'cat') return isIndoorCat !== null;
        return true; // Birds/other skip this step
      case 5: return !!timeElapsed;
      case 6: return !!color;
      case 7: return !uploadingPhoto; // Photo is optional but must finish uploading first
      case 8: { // Contact info - only for non-logged-in users
        if (isLoggedIn) return true; // Skip validation for logged-in users
        // Name is required
        if (!contactName.trim()) return false;
        // At least one contact method required
        const hasEmail = contactEmail.trim() && isValidEmail(contactEmail);
        const hasPhone = contactPhone.trim() && contactPhone.replace(/\D/g, '').length >= 10;
        if (!hasEmail && !hasPhone) return false;
        // If email provided, confirmation must match
        if (hasEmail && contactEmail !== contactEmailConfirm) return false;
        // If phone provided, confirmation must match
        if (hasPhone && contactPhone !== contactPhoneConfirm) return false;
        // Password is required (always creating account)
        if (password.length < 8) return false;
        return true;
      }
      case 9: return true; // Review step
      default: return false;
    }
  };

  const totalSteps = isLoggedIn ? 8 : 9; // Logged-in users skip contact step
  const displayStep = step; // Step number as-is

  const nextStep = () => {
    // For birds/other, skip the pet details step (step 4)
    if (step === 3 && petType !== 'dog' && petType !== 'cat') {
      setStep(5); // Skip to "when" step
      return;
    }
    // For logged-in users, skip the contact step (step 8)
    if (step === 7 && isLoggedIn) {
      setStep(9); // Skip to review step
      return;
    }
    if (canProceed() && step < 9) setStep(step + 1);
    if (step === 9) handleSubmit();
  };

  const prevStep = () => {
    const minStep = 1; // Everyone starts at location now
    if (step > minStep) {
      // If we came from selecting existing pet, go back to step 2
      if (step === 5 && selectedPet) {
        setStep(2);
      // For birds/other, skip back over the pet details step
      } else if (step === 5 && petType !== 'dog' && petType !== 'cat') {
        setStep(3);
      // For logged-in users, skip back over the contact step
      } else if (step === 9 && isLoggedIn) {
        setStep(7);
      } else {
        setStep(step - 1);
      }
    }
  };

  // Loading state while checking auth
  if (authStatus === 'loading') {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <img
            src={SARAMA_AVATAR}
            alt="Sarama"
            className="w-16 h-16 mx-auto mb-4 animate-pulse"
          />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (step === 10 && reportResult) {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center max-w-md w-full">
            {/* Success Icon */}
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-200">
                <Check size={40} className="text-white" strokeWidth={3} />
              </div>
              <Sparkles className="absolute -top-1 -right-1 text-yellow-400" size={20} />
              <Sparkles className="absolute -bottom-0 -left-2 text-green-400" size={16} />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">Alert Sent!</h1>

            {/* Case Number Badge */}
            {reportResult.caseNumber && (
              <div className="inline-block bg-gray-100 px-4 py-2 rounded-lg mb-4">
                <span className="text-sm text-gray-500">Case Number: </span>
                <span className="font-mono font-bold text-gray-800">{reportResult.caseNumber}</span>
              </div>
            )}

            <p className="text-gray-600 mb-6">
              {reportResult.squadsNotified || 0} rescue team{reportResult.squadsNotified === 1 ? '' : 's'} notified for <strong>{reportResult.petName || petName}</strong>
            </p>

            {/* Account Created Notice */}
            {reportResult.accountCreated && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-start gap-3">
                  <Mail size={20} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-blue-800">Account created!</p>
                    <p className="text-sm text-blue-600">
                      {createAccount
                        ? "You can now log in with your email and password to track your case."
                        : "Check your email for login details to track sightings and manage your case."
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Squad Joined Notice */}
            {reportResult.assignedSquad && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-start gap-3">
                  <Heart size={20} className="text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-800">You've joined {reportResult.assignedSquad.name}!</p>
                    <p className="text-sm text-green-600">
                      Your neighbors are ready to help search. Coordinate with them on the squad dashboard.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* What Happens Next */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-gray-800 mb-3">What happens next:</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-emerald-600 text-sm font-bold">1</span>
                  </div>
                  <p className="text-gray-600 text-sm">Volunteers in your area are being notified now</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-emerald-600 text-sm font-bold">2</span>
                  </div>
                  <p className="text-gray-600 text-sm">You'll get an email/text when someone spots your pet</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-emerald-600 text-sm font-bold">3</span>
                  </div>
                  <p className="text-gray-600 text-sm">View your case page to coordinate with your search team</p>
                </div>
              </div>
            </div>

            {/* Primary CTA - View Case */}
            <Link
              href={`/cases/${reportResult.caseNumber}`}
              className="block w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-green-200 hover:shadow-xl transition-all mb-3"
            >
              View Your Case Page
            </Link>

            {/* Squad CTA - if assigned to squad */}
            {reportResult.assignedSquad && (
              <Link
                href={`/rescue-squads/${reportResult.assignedSquad.id}`}
                className="block w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-all mb-3"
              >
                Coordinate with Squad
              </Link>
            )}

            {/* Secondary CTA - Dashboard */}
            <Link
              href="/dashboard"
              className="block w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
            >
              Back to Dashboard
            </Link>

            {/* Share Buttons */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-3">Share to spread the word:</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/cases/${reportResult.caseNumber || reportResult.reportId}`;
                    if (navigator.share) {
                      navigator.share({ title: `Help find ${reportResult.petName || petName}!`, url });
                    } else {
                      navigator.clipboard.writeText(url);
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all"
                >
                  Copy Link
                </button>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/cases/${reportResult.caseNumber || reportResult.reportId}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all"
                >
                  Share on Facebook
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const minStep = 1; // Everyone starts at location now
  const stepLabels = isLoggedIn
    ? ['Location', 'Pet', 'Name', 'Details', 'When', 'Color', 'Photo', 'Review']
    : ['Location', 'Pet', 'Name', 'Details', 'When', 'Color', 'Photo', 'Contact', 'Review'];

  return (
    <div className="h-[100dvh] bg-gradient-to-br from-orange-50 via-white to-red-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
        <div className="w-16">
          {step > minStep ? (
            <button
              onClick={prevStep}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft size={20} />
              <span className="text-sm font-medium">Back</span>
            </button>
          ) : (
            <Link href="/dashboard" className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
              <X size={20} />
            </Link>
          )}
        </div>

        <div className="flex-1 mx-2">
          <div className="flex justify-center gap-1">
            {Array.from({ length: totalSteps }, (_, i) => {
              let stepNum = i + 1;
              if (isLoggedIn && i >= 7) stepNum = i + 2;
              const isActive = stepNum <= step;
              const isCurrent = stepNum === step;
              return (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    isCurrent ? 'w-6 bg-gradient-to-r from-orange-400 to-red-500' :
                    isActive ? 'w-3 bg-orange-300' : 'w-3 bg-gray-200'
                  }`}
                />
              );
            })}
          </div>
        </div>

        <div className="w-16" />
      </header>

      {/* Content - scrollable with room for footer */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">

        {/* Step 8: Contact Info (non-logged-in users) - moved to end for better engagement */}
        {step === 8 && !isLoggedIn && (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Almost done!</h1>
              <p className="text-gray-500 text-sm">How can volunteers reach you about {petName}?</p>
            </div>

            <div className="space-y-3 pb-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Your name *</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Enter email, phone, or both *</p>
              </div>

              {/* Email + Confirm side by side */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className={`w-full px-3 py-2.5 text-sm bg-white border-2 rounded-xl focus:ring-2 focus:ring-blue-50 outline-none transition-all ${
                      contactEmail && !isValidEmail(contactEmail) ? 'border-red-300' : 'border-gray-200 focus:border-blue-400'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Confirm email</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={contactEmailConfirm}
                      onChange={(e) => setContactEmailConfirm(e.target.value)}
                      placeholder="Confirm"
                      disabled={!contactEmail}
                      className={`w-full px-3 pr-8 py-2.5 text-sm bg-white border-2 rounded-xl focus:ring-2 focus:ring-blue-50 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400 ${
                        contactEmailConfirm && contactEmail !== contactEmailConfirm ? 'border-red-300' : 'border-gray-200 focus:border-blue-400'
                      }`}
                    />
                    {contactEmail && contactEmailConfirm && contactEmail === contactEmailConfirm && isValidEmail(contactEmail) && (
                      <Check size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500" />
                    )}
                  </div>
                </div>
              </div>
              {contactEmailConfirm && contactEmail !== contactEmailConfirm && (
                <p className="text-xs text-red-500 -mt-1">Emails don't match</p>
              )}

              {/* Phone + Confirm side by side */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2.5 text-sm bg-white border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Confirm phone</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={contactPhoneConfirm}
                      onChange={(e) => setContactPhoneConfirm(e.target.value)}
                      placeholder="Confirm"
                      disabled={!contactPhone}
                      className={`w-full px-3 pr-8 py-2.5 text-sm bg-white border-2 rounded-xl focus:ring-2 focus:ring-blue-50 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400 ${
                        contactPhoneConfirm && contactPhone !== contactPhoneConfirm ? 'border-red-300' : 'border-gray-200 focus:border-blue-400'
                      }`}
                    />
                    {contactPhone && contactPhoneConfirm && contactPhone === contactPhoneConfirm && contactPhone.replace(/\D/g, '').length >= 10 && (
                      <Check size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500" />
                    )}
                  </div>
                </div>
              </div>
              {contactPhoneConfirm && contactPhone !== contactPhoneConfirm && (
                <p className="text-xs text-red-500 -mt-1">Phone numbers don't match</p>
              )}

              {/* Password - required to create account for case tracking */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-600 mb-1">Create a password *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-3 py-2.5 text-sm bg-white border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">So you can track sightings and coordinate with your rescue team</p>
              </div>
            </div>

            <div className="mt-auto pt-4">
              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/login?callbackUrl=/report/new" className="text-blue-600 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Location - GPS required */}
        {step === 1 && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-6 py-3 relative z-30">
              <h1 className="text-xl font-bold text-gray-900 mb-1">Where was {petName || 'your pet'} last seen?</h1>
              {center && !locationDenied && (
                <p className="text-sm text-gray-500">Drag the pin or tap the map to adjust the exact spot</p>
              )}
            </div>

            <div className="flex-1 relative z-10 mx-4 mb-2 rounded-2xl overflow-hidden shadow-lg border border-gray-100 min-h-[300px]">
              {isGettingLocation ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                      <Navigation size={28} className="text-blue-500 animate-pulse" />
                    </div>
                    <p className="text-gray-600 font-medium">Detecting your location...</p>
                    <p className="text-gray-400 text-xs mt-1">Please allow location access when prompted</p>
                  </div>
                </div>
              ) : locationDenied || !center ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
                  <div className="text-center px-6">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                      <AlertTriangle size={28} className="text-red-500" />
                    </div>
                    <p className="text-gray-900 font-semibold mb-2">Location access required</p>
                    <p className="text-gray-500 text-sm mb-4">
                      To report a lost pet, we need your location to coordinate the search. Please enable location services in your browser settings and tap the button below.
                    </p>
                    <button
                      onClick={() => {
                        setLocationDenied(false);
                        detectLocation();
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl font-medium shadow-lg hover:bg-red-600 transition-colors"
                    >
                      <Navigation size={16} /> Try again
                    </button>
                    <p className="text-gray-400 text-xs mt-3">
                      On iPhone: Settings &gt; Safari &gt; Location<br />
                      On Android: Tap the lock icon in the address bar
                    </p>
                  </div>
                </div>
              ) : (
                <div ref={mapRef} className="absolute inset-0" />
              )}
            </div>

            {center && !locationDenied && (
              <div className="px-6 pb-4 flex-shrink-0">
                {/* Low accuracy warning */}
                {locationAccuracy && locationAccuracy > 1000 && !locationLocked && (
                  <div className="rounded-xl p-3 mb-2 bg-amber-50 border border-amber-200 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-amber-800">Approximate location (~{locationAccuracy > 1000 ? `${Math.round(locationAccuracy / 1000)}km` : `${locationAccuracy}m`})</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        Your GPS is still locking in. Drag the pin to the correct spot, or wait a moment for a better reading.
                      </p>
                    </div>
                  </div>
                )}

                <div className={`rounded-2xl p-4 shadow-sm border ${locationLocked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {locationLocked && (
                        <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium mb-1">
                          <Check size={12} /> Location confirmed
                        </div>
                      )}
                      <p className="text-sm text-gray-600 truncate">{lastSeenAddress || 'Location set'}</p>
                      {locationAccuracy && !locationLocked && (
                        <p className={`text-xs mt-0.5 ${locationAccuracy < 150 ? 'text-green-500' : locationAccuracy < 1000 ? 'text-amber-500' : 'text-red-500'}`}>
                          {locationAccuracy < 150 ? 'GPS locked' : locationAccuracy < 1000 ? 'Refining...' : 'Low accuracy'} — {locationAccuracy < 1000 ? `${locationAccuracy}m` : `${Math.round(locationAccuracy / 1000)}km`}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        localStorage.removeItem('reportLocation');
                        setLocationLocked(false);
                        setDetectedLocation(null);
                        setLocationAccuracy(null);
                        detectLocation();
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 flex-shrink-0"
                    >
                      <Navigation size={12} /> Re-detect
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Pet */}
        {step === 2 && (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center mb-3 shadow-lg shadow-purple-200">
              <Heart size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Who went missing?</h1>
            <p className="text-gray-500 mb-6">Select your pet or tell us about them</p>

            {myPets.length > 0 && (
              <div className="mb-8">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Pets</p>
                <div className="grid grid-cols-2 gap-3">
                  {myPets.map(pet => (
                    <button
                      key={pet.id}
                      onClick={() => handleSelectPet(pet)}
                      className="p-4 bg-white border-2 border-gray-100 rounded-2xl text-left hover:border-purple-300 hover:shadow-lg transition-all group"
                    >
                      <div className="w-16 h-16 rounded-xl bg-gray-100 mb-3 overflow-hidden group-hover:scale-105 transition-transform">
                        {pet.primaryPhotoUrl ? (
                          <img src={pet.primaryPhotoUrl} alt={pet.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
                            {pet.species === 'DOG' ? <Dog size={28} className="text-gray-400" /> :
                             pet.species === 'CAT' ? <Cat size={28} className="text-gray-400" /> :
                             <Rabbit size={28} className="text-gray-400" />}
                          </div>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900">{pet.name}</p>
                      <p className="text-xs text-gray-500">{pet.species?.toLowerCase()}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {myPets.length > 0 ? 'Or Add New' : 'Pet Type'}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {PET_TYPES.map(pet => {
                  return (
                    <button
                      key={pet.type}
                      onClick={() => handleSelectPetType(pet.type)}
                      className="py-4 px-2 bg-white border-2 border-gray-100 rounded-2xl hover:border-purple-300 hover:shadow-lg transition-all text-center group"
                    >
                      <span className="text-3xl block mb-1 group-hover:scale-110 transition-transform">{pet.emoji}</span>
                      <span className="text-sm font-medium text-gray-700">{pet.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Pet Name */}
        {step === 3 && (
          <div className="flex-1 px-6 py-4 flex flex-col overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-200 flex-shrink-0">
                <span className="text-xl">{PET_TYPES.find(p => p.type === petType)?.emoji || '🐾'}</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">What's their name?</h1>
                <p className="text-sm text-gray-500">This helps identify your pet</p>
              </div>
            </div>

            <input
              type="text"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              onFocus={(e) => {
                // Scroll input into view on mobile when keyboard opens
                setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
              }}
              placeholder="Enter name..."
              className="w-full text-base sm:text-2xl font-medium px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-pink-400 outline-none bg-white placeholder:text-gray-300 transition-colors"
              autoFocus
            />
            <p className="text-sm text-gray-400 mt-2">e.g., Max, Bella, Charlie</p>

            {/* Spacer for keyboard */}
            <div className="flex-1 min-h-[200px]" />
          </div>
        )}

        {/* Step 4: Pet Details (Size for dogs, Indoor/Outdoor for cats) */}
        {step === 4 && (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            {petType === 'dog' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200 flex-shrink-0">
                    <Dog size={24} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">How big is {petName}?</h1>
                    <p className="text-sm text-gray-500">This helps with search planning</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {DOG_SIZE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setPetSize(opt.value); setStep(5); }}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                        petSize === opt.value
                          ? 'border-orange-400 bg-orange-50 shadow-lg shadow-orange-100'
                          : 'border-gray-100 bg-white hover:border-orange-200 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-semibold text-lg ${petSize === opt.value ? 'text-orange-600' : 'text-gray-900'}`}>
                            {opt.label}
                          </p>
                          <p className="text-sm text-gray-500">{opt.sublabel}</p>
                        </div>
                        <p className="text-xs text-gray-400">{opt.example}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {petType === 'cat' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-200 flex-shrink-0">
                    <Cat size={24} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Is {petName} an indoor cat?</h1>
                    <p className="text-sm text-gray-500">This affects where they may have gone</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {CAT_LIVING_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const isSelected = (opt.value === 'indoor' && isIndoorCat === true) ||
                                       (opt.value === 'outdoor' && isIndoorCat === false);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { setIsIndoorCat(opt.value === 'indoor'); setStep(5); }}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                          isSelected
                            ? 'border-purple-400 bg-purple-50 shadow-lg shadow-purple-100'
                            : 'border-gray-100 bg-white hover:border-purple-200 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            isSelected ? 'bg-purple-100' : 'bg-gray-100'
                          }`}>
                            <Icon size={24} className={isSelected ? 'text-purple-600' : 'text-gray-500'} />
                          </div>
                          <div>
                            <p className={`font-semibold text-lg ${isSelected ? 'text-purple-600' : 'text-gray-900'}`}>
                              {opt.label}
                            </p>
                            <p className="text-sm text-gray-500">{opt.sublabel}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 5: When */}
        {step === 5 && (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-3 shadow-lg shadow-amber-200">
              <Clock size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">When did {petName} go missing?</h1>
            <p className="text-gray-500 mb-6">This helps prioritize the search</p>

            <div className="grid grid-cols-2 gap-3">
              {TIME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setTimeElapsed(opt.value); setStep(6); }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    timeElapsed === opt.value
                      ? 'border-orange-400 bg-orange-50 shadow-lg shadow-orange-100'
                      : 'border-gray-100 bg-white hover:border-orange-200 hover:shadow-md'
                  }`}
                >
                  <p className={`font-semibold text-lg ${timeElapsed === opt.value ? 'text-orange-600' : 'text-gray-900'}`}>
                    {opt.label}
                  </p>
                  <p className="text-sm text-gray-500">{opt.sublabel}</p>
                  {opt.urgent && (
                    <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                      Urgent
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: Color */}
        {step === 6 && (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200 flex-shrink-0">
                <div className="grid grid-cols-2 gap-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-200" />
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-300" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">What color is {petName}?</h1>
                <p className="text-sm text-gray-500">Select one or more colors</p>
              </div>
            </div>

            <ColorSelector
              value={color}
              onChange={setColor}
            />
          </div>
        )}

        {/* Step 7: Photo */}
        {step === 7 && (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center mb-3 shadow-lg shadow-sky-200">
              <Camera size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Add a photo</h1>
            <p className="text-gray-500 mb-6">A clear photo helps others spot {petName}</p>

            {photos.length > 0 ? (
              <div className="relative rounded-3xl overflow-hidden shadow-lg">
                <img src={photos[0]} alt="Pet" className="w-full aspect-square object-cover" />
                <button
                  onClick={() => setPhotos([])}
                  className="absolute top-3 right-3 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-full flex items-center gap-1.5">
                  <Check size={14} /> Photo added
                </div>
              </div>
            ) : (
              <label className="block aspect-square bg-white border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-all group">
                <div className="h-full flex flex-col items-center justify-center">
                  {uploadingPhoto ? (
                    <div className="text-center">
                      <Loader2 size={40} className="text-blue-500 animate-spin mx-auto mb-3" />
                      <p className="text-gray-500">Uploading...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Camera size={32} className="text-blue-500" />
                      </div>
                      <p className="text-gray-900 font-medium text-lg">Tap to add photo</p>
                      <p className="text-gray-500 text-sm mt-1">or drag & drop</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploadingPhoto}
                />
              </label>
            )}

            <button
              onClick={() => setStep(8)}
              className="mt-6 w-full py-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
            >
              Skip for now — you can add later
            </button>
          </div>
        )}

        {/* Step 9: Confirm */}
        {step === 9 && (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center mb-3 shadow-lg shadow-violet-200">
              <Sparkles size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Ready to send alert?</h1>
            <p className="text-gray-500 mb-6">Review the details below</p>

            <div className="space-y-3">
              {/* Location */}
              <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <MapPin size={20} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Seen</p>
                  <p className="font-medium text-gray-900 truncate">{cityName || lastSeenAddress || 'Location set'}</p>
                </div>
              </div>

              {/* Pet */}
              <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-purple-100 flex items-center justify-center flex-shrink-0">
                  {photos[0] ? (
                    <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{PET_TYPES.find(p => p.type === petType)?.emoji}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pet</p>
                  <p className="font-medium text-gray-900">{petName}</p>
                  <p className="text-sm text-gray-500">{color} {petType}</p>
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Clock size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Missing Since</p>
                  <p className="font-medium text-gray-900">
                    {TIME_OPTIONS.find(t => t.value === timeElapsed)?.label}
                    {TIME_OPTIONS.find(t => t.value === timeElapsed)?.urgent && (
                      <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                        Urgent
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Contact */}
              <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Mail size={20} className="text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact</p>
                  <p className="font-medium text-gray-900">{effectiveName}</p>
                  {effectiveEmail && <p className="text-sm text-gray-500">{effectiveEmail}</p>}
                  {effectivePhone && <p className="text-sm text-gray-500">{effectivePhone}</p>}
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-700">Something went wrong</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with navigation - fixed at bottom */}
      {step >= minStep && step < 10 && (
        <div className="flex-shrink-0 px-4 sm:px-6 pb-4 pt-3 bg-white border-t border-gray-100" style={{ paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 16px))' }}>
          <div className="flex gap-3">
            {/* Back button */}
            {step > minStep && (
              <button
                onClick={prevStep}
                className="px-5 py-3 rounded-2xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all flex items-center gap-1"
              >
                <ChevronLeft size={18} />
                Back
              </button>
            )}

            {/* Continue/Submit button */}
            <button
              onClick={nextStep}
              disabled={!canProceed() || isSubmitting}
              className={`flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
                canProceed() && !isSubmitting
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-200 hover:shadow-xl active:scale-[0.98]'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Creating alert...</span>
                </>
              ) : step === 9 ? (
                <>
                  <Sparkles size={18} />
                  <span>Send Alert</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-marker { background: transparent; border: none; }
      `}</style>
    </div>
  );
}
