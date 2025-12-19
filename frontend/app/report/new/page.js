'use client';

/**
 * Report Lost Pet - Midnight & Flash Design
 *
 * Multi-step wizard for reporting a lost pet:
 * 1. Pet type selection
 * 2. Location & time
 * 3. Map with search radius
 * 4. Contact info (skipped if logged in)
 * 5. Pet details & photos
 * 6. Success with squad assignment
 */

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Dog, Cat, Bird, Rabbit, MapPin, Clock, Search,
  User, Mail, Phone, Camera, Check, ChevronLeft,
  ChevronRight, AlertTriangle, Loader2, Sparkles,
  Shield, Users, Bell, ArrowRight, Crosshair
} from 'lucide-react';
import BreedSelector from '../../components/BreedSelector';
import ColorSelector from '../../components/ColorSelector';
import CitySearchInput, { getCountryFlag } from '../../components/CitySearchInput';

// Step configuration
const STEPS = [
  { id: 1, label: 'Pet Type', icon: Dog },
  { id: 2, label: 'Location', icon: MapPin },
  { id: 3, label: 'Search Area', icon: Search },
  { id: 4, label: 'Contact', icon: User },
  { id: 5, label: 'Details', icon: Camera },
];

const PET_TYPES = [
  { type: 'dog', label: 'Dog', icon: Dog, color: 'from-blue-500 to-cyan-500' },
  { type: 'cat', label: 'Cat', icon: Cat, color: 'from-violet-500 to-purple-500' },
  { type: 'bird', label: 'Bird', icon: Bird, color: 'from-emerald-500 to-teal-500' },
  { type: 'other', label: 'Other', icon: Rabbit, color: 'from-amber-500 to-orange-500' },
];

const TIME_OPTIONS = [
  { value: 'less_than_hour', label: 'Less than 1 hour ago', urgency: 'critical' },
  { value: '1_to_6_hours', label: '1-6 hours ago', urgency: 'high' },
  { value: '6_to_24_hours', label: '6-24 hours ago', urgency: 'medium' },
  { value: '1_to_3_days', label: '1-3 days ago', urgency: 'medium' },
  { value: '3_to_7_days', label: '3-7 days ago', urgency: 'normal' },
  { value: '1_to_2_weeks', label: '1-2 weeks ago', urgency: 'normal' },
  { value: 'more_than_2_weeks', label: 'More than 2 weeks ago', urgency: 'normal' },
];

export default function ReportLostPet() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const petId = searchParams.get('petId');

  const [step, setStep] = useState(1);
  const [petType, setPetType] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLoadingPet, setIsLoadingPet] = useState(false);
  const [prefillPet, setPrefillPet] = useState(null);

  // Location and map data
  const [locationMethod, setLocationMethod] = useState(''); // 'city' or 'pin'
  const [lastSeenAddress, setLastSeenAddress] = useState('');
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState(null); // Full city object with lat/lng/country
  const [center, setCenter] = useState(null);
  const [radiusMiles] = useState(5); // Auto-set to 5 miles (squad coverage determines actual assignment)
  const [timeElapsed, setTimeElapsed] = useState('');
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [cityName, setCityName] = useState(''); // City name for notifications
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Report submission data
  const [reportData, setReportData] = useState({
    email: '',
    phone: '',
    firstName: '',
    petName: '',
    breed: '',
    color: '',
    size: 'MEDIUM',
    distinctiveMarks: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reportResult, setReportResult] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Validation states
  const [touched, setTouched] = useState({});

  // Auto-fill user data from session
  useEffect(() => {
    if (session?.user) {
      setReportData(prev => ({
        ...prev,
        email: session.user.email || '',
        firstName: session.user.name || '',
      }));
    }
  }, [session]);

  // Handle city selection from unified search
  const handleCitySelect = (city) => {
    setSelectedCity(city);
    setCityName(city.city);
    const flag = getCountryFlag(city.country);
    setLastSeenAddress(`${city.city}, ${city.state_name || city.state_id}, ${city.country} ${flag}`);
    if (city.lat && city.lng) {
      setCenter([city.lat, city.lng]);
      setLocationConfirmed(false);
      setStep(3);
    }
  };

  // Pre-fill from existing pet profile if petId is provided
  useEffect(() => {
    if (!petId) return;

    const fetchPet = async () => {
      setIsLoadingPet(true);
      try {
        const response = await fetch(`/api/pets/${petId}`);
        if (response.ok) {
          const pet = await response.json();
          setPrefillPet(pet);

          // Map species to petType
          const speciesMap = {
            'DOG': 'dog',
            'CAT': 'cat',
            'BIRD': 'bird',
          };
          const mappedType = speciesMap[pet.species] || 'other';
          setPetType(mappedType);

          // Pre-fill pet data
          setReportData(prev => ({
            ...prev,
            petName: pet.name || '',
            breed: pet.breed || '',
            color: pet.color || '',
            size: pet.size || 'MEDIUM',
            distinctiveMarks: pet.distinctiveMarks || '',
          }));

          // Pre-fill photos
          if (pet.primaryPhotoUrl) {
            setPhotos([pet.primaryPhotoUrl]);
          }

          // Skip to step 2 since pet type is pre-selected
          setStep(2);
        }
      } catch (err) {
        console.error('Error fetching pet:', err);
      } finally {
        setIsLoadingPet(false);
      }
    };

    fetchPet();
  }, [petId]);

  // Initialize map when on step 3
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || !center || step !== 3) {
      if (step !== 3 && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
      return;
    }

    if (mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      // Dark map style matching midnight theme
      const map = L.map(mapRef.current, {
        zoomControl: false,
      }).setView(center, 14);
      mapInstanceRef.current = map;

      L.control.zoom({ position: 'topright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      // Custom marker with flash yellow glow
      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="relative">
            <div class="absolute -inset-4 bg-flash-500/30 rounded-full animate-ping"></div>
            <div class="w-8 h-8 bg-gradient-to-br from-flash-400 to-flash-600 rounded-full border-2 border-white shadow-lg shadow-flash-500/50 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const marker = L.marker(center, {
        draggable: true,
        icon: markerIcon,
      }).addTo(map);
      markerRef.current = marker;

      const circle = L.circle(center, {
        color: '#facc15',
        fillColor: '#facc15',
        fillOpacity: 0.15,
        weight: 2,
        radius: radiusMiles * 1609.34,
      }).addTo(map);
      circleRef.current = circle;

      marker.on('dragend', async function(e) {
        const pos = e.target.getLatLng();
        setCenter([pos.lat, pos.lng]);
        // Update address when marker is dragged
        const result = await reverseGeocode(pos.lat, pos.lng);
        setLastSeenAddress(result.address);
        setCityName(result.city);
      });

      // Fit bounds to circle
      map.fitBounds(circle.getBounds(), { padding: [20, 20] });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
  }, [step, center]);

  useEffect(() => {
    if (markerRef.current && circleRef.current && center) {
      markerRef.current.setLatLng(center);
      circleRef.current.setLatLng(center);
    }
  }, [center]);

  useEffect(() => {
    if (circleRef.current && mapInstanceRef.current) {
      circleRef.current.setRadius(radiusMiles * 1609.34);
      mapInstanceRef.current.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
    }
  }, [radiusMiles]);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    const maxPhotos = 5;

    if (photos.length + files.length > maxPhotos) {
      setError(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    // Validate file sizes first
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Each photo must be under 10MB');
        return;
      }
    }

    setError(null);
    setUploadingPhotos(true);

    try {
      const uploadedUrls = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('context', 'pet');

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to upload photo');
        }

        const data = await response.json();
        if (data.url) {
          uploadedUrls.push(data.url);
        }
      }

      setPhotos(prev => [...prev, ...uploadedUrls]);
    } catch (err) {
      console.error('Photo upload error:', err);
      setError(err.message || 'Failed to upload photos. Please try again.');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Reverse geocode coordinates to get address and city using Nominatim
  const reverseGeocode = async (lat, lon) => {
    try {
      const response = await fetch(
        `/api/geocode?lat=${lat}&lon=${lon}&addressdetails=1`
      );

      if (!response.ok) {
        console.warn('Reverse geocode failed with status:', response.status);
        return {
          address: `Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          city: '',
        };
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.warn('Reverse geocode returned non-JSON response');
        return {
          address: `Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          city: '',
        };
      }

      if (data && data.display_name) {
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.municipality ||
                     addr.hamlet || addr.suburb || addr.county || '';
        return {
          address: data.display_name,
          city: city,
        };
      }
    } catch (err) {
      console.error('Reverse geocoding error:', err);
    }
    return {
      address: `Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      city: '',
    };
  };

  // Handle "drop pin" - get user's current location or default
  const handleDropPin = async () => {
    setError(null);
    setIsGeocoding(true);

    try {
      // Try to get user's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            setCenter([latitude, longitude]);
            // Reverse geocode to get actual address
            const result = await reverseGeocode(latitude, longitude);
            setLastSeenAddress(result.address);
            setCityName(result.city);
            setLocationConfirmed(false);
            setStep(3);
            setIsGeocoding(false);
          },
          async (error) => {
            // If geolocation fails, use a default (Chicago center)
            console.warn('Geolocation failed:', error);
            const defaultLat = 41.8781;
            const defaultLon = -87.6298;
            setCenter([defaultLat, defaultLon]);
            setLastSeenAddress('Chicago, IL (drag pin to your location)');
            setCityName('Chicago');
            setLocationConfirmed(false);
            setStep(3);
            setIsGeocoding(false);
          },
          { timeout: 10000 }
        );
      } else {
        // No geolocation support, use default
        const defaultLat = 41.8781;
        const defaultLon = -87.6298;
        setCenter([defaultLat, defaultLon]);
        setLastSeenAddress('Chicago, IL (drag pin to your location)');
        setCityName('Chicago');
        setLocationConfirmed(false);
        setStep(3);
        setIsGeocoding(false);
      }
    } catch (err) {
      setError('Could not get location. Please try entering an address.');
      setIsGeocoding(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    // Validate location
    if (!center || !Array.isArray(center) || center.length !== 2) {
      setError('Please set a valid location. Go back to step 2.');
      setIsSubmitting(false);
      return;
    }

    // Validate required fields
    if (!reportData.petName) {
      setError('Please enter your pet\'s name');
      setIsSubmitting(false);
      return;
    }

    if (!reportData.color) {
      setError('Please select your pet\'s color');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: reportData.email,
          phone: reportData.phone,
          firstName: reportData.firstName,
          petName: reportData.petName,
          breed: reportData.breed,
          color: reportData.color,
          size: reportData.size,
          distinctiveMarks: reportData.distinctiveMarks,
          lastSeenAddress,
          center,
          radiusMiles,
          timeElapsed,
          petType,
          photos,
          // Location type info for squad notifications
          locationType: locationMethod, // 'address', 'zip', or 'pin'
          cityName, // City name for zip code notifications
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create report');
      }

      setReportResult(data);
      setStep(6);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedFromStep4 = reportData.firstName && reportData.email;
  const canSubmit = reportData.petName && reportData.color && center && locationConfirmed && !uploadingPhotos;

  // Determine which step to skip to based on session
  const nextStepFromMap = session?.user ? 5 : 4;
  const prevStepFromDetails = session?.user ? 3 : 4;

  return (
    <div className="min-h-screen bg-midnight-50 text-midnight-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-midnight-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-midnight-600 hover:text-midnight-900 transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="font-medium">Back</span>
          </Link>

          {session?.user && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-sm">
              <Check size={14} className="text-green-600" />
              <span className="text-green-700">Signed in</span>
            </div>
          )}
        </div>
      </header>

      {/* Progress indicator - only show during form steps */}
      {step >= 2 && step <= 5 && (
        <div className="bg-white border-b border-midnight-200 py-4">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-center justify-between gap-2">
              {STEPS.slice(1).map((s, idx) => {
                const stepNum = s.id;
                const isActive = step === stepNum;
                const isComplete = step > stepNum;
                const Icon = s.icon;

                // Skip step 4 indicator if logged in
                if (stepNum === 4 && session?.user) return null;

                return (
                  <div key={s.id} className="flex-1 flex items-center">
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                        ${isComplete
                          ? 'bg-flash-500 shadow-glow-flash'
                          : isActive
                            ? 'bg-flash-100 border-2 border-flash-500 shadow-glow-flash-sm'
                            : 'bg-midnight-50 border border-midnight-200'
                        }
                      `}
                    >
                      {isComplete ? (
                        <Check size={18} className="text-midnight-900" />
                      ) : (
                        <Icon size={18} className={isActive ? 'text-flash-600' : 'text-midnight-400'} />
                      )}
                    </div>
                    {idx < (session?.user ? 2 : 3) && (
                      <div
                        className={`
                          flex-1 h-1 mx-2 rounded-full transition-all duration-300
                          ${isComplete
                            ? 'bg-gradient-to-r from-flash-400 to-flash-500'
                            : 'bg-midnight-100'
                          }
                        `}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <main className="report-form max-w-4xl mx-auto px-4 py-8">
        {/* Loading state for pet prefill */}
        {isLoadingPet && (
          <div className="text-center py-12">
            <Loader2 size={48} className="mx-auto mb-4 text-flash-500 animate-spin" />
            <p className="text-midnight-700">Loading pet information...</p>
          </div>
        )}

        {/* Error display with dismiss */}
        {error && !isLoadingPet && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
          >
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700">{error}</p>
              {error.includes('location') && (
                <p className="text-sm text-midnight-600 mt-1">
                  Try a different address format or use zip code instead.
                </p>
              )}
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-midnight-900 transition-colors p-1"
              aria-label="Dismiss error"
            >
              <span className="text-xl leading-none">&times;</span>
            </button>
          </div>
        )}

        {/* Pre-filled pet notice */}
        {prefillPet && step >= 2 && step <= 5 && (
          <div className="mb-6 p-4 bg-flash-50 border border-flash-200 rounded-xl flex items-start gap-3">
            <Sparkles size={20} className="text-flash-500 flex-shrink-0 mt-0.5" />
            <p className="text-midnight-700">
              <strong className="text-flash-600">Pre-filled from {prefillPet.name}'s profile.</strong> You can update any details below.
            </p>
          </div>
        )}

        {/* Step 1: Pet Type Selection */}
        {step === 1 && !isLoadingPet && (
          <div className="text-center max-w-xl mx-auto">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 rounded-full" />
              <AlertTriangle size={64} className="relative text-red-600" />
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-red-600 to-orange-400 bg-clip-text text-transparent">
              Report Lost Pet
            </h1>
            <p className="text-lg text-midnight-700 mb-10">
              Alert your community and mobilize rescue squads to help find your pet
            </p>

            <h2 className="text-xl font-semibold mb-6 text-midnight-900" id="pet-type-label">
              What type of pet is missing?
            </h2>

            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
              role="radiogroup"
              aria-labelledby="pet-type-label"
            >
              {PET_TYPES.map((pet) => {
                const Icon = pet.icon;
                return (
                  <button
                    key={pet.type}
                    onClick={() => {
                      setPetType(pet.type);
                      setStep(2);
                    }}
                    role="radio"
                    aria-checked={petType === pet.type}
                    aria-label={`Report lost ${pet.label.toLowerCase()}`}
                    className={`
                      relative group p-4 sm:p-6 rounded-2xl border-2 border-midnight-200
                      bg-white hover:bg-midnight-50
                      transition-all duration-300 hover:scale-[1.02]
                      hover:border-flash-400
                      hover:shadow-glow-flash-sm
                      focus:outline-none focus:ring-2 focus:ring-flash-400 focus:ring-offset-2 focus:ring-offset-midnight-50
                    `}
                  >
                    <div className={`
                      w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-2xl bg-gradient-to-br ${pet.color}
                      flex items-center justify-center shadow-lg
                      group-hover:shadow-xl group-hover:scale-110 transition-all duration-300
                    `}>
                      <Icon size={24} className="sm:hidden text-white" />
                      <Icon size={32} className="hidden sm:block text-white" />
                    </div>
                    <span className="text-base sm:text-lg font-semibold text-midnight-900">
                      {pet.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Time & Location Method */}
        {step === 2 && (
          <div className="max-w-xl mx-auto space-y-6">
            {/* Time Selection */}
            <div className="bg-white rounded-2xl border border-midnight-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <Clock size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-midnight-900">When did they go missing?</h3>
                </div>
              </div>

              <div className="grid gap-2">
                {TIME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTimeElapsed(option.value)}
                    className={`
                      w-full p-3 rounded-xl border text-left transition-all
                      ${timeElapsed === option.value
                        ? 'bg-flash-100 border-flash-500'
                        : 'bg-midnight-50 border-midnight-200 hover:border-midnight-400'
                      }
                    `}
                  >
                    <span className={`flex items-center justify-between ${timeElapsed === option.value ? 'text-flash-700' : 'text-midnight-700'}`}>
                      {option.label}
                      {option.urgency === 'critical' && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">
                          URGENT
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>

              {!timeElapsed && (
                <p className="mt-3 text-sm text-amber-600">
                  Please select when your pet went missing
                </p>
              )}
            </div>

            {/* Location Selection */}
            <div className="bg-white rounded-2xl border border-midnight-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-flash-100 flex items-center justify-center">
                  <MapPin size={20} className="text-flash-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-midnight-900">Where were they last seen?</h3>
                  <p className="text-sm text-midnight-600">Search by city name or postal code</p>
                </div>
              </div>

              {/* Location method buttons */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => setLocationMethod('city')}
                  className={`
                    p-4 rounded-xl border text-center transition-all
                    ${locationMethod === 'city'
                      ? 'bg-flash-100 border-flash-500'
                      : 'bg-midnight-50 border-midnight-200 hover:border-midnight-400'
                    }
                  `}
                >
                  <Search size={24} className={`mx-auto mb-2 ${locationMethod === 'city' ? 'text-flash-600' : 'text-midnight-600'}`} />
                  <span className={`text-sm font-medium ${locationMethod === 'city' ? 'text-flash-700' : 'text-midnight-700'}`}>
                    City / Postal Code
                  </span>
                </button>
                <button
                  onClick={() => setLocationMethod('pin')}
                  className={`
                    p-4 rounded-xl border text-center transition-all
                    ${locationMethod === 'pin'
                      ? 'bg-flash-100 border-flash-500'
                      : 'bg-midnight-50 border-midnight-200 hover:border-midnight-400'
                    }
                  `}
                >
                  <Crosshair size={24} className={`mx-auto mb-2 ${locationMethod === 'pin' ? 'text-flash-600' : 'text-midnight-600'}`} />
                  <span className={`text-sm font-medium ${locationMethod === 'pin' ? 'text-flash-700' : 'text-midnight-700'}`}>
                    Use My Location
                  </span>
                </button>
              </div>

              {/* Unified city search input */}
              {locationMethod === 'city' && (
                <div>
                  <CitySearchInput
                    value={citySearchTerm}
                    onChange={setCitySearchTerm}
                    onSelect={handleCitySelect}
                    selectedCity={selectedCity}
                    placeholder="e.g., Los Angeles, Chicago, 90210, Ciudad de México"
                    label="City or Postal Code"
                    showIcon={true}
                  />
                  {selectedCity && center && (
                    <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                      <Check size={14} /> Location set: {selectedCity.city}, {selectedCity.state_name || selectedCity.state_id}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-midnight-500">
                    35+ countries supported including US, Canada, Mexico, Colombia, Caribbean, and Central America
                  </p>
                </div>
              )}

              {/* Pin on map info */}
              {locationMethod === 'pin' && (
                <div className="p-4 bg-midnight-50 rounded-xl">
                  <p className="text-midnight-700 text-sm">
                    We'll use your current location or let you drop a pin on the map to mark where your pet was last seen.
                  </p>
                </div>
              )}

              {!locationMethod && (
                <p className="text-sm text-amber-600">
                  Select how you want to enter the location
                </p>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 px-4 rounded-xl bg-midnight-50 text-midnight-700
                  border border-midnight-200 hover:bg-midnight-100 transition-all
                  flex items-center justify-center gap-2"
              >
                <ChevronLeft size={18} />
                Back
              </button>
              <button
                onClick={() => {
                  if (locationMethod === 'city' && center) {
                    // Already validated via city search, go to step 3
                    setStep(3);
                  } else if (locationMethod === 'pin') {
                    handleDropPin();
                  }
                }}
                disabled={
                  !timeElapsed ||
                  !locationMethod ||
                  (locationMethod === 'city' && !center) ||
                  isGeocoding
                }
                className={`
                  flex-[2] py-3 px-4 rounded-xl font-medium transition-all
                  flex items-center justify-center gap-2
                  ${timeElapsed && locationMethod && !isGeocoding &&
                    ((locationMethod === 'city' && center) ||
                     locationMethod === 'pin')
                    ? 'bg-gradient-to-r from-flash-400 to-flash-500 text-midnight-900 shadow-glow-flash hover:shadow-glow-flash-lg'
                    : 'bg-midnight-100 text-midnight-400 cursor-not-allowed'
                  }
                `}
              >
                {isGeocoding ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Finding location...
                  </>
                ) : (
                  <>
                    Set Location on Map
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm Location on Map */}
        {step === 3 && center && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-2xl border border-midnight-200 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-midnight-200">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-flash-100 flex items-center justify-center flex-shrink-0">
                    <MapPin size={20} className="sm:hidden text-flash-600" />
                    <MapPin size={24} className="hidden sm:block text-flash-600" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-midnight-900">Confirm Last Seen Location</h2>
                    <p className="text-sm sm:text-base text-midnight-600">
                      <span className="hidden sm:inline">Drag the marker to the exact spot. Set how far they may have wandered.</span>
                      <span className="sm:hidden">Drag marker to exact spot</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Drag instruction banner */}
              <div className="px-4 py-2 bg-flash-50 border-b border-midnight-200 flex items-center justify-center gap-2">
                <Crosshair size={14} className="text-flash-600" />
                <span className="text-xs sm:text-sm text-flash-700">
                  Drag the flash yellow marker to adjust location
                </span>
              </div>

              {/* Map container - responsive height */}
              <div className="h-[280px] sm:h-[350px] md:h-[400px] lg:h-[450px]">
                <div ref={mapRef} className="h-full w-full" />
              </div>

              {/* Info about coverage */}
              <div className="p-4 sm:p-6 bg-midnight-50 rounded-xl">
                <p className="text-sm text-midnight-700">
                  Your local rescue squad will be automatically notified based on your location.
                  The search area is set to {radiusMiles} miles and nearby rescue squads will be alerted.
                </p>
              </div>
            </div>

            {/* Tip */}
            <div className="p-4 bg-flash-50 border border-flash-200 rounded-xl flex items-start gap-3">
              <Sparkles size={20} className="text-flash-600 flex-shrink-0 mt-0.5" />
              <p className="text-midnight-700">
                <strong className="text-flash-700">Tip:</strong> Rescue squads in your area will be automatically notified.
                They'll coordinate search efforts based on your pet's last known location.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep(2);
                  setCenter(null);
                  setLocationConfirmed(false);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-midnight-50 text-midnight-700
                  border border-midnight-200 hover:bg-midnight-100 transition-all
                  flex items-center justify-center gap-2"
              >
                <ChevronLeft size={18} />
                Back
              </button>
              <button
                onClick={() => {
                  setLocationConfirmed(true);
                  setStep(nextStepFromMap);
                }}
                className="flex-[2] py-3 px-4 rounded-xl font-medium transition-all
                  bg-gradient-to-r from-flash-400 to-flash-500 text-midnight-900
                  shadow-glow-flash hover:shadow-glow-flash-lg
                  flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Confirm Location
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Contact Info (only if not logged in) */}
        {step === 4 && !session?.user && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-2xl border border-midnight-200 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
                  <User size={24} className="text-violet-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-midnight-900">Your Contact Information</h2>
                  <p className="text-midnight-600">So rescuers can reach you with sightings</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-midnight-700">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={reportData.firstName}
                    onChange={(e) => setReportData({ ...reportData, firstName: e.target.value })}
                    placeholder="John"
                    className="w-full px-4 py-3 bg-midnight-50 border border-midnight-200 rounded-xl
                      text-midnight-900 placeholder:text-midnight-600
                      focus:outline-none focus:border-flash-500 focus:ring-1 focus:ring-flash-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-midnight-700">
                    <Mail size={14} className="inline mr-1" />
                    Email *
                  </label>
                  <input
                    type="email"
                    value={reportData.email}
                    onChange={(e) => setReportData({ ...reportData, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 bg-midnight-50 border border-midnight-200 rounded-xl
                      text-midnight-900 placeholder:text-midnight-600
                      focus:outline-none focus:border-flash-500 focus:ring-1 focus:ring-flash-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-midnight-700">
                    <Phone size={14} className="inline mr-1" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={reportData.phone}
                    onChange={(e) => setReportData({ ...reportData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 bg-midnight-50 border border-midnight-200 rounded-xl
                      text-midnight-900 placeholder:text-midnight-600
                      focus:outline-none focus:border-flash-500 focus:ring-1 focus:ring-flash-500"
                  />
                  <p className="mt-1 text-sm text-midnight-600">For text alerts about sightings</p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 px-4 rounded-xl bg-midnight-50 text-midnight-700
                    border border-midnight-200 hover:bg-midnight-100 transition-all
                    flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={18} />
                  Back
                </button>
                <button
                  onClick={() => setStep(5)}
                  disabled={!canProceedFromStep4}
                  className={`
                    flex-[2] py-3 px-4 rounded-xl font-medium transition-all
                    flex items-center justify-center gap-2
                    ${canProceedFromStep4
                      ? 'bg-gradient-to-r from-flash-400 to-flash-500 text-midnight-900 shadow-glow-flash hover:shadow-glow-flash-lg'
                      : 'bg-midnight-100 text-midnight-400 cursor-not-allowed'
                    }
                  `}
                >
                  Continue
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Pet Details */}
        {step === 5 && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-midnight-200 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                  <Camera size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-midnight-900">Tell us about your pet</h2>
                  <p className="text-midnight-600">Help people identify and find them</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-midnight-700">
                    Pet's Name *
                  </label>
                  <input
                    type="text"
                    value={reportData.petName}
                    onChange={(e) => setReportData({ ...reportData, petName: e.target.value })}
                    placeholder="Max"
                    disabled={isSubmitting}
                    className={`w-full px-4 py-3 bg-midnight-50 border border-midnight-200 rounded-xl
                      text-midnight-900 placeholder:text-midnight-600
                      focus:outline-none focus:border-flash-500 focus:ring-1 focus:ring-flash-500
                      ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-midnight-700">
                    Breed
                  </label>
                  <div className="breed-selector-wrapper">
                    <BreedSelector
                      species={petType}
                      value={reportData.breed}
                      onChange={(breed) => setReportData({ ...reportData, breed })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-midnight-700">
                    Color/Pattern *
                  </label>
                  <div className="color-selector-wrapper">
                    <ColorSelector
                      value={reportData.color}
                      onChange={(color) => setReportData({ ...reportData, color })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-midnight-700">
                    Size
                  </label>
                  <select
                    value={reportData.size}
                    onChange={(e) => setReportData({ ...reportData, size: e.target.value })}
                    disabled={isSubmitting}
                    className={`w-full px-4 py-3 bg-midnight-50 border border-midnight-200 rounded-xl
                      text-midnight-900 focus:outline-none focus:border-flash-500
                      ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {petType === 'bird' ? (
                      <>
                        <option value="TINY">Small (Parakeet, Finch)</option>
                        <option value="SMALL">Medium (Cockatiel, Conure)</option>
                        <option value="MEDIUM">Large (African Grey, Amazon)</option>
                        <option value="LARGE">Very Large (Macaw, Cockatoo)</option>
                      </>
                    ) : petType === 'cat' ? (
                      <>
                        <option value="TINY">Small (&lt; 8 lbs)</option>
                        <option value="SMALL">Medium (8-12 lbs)</option>
                        <option value="MEDIUM">Large (12-18 lbs)</option>
                        <option value="LARGE">Very Large (&gt; 18 lbs)</option>
                      </>
                    ) : (
                      <>
                        <option value="TINY">Tiny (&lt; 10 lbs)</option>
                        <option value="SMALL">Small (10-25 lbs)</option>
                        <option value="MEDIUM">Medium (25-60 lbs)</option>
                        <option value="LARGE">Large (60-90 lbs)</option>
                        <option value="GIANT">Giant (&gt; 90 lbs)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Photo upload */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-midnight-700">
                    <Camera size={14} className="inline mr-1" />
                    Photos (up to 5)
                  </label>

                  {photos.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-3">
                      {photos.map((photo, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={photo}
                            alt={`Pet photo ${index + 1}`}
                            className="w-24 h-24 object-cover rounded-lg border border-midnight-200"
                          />
                          {!isSubmitting && (
                            <button
                              onClick={() => removePhoto(index)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full
                                flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {photos.length < 5 && !isSubmitting && (
                    uploadingPhotos ? (
                      <div className="block p-6 border-2 border-dashed border-flash-500 rounded-xl text-center">
                        <Loader2 size={32} className="mx-auto mb-2 text-flash-500 animate-spin" />
                        <span className="text-flash-600">Uploading photos...</span>
                      </div>
                    ) : (
                      <label className="block p-6 border-2 border-dashed border-midnight-200 rounded-xl
                        hover:border-flash-500 transition-colors cursor-pointer text-center">
                        <Camera size={32} className="mx-auto mb-2 text-midnight-400" />
                        <span className="text-midnight-700">Click to upload photos</span>
                        <span className="block text-sm text-midnight-600">Max 10MB each</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                    )
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-midnight-700">
                    Distinctive Features
                  </label>
                  <textarea
                    value={reportData.distinctiveMarks}
                    onChange={(e) => setReportData({ ...reportData, distinctiveMarks: e.target.value })}
                    placeholder="Black spot on left ear, scar on right paw, very friendly with strangers..."
                    rows={3}
                    disabled={isSubmitting}
                    className={`w-full px-4 py-3 bg-midnight-50 border border-midnight-200 rounded-xl
                      text-midnight-900 placeholder:text-midnight-600
                      focus:outline-none focus:border-flash-500 resize-none
                      ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep(prevStepFromDetails)}
                  disabled={isSubmitting}
                  className={`flex-1 py-3 px-4 rounded-xl bg-midnight-50 text-midnight-700
                    border border-midnight-200 transition-all flex items-center justify-center gap-2
                    ${isSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-midnight-100'}`}
                >
                  <ChevronLeft size={18} />
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  className={`
                    flex-[2] py-3 px-4 rounded-xl font-medium transition-all
                    flex items-center justify-center gap-2
                    ${canSubmit && !isSubmitting
                      ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-white shadow-glow-green hover:shadow-glow-green-lg'
                      : 'bg-midnight-100 text-midnight-400 cursor-not-allowed'
                    }
                  `}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Creating Alert...
                    </>
                  ) : (
                    <>
                      <Bell size={18} />
                      Create Alert
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Success */}
        {step === 6 && reportResult && (
          <div className="max-w-xl mx-auto text-center">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-green-500 blur-3xl opacity-30 rounded-full animate-pulse" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-400 rounded-full flex items-center justify-center shadow-glow-green">
                <Check size={48} className="text-white" />
              </div>
            </div>

            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
              Alert Created!
            </h1>
            <p className="text-lg text-midnight-700 mb-8">
              {reportResult.squadsNotified || 0} rescue squad{reportResult.squadsNotified === 1 ? '' : 's'} and {reportResult.patrolAlerted || 0} patrol member{reportResult.patrolAlerted === 1 ? '' : 's'} have been notified about {reportData.petName}.
            </p>

            {/* Report Summary */}
            <div className="bg-white rounded-2xl border border-midnight-200 p-4 sm:p-6 text-left mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Search size={20} className="text-flash-500" />
                Report Summary
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-midnight-600">Pet Name</p>
                  <p className="font-medium text-midnight-900">{reportData.petName}</p>
                </div>
                <div>
                  <p className="text-midnight-600">Type</p>
                  <p className="font-medium text-midnight-900 capitalize">{petType}</p>
                </div>
                <div>
                  <p className="text-midnight-600">Color</p>
                  <p className="font-medium text-midnight-900">{reportData.color}</p>
                </div>
                <div>
                  <p className="text-midnight-600">Last Seen</p>
                  <p className="font-medium text-midnight-900">
                    {TIME_OPTIONS.find(opt => opt.value === timeElapsed)?.label || 'Recently'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-midnight-600">Last Seen Location</p>
                  <p className="font-medium text-midnight-900 text-sm break-words">{lastSeenAddress}</p>
                </div>
              </div>
              {reportResult.reportId && (
                <div className="mt-4 pt-4 border-t border-midnight-200">
                  <p className="text-xs text-midnight-600">
                    Report ID: <span className="font-mono text-flash-600">{reportResult.reportId}</span>
                  </p>
                </div>
              )}
            </div>

            {/* What happens next */}
            <div className="bg-white rounded-2xl border border-midnight-200 p-4 sm:p-6 text-left mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles size={20} className="text-flash-500" />
                What happens next
              </h3>
              <ul className="space-y-3">
                {[
                  { icon: Users, text: 'Community patrol members in your area will keep watch' },
                  { icon: Bell, text: `You'll receive updates when there are sightings of ${reportData.petName}` },
                  { icon: Shield, text: 'Rescue squads can coordinate search efforts' },
                  { icon: MapPin, text: 'Check your dashboard to see reported sightings on the map' },
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <item.icon size={18} className="text-flash-500 flex-shrink-0 mt-0.5" />
                    <span className="text-midnight-700 text-sm sm:text-base">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Assigned squad notice */}
            {reportResult.assignedSquad && (
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-center gap-3 mb-2">
                  <Shield size={20} className="text-violet-600" />
                  <p className="text-violet-700 font-medium">Rescue Squad Assigned</p>
                </div>
                <p className="text-sm text-midnight-700 mb-3">
                  {reportResult.assignedSquad.name}{reportResult.assignedSquad.city ? ` (${reportResult.assignedSquad.city})` : ''} has been notified and will coordinate search efforts.
                  {reportResult.squadsNotified > 1 && (
                    <span className="block mt-1 text-flash-600">
                      + {reportResult.squadsNotified - 1} other squad{reportResult.squadsNotified > 2 ? 's' : ''} also notified
                    </span>
                  )}
                </p>
                <Link
                  href={`/rescue-squads/${reportResult.assignedSquad.id}`}
                  className="inline-flex items-center gap-2 text-sm text-violet-600 hover:underline"
                >
                  View Squad Hub
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}

            {/* Account created notice */}
            {reportResult.accountCreated && (
              <div className="bg-flash-50 border border-flash-200 rounded-xl p-4 mb-6 text-left">
                <p className="text-flash-700 font-medium mb-1">Account Created</p>
                <p className="text-sm text-midnight-700">
                  Check your email for login credentials to access your dashboard.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {reportResult.assignedSquad ? (
                <Link
                  href={`/rescue-squads/${reportResult.assignedSquad.id}`}
                  className="flex-1 py-3 px-6 rounded-xl font-medium transition-all
                    bg-gradient-to-r from-violet-500 to-violet-400 text-white
                    shadow-glow-violet hover:shadow-glow-violet-lg
                    flex items-center justify-center gap-2"
                >
                  Go to Squad Hub
                  <ArrowRight size={18} />
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className="flex-1 py-3 px-6 rounded-xl font-medium transition-all
                    bg-gradient-to-r from-flash-400 to-flash-500 text-midnight-900
                    shadow-glow-flash hover:shadow-glow-flash-lg
                    flex items-center justify-center gap-2"
                >
                  Go to Dashboard
                  <ArrowRight size={18} />
                </Link>
              )}
              <Link
                href="/dashboard"
                className="flex-1 py-3 px-6 rounded-xl bg-midnight-50 text-midnight-700
                  border border-midnight-200 hover:bg-midnight-100 transition-all
                  flex items-center justify-center"
              >
                My Dashboard
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Leaflet CSS injection for dark theme */}
      <style jsx global>{`
        .leaflet-container {
          background: #0f172a;
        }
        .custom-marker {
          background: transparent;
          border: none;
        }
        .leaflet-control-zoom a {
          background: #ffffff !important;
          color: #0f172a !important;
          border-color: #e2e8f0 !important;
        }
        .leaflet-control-zoom a:hover {
          background: #f1f5f9 !important;
        }
        /* Override global input styles */
        .report-form input[type="text"],
        .report-form input[type="email"],
        .report-form input[type="tel"],
        .report-form textarea,
        .report-form select {
          background: #f8fafc !important;
          color: #0f172a !important;
          border-color: #e2e8f0 !important;
        }
        .report-form input::placeholder,
        .report-form textarea::placeholder {
          color: #64748b !important;
        }
        .report-form input:focus,
        .report-form textarea:focus,
        .report-form select:focus {
          border-color: #facc15 !important;
          box-shadow: 0 0 0 1px #facc15 !important;
        }
        .breed-selector-wrapper input,
        .color-selector-wrapper button {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
          color: #0f172a !important;
        }
      `}</style>
    </div>
  );
}
