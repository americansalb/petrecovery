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
  // 1=location, 2=pet info (type+name+details), 3=photo, 4=contact (if not logged in),
  // 5=when (optional), 6=color (optional), 7=review (optional), 8=success
  // After required steps (3 or 4), footer shows "Submit Now" + "Add More Details"
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reportResult, setReportResult] = useState(null);
  const [wantsTellMore, setWantsTellMore] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop for layout
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
  const [displayPhotoIndex, setDisplayPhotoIndex] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [reporterLocation, setReporterLocation] = useState(null); // Reporter's initial GPS position

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

  // Auto-detect location (only on first load, respects locationLocked)
  const detectLocation = async () => {
    if (locationLocked) return; // Don't override user's manual selection

    setIsGettingLocation(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
          // Store reporter's initial GPS position (separate from last-seen which user may change)
          if (!reporterLocation) {
            setReporterLocation([latitude, longitude]);
          }
          const result = await reverseGeocode(latitude, longitude);
          setLastSeenAddress(result.address);
          setCityName(result.city);
          setIsGettingLocation(false);
        },
        () => {
          // Geolocation failed - user will need to search
          setIsGettingLocation(false);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      // No geolocation - user will need to search
      setIsGettingLocation(false);
    }
  };

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
      setTimeout(() => map.invalidateSize(), 500);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center, step]);

  // Re-validate map size when loading overlay disappears
  useEffect(() => {
    if (!isGettingLocation && mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
    }
  }, [isGettingLocation]);

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
    // If pet already has a photo, skip to fork point; otherwise go to photo step
    if (pet.primaryPhotoUrl) {
      setStep(isLoggedIn ? 3 : 4); // Skip to fork point (photo for logged in, contact for not)
    } else {
      setStep(3); // Go to photo step
    }
  };

  const handleSelectPetType = (type) => {
    setSelectedPet(null);
    setPetType(type);
    setPetName('');
    setPetSize('');
    setIsIndoorCat(null);
    setColor('');
    setPhotos([]);
    // Stay on step 2 - user will fill in name and details on same page
  };

  const analyzePhoto = async (url) => {
    setAnalyzingPhoto(true);
    try {
      const res = await fetch('/api/ai/analyze-pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
      });
      if (res.ok) {
        const analysis = await res.json();
        setAiAnalysis(analysis);
        // Auto-fill color since it's not on a previous step
        if (analysis.colors?.length > 0 && !color) {
          setColor(analysis.colors.join(', '));
        }
      }
    } catch (err) {
      console.error('Photo analysis failed:', err);
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const isFirstPhoto = photos.length === 0;

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Each photo must be under 10MB');
        continue;
      }

      setUploadingPhoto(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('context', 'pet');
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            setPhotos(prev => [...prev, data.url]);
            // Analyze the first photo uploaded for auto-fill
            if (isFirstPhoto && !aiAnalysis) {
              analyzePhoto(data.url);
            }
          }
        }
      } catch (err) {
        setError('Failed to upload photo');
      } finally {
        setUploadingPhoto(false);
      }
    }
    e.target.value = '';
  };

  const removePhoto = (index) => {
    setPhotos(prev => {
      const next = prev.filter((_, i) => i !== index);
      // Adjust display index if needed
      if (displayPhotoIndex >= next.length) setDisplayPhotoIndex(Math.max(0, next.length - 1));
      else if (index < displayPhotoIndex) setDisplayPhotoIndex(displayPhotoIndex - 1);
      return next;
    });
  };

  const setAsDisplay = (index) => {
    setDisplayPhotoIndex(index);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    // Validate required fields before submission
    const hasContact = effectiveEmail || effectivePhone;
    if (!hasContact || !effectiveName || !petName || !lastSeenAddress || !center) {
      const missing = [];
      if (!hasContact) missing.push('email or phone');
      if (!effectiveName) missing.push('name');
      if (!petName) missing.push('pet name');
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
          photos: [photos[displayPhotoIndex], ...photos.filter((_, i) => i !== displayPhotoIndex)],
          locationType: 'address',
          cityName,
          selectedPetId: selectedPet?.id,
          createAccount: !isLoggedIn && createAccount,
          password: !isLoggedIn && createAccount ? password : undefined,
          reporterLocation: reporterLocation || null,
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
      setStep(8); // Success step
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const canProceed = () => {
    switch (step) {
      case 1: return !!center;
      case 2: { // Pet info - type + name + details
        if (!petType || !petName.trim()) return false;
        if (petType === 'dog' && !petSize) return false;
        if (petType === 'cat' && isIndoorCat === null) return false;
        return true;
      }
      case 3: return photos.length > 0 && !uploadingPhoto; // Photo is required
      case 4: { // Contact info - only for non-logged-in users
        if (isLoggedIn) return true;
        if (!contactName.trim()) return false;
        const hasEmail = contactEmail.trim() && isValidEmail(contactEmail);
        const hasPhone = contactPhone.trim() && contactPhone.replace(/\D/g, '').length >= 10;
        if (!hasEmail && !hasPhone) return false;
        if (hasEmail && contactEmail !== contactEmailConfirm) return false;
        if (hasPhone && contactPhone !== contactPhoneConfirm) return false;
        if (password.length < 8) return false;
        return true;
      }
      case 5: return !!timeElapsed;
      case 6: return !!color;
      case 7: return true; // Review step
      default: return false;
    }
  };

  // Steps shown in progress bar depend on path
  // Required: location, pet, photo, (contact if not logged in)
  // Optional (if tell more): when, color, review
  const requiredSteps = isLoggedIn ? 3 : 4;
  const totalSteps = wantsTellMore ? requiredSteps + 3 : requiredSteps;
  const displayStep = step;
  // The "fork point" - the step where we offer submit vs add more
  const forkStep = isLoggedIn ? 3 : 4;

  const nextStep = () => {
    // For logged-in users, skip contact step (step 4)
    if (step === 3 && isLoggedIn) {
      // At fork point - don't auto-advance, let footer buttons handle it
      return;
    }
    // At fork point for non-logged-in (after contact)
    if (step === forkStep) return;
    // Submit on review step
    if (step === 7) {
      handleSubmit();
      return;
    }
    if (canProceed() && step < 7) setStep(step + 1);
  };

  const prevStep = () => {
    const minStep = 1;
    if (step > minStep) {
      // For logged-in users, skip back over the contact step
      if (step === 5 && isLoggedIn) {
        setStep(3);
      } else {
        setStep(step - 1);
      }
    }
  };

  // Loading state while checking auth
  if (authStatus === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center">
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
  if (step === 8 && reportResult) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
          <div className="text-center max-w-lg w-full">
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
    ? (wantsTellMore ? ['Location', 'Pet Info', 'Photo', 'When', 'Color', 'Review'] : ['Location', 'Pet Info', 'Photo'])
    : (wantsTellMore ? ['Location', 'Pet Info', 'Photo', 'Contact', 'When', 'Color', 'Review'] : ['Location', 'Pet Info', 'Photo', 'Contact']);

  // Desktop sidebar context - changes per step
  const sidebarData = {
    1: { title: 'Pin the location', subtitle: 'Drag the map to mark exactly where your pet was last seen.', Icon: MapPin },
    2: { title: 'Tell us about your pet', subtitle: 'The more detail you share, the easier it is for neighbors to identify them.', Icon: Heart },
    3: { title: 'A picture is worth 1,000 flyers', subtitle: 'Upload a clear, recent photo so searchers know exactly who to look for.', Icon: Camera },
    4: { title: 'Stay connected', subtitle: 'We\'ll use this info to notify you the moment someone spots your pet.', Icon: Mail },
    5: { title: 'Timeline matters', subtitle: 'Knowing when your pet went missing helps us prioritize the search radius.', Icon: Clock },
    6: { title: 'Color identification', subtitle: 'Accurate colors help volunteers and AI match sightings to your pet.', Icon: Search },
    7: { title: 'Final review', subtitle: 'Double-check everything before we blast the alert to nearby volunteers.', Icon: Check },
  };
  const sidebar = sidebarData[step] || sidebarData[1];

  return (
    <div
      className={isDesktop ? '' : 'min-h-[100dvh] bg-gradient-to-br from-orange-50 via-white to-red-50'}
      style={isDesktop ? {
        minHeight: '100dvh',
        display: 'flex',
        background: '#f8fafc',
      } : undefined}
    >

    {/* Desktop Left Panel - contextual sidebar */}
    {isDesktop && (
      <div style={{
        width: '360px',
        minHeight: '100dvh',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '40px 36px',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        color: 'white',
        position: 'sticky',
        top: 0,
      }}>
        {/* Nav links */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white', textDecoration: 'none' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Search size={16} style={{ color: '#0f172a' }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>ReunitePets</span>
            </Link>
            <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
              <X size={20} />
            </Link>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link href="/dashboard" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', padding: '4px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)' }}>Dashboard</Link>
            <Link href="/my-pets" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', padding: '4px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)' }}>My Pets</Link>
            <Link href="/hub" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', padding: '4px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)' }}>Hub</Link>
          </div>
        </div>

        {/* Step indicator - vertical */}
        <div style={{ marginBottom: '40px' }}>
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const isActive = stepNum <= Math.min(step, totalSteps);
            const isCurrent = stepNum === Math.min(step, totalSteps);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: i < stepLabels.length - 1 ? '8px' : 0 }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', fontWeight: 600,
                  background: isCurrent ? '#facc15' : isActive ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.08)',
                  color: isCurrent ? '#0f172a' : isActive ? '#facc15' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.3s',
                  boxShadow: isCurrent ? '0 0 20px rgba(250,204,21,0.3)' : 'none',
                }}>
                  {isActive && !isCurrent ? <Check size={14} /> : stepNum}
                </div>
                <span style={{
                  fontSize: '0.9rem', fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? 'white' : isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.3s',
                }}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Contextual message */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <sidebar.Icon size={24} style={{ color: '#0f172a' }} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '12px', letterSpacing: '-0.02em' }}>{sidebar.title}</h2>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.6)' }}>{sidebar.subtitle}</p>

          {/* Show collected info as it builds */}
          {(petName || photos.length > 0 || lastSeenAddress) && step > 2 && (
            <div style={{ marginTop: '32px', padding: '20px', background: 'rgba(255,255,255,0.06)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', fontWeight: 600 }}>Building your report</p>
              {petName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  {petType === 'dog' ? <Dog size={16} style={{ color: '#facc15', flexShrink: 0 }} /> :
                   petType === 'cat' ? <Cat size={16} style={{ color: '#facc15', flexShrink: 0 }} /> :
                   petType === 'bird' ? <Bird size={16} style={{ color: '#facc15', flexShrink: 0 }} /> :
                   <Rabbit size={16} style={{ color: '#facc15', flexShrink: 0 }} />}
                  <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>{petName}</span>
                </div>
              )}
              {lastSeenAddress && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <MapPin size={16} style={{ color: '#facc15', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastSeenAddress}</span>
                </div>
              )}
              {photos.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Camera size={16} style={{ color: '#facc15', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Photo uploaded</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom decorative */}
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem', marginTop: '24px' }}>
          Every minute counts — let's bring them home.
        </div>
      </div>
    )}

    {/* Right panel (main form) */}
    <div
      className={isDesktop ? 'w-full flex flex-col' : 'w-full flex flex-col min-h-[100dvh]'}
      style={isDesktop ? {
        flex: 1,
        minHeight: '100dvh',
        background: 'white',
        overflow: 'hidden',
      } : undefined}
    >
      {/* Header - mobile only shows dots, desktop shows minimal */}
      <header className={`flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0 ${isDesktop ? '' : ''}`}
        style={isDesktop ? { padding: '20px 40px 16px', borderBottom: '1px solid #f1f5f9' } : undefined}
      >
        <div className="w-16">
          {step > minStep ? (
            <button
              onClick={prevStep}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft size={20} />
              <span className="text-sm font-medium">Back</span>
            </button>
          ) : !isDesktop ? (
            <Link href="/dashboard" className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
              <X size={20} />
            </Link>
          ) : <div />}
        </div>

        {/* Progress dots - mobile only */}
        {!isDesktop && (
          <div className="flex-1 mx-2">
            <div className="flex justify-center gap-1">
              {Array.from({ length: totalSteps }, (_, i) => {
                const isActive = i < totalSteps && (i + 1) <= Math.min(step, totalSteps);
                const isCurrent = (i + 1) === Math.min(step, totalSteps);
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
        )}

        {/* Desktop: step label */}
        {isDesktop && (
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>
              Step {Math.min(step, totalSteps)} of {totalSteps}
            </span>
          </div>
        )}

        <div className="w-16" />
      </header>

      {/* Content - scrollable with room for footer */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto"
        style={isDesktop ? { padding: '0' } : undefined}
      >

        {/* Step 4: Contact Info (non-logged-in users) */}
        {step === 4 && !isLoggedIn && (
          <div className="flex-1 px-6 lg:px-8 py-4 lg:py-8 overflow-y-auto">
            <div className="mb-4">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Almost done!</h1>
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

        {/* Step 1: Location */}
        {step === 1 && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-6 lg:px-8 py-3 lg:py-6 relative z-30">
              <h1 className="text-xl font-bold text-gray-900 mb-1" style={isDesktop ? { fontSize: '1.75rem', marginBottom: '4px' } : undefined}>Where was {petName || 'your pet'} last seen?</h1>

              {/* Address Search */}
              <div className="relative mt-2" style={isDesktop ? { maxWidth: '600px' } : undefined}>
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={addressSearch}
                  onChange={(e) => {
                    setAddressSearch(e.target.value);
                    searchAddress(e.target.value);
                  }}
                  placeholder="Search address..."
                  className="w-full pl-10 pr-4 py-3 text-base bg-white border border-gray-200 rounded-xl focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none"
                />
                {isSearching && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectSearchResult(result)}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="font-medium text-gray-900 truncate">{result.name}</p>
                        <p className="text-xs text-gray-500 truncate">{result.address}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 relative z-10 mx-4 mb-2 rounded-2xl overflow-hidden shadow-lg border border-gray-100" style={isDesktop ? { minHeight: '500px', margin: '0 40px 16px', borderRadius: '16px' } : { minHeight: '250px' }}>
              {/* Always render map div so Leaflet can initialize reliably */}
              <div ref={mapRef} className="absolute inset-0" />
              {/* Overlay loading/fallback states on top of map */}
              {isGettingLocation && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                      <Navigation size={28} className="text-blue-500 animate-pulse" />
                    </div>
                    <p className="text-gray-600 font-medium">Finding your location...</p>
                  </div>
                </div>
              )}
              {!isGettingLocation && !center && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
                  <div className="text-center px-6">
                    <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-3">
                      <MapPin size={28} className="text-orange-500" />
                    </div>
                    <p className="text-gray-900 font-semibold mb-1">Enter your location</p>
                    <p className="text-gray-500 text-sm">Type an address or city in the search box above</p>
                  </div>
                </div>
              )}
            </div>

            {center && (
              <div className="px-6 pb-4 flex-shrink-0">
                <div className={`rounded-2xl p-4 shadow-sm border ${locationLocked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {locationLocked && (
                        <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium mb-1">
                          <Check size={12} /> Location confirmed
                        </div>
                      )}
                      <p className="text-sm text-gray-600 truncate">{lastSeenAddress || 'Location set'}</p>
                    </div>
                    <button
                      onClick={() => {
                        localStorage.removeItem('reportLocation');
                        setLocationLocked(false);
                        setCenter(null);
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

        {/* Step 2: Pet Info (type + name + details) */}
        {step === 2 && (
          <div className="flex-1 px-6 lg:px-8 py-4 lg:py-8 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-flash-400 flex items-center justify-center mb-3 shadow-lg shadow-flash-200">
              <Heart size={24} className="text-midnight-900" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Who went missing?</h1>
            <p className="text-gray-500 mb-4">Tell us about your pet</p>

            {/* Existing pets (if logged in) */}
            {myPets.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Pets</p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {myPets.map(pet => (
                    <button
                      key={pet.id}
                      onClick={() => handleSelectPet(pet)}
                      className="p-4 bg-white border-2 border-gray-100 rounded-2xl text-left hover:border-flash-400 hover:shadow-lg transition-all group"
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

            {/* Pet Type */}
            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {myPets.length > 0 ? 'Or Add New' : 'Pet Type'}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {PET_TYPES.map(pet => (
                  <button
                    key={pet.type}
                    onClick={() => handleSelectPetType(pet.type)}
                    className={`py-3 px-2 border-2 rounded-2xl text-center group transition-all ${
                      petType === pet.type
                        ? 'border-flash-400 bg-flash-50 shadow-lg shadow-flash-100'
                        : 'bg-white border-gray-100 hover:border-flash-300 hover:shadow-lg'
                    }`}
                  >
                    <pet.icon size={24} className={`mx-auto mb-1 group-hover:scale-110 transition-transform ${petType === pet.type ? 'text-midnight-800' : 'text-gray-500'}`} />
                    <span className={`text-xs font-medium ${petType === pet.type ? 'text-midnight-800' : 'text-gray-700'}`}>{pet.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pet Name - shown after type is selected */}
            {petType && (
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Pet Name</label>
                <input
                  type="text"
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  onFocus={(e) => {
                    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                  }}
                  placeholder="e.g., Max, Bella, Charlie"
                  className="w-full lg:max-w-lg text-lg font-medium px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-flash-400 outline-none bg-white placeholder:text-gray-300 transition-colors"
                  autoFocus
                />
              </div>
            )}

            {/* Dog Size - shown after name is entered */}
            {petType === 'dog' && petName.trim() && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Size</label>
                <div className="grid grid-cols-5 gap-2">
                  {DOG_SIZE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setPetSize(opt.value); setTimeout(() => setStep(3), 300); }}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        petSize === opt.value
                          ? 'border-orange-400 bg-orange-50 shadow-md'
                          : 'border-gray-100 bg-white hover:border-orange-200'
                      }`}
                    >
                      <p className={`font-semibold text-sm ${petSize === opt.value ? 'text-orange-600' : 'text-gray-900'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{opt.sublabel}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cat Indoor/Outdoor - shown after name is entered */}
            {petType === 'cat' && petName.trim() && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Living Situation</label>
                <div className="grid grid-cols-2 gap-3">
                  {CAT_LIVING_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const isSelected = (opt.value === 'indoor' && isIndoorCat === true) ||
                                       (opt.value === 'outdoor' && isIndoorCat === false);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { setIsIndoorCat(opt.value === 'indoor'); setTimeout(() => setStep(3), 300); }}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? 'border-flash-400 bg-flash-50 shadow-md'
                            : 'border-gray-100 bg-white hover:border-flash-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={20} className={isSelected ? 'text-midnight-800' : 'text-gray-500'} />
                          <div>
                            <p className={`font-semibold text-sm ${isSelected ? 'text-midnight-800' : 'text-gray-900'}`}>
                              {opt.label}
                            </p>
                            <p className="text-xs text-gray-500">{opt.sublabel}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: When (optional - tell us more) */}
        {step === 5 && (
          <div className="flex-1 px-6 lg:px-8 py-4 lg:py-8 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-flash-400 flex items-center justify-center mb-3 shadow-lg shadow-flash-200">
              <Clock size={24} className="text-midnight-900" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">When did {petName} go missing?</h1>
            <p className="text-gray-500 lg:text-base mb-6">This helps prioritize the search</p>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
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

        {/* Step 6: Color (optional - tell us more) */}
        {step === 6 && (
          <div className="flex-1 px-6 lg:px-8 py-4 lg:py-8 overflow-y-auto">
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
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">What color is {petName}?</h1>
                <p className="text-sm lg:text-base text-gray-500">Select one or more colors</p>
              </div>
            </div>

            <ColorSelector
              value={color}
              onChange={setColor}
            />
          </div>
        )}

        {/* Step 3: Photo */}
        {step === 3 && (
          <div className="flex-1 px-6 py-4 overflow-y-auto flex flex-col items-center"
            style={isDesktop ? { padding: '32px 40px' } : undefined}
          >
            <div className="w-full" style={isDesktop ? { maxWidth: '700px' } : { maxWidth: '500px' }}>
              <div className="w-14 h-14 rounded-2xl bg-flash-400 flex items-center justify-center mb-3 shadow-lg shadow-flash-200">
                <Camera size={24} className="text-midnight-900" />
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Add photos of {petName}</h1>
              <p className="text-gray-500 lg:text-base mb-6">At least one photo is required. The display photo will be shown on the alert.</p>

              {photos.length === 0 ? (
                /* No photos yet - single large upload area */
                <label className="block aspect-[4/3] bg-white border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-flash-400 hover:bg-flash-50/30 transition-all group"
                  style={isDesktop ? { maxWidth: '500px' } : undefined}
                >
                  <div className="h-full flex flex-col items-center justify-center">
                    {uploadingPhoto ? (
                      <div className="text-center">
                        <Loader2 size={40} className="text-flash-500 animate-spin mx-auto mb-3" />
                        <p className="text-gray-500">Uploading...</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-20 h-20 rounded-full bg-flash-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Camera size={32} className="text-flash-600" />
                        </div>
                        <p className="text-gray-900 font-medium text-lg">Click to add photos</p>
                        <p className="text-gray-500 text-sm mt-1">or drag and drop</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploadingPhoto}
                  />
                </label>
              ) : (
                /* Has photos - show display + thumbnails + add more */
                <>
                  {/* Display photo - large */}
                  <div className="relative rounded-2xl overflow-hidden shadow-lg mb-4" style={isDesktop ? { maxWidth: '500px' } : undefined}>
                    <img src={photos[displayPhotoIndex] || photos[0]} alt="Display photo" className="w-full aspect-[4/3] object-cover" />
                    <div className="absolute top-3 left-3 px-3 py-1.5 bg-flash-400 text-midnight-900 text-xs font-semibold rounded-full flex items-center gap-1.5">
                      <Check size={12} /> Display photo
                    </div>
                  </div>

                  {/* Thumbnails + add more */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    {photos.map((url, i) => (
                      <div key={i} className="relative group">
                        <button
                          onClick={() => setAsDisplay(i)}
                          className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                            i === displayPhotoIndex ? 'border-flash-400 shadow-md' : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                        {i === displayPhotoIndex && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-flash-400 rounded-full flex items-center justify-center">
                            <Check size={10} className="text-midnight-900" />
                          </div>
                        )}
                        <button
                          onClick={() => removePhoto(i)}
                          className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {/* Add more */}
                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-flash-400 hover:bg-flash-50 transition-all">
                      {uploadingPhoto ? (
                        <Loader2 size={20} className="text-gray-400 animate-spin" />
                      ) : (
                        <>
                          <Camera size={18} className="text-gray-400" />
                          <span className="text-xs text-gray-400 mt-1">Add</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={uploadingPhoto}
                      />
                    </label>
                  </div>

                  {photos.length > 1 && (
                    <p className="text-sm text-gray-500 mb-2">Click a thumbnail to set it as the display photo.</p>
                  )}
                </>
              )}

              {/* AI Analysis indicator */}
              {analyzingPhoto && (
                <div className="flex items-center gap-2 mt-4 p-3 bg-flash-50 border border-flash-200 rounded-xl">
                  <Loader2 size={16} className="text-flash-600 animate-spin" />
                  <span className="text-sm text-midnight-700">Detecting species and colors...</span>
                </div>
              )}
              {aiAnalysis && !analyzingPhoto && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">AI Detection — edit if incorrect</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Species</label>
                      <div className="flex gap-2">
                        {PET_TYPES.map(pt => (
                          <button
                            key={pt.type}
                            onClick={() => setPetType(pt.type)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                              petType === pt.type
                                ? 'border-flash-400 bg-flash-50 text-midnight-800'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <pt.icon size={14} className="inline mr-1" />
                            {pt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Colors</label>
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-flash-400 outline-none"
                        placeholder="e.g. brown, tan"
                      />
                    </div>
                  </div>
                </div>
              )}

              <p className="mt-4 text-sm text-gray-400">At least one photo is required to help identify your pet</p>
            </div>
          </div>
        )}

        {/* Step 7: Confirm (only shown for "tell us more" path) */}
        {step === 7 && (
          <div className="flex-1 px-6 lg:px-8 py-4 lg:py-8 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-flash-400 flex items-center justify-center mb-3 shadow-lg shadow-flash-200">
              <Sparkles size={24} className="text-midnight-900" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Ready to send alert?</h1>
            <p className="text-gray-500 lg:text-base mb-6">Review the details below</p>

            <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
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
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-flash-100 flex items-center justify-center flex-shrink-0">
                  {photos.length > 0 ? (
                    <img src={photos[displayPhotoIndex] || photos[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-midnight-600">{petType === 'dog' ? <Dog size={24} /> : petType === 'cat' ? <Cat size={24} /> : petType === 'bird' ? <Bird size={24} /> : <Rabbit size={24} />}</span>
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
      {step >= minStep && step < 8 && (
        <div className="flex-shrink-0 px-4 sm:px-6 pb-4 pt-3 bg-white border-t border-gray-100"
          style={isDesktop ? { padding: '16px 40px 24px' } : { paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
        >
          {/* Fork point - show Submit Now + Add More Details */}
          {step === forkStep && canProceed() ? (
            <div>
              <p className="text-sm text-gray-500 text-center mb-3">We have everything we need to send the alert.</p>
              <div className="flex gap-3">
                {step > minStep && (
                  <button onClick={prevStep} className="px-5 py-3 rounded-2xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all flex items-center gap-1">
                    <ChevronLeft size={18} /> Back
                  </button>
                )}
                <button
                  onClick={() => { setWantsTellMore(false); handleSubmit(); }}
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-flash-400 to-flash-500 text-midnight-900 shadow-lg shadow-flash-200 hover:shadow-xl active:scale-[0.98]"
                >
                  {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Creating alert...</> : <><Sparkles size={18} /> Submit Now</>}
                </button>
                <button
                  onClick={() => { setWantsTellMore(true); setStep(5); }}
                  className="px-5 py-3 rounded-2xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center gap-1"
                >
                  Add Details <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              {step > minStep && (
                <button onClick={prevStep} className="px-5 py-3 rounded-2xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all flex items-center gap-1">
                  <ChevronLeft size={18} /> Back
                </button>
              )}
              <button
                onClick={step === 7 ? handleSubmit : nextStep}
                disabled={!canProceed() || isSubmitting}
                className={`flex-1 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  canProceed() && !isSubmitting
                    ? step === 7
                      ? 'bg-gradient-to-r from-flash-400 to-flash-500 text-midnight-900 shadow-lg shadow-flash-200 hover:shadow-xl active:scale-[0.98]'
                      : 'bg-midnight-900 text-white shadow-lg hover:bg-midnight-800 active:scale-[0.98]'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {isSubmitting ? (
                  <><Loader2 size={18} className="animate-spin" /> Creating alert...</>
                ) : step === 7 ? (
                  <><Sparkles size={18} /> Send Alert</>
                ) : (
                  <>Continue <ChevronRight size={18} /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}

    </div>
    </div>
  );
}
