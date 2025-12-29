'use client';

/**
 * Report Lost Pet - Sarama-Powered Wizard
 *
 * A conversational approach to lost pet reporting guided by Sarama,
 * our AI mascot. Collects info through natural conversation, then
 * shows location picker for precise address, and submits the report.
 */

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  MapPin, Check, ChevronLeft, X, Navigation, Loader2,
  Sparkles, Heart, Mail, Search, ExternalLink, Camera, ChevronRight,
} from 'lucide-react';
import SaramaChat from '../../components/SaramaChat';

// Wizard phases
const PHASES = {
  CHAT: 'chat',        // Sarama conversation
  LOCATION: 'location', // Map-based location picker
  PHOTO: 'photo',       // Optional photo upload
  CONFIRM: 'confirm',   // Review & submit
  SUCCESS: 'success',   // Done!
};

export default function ReportLostPetSarama() {
  const { data: session, status: authStatus } = useSession();
  const isLoggedIn = authStatus === 'authenticated';

  // Wizard state
  const [phase, setPhase] = useState(PHASES.CHAT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reportResult, setReportResult] = useState(null);

  // Data collected from Sarama
  const [collectedData, setCollectedData] = useState({});

  // Contact info (for non-logged-in users)
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);

  // Location state
  const [center, setCenter] = useState(null);
  const [lastSeenAddress, setLastSeenAddress] = useState('');
  const [cityName, setCityName] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Photo state
  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Map refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Get effective email and name
  const effectiveEmail = isLoggedIn ? session?.user?.email : contactEmail;
  const effectiveName = isLoggedIn ? (session?.user?.name || 'Pet Owner') : contactName;

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

  // Handle data collection from Sarama
  const handleDataCollected = (data) => {
    setCollectedData(prev => ({ ...prev, ...data }));
  };

  // Handle wizard completion from Sarama
  const handleWizardComplete = (data) => {
    setCollectedData(prev => ({ ...prev, ...data }));

    // If user provided a location in chat, try to geocode it
    if (data.location) {
      geocodeAddress(data.location);
    }

    // Move to location phase
    setPhase(PHASES.LOCATION);

    // Start getting user's location in background
    getDeviceLocation();
  };

  // Get device location
  const getDeviceLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    setIsGettingLocation(true);
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
        setIsGettingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Geocode an address string
  const geocodeAddress = async (address) => {
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(address)}&limit=1&addressdetails=1`);
      if (response.ok) {
        const results = await response.json();
        if (Array.isArray(results) && results.length > 0) {
          const result = results[0];
          const lat = parseFloat(result.lat);
          const lon = parseFloat(result.lon);
          setCenter([lat, lon]);
          setLastSeenAddress(result.display_name);
          const addr = result.address || {};
          setCityName(addr.city || addr.town || addr.village || addr.municipality || '');
        }
      }
    } catch (err) {
      console.error('Geocode error:', err);
    }
  };

  // Reverse geocode coordinates
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

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !center || phase !== PHASES.LOCATION) return;

    // If map already exists, just update view
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, 17);
      if (markerRef.current) markerRef.current.setLatLng(center);
      if (circleRef.current) circleRef.current.setLatLng(center);
      return;
    }

    const initMap = async () => {
      const container = mapRef.current;
      if (!container || container.offsetHeight === 0) {
        setTimeout(initMap, 50);
        return;
      }

      const L = (await import('leaflet')).default;

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
  }, [center, phase]);

  // Address search
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

  // Photo upload
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

  // Submit report
  const handleSubmit = async () => {
    // Check contact info for non-logged-in users
    if (!isLoggedIn && (!contactEmail || !contactName)) {
      setShowContactForm(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Validate required fields
    if (!effectiveEmail || !effectiveName || !collectedData.petName || !collectedData.color || !center) {
      const missing = [];
      if (!effectiveEmail) missing.push('email');
      if (!effectiveName) missing.push('name');
      if (!collectedData.petName) missing.push('pet name');
      if (!collectedData.color) missing.push('color');
      if (!center) missing.push('location');
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
          petName: collectedData.petName,
          color: collectedData.color,
          lastSeenAddress,
          center,
          radiusMiles: 0.1,
          timeElapsed: collectedData.timeElapsed || '6_to_24_hours',
          petType: (collectedData.petType || 'dog').toUpperCase(),
          petSize: collectedData.petType === 'dog' ? collectedData.petSize : undefined,
          isIndoorCat: collectedData.petType === 'cat' ? collectedData.isIndoorCat : undefined,
          photos,
          locationType: 'address',
          cityName,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create report');

      setReportResult(data);
      setPhase(PHASES.SUCCESS);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Loading state
  if (authStatus === 'loading') {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Heart size={28} className="text-white" />
          </div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (phase === PHASES.SUCCESS && reportResult) {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center max-w-md w-full">
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-200">
                <Check size={40} className="text-white" strokeWidth={3} />
              </div>
              <Sparkles className="absolute -top-1 -right-1 text-yellow-400" size={20} />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">Alert Sent!</h1>

            {reportResult.caseNumber && (
              <div className="inline-block bg-gray-100 px-4 py-2 rounded-lg mb-4">
                <span className="text-sm text-gray-500">Case: </span>
                <span className="font-mono font-bold text-gray-800">{reportResult.caseNumber}</span>
              </div>
            )}

            <p className="text-gray-600 mb-6">
              {reportResult.squadsNotified || 0} rescue team{reportResult.squadsNotified === 1 ? '' : 's'} notified for <strong>{collectedData.petName}</strong>
            </p>

            {reportResult.accountCreated && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-start gap-3">
                  <Mail size={20} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-blue-800">Check your email!</p>
                    <p className="text-sm text-blue-600">We sent your login details.</p>
                  </div>
                </div>
              </div>
            )}

            <Link
              href={`/mission-control?mission=${reportResult.reportId}`}
              className="block w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-2xl font-semibold text-lg shadow-lg mb-3"
            >
              Open Mission Control
            </Link>

            <Link
              href="/dashboard"
              className="block w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-amber-100 bg-white/80 backdrop-blur-sm flex-shrink-0">
        <button
          onClick={() => {
            if (phase === PHASES.LOCATION) setPhase(PHASES.CHAT);
            else if (phase === PHASES.PHOTO) setPhase(PHASES.LOCATION);
            else if (phase === PHASES.CONFIRM) setPhase(PHASES.PHOTO);
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-amber-50 transition-colors"
        >
          {phase === PHASES.CHAT ? (
            <Link href="/dashboard"><X size={24} className="text-gray-600" /></Link>
          ) : (
            <ChevronLeft size={24} className="text-gray-600" />
          )}
        </button>

        <div className="flex-1 text-center">
          <p className="text-sm font-medium text-gray-900">Report Lost Pet</p>
          <p className="text-xs text-gray-500">
            {phase === PHASES.CHAT && 'Chat with Sarama'}
            {phase === PHASES.LOCATION && 'Set Location'}
            {phase === PHASES.PHOTO && 'Add Photo'}
            {phase === PHASES.CONFIRM && 'Review'}
          </p>
        </div>

        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Chat Phase */}
        {phase === PHASES.CHAT && (
          <SaramaChat
            onDataCollected={handleDataCollected}
            onWizardComplete={handleWizardComplete}
            initialData={collectedData}
            className="flex-1"
          />
        )}

        {/* Location Phase */}
        {phase === PHASES.LOCATION && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-3">
              <h1 className="text-lg font-bold text-gray-900 mb-1">Where was {collectedData.petName} last seen?</h1>
              <p className="text-sm text-gray-500">Drag the pin to the exact spot</p>

              {/* Address Search */}
              <div className="relative mt-3">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={addressSearch}
                  onChange={(e) => {
                    setAddressSearch(e.target.value);
                    searchAddress(e.target.value);
                  }}
                  placeholder="Search address..."
                  className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
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

            <div className="flex-1 relative mx-4 mb-2 rounded-2xl overflow-hidden shadow-lg border border-gray-100 min-h-[250px]">
              {isGettingLocation && !center ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                      <Navigation size={28} className="text-amber-500 animate-pulse" />
                    </div>
                    <p className="text-gray-600 font-medium">Finding your location...</p>
                  </div>
                </div>
              ) : !center ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
                  <div className="text-center px-6">
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                      <MapPin size={28} className="text-amber-500" />
                    </div>
                    <p className="text-gray-900 font-semibold mb-1">Enter your location</p>
                    <p className="text-gray-500 text-sm">Search for an address above</p>
                  </div>
                </div>
              ) : (
                <div ref={mapRef} className="absolute inset-0" />
              )}
            </div>

            {center && (
              <div className="px-4 pb-2">
                <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                  <p className="text-sm text-gray-600 truncate mb-1">{lastSeenAddress || 'Location set'}</p>
                  <button
                    onClick={openInMaps}
                    className="text-xs text-amber-600 font-medium flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> Open in Maps
                  </button>
                </div>
              </div>
            )}

            {/* Next button */}
            <div className="px-4 pb-4 pt-2">
              <button
                onClick={() => setPhase(PHASES.PHOTO)}
                disabled={!center}
                className={`w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
                  center
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                Continue
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Photo Phase */}
        {phase === PHASES.PHOTO && (
          <div className="flex-1 flex flex-col px-4 py-4 overflow-y-auto">
            <h1 className="text-lg font-bold text-gray-900 mb-1">Add a photo of {collectedData.petName}</h1>
            <p className="text-sm text-gray-500 mb-4">A clear photo helps others spot your pet</p>

            {photos.length > 0 ? (
              <div className="relative rounded-2xl overflow-hidden shadow-lg mb-4">
                <img src={photos[0]} alt="Pet" className="w-full aspect-square object-cover" />
                <button
                  onClick={() => setPhotos([])}
                  className="absolute top-3 right-3 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
                >
                  <X size={20} />
                </button>
                <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-full flex items-center gap-1.5">
                  <Check size={14} /> Photo added
                </div>
              </div>
            ) : (
              <label className="block aspect-square bg-white border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-all">
                <div className="h-full flex flex-col items-center justify-center">
                  {uploadingPhoto ? (
                    <div className="text-center">
                      <Loader2 size={40} className="text-amber-500 animate-spin mx-auto mb-3" />
                      <p className="text-gray-500">Uploading...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                        <Camera size={28} className="text-amber-500" />
                      </div>
                      <p className="text-gray-900 font-medium">Tap to add photo</p>
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

            <div className="mt-auto pt-4 space-y-3">
              <button
                onClick={() => setPhase(PHASES.CONFIRM)}
                className="w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg"
              >
                {photos.length > 0 ? 'Continue' : 'Skip for now'}
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Confirm Phase */}
        {phase === PHASES.CONFIRM && (
          <div className="flex-1 flex flex-col px-4 py-4 overflow-y-auto">
            <h1 className="text-lg font-bold text-gray-900 mb-1">Ready to send alert?</h1>
            <p className="text-sm text-gray-500 mb-4">Review the details below</p>

            {/* Contact form for non-logged-in users */}
            {!isLoggedIn && showContactForm && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <p className="font-medium text-blue-800 mb-3">We need your contact info:</p>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl border border-blue-200 focus:border-blue-400 outline-none"
                  />
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-4 py-3 rounded-xl border border-blue-200 focus:border-blue-400 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* Pet */}
              <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-amber-100 flex items-center justify-center flex-shrink-0">
                  {photos[0] ? (
                    <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">
                      {collectedData.petType === 'dog' ? '🐕' : collectedData.petType === 'cat' ? '🐈' : '🐾'}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase">Pet</p>
                  <p className="font-medium text-gray-900">{collectedData.petName}</p>
                  <p className="text-sm text-gray-500">{collectedData.color} {collectedData.petType}</p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <MapPin size={20} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase">Last Seen</p>
                  <p className="font-medium text-gray-900 truncate">{cityName || lastSeenAddress || 'Location set'}</p>
                </div>
              </div>

              {/* Contact */}
              {(isLoggedIn || contactEmail) && (
                <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Mail size={20} className="text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Contact</p>
                    <p className="font-medium text-gray-900">{effectiveName}</p>
                    <p className="text-sm text-gray-500">{effectiveEmail}</p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="mt-auto pt-4">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Creating alert...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Send Alert
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-marker { background: transparent; border: none; }
      `}</style>
    </div>
  );
}
