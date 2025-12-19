'use client';

/**
 * Report Lost Pet - Streamlined Map-First Design
 *
 * New flow:
 * 1. Map loads immediately with GPS auto-detection
 * 2. Quick pet selection (from registry) or new pet type
 * 3. Bottom sheet with essential details
 * 4. Submit - done!
 */

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Dog, Cat, Bird, Rabbit, MapPin, Clock, Search,
  Camera, Check, ChevronUp, ChevronDown,
  AlertTriangle, Loader2, Sparkles, X, Plus,
  Shield, Users, Bell, ArrowRight, Navigation
} from 'lucide-react';
import BreedSelector from '../../components/BreedSelector';
import ColorSelector from '../../components/ColorSelector';
import CitySearchInput, { getCountryFlag } from '../../components/CitySearchInput';

const PET_TYPES = [
  { type: 'dog', label: 'Dog', icon: Dog, species: 'DOG' },
  { type: 'cat', label: 'Cat', icon: Cat, species: 'CAT' },
  { type: 'bird', label: 'Bird', icon: Bird, species: 'BIRD' },
  { type: 'other', label: 'Other', icon: Rabbit, species: 'OTHER' },
];

const TIME_OPTIONS = [
  { value: 'less_than_hour', label: '< 1 hour', shortLabel: '< 1h' },
  { value: '1_to_6_hours', label: '1-6 hours', shortLabel: '1-6h' },
  { value: '6_to_24_hours', label: '6-24 hours', shortLabel: '6-24h' },
  { value: '1_to_3_days', label: '1-3 days', shortLabel: '1-3d' },
  { value: '3_to_7_days', label: '3-7 days', shortLabel: '3-7d' },
  { value: 'more_than_2_weeks', label: '1+ weeks', shortLabel: '1w+' },
];

export default function ReportLostPet() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  // Core state
  const [phase, setPhase] = useState('location'); // 'location' or 'details'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reportResult, setReportResult] = useState(null);

  // My Pets state
  const [myPets, setMyPets] = useState([]);
  const [loadingPets, setLoadingPets] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);

  // Location state
  const [center, setCenter] = useState(null);
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState(null);
  const [lastSeenAddress, setLastSeenAddress] = useState('');
  const [cityName, setCityName] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Pet details state
  const [petType, setPetType] = useState('');
  const [timeElapsed, setTimeElapsed] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [reportData, setReportData] = useState({
    petName: '',
    breed: '',
    color: '',
    size: 'MEDIUM',
    distinctiveMarks: '',
    email: '',
    phone: '',
    firstName: '',
  });

  // Bottom sheet state
  const [sheetExpanded, setSheetExpanded] = useState(false);

  // Fetch user's pets on mount
  useEffect(() => {
    if (session?.user) {
      fetchMyPets();
      setReportData(prev => ({
        ...prev,
        email: session.user.email || '',
        firstName: session.user.name || '',
      }));
    }
  }, [session]);

  const fetchMyPets = async () => {
    setLoadingPets(true);
    try {
      const res = await fetch('/api/pets');
      if (res.ok) {
        const data = await res.json();
        setMyPets(data.pets || []);
      }
    } catch (err) {
      console.error('Failed to fetch pets:', err);
    } finally {
      setLoadingPets(false);
    }
  };

  // Auto-detect location on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsGettingLocation(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
          // Reverse geocode
          const result = await reverseGeocode(latitude, longitude);
          setLastSeenAddress(result.address);
          setCityName(result.city);
          setIsGettingLocation(false);
        },
        (error) => {
          console.warn('Geolocation failed:', error);
          setLocationError('Could not detect location. Please search for your city.');
          setShowSearch(true);
          setIsGettingLocation(false);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      setLocationError('Location not supported. Please search for your city.');
      setShowSearch(true);
      setIsGettingLocation(false);
    }
  }, []);

  // Initialize map when we have center
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || !center) return;
    if (mapInstanceRef.current) {
      // Update existing map
      mapInstanceRef.current.setView(center, 14);
      if (markerRef.current) {
        markerRef.current.setLatLng(center);
      }
      if (circleRef.current) {
        circleRef.current.setLatLng(center);
      }
      return;
    }

    import('leaflet').then((L) => {
      const map = L.map(mapRef.current, {
        zoomControl: false,
      }).setView(center, 14);
      mapInstanceRef.current = map;

      L.control.zoom({ position: 'topright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      // Custom marker
      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div class="relative">
            <div class="absolute -inset-3 bg-red-500/30 rounded-full animate-ping"></div>
            <div class="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      const marker = L.marker(center, {
        draggable: true,
        icon: markerIcon,
      }).addTo(map);
      markerRef.current = marker;

      const circle = L.circle(center, {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.1,
        weight: 2,
        radius: 5 * 1609.34, // 5 miles
      }).addTo(map);
      circleRef.current = circle;

      // Handle marker drag
      marker.on('dragend', async function(e) {
        const pos = e.target.getLatLng();
        setCenter([pos.lat, pos.lng]);
        circle.setLatLng(pos);
        const result = await reverseGeocode(pos.lat, pos.lng);
        setLastSeenAddress(result.address);
        setCityName(result.city);
      });

      // Handle map click
      map.on('click', async function(e) {
        const pos = e.latlng;
        setCenter([pos.lat, pos.lng]);
        marker.setLatLng(pos);
        circle.setLatLng(pos);
        const result = await reverseGeocode(pos.lat, pos.lng);
        setLastSeenAddress(result.address);
        setCityName(result.city);
      });

      map.fitBounds(circle.getBounds(), { padding: [30, 30] });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
  }, [center]);

  const reverseGeocode = async (lat, lon) => {
    try {
      const response = await fetch(`/api/geocode?lat=${lat}&lon=${lon}&addressdetails=1`);
      if (response.ok) {
        const data = await response.json();
        if (data?.display_name) {
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
          return { address: data.display_name, city };
        }
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
    }
    return { address: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, city: '' };
  };

  const handleCitySelect = (city) => {
    setSelectedCity(city);
    setCityName(city.city);
    const flag = getCountryFlag(city.country);
    setLastSeenAddress(`${city.city}, ${city.state_name || city.state_id} ${flag}`);
    if (city.lat && city.lng) {
      setCenter([city.lat, city.lng]);
    }
    setShowSearch(false);
  };

  const handleSelectPet = (pet) => {
    setSelectedPet(pet);
    // Map species to petType
    const typeMap = { 'DOG': 'dog', 'CAT': 'cat', 'BIRD': 'bird' };
    setPetType(typeMap[pet.species] || 'other');
    setReportData(prev => ({
      ...prev,
      petName: pet.name || '',
      breed: pet.breed || '',
      color: pet.color || '',
      size: pet.size || 'MEDIUM',
      distinctiveMarks: pet.distinctiveMarks || '',
    }));
    if (pet.primaryPhotoUrl) {
      setPhotos([pet.primaryPhotoUrl]);
    }
    setSheetExpanded(true);
  };

  const handleSelectNewPetType = (type) => {
    setSelectedPet(null);
    setPetType(type);
    setReportData(prev => ({
      ...prev,
      petName: '',
      breed: '',
      color: '',
      size: 'MEDIUM',
      distinctiveMarks: '',
    }));
    setPhotos([]);
    setSheetExpanded(true);
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (photos.length + files.length > 5) {
      setError('Maximum 5 photos allowed');
      return;
    }

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
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        if (response.ok) {
          const data = await response.json();
          if (data.url) uploadedUrls.push(data.url);
        }
      }
      setPhotos(prev => [...prev, ...uploadedUrls]);
    } catch (err) {
      setError('Failed to upload photos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    if (!center) {
      setError('Please set a location on the map');
      setIsSubmitting(false);
      return;
    }

    if (!petType) {
      setError('Please select a pet type');
      setIsSubmitting(false);
      return;
    }

    if (!reportData.petName) {
      setError("Please enter your pet's name");
      setIsSubmitting(false);
      return;
    }

    if (!reportData.color) {
      setError("Please select your pet's color");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: reportData.email || session?.user?.email,
          phone: reportData.phone,
          firstName: reportData.firstName || session?.user?.name,
          petName: reportData.petName,
          breed: reportData.breed,
          color: reportData.color,
          size: reportData.size,
          distinctiveMarks: reportData.distinctiveMarks,
          lastSeenAddress,
          center,
          radiusMiles: 5,
          timeElapsed: timeElapsed || '6_to_24_hours',
          petType,
          photos,
          locationType: 'city',
          cityName,
          selectedPetId: selectedPet?.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create report');

      setReportResult(data);
      setPhase('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = center && petType && reportData.petName && reportData.color;

  // Success phase
  if (phase === 'success' && reportResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-green-500 blur-3xl opacity-30 rounded-full animate-pulse" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-400 rounded-full flex items-center justify-center shadow-xl">
              <Check size={48} className="text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold mb-3 text-gray-900">Alert Created!</h1>
          <p className="text-gray-600 mb-8">
            {reportResult.squadsNotified || 0} rescue squad{reportResult.squadsNotified === 1 ? '' : 's'} notified about {reportData.petName}
          </p>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                {petType === 'dog' && <Dog className="text-gray-600" />}
                {petType === 'cat' && <Cat className="text-gray-600" />}
                {petType === 'bird' && <Bird className="text-gray-600" />}
                {petType === 'other' && <Rabbit className="text-gray-600" />}
              </div>
              <div>
                <p className="font-bold text-gray-900">{reportData.petName}</p>
                <p className="text-sm text-gray-500">{reportData.color} {reportData.breed}</p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <p className="flex items-center gap-2 mb-1">
                <MapPin size={14} /> {cityName || 'Location set'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {reportResult.assignedSquad && (
              <Link
                href={`/rescue-squads/${reportResult.assignedSquad.id}`}
                className="w-full py-3 px-6 rounded-xl font-medium bg-gradient-to-r from-violet-500 to-purple-500 text-white flex items-center justify-center gap-2"
              >
                <Shield size={18} />
                Go to Squad Hub
              </Link>
            )}
            <Link
              href="/dashboard"
              className="w-full py-3 px-6 rounded-xl font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              My Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Header - minimal */}
      <header className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg"
        >
          <X size={20} className="text-gray-600" />
        </Link>

        <div className="bg-red-500 text-white px-4 py-2 rounded-full font-semibold text-sm shadow-lg flex items-center gap-2">
          <AlertTriangle size={16} />
          Report Lost Pet
        </div>

        <div className="w-10" /> {/* Spacer */}
      </header>

      {/* Search bar - floating */}
      {(showSearch || !center) && (
        <div className="absolute top-20 left-4 right-4 z-20">
          <div className="bg-white rounded-2xl shadow-xl p-2">
            <CitySearchInput
              value={citySearchTerm}
              onChange={setCitySearchTerm}
              onSelect={handleCitySelect}
              placeholder="Search city, address, or postal code..."
              showIcon={true}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Toggle search button */}
      {center && !showSearch && (
        <button
          onClick={() => setShowSearch(true)}
          className="absolute top-20 left-4 z-20 bg-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm font-medium text-gray-700"
        >
          <Search size={16} />
          {cityName || 'Change location'}
        </button>
      )}

      {/* Map container */}
      <div className="flex-1 relative">
        {isGettingLocation && !center && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <div className="text-center">
              <Navigation size={48} className="mx-auto mb-4 text-blue-500 animate-pulse" />
              <p className="text-gray-600 font-medium">Detecting your location...</p>
            </div>
          </div>
        )}

        <div ref={mapRef} className="h-full w-full" />

        {/* Location hint */}
        {center && (
          <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none">
            <div className="bg-black/70 backdrop-blur text-white px-4 py-2 rounded-full text-center text-sm">
              Tap map or drag pin to set exact location
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <div
        className={`
          bg-white rounded-t-3xl shadow-2xl transition-all duration-300 ease-out
          ${sheetExpanded ? 'max-h-[80vh]' : 'max-h-[280px]'}
          overflow-hidden flex flex-col
        `}
      >
        {/* Drag handle */}
        <div
          className="py-3 flex justify-center cursor-pointer"
          onClick={() => setSheetExpanded(!sheetExpanded)}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        <div className="px-4 pb-4 overflow-y-auto flex-1">
          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Pet Selection */}
          {!petType && (
            <>
              {/* My Pets - if logged in and has pets */}
              {session?.user && myPets.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-500 mb-2">Quick select from your pets:</p>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {myPets.map(pet => (
                      <button
                        key={pet.id}
                        onClick={() => handleSelectPet(pet)}
                        className="flex-shrink-0 w-20 text-center"
                      >
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden mb-1 hover:border-blue-400 transition-colors">
                          {pet.primaryPhotoUrl ? (
                            <img src={pet.primaryPhotoUrl} alt={pet.name} className="w-full h-full object-cover" />
                          ) : (
                            pet.species === 'DOG' ? <Dog size={28} className="text-gray-400" /> :
                            pet.species === 'CAT' ? <Cat size={28} className="text-gray-400" /> :
                            pet.species === 'BIRD' ? <Bird size={28} className="text-gray-400" /> :
                            <Rabbit size={28} className="text-gray-400" />
                          )}
                        </div>
                        <span className="text-xs font-medium text-gray-700 truncate block">{pet.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* New pet type selection */}
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">
                  {myPets.length > 0 ? 'Or report a new pet:' : 'What type of pet is missing?'}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {PET_TYPES.map((pet) => {
                    const Icon = pet.icon;
                    return (
                      <button
                        key={pet.type}
                        onClick={() => handleSelectNewPetType(pet.type)}
                        className="p-3 rounded-xl bg-gray-50 border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-center"
                      >
                        <Icon size={28} className="mx-auto mb-1 text-gray-600" />
                        <span className="text-xs font-medium text-gray-700">{pet.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Details Form - shown after pet type selected */}
          {petType && (
            <div className="space-y-4">
              {/* Selected pet indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {petType === 'dog' && <Dog size={20} className="text-gray-600" />}
                  {petType === 'cat' && <Cat size={20} className="text-gray-600" />}
                  {petType === 'bird' && <Bird size={20} className="text-gray-600" />}
                  {petType === 'other' && <Rabbit size={20} className="text-gray-600" />}
                  <span className="font-medium text-gray-900">
                    {selectedPet ? selectedPet.name : `New ${petType}`}
                  </span>
                </div>
                <button
                  onClick={() => { setPetType(''); setSelectedPet(null); setSheetExpanded(false); }}
                  className="text-sm text-blue-600"
                >
                  Change
                </button>
              </div>

              {/* Pet name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pet's Name *</label>
                <input
                  type="text"
                  value={reportData.petName}
                  onChange={(e) => setReportData(prev => ({ ...prev, petName: e.target.value }))}
                  placeholder="Max"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                />
              </div>

              {/* Time elapsed - compact pills */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">When did they go missing?</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTimeElapsed(opt.value)}
                      className={`
                        py-2 px-3 rounded-lg text-sm font-medium transition-all
                        ${timeElapsed === opt.value
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                      `}
                    >
                      {opt.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color - required */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color/Pattern *</label>
                <ColorSelector
                  value={reportData.color}
                  onChange={(color) => setReportData(prev => ({ ...prev, color }))}
                />
              </div>

              {/* Photo upload - prominent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Photos <span className="text-gray-400 font-normal">(helps rescuers identify your pet)</span>
                </label>

                {photos.length > 0 && (
                  <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                    {photos.map((photo, idx) => (
                      <div key={idx} className="relative flex-shrink-0">
                        <img src={photo} alt="" className="w-20 h-20 object-cover rounded-lg" />
                        <button
                          onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {photos.length < 5 && (
                  <label className={`
                    block p-4 border-2 border-dashed rounded-xl cursor-pointer text-center transition-colors
                    ${uploadingPhotos ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}
                  `}>
                    {uploadingPhotos ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 size={20} className="animate-spin text-blue-500" />
                        <span className="text-blue-600">Uploading...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <Camera size={20} />
                        <span>Add photos</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploadingPhotos}
                    />
                  </label>
                )}
              </div>

              {/* More details - expandable */}
              <button
                onClick={() => setShowMoreDetails(!showMoreDetails)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
              >
                {showMoreDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {showMoreDetails ? 'Less details' : 'More details (optional)'}
              </button>

              {showMoreDetails && (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Breed</label>
                    <BreedSelector
                      species={petType}
                      value={reportData.breed}
                      onChange={(breed) => setReportData(prev => ({ ...prev, breed }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Distinctive Marks</label>
                    <textarea
                      value={reportData.distinctiveMarks}
                      onChange={(e) => setReportData(prev => ({ ...prev, distinctiveMarks: e.target.value }))}
                      placeholder="Black spot on left ear, very friendly..."
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none resize-none"
                    />
                  </div>

                  {!session?.user && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Your Email *</label>
                        <input
                          type="email"
                          value={reportData.email}
                          onChange={(e) => setReportData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="you@email.com"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone (for text alerts)</label>
                        <input
                          type="tel"
                          value={reportData.phone}
                          onChange={(e) => setReportData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="(555) 123-4567"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className={`
                  w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all
                  ${canSubmit && !isSubmitting
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Creating Alert...
                  </>
                ) : (
                  <>
                    <Bell size={20} />
                    Create Alert
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Styles */}
      <style jsx global>{`
        .leaflet-container {
          background: #f3f4f6;
        }
        .custom-marker {
          background: transparent;
          border: none;
        }
        .leaflet-control-zoom a {
          background: white !important;
          color: #374151 !important;
          border-color: #e5e7eb !important;
        }
      `}</style>
    </div>
  );
}
