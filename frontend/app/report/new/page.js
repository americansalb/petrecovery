'use client';

/**
 * Report Lost Pet - Step-by-Step Wizard
 *
 * Clean, focused flow - one question per screen:
 * 1. Where? (map)
 * 2. Who? (select pet or type)
 * 3. Name? (if new pet)
 * 4. When?
 * 5. Color?
 * 6. Photo? (optional)
 * 7. Confirm & Submit
 */

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Dog, Cat, Bird, Rabbit, MapPin, Clock, Search,
  Camera, Check, ChevronLeft, ChevronRight,
  AlertTriangle, Loader2, X, Navigation, ExternalLink
} from 'lucide-react';
import ColorSelector from '../../components/ColorSelector';

const PET_TYPES = [
  { type: 'dog', label: 'Dog', icon: Dog, species: 'DOG' },
  { type: 'cat', label: 'Cat', icon: Cat, species: 'CAT' },
  { type: 'bird', label: 'Bird', icon: Bird, species: 'BIRD' },
  { type: 'other', label: 'Other', icon: Rabbit, species: 'OTHER' },
];

const TIME_OPTIONS = [
  { value: 'less_than_hour', label: 'Less than an hour ago', emoji: '⚡' },
  { value: '1_to_6_hours', label: '1-6 hours ago', emoji: '🕐' },
  { value: '6_to_24_hours', label: '6-24 hours ago', emoji: '🌅' },
  { value: '1_to_3_days', label: '1-3 days ago', emoji: '📅' },
  { value: '3_to_7_days', label: '3-7 days ago', emoji: '📆' },
  { value: 'more_than_2_weeks', label: 'More than a week', emoji: '📆' },
];

export default function ReportLostPet() {
  const { data: session } = useSession();

  // Wizard state
  const [step, setStep] = useState(1); // 1=location, 2=pet, 3=name, 4=when, 5=color, 6=photo, 7=confirm
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reportResult, setReportResult] = useState(null);

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

  // Map refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Fetch user's pets
  useEffect(() => {
    if (session?.user) {
      fetch('/api/pets')
        .then(res => res.ok ? res.json() : { pets: [] })
        .then(data => setMyPets(data.pets || []))
        .catch(() => setMyPets([]));
    }
  }, [session]);

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
          setIsGettingLocation(false);
          // Default to a location if geolocation fails
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      setIsGettingLocation(false);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || !center || step !== 1) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, 17);
      if (markerRef.current) markerRef.current.setLatLng(center);
      if (circleRef.current) circleRef.current.setLatLng(center);
      return;
    }

    import('leaflet').then((L) => {
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
    });

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

    try {
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session?.user?.email,
          firstName: session?.user?.name,
          petName,
          color,
          lastSeenAddress,
          center,
          radiusMiles: 0.1,
          timeElapsed,
          petType,
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

  const canProceed = () => {
    switch (step) {
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

  const nextStep = () => {
    if (canProceed() && step < 7) setStep(step + 1);
    if (step === 7) handleSubmit();
  };

  const prevStep = () => {
    if (step > 1) {
      // If we came from selecting existing pet, go back to step 2
      if (step === 4 && selectedPet) {
        setStep(2);
      } else {
        setStep(step - 1);
      }
    }
  };

  // Success screen
  if (step === 8 && reportResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Alert Created!</h1>
          <p className="text-gray-600 mb-6">
            {reportResult.squadsNotified || 0} rescue squad{reportResult.squadsNotified === 1 ? '' : 's'} notified
          </p>
          <Link
            href="/dashboard"
            className="block w-full py-3 bg-green-500 text-white rounded-xl font-semibold"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <button onClick={() => step > 1 ? prevStep() : null} className="w-10 h-10 flex items-center justify-center">
          {step > 1 ? <ChevronLeft size={24} /> : <Link href="/dashboard"><X size={24} /></Link>}
        </button>
        <div className="flex gap-1">
          {[1,2,3,4,5,6,7].map(s => (
            <div key={s} className={`w-8 h-1 rounded-full ${s <= step ? 'bg-red-500' : 'bg-gray-200'}`} />
          ))}
        </div>
        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col">

        {/* Step 1: Location */}
        {step === 1 && (
          <div className="flex-1 flex flex-col">
            <div className="p-6 pb-2">
              <h1 className="text-2xl font-bold mb-1">Where was {petName || 'your pet'} last seen?</h1>
              <p className="text-gray-500">Tap the map or drag the pin</p>
            </div>

            <div className="flex-1 relative">
              {isGettingLocation && !center ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <Navigation size={32} className="mx-auto mb-2 text-blue-500 animate-pulse" />
                    <p className="text-gray-600">Finding your location...</p>
                  </div>
                </div>
              ) : (
                <div ref={mapRef} className="h-full w-full" />
              )}
            </div>

            {center && (
              <div className="p-4 border-t bg-gray-50">
                <p className="text-sm text-gray-600 truncate mb-2">{lastSeenAddress || 'Location set'}</p>
                <button
                  onClick={openInMaps}
                  className="text-sm text-blue-600 flex items-center gap-1"
                >
                  <ExternalLink size={14} /> Open in Maps for exact address
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Pet */}
        {step === 2 && (
          <div className="flex-1 p-6">
            <h1 className="text-2xl font-bold mb-1">Who went missing?</h1>
            <p className="text-gray-500 mb-6">Select your pet or add a new one</p>

            {myPets.length > 0 && (
              <div className="mb-8">
                <p className="text-sm font-medium text-gray-500 mb-3">Your pets</p>
                <div className="grid grid-cols-2 gap-3">
                  {myPets.map(pet => (
                    <button
                      key={pet.id}
                      onClick={() => handleSelectPet(pet)}
                      className="p-4 border-2 rounded-2xl text-left hover:border-blue-400 transition-all"
                    >
                      <div className="w-16 h-16 rounded-xl bg-gray-100 mb-2 overflow-hidden">
                        {pet.primaryPhotoUrl ? (
                          <img src={pet.primaryPhotoUrl} alt={pet.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {pet.species === 'DOG' ? <Dog size={28} className="text-gray-400" /> :
                             pet.species === 'CAT' ? <Cat size={28} className="text-gray-400" /> :
                             <Rabbit size={28} className="text-gray-400" />}
                          </div>
                        )}
                      </div>
                      <p className="font-semibold">{pet.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-500 mb-3">
                {myPets.length > 0 ? 'Or report a new pet' : 'What type of pet?'}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {PET_TYPES.map(pet => {
                  const Icon = pet.icon;
                  return (
                    <button
                      key={pet.type}
                      onClick={() => handleSelectPetType(pet.type)}
                      className="p-4 border-2 rounded-2xl hover:border-blue-400 transition-all text-center"
                    >
                      <Icon size={32} className="mx-auto mb-1 text-gray-600" />
                      <span className="text-sm font-medium">{pet.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Pet Name */}
        {step === 3 && (
          <div className="flex-1 p-6">
            <h1 className="text-2xl font-bold mb-1">What's their name?</h1>
            <p className="text-gray-500 mb-6">This helps people identify your pet</p>

            <input
              type="text"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              placeholder="Max, Bella, Charlie..."
              className="w-full text-2xl py-4 border-b-2 border-gray-200 focus:border-blue-500 outline-none"
              autoFocus
            />
          </div>
        )}

        {/* Step 4: When */}
        {step === 4 && (
          <div className="flex-1 p-6">
            <h1 className="text-2xl font-bold mb-1">When did {petName} go missing?</h1>
            <p className="text-gray-500 mb-6">This helps prioritize the search</p>

            <div className="space-y-3">
              {TIME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTimeElapsed(opt.value)}
                  className={`w-full p-4 rounded-2xl border-2 text-left flex items-center gap-3 transition-all ${
                    timeElapsed === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Color */}
        {step === 5 && (
          <div className="flex-1 p-6">
            <h1 className="text-2xl font-bold mb-1">What color is {petName}?</h1>
            <p className="text-gray-500 mb-6">Select all that apply</p>

            <ColorSelector
              value={color}
              onChange={setColor}
            />
          </div>
        )}

        {/* Step 6: Photo */}
        {step === 6 && (
          <div className="flex-1 p-6">
            <h1 className="text-2xl font-bold mb-1">Add a photo of {petName}</h1>
            <p className="text-gray-500 mb-6">This really helps people identify your pet</p>

            {photos.length > 0 ? (
              <div className="relative">
                <img src={photos[0]} alt="Pet" className="w-full aspect-square object-cover rounded-2xl" />
                <button
                  onClick={() => setPhotos([])}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <label className="block aspect-square border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-400 transition-colors">
                <div className="h-full flex flex-col items-center justify-center">
                  {uploadingPhoto ? (
                    <Loader2 size={32} className="text-blue-500 animate-spin" />
                  ) : (
                    <>
                      <Camera size={48} className="text-gray-400 mb-2" />
                      <span className="text-gray-500">Tap to add photo</span>
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
              className="mt-4 text-gray-500 text-sm"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Step 7: Confirm */}
        {step === 7 && (
          <div className="flex-1 p-6">
            <h1 className="text-2xl font-bold mb-6">Ready to alert?</h1>

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <MapPin className="text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium truncate">{cityName || lastSeenAddress || 'Set'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                {petType === 'dog' ? <Dog className="text-gray-400" /> :
                 petType === 'cat' ? <Cat className="text-gray-400" /> :
                 <Rabbit className="text-gray-400" />}
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Pet</p>
                  <p className="font-medium">{petName} • {color}</p>
                </div>
                {photos[0] && (
                  <img src={photos[0]} alt="" className="w-12 h-12 rounded-lg object-cover" />
                )}
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Clock className="text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Missing since</p>
                  <p className="font-medium">{TIME_OPTIONS.find(t => t.value === timeElapsed)?.label}</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl mb-4 flex items-start gap-2">
                <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with Next button */}
      {step < 8 && (
        <div className="p-4 border-t">
          <button
            onClick={nextStep}
            disabled={!canProceed() || isSubmitting}
            className={`w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 ${
              canProceed() && !isSubmitting
                ? 'bg-red-500 text-white'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            {isSubmitting ? (
              <Loader2 size={20} className="animate-spin" />
            ) : step === 7 ? (
              'Create Alert'
            ) : (
              <>Continue <ChevronRight size={20} /></>
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
