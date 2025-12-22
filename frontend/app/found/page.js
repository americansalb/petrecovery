'use client';

/**
 * Report Found Pet - Beautiful Step-by-Step Wizard
 *
 * Modern, clean design matching the Lost Pet wizard
 */

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Dog, Cat, Bird, Rabbit, MapPin,
  Camera, Check, ChevronLeft, ChevronRight,
  Loader2, X, Navigation, ExternalLink,
  Sparkles, Heart, Mail, User, Search, PawPrint,
  Calendar, FileText, CheckCircle
} from 'lucide-react';
import ColorSelector from '../components/ColorSelector';

const PET_TYPES = [
  { type: 'dog', label: 'Dog', icon: Dog, emoji: '🐕' },
  { type: 'cat', label: 'Cat', icon: Cat, emoji: '🐈' },
  { type: 'bird', label: 'Bird', icon: Bird, emoji: '🦜' },
  { type: 'other', label: 'Other', icon: Rabbit, emoji: '🐰' },
];

export default function ReportFoundPet() {
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = authStatus === 'authenticated';

  // Wizard state
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reportResult, setReportResult] = useState(null);

  // Contact info (for non-logged-in users)
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Data state
  const [center, setCenter] = useState(null);
  const [foundAddress, setFoundAddress] = useState('');
  const [cityName, setCityName] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(true);
  const [petType, setPetType] = useState('');
  const [color, setColor] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [description, setDescription] = useState('');
  const [breed, setBreed] = useState('');
  const [foundWhen, setFoundWhen] = useState('today');

  // Map refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Determine starting step based on auth
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (isLoggedIn) {
      setStep(1);
    } else {
      setStep(0);
    }
  }, [authStatus, isLoggedIn]);

  // Get effective email and name
  const effectiveEmail = isLoggedIn ? session?.user?.email : contactEmail;
  const effectiveName = isLoggedIn ? (session?.user?.name || 'Good Samaritan') : contactName;

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

    console.log('[FoundPet] Getting geolocation...');
    setIsGettingLocation(true);

    // Default fallback location (center of US)
    const fallbackLocation = [39.8283, -98.5795];

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log('[FoundPet] Geolocation success:', latitude, longitude);
          setCenter([latitude, longitude]);
          const result = await reverseGeocode(latitude, longitude);
          setFoundAddress(result.address);
          setCityName(result.city);
          setIsGettingLocation(false);
        },
        async (error) => {
          console.log('[FoundPet] Geolocation error, using fallback:', error.message);
          setCenter(fallbackLocation);
          setFoundAddress('Drag the pin or search for your location');
          setIsGettingLocation(false);
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    } else {
      console.log('[FoundPet] Geolocation not available, using fallback');
      setCenter(fallbackLocation);
      setFoundAddress('Drag the pin or search for your location');
      setIsGettingLocation(false);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    console.log('[FoundPet Map] useEffect triggered - step:', step, 'center:', center, 'mapRef:', mapRef.current);
    if (typeof window === 'undefined' || !center || step !== 1) {
      console.log('[FoundPet Map] Early return - conditions not met');
      return;
    }

    if (mapInstanceRef.current) {
      console.log('[FoundPet Map] Map already exists, updating view');
      mapInstanceRef.current.setView(center, 17);
      if (markerRef.current) markerRef.current.setLatLng(center);
      return;
    }

    const initMap = async () => {
      const container = mapRef.current;
      console.log('[FoundPet Map] initMap called - container:', container, 'height:', container?.offsetHeight);
      if (!container || container.offsetHeight === 0) {
        console.log('[FoundPet Map] Container not ready, retrying in 50ms');
        setTimeout(initMap, 50);
        return;
      }

      console.log('[FoundPet Map] Container ready, loading Leaflet...');
      const L = (await import('leaflet')).default;

      if (!mapRef.current || mapInstanceRef.current) {
        console.log('[FoundPet Map] Abort - mapRef gone or map already created');
        return;
      }

      console.log('[FoundPet Map] Creating map instance...');
      const map = L.map(mapRef.current, { zoomControl: false }).setView(center, 17);
      mapInstanceRef.current = map;
      console.log('[FoundPet Map] Map instance created successfully');

      L.control.zoom({ position: 'topright' }).addTo(map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="w-8 h-8 bg-green-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
          <div class="w-2 h-2 bg-white rounded-full"></div>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(center, { draggable: true, icon: markerIcon }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', async (e) => {
        const pos = e.target.getLatLng();
        setCenter([pos.lat, pos.lng]);
        const result = await reverseGeocode(pos.lat, pos.lng);
        setFoundAddress(result.address);
        setCityName(result.city);
      });

      map.on('click', async (e) => {
        const pos = e.latlng;
        setCenter([pos.lat, pos.lng]);
        marker.setLatLng(pos);
        const result = await reverseGeocode(pos.lat, pos.lng);
        setFoundAddress(result.address);
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

  const searchTimeoutRef = useRef(null);

  const searchAddress = async (query) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&limit=5`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(Array.isArray(data) ? data : []);
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
    setFoundAddress(result.display_name);
    setSearchResults([]);
    setAddressSearch('');

    const addr = result.address || {};
    setCityName(addr.city || addr.town || addr.village || addr.municipality || '');
  };

  const openInMaps = () => {
    if (center) {
      window.open(`https://www.google.com/maps?q=${center[0]},${center[1]}`, '_blank');
    }
  };

  // Photo upload
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingPhoto(true);

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('context', 'found-pet');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setPhotos(prev => [...prev, data.url]);
        }
      } catch (err) {
        console.error('Upload error:', err);
      }
    }

    setUploadingPhoto(false);
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Submit handler
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/public/found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          petSpecies: petType.toUpperCase(),
          petBreed: breed,
          petColor: color,
          petDescription: description,
          city: cityName,
          state: '',
          zipCode: '',
          lastSeenLandmark: foundAddress,
          foundAt: new Date().toISOString(),
          contactName: effectiveName,
          contactPhone: contactPhone,
          contactEmail: effectiveEmail,
          agreeToTerms: true,
          photoUrls: photos,
          latitude: center?.[0],
          longitude: center?.[1],
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      setReportResult(data);
      setStep(7);
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
      case 3: return !!color;
      case 4: return true; // Photo is optional
      case 5: return true; // Details are optional
      case 6: return true;
      default: return false;
    }
  };

  const totalSteps = isLoggedIn ? 6 : 7;
  const minStep = isLoggedIn ? 1 : 0;

  const nextStep = () => {
    if (canProceed() && step < 6) setStep(step + 1);
    if (step === 6) handleSubmit();
  };

  const prevStep = () => {
    if (step > minStep) setStep(step - 1);
  };

  // Loading state
  if (authStatus === 'loading') {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Heart size={28} className="text-white" />
          </div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (step === 7 && reportResult) {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-4 text-lg">
            Your found pet report has been submitted
          </p>

          {reportResult.matches?.length > 0 && (
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 mb-6 text-left">
              <p className="font-bold text-green-800 flex items-center gap-2 mb-2">
                <CheckCircle size={20} />
                Potential Matches Found!
              </p>
              <p className="text-sm text-green-700">
                We found {reportResult.matches.length} potential match(es) and notified the owners.
              </p>
            </div>
          )}

          {(!reportResult.matches || reportResult.matches.length === 0) && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-6">
              <p className="text-sm text-amber-800">
                No matching lost pet reports found yet. If someone reports a matching pet, they'll be notified!
              </p>
            </div>
          )}

          <Link
            href="/database"
            className="block w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-green-200 hover:shadow-xl transition-all"
          >
            View Pet Database
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-green-600 font-medium"
          >
            Report Another Found Pet
          </button>
        </div>
      </div>
    );
  }

  const stepLabels = isLoggedIn
    ? ['Location', 'Pet Type', 'Color', 'Photo', 'Details', 'Review']
    : ['Contact', 'Location', 'Pet Type', 'Color', 'Photo', 'Details', 'Review'];

  return (
    <div className="h-[100dvh] bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <button
          onClick={() => step > minStep ? prevStep() : null}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/50 transition-colors"
        >
          {step > minStep ? (
            <ChevronLeft size={24} className="text-gray-600" />
          ) : (
            <Link href="/"><X size={24} className="text-gray-600" /></Link>
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
                    isCurrent ? 'w-8 bg-gradient-to-r from-green-400 to-emerald-500' :
                    isActive ? 'w-4 bg-green-300' : 'w-4 bg-gray-200'
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

        {/* Step 0: Contact Info */}
        {step === 0 && (
          <div className="flex-1 flex flex-col px-6 py-4 overflow-y-auto">
            <div className="mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-green-200">
                <Mail size={28} className="text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Your contact info</h1>
              <p className="text-gray-500 text-lg">So pet owners can reach you</p>
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
                    className="w-full pl-12 pr-4 py-4 text-lg bg-white border-2 border-gray-200 rounded-2xl focus:border-green-400 focus:ring-4 focus:ring-green-50 outline-none transition-all"
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
                    className="w-full pl-12 pr-4 py-4 text-lg bg-white border-2 border-gray-200 rounded-2xl focus:border-green-400 focus:ring-4 focus:ring-green-50 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone (optional)</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full px-4 py-4 text-lg bg-white border-2 border-gray-200 rounded-2xl focus:border-green-400 focus:ring-4 focus:ring-green-50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="mt-auto pt-4">
              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/login?callbackUrl=/found" className="text-green-600 font-medium">
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
              <h1 className="text-xl font-bold text-gray-900 mb-1">Where did you find the pet?</h1>

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
                  className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none"
                />
                {isSearching && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}

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
              {/* Always render map container so ref is available immediately */}
              <div ref={mapRef} className="absolute inset-0" />

              {/* Overlay loading states on top of map */}
              {(isGettingLocation || !center) && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
                  {isGettingLocation ? (
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                        <Navigation size={28} className="text-green-500 animate-pulse" />
                      </div>
                      <p className="text-gray-600 font-medium">Finding your location...</p>
                    </div>
                  ) : (
                    <div className="text-center px-6">
                      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                        <MapPin size={28} className="text-green-500" />
                      </div>
                      <p className="text-gray-900 font-semibold mb-1">Enter the location</p>
                      <p className="text-gray-500 text-sm">Where did you find the pet?</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {center && (
              <div className="px-6 pb-4 flex-shrink-0">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <p className="text-sm text-gray-600 truncate mb-2">{foundAddress || 'Location set'}</p>
                  <button
                    onClick={openInMaps}
                    className="text-sm text-green-600 font-medium flex items-center gap-1.5 hover:text-green-700"
                  >
                    <ExternalLink size={14} /> Open in Maps
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Pet Type */}
        {step === 2 && (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-3 shadow-lg shadow-green-200">
              <PawPrint size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">What kind of pet?</h1>
            <p className="text-gray-500 mb-6">Select the type of pet you found</p>

            <div className="grid grid-cols-2 gap-4">
              {PET_TYPES.map(({ type, label, icon: Icon, emoji }) => (
                <button
                  key={type}
                  onClick={() => setPetType(type)}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    petType === type
                      ? 'border-green-500 bg-green-50 shadow-lg shadow-green-100'
                      : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-md'
                  }`}
                >
                  <div className="text-4xl mb-2">{emoji}</div>
                  <p className={`font-semibold ${petType === type ? 'text-green-700' : 'text-gray-700'}`}>
                    {label}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Breed (if known)</label>
              <input
                type="text"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder="e.g., Golden Retriever, Tabby..."
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none"
              />
            </div>
          </div>
        )}

        {/* Step 3: Color */}
        {step === 3 && (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-3 shadow-lg shadow-orange-200">
              <div className="w-6 h-6 rounded-full bg-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">What color is the pet?</h1>
            <p className="text-gray-500 mb-4">Select one or more colors</p>

            <ColorSelector value={color} onChange={setColor} />
          </div>
        )}

        {/* Step 4: Photo */}
        {step === 4 && (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center mb-3 shadow-lg shadow-blue-200">
              <Camera size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Add photos</h1>
            <p className="text-gray-500 mb-6">Photos help owners identify their pet</p>

            {/* Photo Grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {photos.map((url, index) => (
                <div key={index} className="relative aspect-square">
                  <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover rounded-xl" />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              {photos.length < 5 && (
                <label className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    multiple
                  />
                  {uploadingPhoto ? (
                    <Loader2 size={24} className="text-gray-400 animate-spin" />
                  ) : (
                    <>
                      <Camera size={24} className="text-gray-400 mb-1" />
                      <span className="text-xs text-gray-500">Add Photo</span>
                    </>
                  )}
                </label>
              )}
            </div>

            <p className="text-sm text-gray-500 text-center">
              {photos.length === 0 ? 'Photos are optional but help a lot!' : `${photos.length}/5 photos added`}
            </p>
          </div>
        )}

        {/* Step 5: Details */}
        {step === 5 && (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center mb-3 shadow-lg shadow-purple-200">
              <FileText size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Additional details</h1>
            <p className="text-gray-500 mb-6">Any other info that might help</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">When did you find the pet?</label>
                <div className="grid grid-cols-3 gap-2">
                  {['today', 'yesterday', 'earlier'].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFoundWhen(option)}
                      className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                        foundWhen === option
                          ? 'bg-green-500 text-white'
                          : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-green-300'
                      }`}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Any distinctive features, collar, tags, behavior..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Review */}
        {step === 6 && (
          <div className="flex-1 px-6 py-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-3 shadow-lg shadow-green-200">
              <Check size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Review your report</h1>
            <p className="text-gray-500 mb-6">Make sure everything looks right</p>

            <div className="space-y-4">
              {/* Photo preview */}
              {photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {photos.map((url, idx) => (
                    <img key={idx} src={url} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                  ))}
                </div>
              )}

              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Pet Type</p>
                    <p className="font-medium text-gray-900">{petType || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Breed</p>
                    <p className="font-medium text-gray-900">{breed || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Color</p>
                    <p className="font-medium text-gray-900">{color || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Found</p>
                    <p className="font-medium text-gray-900">{foundWhen}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase mb-1">Location</p>
                <p className="font-medium text-gray-900 text-sm">{foundAddress || 'Location set'}</p>
              </div>

              {description && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase mb-1">Description</p>
                  <p className="text-gray-700 text-sm">{description}</p>
                </div>
              )}

              <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
                <p className="text-xs text-green-600 uppercase mb-1">Contact</p>
                <p className="font-medium text-gray-900">{effectiveName}</p>
                <p className="text-sm text-gray-600">{effectiveEmail}</p>
                {contactPhone && <p className="text-sm text-gray-600">{contactPhone}</p>}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 pt-2 flex-shrink-0">
        <button
          onClick={nextStep}
          disabled={!canProceed() || isSubmitting}
          className={`w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
            canProceed() && !isSubmitting
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-200 hover:shadow-xl'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Submitting...
            </>
          ) : step === 6 ? (
            <>
              Submit Report
              <Check size={20} />
            </>
          ) : (
            <>
              Continue
              <ChevronRight size={20} />
            </>
          )}
        </button>
      </div>

      <style jsx global>{`
        .custom-marker { background: transparent; border: none; }
      `}</style>
    </div>
  );
}
