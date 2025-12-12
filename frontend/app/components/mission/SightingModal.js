'use client';

/**
 * Sighting Report Modal
 *
 * Quick form to report a sighting directly from the Command Center.
 * Features:
 * - Location auto-detect or manual input
 * - Photo upload
 * - Behavior/confidence selection
 * - Description field
 */

import { useState, useEffect, useRef } from 'react';

const BEHAVIOR_OPTIONS = [
  { value: 'FRIENDLY', label: 'Friendly/Approachable', emoji: '😊', confidence: 'HIGH' },
  { value: 'SCARED', label: 'Scared/Skittish', emoji: '😰', confidence: 'MEDIUM' },
  { value: 'RUNNING', label: 'Running/Fleeing', emoji: '🏃', confidence: 'MEDIUM' },
  { value: 'HIDING', label: 'Hiding', emoji: '🫣', confidence: 'HIGH' },
  { value: 'STATIONARY', label: 'Stationary/Still', emoji: '🧍', confidence: 'HIGH' },
  { value: 'INJURED', label: 'Possibly Injured', emoji: '🩹', confidence: 'HIGH' },
  { value: 'UNKNOWN', label: 'Not Sure', emoji: '❓', confidence: 'LOW' },
];

export default function SightingModal({ missionData, onClose, onSubmitted }) {
  const [step, setStep] = useState(1); // 1: location, 2: details
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form data
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    address: '',
    method: null, // 'gps' | 'manual'
  });
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [behavior, setBehavior] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [directionOfTravel, setDirectionOfTravel] = useState('');

  const fileInputRef = useRef(null);

  // Get user's location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    setIsGettingLocation(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({
          latitude,
          longitude,
          method: 'gps',
          address: 'Getting address...',
        });

        // Reverse geocode to get address
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'PetRecovery.org' } }
          );
          if (res.ok) {
            const data = await res.json();
            setLocation(prev => ({
              ...prev,
              address: data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            }));
          }
        } catch (err) {
          setLocation(prev => ({
            ...prev,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          }));
        }

        setIsGettingLocation(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('Could not get your location. Please enter manually.');
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handle manual address input with geocoding
  const handleAddressSubmit = async (address) => {
    if (!address.trim()) return;

    setIsGettingLocation(true);
    setError(null);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'PetRecovery.org' } }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setLocation({
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon),
            address: data[0].display_name,
            method: 'manual',
          });
        } else {
          setError('Address not found. Please try a different address.');
        }
      }
    } catch (err) {
      setError('Error looking up address');
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Handle photo upload
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Photo must be under 10MB');
      return;
    }

    setPhoto(file);
    setIsUploadingPhoto(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', 'sighting');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Failed to upload photo');
      }

      const data = await res.json();
      setPhotoUrl(data.url);
    } catch (err) {
      console.error('Photo upload error:', err);
      setError('Failed to upload photo');
      setPhoto(null);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Submit sighting
  const handleSubmit = async () => {
    if (!location.latitude || !location.longitude) {
      setError('Please provide a location');
      return;
    }

    if (!behavior) {
      setError('Please select a behavior');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const selectedBehavior = BEHAVIOR_OPTIONS.find(b => b.value === behavior);

      const res = await fetch(`/api/missions/${missionData.id}/sightings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          description: description.trim() || `${BEHAVIOR_OPTIONS.find(b => b.value === behavior)?.label || behavior}${directionOfTravel ? `, heading ${directionOfTravel}` : ''}`,
          behavior,
          confidence: selectedBehavior?.confidence || 'MEDIUM',
          directionOfTravel: directionOfTravel || null,
          photoUrl: photoUrl || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit sighting');
      }

      onSubmitted?.();
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👁️</span>
            <div>
              <h2 className="font-bold text-lg text-white">Report Sighting</h2>
              <p className="text-sm text-slate-400">
                {missionData.petName || 'Pet'} - {missionData.petColor} {missionData.petSpecies?.toLowerCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white mb-2">Where did you see them?</h3>

              {/* GPS Location Button */}
              <button
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
                className="w-full p-4 bg-cyan-500/20 border border-cyan-500/50 rounded-xl text-cyan-400 flex items-center justify-center gap-3 hover:bg-cyan-500/30 transition disabled:opacity-50"
              >
                {isGettingLocation ? (
                  <>
                    <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                    <span>Getting location...</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl">📍</span>
                    <span className="font-medium">Use My Current Location</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 text-slate-500">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-sm">or</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>

              {/* Manual Address Input */}
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Enter address or intersection</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={location.method === 'manual' ? '' : location.address}
                    onChange={(e) => setLocation(prev => ({ ...prev, address: e.target.value, method: null }))}
                    placeholder="123 Main St, City, State"
                    className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={() => handleAddressSubmit(location.address)}
                    disabled={isGettingLocation || !location.address}
                    className="px-4 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition disabled:opacity-50"
                  >
                    Find
                  </button>
                </div>
              </div>

              {/* Location confirmation */}
              {location.latitude && location.longitude && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-green-400 text-xl">✓</span>
                    <div>
                      <p className="text-green-400 font-medium text-sm">Location set</p>
                      <p className="text-slate-400 text-sm mt-0.5 line-clamp-2">{location.address}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {/* Behavior Selection */}
              <div>
                <h3 className="font-semibold text-white mb-3">How was the pet behaving?</h3>
                <div className="grid grid-cols-2 gap-2">
                  {BEHAVIOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setBehavior(opt.value)}
                      className={`p-3 rounded-xl border text-left transition ${
                        behavior === opt.value
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-lg mr-2">{opt.emoji}</span>
                      <span className="text-sm">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Direction of Travel */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Direction of travel (optional)</label>
                <div className="flex gap-2 flex-wrap">
                  {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'Unknown'].map((dir) => (
                    <button
                      key={dir}
                      onClick={() => setDirectionOfTravel(dir)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        directionOfTravel === dir
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Additional details (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Any other details about what you saw..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Photo (optional but helpful)</label>
                {photo ? (
                  <div className="relative">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt="Sighting"
                      className="w-full h-40 object-cover rounded-xl"
                    />
                    {isUploadingPhoto && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                    <button
                      onClick={() => { setPhoto(null); setPhotoUrl(''); }}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 hover:border-slate-600 hover:text-slate-300 transition"
                  >
                    <span className="text-2xl block mb-1">📷</span>
                    <span className="text-sm">Tap to add photo</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-between gap-3">
          {step === 1 ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!location.latitude || !location.longitude}
                className="flex-1 py-3 bg-cyan-500 text-white rounded-xl hover:bg-cyan-400 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(1)}
                className="py-3 px-6 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition font-medium"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !behavior || isUploadingPhoto}
                className="flex-1 py-3 bg-yellow-500 text-black rounded-xl hover:bg-yellow-400 transition font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : '👁️ Submit Sighting'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
