'use client';

/**
 * Report Lost Pet - Modern Bioluminescent Wizard
 *
 * Multi-step wizard for reporting a lost pet:
 * 1. Pet type selection
 * 2. Location & time
 * 3. Map with search radius
 * 4. Contact info (skipped if logged in)
 * 5. Pet details & photos
 * 6. Success with squad assignment
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Dog, Cat, Bird, Rabbit, MapPin, Clock, Search,
  User, Mail, Phone, Camera, Check, ChevronLeft,
  ChevronRight, AlertTriangle, Loader2, Sparkles,
  Shield, Users, Bell, ArrowRight
} from 'lucide-react';
import BreedSelector from '../../components/BreedSelector';
import ColorSelector from '../../components/ColorSelector';

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
  const [lastSeenAddress, setLastSeenAddress] = useState('');
  const [center, setCenter] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(1);
  const [timeElapsed, setTimeElapsed] = useState('');

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
      // Dark map style matching Squad Hub
      const map = L.map(mapRef.current, {
        zoomControl: false,
      }).setView(center, 14);
      mapInstanceRef.current = map;

      L.control.zoom({ position: 'topright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      // Custom marker with glow
      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="relative">
            <div class="absolute -inset-4 bg-cyan-500/30 rounded-full animate-ping"></div>
            <div class="w-8 h-8 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full border-2 border-white shadow-lg shadow-cyan-500/50 flex items-center justify-center">
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
        color: '#22d3ee',
        fillColor: '#22d3ee',
        fillOpacity: 0.15,
        weight: 2,
        radius: radiusMiles * 1609.34,
      }).addTo(map);
      circleRef.current = circle;

      marker.on('dragend', function(e) {
        const pos = e.target.getLatLng();
        setCenter([pos.lat, pos.lng]);
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

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    const maxPhotos = 5;

    if (photos.length + files.length > maxPhotos) {
      setError(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        setError('Each photo must be under 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });

    setError(null);
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const geocodeAddress = async () => {
    if (!lastSeenAddress || lastSeenAddress.length < 3) {
      setError('Please enter a valid address or zip code');
      return;
    }

    setError(null);
    setIsGeocoding(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(lastSeenAddress)}&format=json&limit=1&countrycodes=us`,
        { headers: { 'User-Agent': 'PetRecovery.org' } }
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setCenter([lat, lon]);
        setStep(3);
      } else {
        setError('Could not find that address. Please try again with more detail.');
      }
    } catch (err) {
      setError('Error finding address. Please try again.');
      console.error('Geocoding error:', err);
    } finally {
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

  const canProceedFromStep2 = lastSeenAddress && timeElapsed;
  const canProceedFromStep4 = reportData.firstName && reportData.email;
  const canSubmit = reportData.petName && reportData.color;

  // Determine which step to skip to based on session
  const nextStepFromMap = session?.user ? 5 : 4;
  const prevStepFromDetails = session?.user ? 3 : 4;

  return (
    <div className="min-h-screen bg-[var(--hub-bg-root)] text-[var(--hub-text-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--hub-bg-panel)]/95 backdrop-blur-sm border-b border-[var(--hub-border)]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-[var(--hub-text-muted)] hover:text-[var(--hub-text-primary)] transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="font-medium">Back</span>
          </Link>

          {session?.user && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--hub-status-success)]/10 border border-[var(--hub-status-success)]/30 rounded-full text-sm">
              <Check size={14} className="text-[var(--hub-status-success)]" />
              <span className="text-[var(--hub-status-success)]">Signed in</span>
            </div>
          )}
        </div>
      </header>

      {/* Progress indicator - only show during form steps */}
      {step >= 2 && step <= 5 && (
        <div className="bg-[var(--hub-bg-panel)] border-b border-[var(--hub-border)] py-4">
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
                          ? 'bg-[var(--hub-accent-primary)] shadow-[0_0_20px_rgba(34,211,238,0.4)]'
                          : isActive
                            ? 'bg-[var(--hub-accent-primary)]/20 border-2 border-[var(--hub-accent-primary)] shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                            : 'bg-[var(--hub-bg-card)] border border-[var(--hub-border)]'
                        }
                      `}
                    >
                      {isComplete ? (
                        <Check size={18} className="text-[var(--hub-bg-root)]" />
                      ) : (
                        <Icon size={18} className={isActive ? 'text-[var(--hub-accent-primary)]' : 'text-[var(--hub-text-muted)]'} />
                      )}
                    </div>
                    {idx < (session?.user ? 2 : 3) && (
                      <div
                        className={`
                          flex-1 h-1 mx-2 rounded-full transition-all duration-300
                          ${isComplete
                            ? 'bg-gradient-to-r from-[var(--hub-accent-primary)] to-[var(--hub-accent-primary)]'
                            : 'bg-[var(--hub-bg-card)]'
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
            <Loader2 size={48} className="mx-auto mb-4 text-[var(--hub-accent-primary)] animate-spin" />
            <p className="text-[var(--hub-text-secondary)]">Loading pet information...</p>
          </div>
        )}

        {/* Error display */}
        {error && !isLoadingPet && (
          <div className="mb-6 p-4 bg-[var(--hub-status-high)]/10 border border-[var(--hub-status-high)]/30 rounded-xl flex items-start gap-3">
            <AlertTriangle size={20} className="text-[var(--hub-status-high)] flex-shrink-0 mt-0.5" />
            <p className="text-[var(--hub-status-high)]">{error}</p>
          </div>
        )}

        {/* Pre-filled pet notice */}
        {prefillPet && step >= 2 && step <= 5 && (
          <div className="mb-6 p-4 bg-[var(--hub-accent-primary)]/10 border border-[var(--hub-accent-primary)]/20 rounded-xl flex items-start gap-3">
            <Sparkles size={20} className="text-[var(--hub-accent-primary)] flex-shrink-0 mt-0.5" />
            <p className="text-[var(--hub-text-secondary)]">
              <strong className="text-[var(--hub-accent-primary)]">Pre-filled from {prefillPet.name}'s profile.</strong> You can update any details below.
            </p>
          </div>
        )}

        {/* Step 1: Pet Type Selection */}
        {step === 1 && !isLoadingPet && (
          <div className="text-center max-w-xl mx-auto">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-[var(--hub-status-high)] blur-3xl opacity-20 rounded-full" />
              <AlertTriangle size={64} className="relative text-[var(--hub-status-high)]" />
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-[var(--hub-status-high)] to-orange-400 bg-clip-text text-transparent">
              Report Lost Pet
            </h1>
            <p className="text-lg text-[var(--hub-text-secondary)] mb-10">
              Alert your community and mobilize rescue squads to help find your pet
            </p>

            <h2 className="text-xl font-semibold mb-6 text-[var(--hub-text-primary)]">
              What type of pet is missing?
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {PET_TYPES.map((pet) => {
                const Icon = pet.icon;
                return (
                  <button
                    key={pet.type}
                    onClick={() => {
                      setPetType(pet.type);
                      setStep(2);
                    }}
                    className={`
                      relative group p-6 rounded-2xl border-2 border-[var(--hub-border)]
                      bg-[var(--hub-bg-panel)] hover:bg-[var(--hub-bg-card)]
                      transition-all duration-300 hover:scale-[1.02]
                      hover:border-[var(--hub-accent-primary)]/50
                      hover:shadow-[0_0_30px_rgba(34,211,238,0.1)]
                    `}
                  >
                    <div className={`
                      w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${pet.color}
                      flex items-center justify-center shadow-lg
                      group-hover:shadow-xl group-hover:scale-110 transition-all duration-300
                    `}>
                      <Icon size={32} className="text-white" />
                    </div>
                    <span className="text-lg font-semibold text-[var(--hub-text-primary)]">
                      {pet.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Location & Time */}
        {step === 2 && (
          <div className="max-w-xl mx-auto">
            <div className="bg-[var(--hub-bg-panel)] rounded-2xl border border-[var(--hub-border)] p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[var(--hub-accent-primary)]/10 flex items-center justify-center">
                  <MapPin size={24} className="text-[var(--hub-accent-primary)]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Where was your pet last seen?</h2>
                  <p className="text-[var(--hub-text-muted)]">This helps us alert nearby rescuers</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--hub-text-secondary)]">
                    Last Seen Address or Zip Code
                  </label>
                  <input
                    type="text"
                    value={lastSeenAddress}
                    onChange={(e) => setLastSeenAddress(e.target.value)}
                    placeholder="123 Main St, City, State or 60601"
                    className="w-full px-4 py-3 bg-[var(--hub-bg-card)] border border-[var(--hub-border)] rounded-xl
                      text-[var(--hub-text-primary)] placeholder:text-[var(--hub-text-muted)]
                      focus:outline-none focus:border-[var(--hub-accent-primary)] focus:ring-1 focus:ring-[var(--hub-accent-primary)]
                      transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canProceedFromStep2) {
                        geocodeAddress();
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--hub-text-secondary)]">
                    <Clock size={14} className="inline mr-1" />
                    When did they go missing?
                  </label>
                  <div className="grid gap-2">
                    {TIME_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTimeElapsed(option.value)}
                        className={`
                          w-full p-3 rounded-xl border text-left transition-all
                          ${timeElapsed === option.value
                            ? 'bg-[var(--hub-accent-primary)]/10 border-[var(--hub-accent-primary)] text-[var(--hub-accent-primary)]'
                            : 'bg-[var(--hub-bg-card)] border-[var(--hub-border)] text-[var(--hub-text-secondary)] hover:border-[var(--hub-text-muted)]'
                          }
                        `}
                      >
                        <span className="flex items-center justify-between">
                          {option.label}
                          {option.urgency === 'critical' && (
                            <span className="text-xs px-2 py-0.5 bg-[var(--hub-status-high)]/20 text-[var(--hub-status-high)] rounded-full">
                              URGENT
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 px-4 rounded-xl bg-[var(--hub-bg-card)] text-[var(--hub-text-secondary)]
                    border border-[var(--hub-border)] hover:bg-[var(--hub-bg-elevated)] transition-all
                    flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={18} />
                  Back
                </button>
                <button
                  onClick={geocodeAddress}
                  disabled={!canProceedFromStep2 || isGeocoding}
                  className={`
                    flex-[2] py-3 px-4 rounded-xl font-medium transition-all
                    flex items-center justify-center gap-2
                    ${canProceedFromStep2 && !isGeocoding
                      ? 'bg-gradient-to-r from-[var(--hub-accent-primary)] to-cyan-400 text-[var(--hub-bg-root)] shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]'
                      : 'bg-[var(--hub-bg-elevated)] text-[var(--hub-text-muted)] cursor-not-allowed'
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
                      Continue
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Map with Search Radius */}
        {step === 3 && center && (
          <div className="space-y-6">
            <div className="bg-[var(--hub-bg-panel)] rounded-2xl border border-[var(--hub-border)] overflow-hidden">
              <div className="p-6 border-b border-[var(--hub-border)]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[var(--hub-accent-primary)]/10 flex items-center justify-center">
                    <Search size={24} className="text-[var(--hub-accent-primary)]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Set Your Search Area</h2>
                    <p className="text-[var(--hub-text-muted)]">Drag the marker to adjust. Rescuers in this area will be alerted.</p>
                  </div>
                </div>
              </div>

              {/* Map container */}
              <div className="h-[400px] md:h-[450px]">
                <div ref={mapRef} className="h-full w-full" />
              </div>

              {/* Radius control */}
              <div className="p-6 bg-[var(--hub-bg-card)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium">Search Radius</span>
                  <span className="text-2xl font-bold text-[var(--hub-accent-primary)]">
                    {radiusMiles} {radiusMiles === 1 ? 'mile' : 'miles'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="10"
                  step="0.25"
                  value={radiusMiles}
                  onChange={(e) => setRadiusMiles(parseFloat(e.target.value))}
                  className="w-full h-2 bg-[var(--hub-bg-elevated)] rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:bg-[var(--hub-accent-primary)] [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                />
                <div className="flex justify-between mt-2 text-sm text-[var(--hub-text-muted)]">
                  <span>0.25 mi</span>
                  <span>10 mi</span>
                </div>
              </div>
            </div>

            {/* Tip */}
            <div className="p-4 bg-[var(--hub-accent-primary)]/10 border border-[var(--hub-accent-primary)]/20 rounded-xl flex items-start gap-3">
              <Sparkles size={20} className="text-[var(--hub-accent-primary)] flex-shrink-0 mt-0.5" />
              <p className="text-[var(--hub-text-secondary)]">
                <strong className="text-[var(--hub-accent-primary)]">Tip:</strong> Most pets stay within 1-2 miles.
                Increase the radius if they've been missing longer.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep(2);
                  setCenter(null);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-[var(--hub-bg-card)] text-[var(--hub-text-secondary)]
                  border border-[var(--hub-border)] hover:bg-[var(--hub-bg-elevated)] transition-all
                  flex items-center justify-center gap-2"
              >
                <ChevronLeft size={18} />
                Back
              </button>
              <button
                onClick={() => setStep(nextStepFromMap)}
                className="flex-[2] py-3 px-4 rounded-xl font-medium transition-all
                  bg-gradient-to-r from-[var(--hub-accent-primary)] to-cyan-400 text-[var(--hub-bg-root)]
                  shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]
                  flex items-center justify-center gap-2"
              >
                Continue
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Contact Info (only if not logged in) */}
        {step === 4 && !session?.user && (
          <div className="max-w-xl mx-auto">
            <div className="bg-[var(--hub-bg-panel)] rounded-2xl border border-[var(--hub-border)] p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[var(--hub-accent-secondary)]/10 flex items-center justify-center">
                  <User size={24} className="text-[var(--hub-accent-secondary)]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Your Contact Information</h2>
                  <p className="text-[var(--hub-text-muted)]">So rescuers can reach you with sightings</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--hub-text-secondary)]">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={reportData.firstName}
                    onChange={(e) => setReportData({ ...reportData, firstName: e.target.value })}
                    placeholder="John"
                    className="w-full px-4 py-3 bg-[var(--hub-bg-card)] border border-[var(--hub-border)] rounded-xl
                      text-[var(--hub-text-primary)] placeholder:text-[var(--hub-text-muted)]
                      focus:outline-none focus:border-[var(--hub-accent-primary)] focus:ring-1 focus:ring-[var(--hub-accent-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--hub-text-secondary)]">
                    <Mail size={14} className="inline mr-1" />
                    Email *
                  </label>
                  <input
                    type="email"
                    value={reportData.email}
                    onChange={(e) => setReportData({ ...reportData, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 bg-[var(--hub-bg-card)] border border-[var(--hub-border)] rounded-xl
                      text-[var(--hub-text-primary)] placeholder:text-[var(--hub-text-muted)]
                      focus:outline-none focus:border-[var(--hub-accent-primary)] focus:ring-1 focus:ring-[var(--hub-accent-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--hub-text-secondary)]">
                    <Phone size={14} className="inline mr-1" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={reportData.phone}
                    onChange={(e) => setReportData({ ...reportData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 bg-[var(--hub-bg-card)] border border-[var(--hub-border)] rounded-xl
                      text-[var(--hub-text-primary)] placeholder:text-[var(--hub-text-muted)]
                      focus:outline-none focus:border-[var(--hub-accent-primary)] focus:ring-1 focus:ring-[var(--hub-accent-primary)]"
                  />
                  <p className="mt-1 text-sm text-[var(--hub-text-muted)]">For text alerts about sightings</p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 px-4 rounded-xl bg-[var(--hub-bg-card)] text-[var(--hub-text-secondary)]
                    border border-[var(--hub-border)] hover:bg-[var(--hub-bg-elevated)] transition-all
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
                      ? 'bg-gradient-to-r from-[var(--hub-accent-primary)] to-cyan-400 text-[var(--hub-bg-root)] shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]'
                      : 'bg-[var(--hub-bg-elevated)] text-[var(--hub-text-muted)] cursor-not-allowed'
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
            <div className="bg-[var(--hub-bg-panel)] rounded-2xl border border-[var(--hub-border)] p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                  <Camera size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Tell us about your pet</h2>
                  <p className="text-[var(--hub-text-muted)]">Help people identify and find them</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--hub-text-secondary)]">
                    Pet's Name *
                  </label>
                  <input
                    type="text"
                    value={reportData.petName}
                    onChange={(e) => setReportData({ ...reportData, petName: e.target.value })}
                    placeholder="Max"
                    className="w-full px-4 py-3 bg-[var(--hub-bg-card)] border border-[var(--hub-border)] rounded-xl
                      text-[var(--hub-text-primary)] placeholder:text-[var(--hub-text-muted)]
                      focus:outline-none focus:border-[var(--hub-accent-primary)] focus:ring-1 focus:ring-[var(--hub-accent-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--hub-text-secondary)]">
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
                  <label className="block text-sm font-medium mb-2 text-[var(--hub-text-secondary)]">
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
                  <label className="block text-sm font-medium mb-2 text-[var(--hub-text-secondary)]">
                    Size
                  </label>
                  <select
                    value={reportData.size}
                    onChange={(e) => setReportData({ ...reportData, size: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--hub-bg-card)] border border-[var(--hub-border)] rounded-xl
                      text-[var(--hub-text-primary)] focus:outline-none focus:border-[var(--hub-accent-primary)]"
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
                  <label className="block text-sm font-medium mb-2 text-[var(--hub-text-secondary)]">
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
                            className="w-24 h-24 object-cover rounded-lg border border-[var(--hub-border)]"
                          />
                          <button
                            onClick={() => removePhoto(index)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--hub-status-high)] rounded-full
                              flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {photos.length < 5 && (
                    <label className="block p-6 border-2 border-dashed border-[var(--hub-border)] rounded-xl
                      hover:border-[var(--hub-accent-primary)] transition-colors cursor-pointer text-center">
                      <Camera size={32} className="mx-auto mb-2 text-[var(--hub-text-muted)]" />
                      <span className="text-[var(--hub-text-secondary)]">Click to upload photos</span>
                      <span className="block text-sm text-[var(--hub-text-muted)]">Max 5MB each</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--hub-text-secondary)]">
                    Distinctive Features
                  </label>
                  <textarea
                    value={reportData.distinctiveMarks}
                    onChange={(e) => setReportData({ ...reportData, distinctiveMarks: e.target.value })}
                    placeholder="Black spot on left ear, scar on right paw, very friendly with strangers..."
                    rows={3}
                    className="w-full px-4 py-3 bg-[var(--hub-bg-card)] border border-[var(--hub-border)] rounded-xl
                      text-[var(--hub-text-primary)] placeholder:text-[var(--hub-text-muted)]
                      focus:outline-none focus:border-[var(--hub-accent-primary)] resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep(prevStepFromDetails)}
                  className="flex-1 py-3 px-4 rounded-xl bg-[var(--hub-bg-card)] text-[var(--hub-text-secondary)]
                    border border-[var(--hub-border)] hover:bg-[var(--hub-bg-elevated)] transition-all
                    flex items-center justify-center gap-2"
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
                      ? 'bg-gradient-to-r from-[var(--hub-status-success)] to-emerald-400 text-[var(--hub-bg-root)] shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]'
                      : 'bg-[var(--hub-bg-elevated)] text-[var(--hub-text-muted)] cursor-not-allowed'
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
              <div className="absolute inset-0 bg-[var(--hub-status-success)] blur-3xl opacity-30 rounded-full animate-pulse" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-[var(--hub-status-success)] to-emerald-400 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.4)]">
                <Check size={48} className="text-white" />
              </div>
            </div>

            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-[var(--hub-status-success)] to-emerald-400 bg-clip-text text-transparent">
              Alert Created!
            </h1>
            <p className="text-lg text-[var(--hub-text-secondary)] mb-8">
              {reportResult.patrolAlerted || 0} rescue patrol members within {radiusMiles} {radiusMiles === 1 ? 'mile' : 'miles'} have been notified about {reportData.petName}.
            </p>

            {/* What happens next */}
            <div className="bg-[var(--hub-bg-panel)] rounded-2xl border border-[var(--hub-border)] p-6 text-left mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles size={20} className="text-[var(--hub-accent-primary)]" />
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
                    <item.icon size={18} className="text-[var(--hub-accent-primary)] flex-shrink-0 mt-0.5" />
                    <span className="text-[var(--hub-text-secondary)]">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Assigned squad notice */}
            {reportResult.assignedSquad && (
              <div className="bg-[var(--hub-accent-secondary)]/10 border border-[var(--hub-accent-secondary)]/20 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-center gap-3 mb-2">
                  <Shield size={20} className="text-[var(--hub-accent-secondary)]" />
                  <p className="text-[var(--hub-accent-secondary)] font-medium">Rescue Squad Assigned</p>
                </div>
                <p className="text-sm text-[var(--hub-text-secondary)] mb-3">
                  {reportResult.assignedSquad.name} ({reportResult.assignedSquad.city}) has been notified and will coordinate search efforts.
                </p>
                <Link
                  href={`/rescue-squads/${reportResult.assignedSquad.city.toLowerCase().replace(/\s+/g, '-')}`}
                  className="inline-flex items-center gap-2 text-sm text-[var(--hub-accent-secondary)] hover:underline"
                >
                  View Squad Hub
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}

            {/* Account created notice */}
            {reportResult.accountCreated && (
              <div className="bg-[var(--hub-accent-primary)]/10 border border-[var(--hub-accent-primary)]/20 rounded-xl p-4 mb-6 text-left">
                <p className="text-[var(--hub-accent-primary)] font-medium mb-1">Account Created</p>
                <p className="text-sm text-[var(--hub-text-secondary)]">
                  Check your email for login credentials to access your dashboard.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {reportResult.assignedSquad ? (
                <Link
                  href={`/rescue-squads/${reportResult.assignedSquad.city.toLowerCase().replace(/\s+/g, '-')}`}
                  className="flex-1 py-3 px-6 rounded-xl font-medium transition-all
                    bg-gradient-to-r from-[var(--hub-accent-secondary)] to-violet-400 text-white
                    shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]
                    flex items-center justify-center gap-2"
                >
                  Go to Squad Hub
                  <ArrowRight size={18} />
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className="flex-1 py-3 px-6 rounded-xl font-medium transition-all
                    bg-gradient-to-r from-[var(--hub-accent-primary)] to-cyan-400 text-[var(--hub-bg-root)]
                    shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]
                    flex items-center justify-center gap-2"
                >
                  Go to Dashboard
                  <ArrowRight size={18} />
                </Link>
              )}
              <Link
                href="/dashboard"
                className="flex-1 py-3 px-6 rounded-xl bg-[var(--hub-bg-card)] text-[var(--hub-text-secondary)]
                  border border-[var(--hub-border)] hover:bg-[var(--hub-bg-elevated)] transition-all
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
          background: var(--hub-bg-root);
        }
        .custom-marker {
          background: transparent;
          border: none;
        }
        .leaflet-control-zoom a {
          background: var(--hub-bg-card) !important;
          color: var(--hub-text-primary) !important;
          border-color: var(--hub-border) !important;
        }
        .leaflet-control-zoom a:hover {
          background: var(--hub-bg-elevated) !important;
        }
        /* Override global input styles for dark theme */
        .report-form input[type="text"],
        .report-form input[type="email"],
        .report-form input[type="tel"],
        .report-form textarea,
        .report-form select {
          background: var(--hub-bg-card) !important;
          color: var(--hub-text-primary) !important;
          border-color: var(--hub-border) !important;
        }
        .report-form input::placeholder,
        .report-form textarea::placeholder {
          color: var(--hub-text-muted) !important;
        }
        .report-form input:focus,
        .report-form textarea:focus,
        .report-form select:focus {
          border-color: var(--hub-accent-primary) !important;
          box-shadow: 0 0 0 1px var(--hub-accent-primary) !important;
        }
        .breed-selector-wrapper input,
        .color-selector-wrapper button {
          background: var(--hub-bg-card) !important;
          border-color: var(--hub-border) !important;
          color: var(--hub-text-primary) !important;
        }
      `}</style>
    </div>
  );
}
