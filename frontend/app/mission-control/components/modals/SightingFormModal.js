'use client';

/**
 * SightingFormModal - Report a Pet Sighting
 *
 * Features preserved from original:
 * - Get current GPS location
 * - Reverse geocoding for address
 * - Confidence level selection
 * - Description input
 * - Submit to API
 */

import { useState } from 'react';
import { CheckCircle2, MapPin } from 'lucide-react';
import { useToast } from '@/app/components/ui/Toast';

export default function SightingFormModal({ missionId, onClose, onSuccess }) {
  const toast = useToast();
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [confidence, setConfidence] = useState('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    setLocationError(null);

    if (!('geolocation' in navigator)) {
      setLocationError('GPS not available on this device');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGettingLocation(false);

        // Reverse geocode to get address
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
          .then(r => r.json())
          .then(data => setAddress(data.display_name || ''))
          .catch(() => {});
      },
      (error) => {
        setGettingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied. Please enable location access.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location unavailable. Please try again.');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out. Please try again.');
            break;
          default:
            setLocationError('Unable to get location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async () => {
    if (!location) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/missions/${missionId}/sightings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location.lat,
          longitude: location.lng,
          address,
          description,
          confidence,
        }),
      });

      if (res.ok) {
        onSuccess?.();
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.message || 'Failed to submit sighting.');
      }
    } catch (err) {
      console.error('Error submitting sighting:', err);
      toast.error('Error submitting sighting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const confidenceOptions = [
    { value: 'HIGH', label: "It's them!", color: 'emerald' },
    { value: 'MEDIUM', label: 'Looks like', color: 'amber' },
    { value: 'LOW', label: 'Maybe', color: 'slate' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[700] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-t sm:border border-flash-500/30 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Report Sighting</h2>
          <p className="text-slate-400 text-sm mt-1">Help locate this pet by sharing what you saw</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Location Section */}
          {location ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-emerald-400 font-semibold flex items-center gap-2">
                <CheckCircle2 size={18} />
                Location captured
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}
              </p>
              <button
                onClick={getCurrentLocation}
                className="mt-2 text-xs text-flash-400 hover:text-flash-300"
              >
                Update location
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={getCurrentLocation}
                disabled={gettingLocation}
                className="w-full py-4 bg-flash-500/20 border border-flash-500/50 text-flash-400 font-bold rounded-xl hover:bg-flash-500/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <MapPin size={20} />
                {gettingLocation ? 'Getting location...' : 'Use My Current Location'}
              </button>
              {locationError && (
                <p className="text-red-400 text-sm mt-2 text-center">{locationError}</p>
              )}
            </div>
          )}

          {/* Confidence Selection */}
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">
              How sure are you?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {confidenceOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setConfidence(opt.value)}
                  className={`py-3 rounded-xl text-sm font-bold transition ${
                    confidence === opt.value
                      ? opt.color === 'emerald'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : opt.color === 'amber'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                        : 'bg-slate-500/20 text-slate-300 border border-slate-500/50'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description Input */}
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">
              What did you see?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Direction they were heading, behavior, any distinguishing features..."
              className="w-full bg-slate-800 text-white rounded-xl p-4 border border-slate-700 focus:border-flash-500 focus:outline-none resize-none placeholder-slate-500"
              rows={4}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!location || submitting}
            className={`flex-1 py-3 font-bold rounded-xl transition ${
              location && !submitting
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:scale-105'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Submitting...' : 'Submit Sighting'}
          </button>
        </div>
      </div>
    </div>
  );
}
