'use client';

/**
 * Task Completion Modal - Captures meaningful details
 *
 * Different forms based on task type:
 * - POST_FLYERS: Mark locations on map, describe area, date
 * - CALL_SHELTER: Which shelter, result, notes
 * - SOCIAL_MEDIA: Platform, post URL, notes
 * - SEARCH_PROPERTY: Describe areas checked
 * - SEARCH_AREA: GPS tracking or polygon drawing (handled separately)
 */

import { useState, useEffect } from 'react';
import { MapPin, Calendar, CheckCircle2, X, Phone, Share2, Search } from 'lucide-react';

export default function TaskCompletionModal({ task, onClose, onComplete }) {
  const [details, setDetails] = useState({
    notes: '',
    // Flyer specific
    flyerLocations: [],
    flyerDate: new Date().toISOString().split('T')[0],
    flyerDescription: '',

    // Shelter specific
    shelterName: '',
    shelterResult: 'CALLED',
    shelterContact: '',

    // Social media specific
    platform: 'FACEBOOK',
    postUrl: '',

    // Property search specific
    areasChecked: '',
  });

  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  // Get current location for flyer marking
  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => console.error('Geolocation error:', err)
      );
    }
  };

  const addFlyerLocation = () => {
    if (!currentLocation) return;

    setDetails(prev => ({
      ...prev,
      flyerLocations: [...prev.flyerLocations, {
        ...currentLocation,
        description: prev.flyerDescription,
        date: prev.flyerDate,
      }]
    }));

    setCurrentLocation(null);
    setDetails(prev => ({ ...prev, flyerDescription: '' }));
    setIsAddingLocation(false);
  };

  const removeFlyerLocation = (index) => {
    setDetails(prev => ({
      ...prev,
      flyerLocations: prev.flyerLocations.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    const completionData = {
      taskId: task.id,
      taskType: task.type,
      details,
      completedAt: new Date().toISOString(),
    };

    await onComplete(completionData);
    onClose();
  };

  const renderFormContent = () => {
    switch (task.type) {
      case 'POST_FLYERS':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-300 text-sm font-semibold block mb-2">
                Where did you post flyers?
              </label>

              {/* Added locations list */}
              {details.flyerLocations.length > 0 && (
                <div className="space-y-2 mb-3">
                  {details.flyerLocations.map((loc, i) => (
                    <div key={i} className="bg-slate-800/50 border-2 border-slate-700 rounded-xl p-3 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-white font-semibold text-sm">{loc.description || 'Flyer location'}</div>
                        <div className="text-slate-500 text-xs mt-1">
                          {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} • {loc.date}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFlyerLocation(i)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add location form */}
              {isAddingLocation ? (
                <div className="bg-cyan-500/10 border-2 border-cyan-500/30 rounded-xl p-4 space-y-3">
                  {!currentLocation ? (
                    <button
                      onClick={getCurrentLocation}
                      className="w-full py-3 bg-cyan-500/20 border-2 border-cyan-500/50 text-cyan-400 font-bold rounded-xl hover:bg-cyan-500/30 transition flex items-center justify-center gap-2"
                    >
                      <MapPin size={18} />
                      Get Current Location
                    </button>
                  ) : (
                    <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-lg p-3 text-emerald-400 text-sm">
                      ✓ Location captured: {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
                    </div>
                  )}

                  <input
                    type="text"
                    value={details.flyerDescription}
                    onChange={(e) => setDetails({ ...details, flyerDescription: e.target.value })}
                    placeholder="Describe the area (e.g., 'Main St & Oak Ave intersection')"
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                  />

                  <input
                    type="date"
                    value={details.flyerDate}
                    onChange={(e) => setDetails({ ...details, flyerDate: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                    style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={addFlyerLocation}
                      disabled={!currentLocation}
                      className={`flex-1 py-2 rounded-xl font-semibold ${
                        currentLocation
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Add Location
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingLocation(false);
                        setCurrentLocation(null);
                        setDetails({ ...details, flyerDescription: '' });
                      }}
                      className="px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingLocation(true)}
                  className="w-full py-3 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-cyan-500 transition flex items-center justify-center gap-2"
                >
                  <MapPin size={18} />
                  + Add Flyer Location
                </button>
              )}
            </div>

            <div>
              <label className="text-slate-300 text-sm font-semibold block mb-2">
                Additional notes (optional)
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="How many flyers? Any specific landmarks?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      case 'CALL_SHELTERS':
      case 'VISIT_SHELTERS':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-300 text-sm font-semibold block mb-2">
                Which shelter? *
              </label>
              <input
                type="text"
                value={details.shelterName}
                onChange={(e) => setDetails({ ...details, shelterName: e.target.value })}
                placeholder="e.g., 'Cook County Animal Control'"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>

            <div>
              <label className="text-slate-300 text-sm font-semibold block mb-2">
                Result
              </label>
              <select
                value={details.shelterResult}
                onChange={(e) => setDetails({ ...details, shelterResult: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              >
                <option value="CALLED">Called - no match</option>
                <option value="VISITED">Visited - no match</option>
                <option value="POSSIBLE_MATCH">Possible match - investigating</option>
                <option value="LEFT_INFO">Left our contact info</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 text-sm font-semibold block mb-2">
                Contact person (optional)
              </label>
              <input
                type="text"
                value={details.shelterContact}
                onChange={(e) => setDetails({ ...details, shelterContact: e.target.value })}
                placeholder="Who did you speak with?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>

            <div>
              <label className="text-slate-300 text-sm font-semibold block mb-2">
                Notes (optional)
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Any additional information..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      case 'POST_SOCIAL_MEDIA':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-300 text-sm font-semibold block mb-2">
                Platform *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['FACEBOOK', 'NEXTDOOR', 'TWITTER', 'INSTAGRAM'].map(platform => (
                  <button
                    key={platform}
                    onClick={() => setDetails({ ...details, platform })}
                    className={`py-3 px-4 rounded-xl font-semibold transition ${
                      details.platform === platform
                        ? 'bg-cyan-500/30 text-cyan-400 border-2 border-cyan-500/50'
                        : 'bg-slate-800 text-slate-400 border-2 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-slate-300 text-sm font-semibold block mb-2">
                Post URL (optional)
              </label>
              <input
                type="url"
                value={details.postUrl}
                onChange={(e) => setDetails({ ...details, postUrl: e.target.value })}
                placeholder="https://facebook.com/..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>

            <div>
              <label className="text-slate-300 text-sm font-semibold block mb-2">
                Notes (optional)
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="e.g., 'Posted in 3 local Facebook groups'"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      case 'SEARCH_PROPERTY':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-300 text-sm font-semibold block mb-2">
                Which areas did you search? *
              </label>
              <textarea
                value={details.areasChecked}
                onChange={(e) => setDetails({ ...details, areasChecked: e.target.value })}
                placeholder="e.g., 'Backyard, garage, under deck, bushes along fence'"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={4}
              />
            </div>

            <div>
              <label className="text-slate-300 text-sm font-semibold block mb-2">
                Notes (optional)
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Anything unusual found? Any hiding spots?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      default:
        return (
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">
              Notes (optional)
            </label>
            <textarea
              value={details.notes}
              onChange={(e) => setDetails({ ...details, notes: e.target.value })}
              placeholder="Add any details about completing this task..."
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
              style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              rows={4}
            />
          </div>
        );
    }
  };

  const canSubmit = () => {
    switch (task.type) {
      case 'POST_FLYERS':
        return details.flyerLocations.length > 0 || details.notes.trim();
      case 'CALL_SHELTERS':
      case 'VISIT_SHELTERS':
        return details.shelterName.trim();
      case 'POST_SOCIAL_MEDIA':
        return true; // Platform is pre-selected
      case 'SEARCH_PROPERTY':
        return details.areasChecked.trim();
      default:
        return true;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-emerald-500/30 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl shadow-emerald-500/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b-2 border-slate-700/60 sticky top-0 bg-slate-900/95 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={24} className="text-emerald-400" />
                Complete Task
              </h2>
              <p className="text-slate-400 text-sm mt-1">{task.label}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          {renderFormContent()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-slate-700/60 flex gap-3 sticky bottom-0 bg-slate-900/95 backdrop-blur">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit()}
            className={`flex-1 py-3 font-bold rounded-xl transition ${
              canSubmit()
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/50'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            Mark Complete
          </button>
        </div>
      </div>
    </div>
  );
}
