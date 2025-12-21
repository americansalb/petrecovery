'use client';

/**
 * Report Lost Pet - Beautiful Step-by-Step Wizard
 *
 * Modern, clean design with one focus per screen
 */

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Dog, Cat, Bird, Rabbit, MapPin, Clock,
  Camera, Check, ChevronLeft, ChevronRight,
  AlertTriangle, Loader2, X, Navigation, ExternalLink,
  Sparkles, Heart, Mail, User, Search
} from 'lucide-react';
import ColorSelector from '../../components/ColorSelector';

const PET_TYPES = [
  { type: 'dog', label: 'Dog', icon: Dog, emoji: '🐕' },
  { type: 'cat', label: 'Cat', icon: Cat, emoji: '🐈' },
  { type: 'bird', label: 'Bird', icon: Bird, emoji: '🦜' },
  { type: 'other', label: 'Other', icon: Rabbit, emoji: '🐰' },
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

  // Wizard state - step 0 is contact info for non-logged-in users
  const [step, setStep] = useState(0); // 0=contact, 1=location, 2=pet, 3=name, 4=when, 5=color, 6=photo, 7=confirm
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reportResult, setReportResult] = useState(null);

  // Contact info (for non-logged-in users)
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');

  // Data state
  const [center, setCenter] = useState(null);
  const [lastSeenAddress, setLastSeenAddress] = useState('');
  const [cityName, setCityName] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(true);
  const [myPets, setMyPets] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [petType, setPetType] = useState('');
  const [petName, setPetName] = useState('');
  const [timeElapsed, setTimeElapsed] = useState('');
  const [color, setColor] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Map refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Determine starting step based on auth
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (isLoggedIn) {
      setStep(1); // Skip contact step
    } else {
      setStep(0); // Show contact step
    }
  }, [authStatus, isLoggedIn]);

  // Get effective email and name
  const effectiveEmail = isLoggedIn ? session?.user?.email : contactEmail;
  const effectiveName = isLoggedIn ? (session?.user?.name || 'Pet Owner') : contactName;

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

  // Auto-detect location
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsGettingLocation(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
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
  }, []);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !center || step !== 1) return;

    // If map already exists, just update view
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, 17);
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
        radius: 100,
      }).addTo(map);
      circleRef.current = circle;

      marker.on('dragend', async (e) => {
        const pos = e.target.getLatLng();
        setCenter([pos.lat, pos.lng]);
        circle.setLatLng(pos);
        const result = await reverseGeocode(pos.lat, pos.lng);
        setLastSeenAddress(result.address);
        setCityName(result.city);
      });

      map.on('click', async (e) => {
        const pos = e.latlng;
        setCenter([pos.lat, pos.lng]);
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

  const searchAddress = async (query) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      return;
    }

    // Debounce: clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Wait 300ms before searching
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&limit=5&addressdetails=1`);
        if (response.ok) {
          const results = await response.json();
          setSearchResults(Array.isArray(results) ? results : []);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const selectSearchResult = async (result) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setCenter([lat, lon]);
    setLastSeenAddress(result.display_name);
    const addr = result.address || {};
    setCityName(addr.city || addr.town || addr.village || addr.municipality || '');
    setSearchResults([]);
    setAddressSearch('');

    // Update map if it exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lon], 17);
      if (markerRef.current) markerRef.current.setLatLng([lat, lon]);
      if (circleRef.current) circleRef.current.setLatLng([lat, lon]);
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
    setPetType(typeMap[pet.species] || 'other');
    setPetName(pet.name);
    setColor(pet.color || '');
    if (pet.primaryPhotoUrl) setPhotos([pet.primaryPhotoUrl]);
    setStep(4); // Skip name step since we have it
  };

  const handleSelectPetType = (type) => {
    setSelectedPet(null);
    setPetType(type);
    setPetName('');
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
    if (!effectiveEmail || !effectiveName || !petName || !color || !lastSeenAddress || !center) {
      const missing = [];
      if (!effectiveEmail) missing.push('email');
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
          firstName: effectiveName,
          petName,
          color,
          lastSeenAddress,
          center,
          radiusMiles: 0.1,
          timeElapsed,
          petType: petType.toUpperCase(),
          photos,
          locationType: 'address',
          cityName,
          selectedPetId: selectedPet?.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create report');

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
      case 0: return contactEmail.trim() && isValidEmail(contactEmail) && contactName.trim();
      case 1: return !!center;
      case 2: return !!petType;
      case 3: return !!petName.trim();
      case 4: return !!timeElapsed;
      case 5: return !!color;
      case 6: return true; // Photo is optional
      case 7: return true;
      default: return false;
    }
  };

  const totalSteps = isLoggedIn ? 7 : 8;
  const displayStep = isLoggedIn ? step : step + 1;

  const nextStep = () => {
    if (canProceed() && step < 7) setStep(step + 1);
    if (step === 7) handleSubmit();
  };

  const prevStep = () => {
    const minStep = isLoggedIn ? 1 : 0;
    if (step > minStep) {
      // If we came from selecting existing pet, go back to step 2
      if (step === 4 && selectedPet) {
        setStep(2);
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
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-400 to-red-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Heart size={28} className="text-white" />
          </div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (step === 8 && reportResult) {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-200">
              <Check size={48} className="text-white" strokeWidth={3} />
            </div>
            <Sparkles className="absolute -top-2 -right-2 text-yellow-400" size={24} />
            <Sparkles className="absolute -bottom-1 -left-3 text-green-400" size={20} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Alert Sent!</h1>
          <p className="text-gray-600 mb-8 text-lg">
            {reportResult.squadsNotified || 0} rescue team{reportResult.squadsNotified === 1 ? '' : 's'} notified in your area
          </p>
          <Link
            href="/dashboard"
            className="block w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-green-200 hover:shadow-xl transition-all"
          >
            View Dashboard
          </Link>
          <p className="mt-4 text-sm text-gray-500">
            We'll notify you of any sightings
          </p>
        </div>
      </div>
    );
  }

  const minStep = isLoggedIn ? 1 : 0;
  const stepLabels = isLoggedIn
    ? ['Location', 'Pet', 'Name', 'When', 'Color', 'Photo', 'Review']
    : ['Contact', 'Location', 'Pet', 'Name', 'When', 'Color', 'Photo', 'Review'];

  return (
    <div className="h-[100dvh] bg-gradient-to-br from-orange-50 via-white to-red-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <button
          onClick={() => step > minStep ? prevStep() : null}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/50 transition-colors"
        >
          {step > minStep ? (
            <ChevronLeft size={24} className="text-gray-600" />
          ) : (
            <Link href="/dashboard"><X size={24} className="text-gray-600" /></Link>
          )}
        </button>

        <div className="flex-1 mx-4">
          <div className="flex justify-center gap-1.5">
            {Array.from({ length: totalSteps }, (_, i) => {
              const stepNum = isLoggedIn ? i + 1 : i;
              const isActive = stepNum <= step;
              const isCurrent = stepNum === step;
              return (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isCurrent ? 'w-8 bg-gradient-to-r from-orange-400 to-red-500' :
                    isActive ? 'w-4 bg-orange-300' : 'w-4 bg-gray-200'
                  }`}
                />
              );
            })}
          </div>
          <p className="text-center text-xs text-gray-400 mt-1">
            {stepLabels[step - minStep] || ''}
          </p>
        </div>

        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Step 0: Contact Info (non-logged-in users) */}
        {step === 0 && (
          <div className="flex-1 flex flex-col px-6 py-4 overflow-y-auto">
            <div className="mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                <Mail size={28} className="text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Let's stay in touch</h1>
              <p className="text-gray-500 text-lg">We'll notify you when someone spots your pet</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your name</label>
                <div className="relative">
                  <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Jane"
                    className="w-full pl-12 pr-4 py-4 text-lg bg-white border-2 border-gray-200 rounded-2xl focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email address</label>
                <div className="relative">
                  <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full pl-12 pr-4 py-4 text-lg bg-white border-2 border-gray-200 rounded-2xl focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                  />
                </div>
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
            <div className="px-6 py-3">
              <h1 className="text-xl font-bold text-gray-900 mb-1">Where was {petName || 'your pet'} last seen?</h1>

              {/* Address Search */}
              <div className="relative mt-2">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={addressSearch}
                  onChange={(e) => {
                    setAddressSearch(e.target.value);
                    searchAddress(e.target.value);
                  }}
                  placeholder="Search address..."
                  className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none"
                />
                {isSearching && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectSearchResult(result)}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="font-medium text-gray-900 truncate">{result.display_name?.split(',')[0]}</p>
                        <p className="text-xs text-gray-500 truncate">{result.display_name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 relative mx-4 mb-2 rounded-2xl overflow-hidden shadow-lg border border-gray-100 min-h-[300px]">
              {isGettingLocation ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                      <Navigation size={28} className="text-blue-500 animate-pulse" />
                    </div>
                    <p className="text-gray-600 font-medium">Finding your location...</p>
                  </div>
                </div>
              ) : !center ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
                  <div className="text-center px-6">
                    <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-3">
                      <MapPin size={28} className="text-orange-500" />
                    </div>
                    <p className="text-gray-900 font-semibold mb-1">Enter your location</p>
                    <p className="text-gray-500 text-sm">Type an address or city in the search box above</p>
                  </div>
                </div>
              ) : (
                <div ref={mapRef} className="absolute inset-0" />
              )}
            </div>

            {center && (
              <div className="px-6 pb-4 flex-shrink-0">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <p className="text-sm text-gray-600 truncate mb-2">{lastSeenAddress || 'Location set'}</p>
                  <button
                    onClick={openInMaps}
                    className="text-sm text-blue-600 font-medium flex items-center gap-1.5 hover:text-blue-700"
                  >
                    <ExternalLink size={14} /> Open in Maps to set exact address
                  </button>
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
              className="w-full text-2xl font-medium py-4 border-b-2 border-gray-200 focus:border-pink-400 outline-none bg-transparent placeholder:text-gray-300 transition-colors"
              autoFocus
            />
            <p className="text-sm text-gray-400 mt-2">e.g., Max, Bella, Charlie</p>

            {/* Spacer for keyboard */}
            <div className="flex-1 min-h-[200px]" />
          </div>
        )}

        {/* Step 4: When */}
        {step === 4 && (
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
                  onClick={() => setTimeElapsed(opt.value)}
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

        {/* Step 5: Color */}
        {step === 5 && (
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

        {/* Step 6: Photo */}
        {step === 6 && (
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
              onClick={() => setStep(7)}
              className="mt-6 w-full py-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
            >
              Skip for now — you can add later
            </button>
          </div>
        )}

        {/* Step 7: Confirm */}
        {step === 7 && (
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
                  <p className="text-sm text-gray-500">{effectiveEmail}</p>
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

      {/* Footer with Next button */}
      {step >= minStep && step < 8 && (
        <div className="px-6 pb-6 pt-4 flex-shrink-0 bg-gradient-to-t from-white via-white to-transparent">
          <button
            onClick={nextStep}
            disabled={!canProceed() || isSubmitting}
            className={`w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
              canProceed() && !isSubmitting
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Creating alert...</span>
              </>
            ) : step === 7 ? (
              <>
                <Sparkles size={20} />
                <span>Send Alert</span>
              </>
            ) : (
              <>
                <span>Continue</span>
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </div>
      )}

      <style jsx global>{`
        .custom-marker { background: transparent; border: none; }
      `}</style>
    </div>
  );
}
