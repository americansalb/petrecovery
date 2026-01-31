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
import { useToast } from '@/app/components/ui/Toast';

export default function TaskCompletionModal({ task, onClose, onComplete }) {
  const toast = useToast();
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
    leftPhoto: false,
    leftDescription: false,
    scheduledCallback: '',

    // Social media specific
    platform: 'FACEBOOK',
    postUrl: '',
    groupsPosted: '',

    // Property search specific
    areasChecked: '',
    areasGPS: [],
    searchDuration: '',

    // Station setup
    stationType: 'FOOD_WATER',
    stationLocation: '',
    stationGPS: null,
    itemsUsed: '',

    // Vet specific
    vetName: '',
    vetResult: '',

    // Microchip
    chipCompany: '',
    chipNumber: '',
    updatedInfo: false,

    // Contact info
    organizationName: '',
    contactPerson: '',
    contactResult: '',

    // Search timing
    searchTime: 'DAWN',
    searchLocation: '',
    searchGPS: [],
    anyResponse: '',

    // Trap setup
    trapLocation: '',
    trapGPS: null,
    trapType: '',
    checkingSchedule: '',

    // Camera setup
    cameraLocation: '',
    cameraGPS: null,
    cameraType: '',

    // Online monitoring
    sitesChecked: '',
    foundMatches: false,
  });

  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationMode, setLocationMode] = useState('gps'); // 'gps' or 'manual'
  const [manualAddress, setManualAddress] = useState('');

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

  // Quick GPS capture for flyer posting
  const quickAddFlyerLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDetails(prev => ({
            ...prev,
            flyerLocations: [...prev.flyerLocations, {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              description: 'Flyer posted',
              date: new Date().toISOString().split('T')[0],
              timestamp: new Date().toISOString(),
            }]
          }));
        },
        (err) => {
          toast.error('Could not get your location. Please enable location services.');
          console.error('Geolocation error:', err);
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser.');
    }
  };

  // Geocode address/zip to coordinates
  const geocodeAddress = async (address) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          address: data[0].display_name,
        };
      } else {
        toast.error('Address not found. Please try a different address or zip code.');
        return null;
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Could not find location. Please check your internet connection.');
      return null;
    }
  };

  // Generic GPS capture for single-location tasks
  const captureGPSLocation = async (fieldName) => {
    if (locationMode === 'manual') {
      // Manual address entry
      if (!manualAddress.trim()) {
        toast.error('Please enter an address or zip code');
        return;
      }

      const location = await geocodeAddress(manualAddress);
      if (location) {
        const gpsData = {
          lat: location.lat,
          lng: location.lng,
          timestamp: new Date().toISOString(),
          address: location.address,
          isManual: true,
        };
        setDetails(prev => ({ ...prev, [fieldName]: gpsData }));
        setManualAddress('');
      }
    } else {
      // GPS mode
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const gpsData = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              timestamp: new Date().toISOString(),
            };
            setDetails(prev => ({ ...prev, [fieldName]: gpsData }));
          },
          (err) => {
            toast.error('Could not get your location. Please enable location services or switch to manual entry.');
            console.error('Geolocation error:', err);
          }
        );
      } else {
        toast.error('Geolocation is not supported. Please use manual entry.');
      }
    }
  };

  // Add GPS point to array for multi-location tracking (search paths)
  const addGPSPoint = (arrayFieldName, description = '') => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const gpsPoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: new Date().toISOString(),
            description: description || 'Search point',
          };
          setDetails(prev => ({
            ...prev,
            [arrayFieldName]: [...prev[arrayFieldName], gpsPoint]
          }));
        },
        (err) => {
          toast.error('Could not get your location. Please enable location services.');
          console.error('Geolocation error:', err);
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser.');
    }
  };

  const removeGPSPoint = (arrayFieldName, index) => {
    setDetails(prev => ({
      ...prev,
      [arrayFieldName]: prev[arrayFieldName].filter((_, i) => i !== index)
    }));
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
            {/* Quick GPS Add Button */}
            <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-2 border-emerald-500/40 rounded-xl p-5">
              <p className="text-white font-semibold mb-3 text-center">📍 Posted a flyer right now?</p>
              <button
                onClick={quickAddFlyerLocation}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-cyan-600 transition shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
              >
                <MapPin size={20} />
                Capture My Location Now
              </button>
              <p className="text-slate-300 text-xs mt-2 text-center">
                Save current GPS coordinates
              </p>
            </div>

            <div>
              <label className="text-slate-200 text-base font-semibold block mb-3">
                Flyer Locations
              </label>

              {/* Added locations list */}
              {details.flyerLocations.length > 0 && (
                <div className="space-y-2 mb-3">
                  {details.flyerLocations.map((loc, i) => (
                    <div key={i} className="bg-emerald-900/20 border-2 border-emerald-500/30 rounded-xl p-3 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-emerald-200 font-semibold text-sm flex items-center gap-2">
                          <MapPin size={14} />
                          {loc.description || 'Flyer posted'}
                        </div>
                        <div className="text-emerald-400/60 text-xs mt-1 space-y-0.5">
                          <div>📍 {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</div>
                          <div>📅 {loc.date} {loc.timestamp && `at ${new Date(loc.timestamp).toLocaleTimeString()}`}</div>
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

              {/* Manual add section - optional */}
              <div className="border-t border-slate-700 pt-4 mt-4">
                <p className="text-slate-400 text-xs mb-3 text-center">
                  Add previous location via manual entry
                </p>

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
                    placeholder="Where exactly? (like 'Coffee shop bulletin board' or 'Main & Oak intersection')"
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
                    className="w-full py-3 bg-slate-800 border-2 border-slate-700 text-slate-400 font-semibold rounded-xl hover:border-cyan-500 hover:text-white transition flex items-center justify-center gap-2"
                  >
                    <MapPin size={18} />
                    + Manual Entry (from earlier)
                  </button>
                )}
              </div>
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
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Which shelter did you contact? *
              </label>
              <input
                type="text"
                value={details.shelterName}
                onChange={(e) => setDetails({ ...details, shelterName: e.target.value })}
                placeholder="Full name like 'Cook County Animal Control' or 'Humane Society of Chicago'"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>

            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                What happened? *
              </label>
              <select
                value={details.shelterResult}
                onChange={(e) => setDetails({ ...details, shelterResult: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              >
                <option value="NO_MATCH">No match found - they'll watch for them</option>
                <option value="POSSIBLE_MATCH">POSSIBLE MATCH - going to check! 🎉</option>
                <option value="LEFT_VOICEMAIL">Left voicemail with callback number</option>
                <option value="BUSY_TRY_AGAIN">Line busy - will try again later</option>
              </select>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <p className="text-amber-200 text-xs font-semibold mb-3">Did you provide them with:</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-slate-200 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={details.leftPhoto}
                    onChange={(e) => setDetails({ ...details, leftPhoto: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600"
                  />
                  <span>Photo of the pet</span>
                </label>
                <label className="flex items-center gap-2 text-slate-200 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={details.leftDescription}
                    onChange={(e) => setDetails({ ...details, leftDescription: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600"
                  />
                  <span>Detailed description (breed, color, markings, collar)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Who did you speak with?
              </label>
              <input
                type="text"
                value={details.shelterContact}
                onChange={(e) => setDetails({ ...details, shelterContact: e.target.value })}
                placeholder="Staff member's name"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>

            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                When should you check back?
              </label>
              <input
                type="date"
                value={details.scheduledCallback}
                onChange={(e) => setDetails({ ...details, scheduledCallback: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
              <p className="text-slate-400 text-xs mt-2">Check back every 2-3 days</p>
            </div>

            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                Did they suggest anything else?
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Other shelters to check? Areas where strays are commonly found? Best time to call back?"
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
              <label className="text-slate-200 text-base font-semibold block mb-3">
                Where did you post? *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['FACEBOOK', 'NEXTDOOR', 'PAWBOOST', 'FINDINGR ROVER'].map(platform => (
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
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Which groups/pages did you post to?
              </label>
              <textarea
                value={details.groupsPosted}
                onChange={(e) => setDetails({ ...details, groupsPosted: e.target.value })}
                placeholder="e.g., Lost Dogs Illinois, Chicago Pet Owners, Nextdoor - Lincoln Park..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
              <p className="text-slate-400 text-xs mt-2">Post to 3-5 local groups for best reach</p>
            </div>

            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                Link to your main post?
              </label>
              <input
                type="url"
                value={details.postUrl}
                onChange={(e) => setDetails({ ...details, postUrl: e.target.value })}
                placeholder="Paste link so others can share it..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>

            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                How's the response so far?
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="How many shares/comments? Any leads? People offering to help search?"
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
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Track your search path
              </label>

              {/* GPS Points List */}
              {details.areasGPS.length > 0 && (
                <div className="space-y-2 mb-3">
                  {details.areasGPS.map((point, i) => (
                    <div key={i} className="bg-cyan-900/20 border-2 border-cyan-500/30 rounded-xl p-3 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-cyan-200 font-semibold text-sm flex items-center gap-2">
                          <MapPin size={14} />
                          {point.description}
                        </div>
                        <div className="text-cyan-400/60 text-xs mt-1">
                          📍 {point.lat.toFixed(5)}, {point.lng.toFixed(5)} • {new Date(point.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      <button
                        onClick={() => removeGPSPoint('areasGPS', i)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => addGPSPoint('areasGPS', 'Searched here')}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2"
              >
                <MapPin size={20} />
                Mark Current Location as Searched
              </button>
              <p className="text-slate-400 text-xs mt-2 text-center">
                Mark locations as you search to track coverage
              </p>
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium block mb-2">
                Additional details (optional)
              </label>
              <textarea
                value={details.areasChecked}
                onChange={(e) => setDetails({ ...details, areasChecked: e.target.value })}
                placeholder="Any specific areas like 'under deck', 'neighbor's shed', etc..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>

            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                Notice anything? <span className="text-slate-500">(optional)</span>
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Any paw prints, favorite toys moved, food missing, hiding spots you found..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      case 'SETUP_STATION':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                What did you set up? *
              </label>
              <select
                value={details.stationType}
                onChange={(e) => setDetails({ ...details, stationType: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              >
                <option value="FOOD_WATER">Food & water station</option>
                <option value="LITTER_BOX">Litter box (for cats)</option>
                <option value="SCENT_ITEMS">Scent items (bed, toys, worn clothes)</option>
                <option value="COMBINATION">Combination (food + scent items)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Where exactly did you place it? *
              </label>

              {details.stationGPS ? (
                <div className="bg-emerald-900/20 border-2 border-emerald-500/30 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-emerald-200 font-semibold text-sm mb-2">
                        📍 Location captured {details.stationGPS.isManual && '(manual entry)'}
                      </div>
                      <div className="text-emerald-400/60 text-xs space-y-1">
                        <div>{details.stationGPS.lat.toFixed(5)}, {details.stationGPS.lng.toFixed(5)}</div>
                        {details.stationGPS.address && <div>{details.stationGPS.address}</div>}
                        <div>{new Date(details.stationGPS.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setDetails({ ...details, stationGPS: null })}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Clear
                    </button>
                  </div>
                  <input
                    type="text"
                    value={details.stationLocation}
                    onChange={(e) => setDetails({ ...details, stationLocation: e.target.value })}
                    placeholder="Optional description: 'front porch', 'back door'..."
                    className="w-full px-3 py-2 mt-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
                    style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Mode Toggle */}
                  <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
                    <button
                      onClick={() => setLocationMode('gps')}
                      className={`flex-1 py-2 px-4 rounded-md font-semibold text-sm transition ${
                        locationMode === 'gps'
                          ? 'bg-emerald-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📍 GPS
                    </button>
                    <button
                      onClick={() => setLocationMode('manual')}
                      className={`flex-1 py-2 px-4 rounded-md font-semibold text-sm transition ${
                        locationMode === 'manual'
                          ? 'bg-cyan-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ✏️ Zip/Address
                    </button>
                  </div>

                  {locationMode === 'manual' && (
                    <input
                      type="text"
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder="Enter zip code or address..."
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                    />
                  )}

                  <button
                    onClick={() => captureGPSLocation('stationGPS')}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-cyan-600 transition shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                  >
                    <MapPin size={20} />
                    {locationMode === 'gps' ? 'Capture My Location Now' : 'Pin This Location'}
                  </button>
                  <p className="text-slate-400 text-xs text-center">
                    {locationMode === 'gps'
                      ? 'Uses your device GPS for accurate location'
                      : 'We\'ll convert the address to map coordinates'}
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                What specific items did you use?
              </label>
              <textarea
                value={details.itemsUsed}
                onChange={(e) => setDetails({ ...details, itemsUsed: e.target.value })}
                placeholder="Favorite treats? Their bed? Your worn hoodie? Specific food brand?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
              <p className="text-slate-400 text-xs mt-2">Strong scents work best - unwashed clothes are ideal</p>
            </div>
          </div>
        );

      case 'CALL_VETS':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Which vet office? *
              </label>
              <input
                type="text"
                value={details.vetName}
                onChange={(e) => setDetails({ ...details, vetName: e.target.value })}
                placeholder="Full clinic name..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Result? *
              </label>
              <select
                value={details.vetResult}
                onChange={(e) => setDetails({ ...details, vetResult: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              >
                <option value="NO_MATCH">No match - they'll keep an eye out</option>
                <option value="LEFT_INFO">Left description & callback number</option>
                <option value="POSSIBLE_MATCH">Possible match! Going to check</option>
              </select>
            </div>
            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                Notes
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Did they suggest other clinics to call? Emergency vets in the area?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      case 'CONTACT_MICROCHIP':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Microchip company? *
              </label>
              <input
                type="text"
                value={details.chipCompany}
                onChange={(e) => setDetails({ ...details, chipCompany: e.target.value })}
                placeholder="Like 'Home Again', '24PetWatch', 'AKC Reunite'..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Microchip number
              </label>
              <input
                type="text"
                value={details.chipNumber}
                onChange={(e) => setDetails({ ...details, chipNumber: e.target.value })}
                placeholder="If you have it handy..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <label className="flex items-center gap-2 text-slate-200 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={details.updatedInfo}
                  onChange={(e) => setDetails({ ...details, updatedInfo: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600"
                />
                <span>✓ Confirmed contact info is up to date & reported them missing</span>
              </label>
            </div>
            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                Notes
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Any updates you made? Issues accessing the account?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      case 'CONTACT_ANIMAL_CONTROL':
      case 'CONTACT_RESCUES':
      case 'CONTACT_BUSINESSES':
      case 'ALERT_MAIL_CARRIERS':
      case 'CONTACT_PET_LOCATIONS':
      case 'ALERT_SCHOOLS':
      case 'CONTACT_BREED_RESCUES':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Who did you contact? *
              </label>
              <input
                type="text"
                value={details.organizationName}
                onChange={(e) => setDetails({ ...details, organizationName: e.target.value })}
                placeholder="Organization or business name..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Contact person (if any)
              </label>
              <input
                type="text"
                value={details.contactPerson}
                onChange={(e) => setDetails({ ...details, contactPerson: e.target.value })}
                placeholder="Who did you speak with?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                What happened? *
              </label>
              <select
                value={details.contactResult}
                onChange={(e) => setDetails({ ...details, contactResult: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              >
                <option value="NOTIFIED">Notified them - they'll watch out</option>
                <option value="LEFT_MESSAGE">Left message/voicemail</option>
                <option value="WILL_HELP">They offered to help!</option>
                <option value="NO_MATCH">No sightings yet</option>
              </select>
            </div>
            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                Details
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Did they have any suggestions? Offer to post flyers? Mention other places to check?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      case 'SEARCH_DAWN_DUSK':
      case 'WALK_CALLING':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                When did you search? *
              </label>
              <select
                value={details.searchTime}
                onChange={(e) => setDetails({ ...details, searchTime: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              >
                <option value="DAWN">Dawn (5-7 AM)</option>
                <option value="DUSK">Dusk (6-8 PM)</option>
                <option value="NIGHT">Late night (quiet hours)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Track your search route
              </label>

              {/* GPS Points List */}
              {details.searchGPS.length > 0 && (
                <div className="space-y-2 mb-3">
                  {details.searchGPS.map((point, i) => (
                    <div key={i} className="bg-amber-900/20 border-2 border-amber-500/30 rounded-xl p-3 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-amber-200 font-semibold text-sm flex items-center gap-2">
                          <MapPin size={14} />
                          Search point #{i + 1}
                        </div>
                        <div className="text-amber-400/60 text-xs mt-1">
                          📍 {point.lat.toFixed(5)}, {point.lng.toFixed(5)} • {new Date(point.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      <button
                        onClick={() => removeGPSPoint('searchGPS', i)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => addGPSPoint('searchGPS', 'Search point')}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
              >
                <MapPin size={20} />
                Mark Location on Search Route
              </button>
              <p className="text-slate-400 text-xs mt-2 text-center">
                Mark key points along your search route
              </p>
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium block mb-2">
                Additional details (optional)
              </label>
              <textarea
                value={details.searchLocation}
                onChange={(e) => setDetails({ ...details, searchLocation: e.target.value })}
                placeholder="Street names, neighborhoods, or landmarks..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={2}
              />
            </div>
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Any response? Signs? Sounds?
              </label>
              <textarea
                value={details.anyResponse}
                onChange={(e) => setDetails({ ...details, anyResponse: e.target.value })}
                placeholder="Did you hear barking? See movement? Any signs they might be nearby?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      case 'CHECK_HIDING_SPOTS':
      case 'SEARCH_CONSTRUCTION':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Mark hiding spots you checked
              </label>

              {/* GPS Points List */}
              {details.areasGPS.length > 0 && (
                <div className="space-y-2 mb-3">
                  {details.areasGPS.map((point, i) => (
                    <div key={i} className="bg-purple-900/20 border-2 border-purple-500/30 rounded-xl p-3 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-purple-200 font-semibold text-sm flex items-center gap-2">
                          <MapPin size={14} />
                          Hiding spot #{i + 1}
                        </div>
                        <div className="text-purple-400/60 text-xs mt-1">
                          📍 {point.lat.toFixed(5)}, {point.lng.toFixed(5)} • {new Date(point.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      <button
                        onClick={() => removeGPSPoint('areasGPS', i)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => addGPSPoint('areasGPS', 'Checked here')}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 transition shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2"
              >
                <MapPin size={20} />
                Mark Hiding Spot Checked
              </button>
              <p className="text-slate-400 text-xs mt-2 text-center">
                Mark each location checked
              </p>
            </div>

            <div>
              <label className="text-slate-300 text-sm font-medium block mb-2">
                Describe specific spots (optional)
              </label>
              <textarea
                value={details.areasChecked}
                onChange={(e) => setDetails({ ...details, areasChecked: e.target.value })}
                placeholder="Under porches, sheds, garages, construction sites..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                Find anything?
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Paw prints? Fur? Spots they might return to? Areas you couldn't access?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      case 'SETUP_TRAP':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Where did you place the trap? *
              </label>

              {details.trapGPS ? (
                <div className="bg-emerald-900/20 border-2 border-emerald-500/30 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-emerald-200 font-semibold text-sm mb-2">
                        📍 Trap location captured {details.trapGPS.isManual && '(manual entry)'}
                      </div>
                      <div className="text-emerald-400/60 text-xs space-y-1">
                        <div>{details.trapGPS.lat.toFixed(5)}, {details.trapGPS.lng.toFixed(5)}</div>
                        {details.trapGPS.address && <div>{details.trapGPS.address}</div>}
                        <div>{new Date(details.trapGPS.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setDetails({ ...details, trapGPS: null })}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Clear
                    </button>
                  </div>
                  <input
                    type="text"
                    value={details.trapLocation}
                    onChange={(e) => setDetails({ ...details, trapLocation: e.target.value })}
                    placeholder="Optional description: 'backyard', 'last sighting area'..."
                    className="w-full px-3 py-2 mt-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
                    style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
                    <button
                      onClick={() => setLocationMode('gps')}
                      className={`flex-1 py-2 px-4 rounded-md font-semibold text-sm transition ${
                        locationMode === 'gps'
                          ? 'bg-emerald-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📍 GPS
                    </button>
                    <button
                      onClick={() => setLocationMode('manual')}
                      className={`flex-1 py-2 px-4 rounded-md font-semibold text-sm transition ${
                        locationMode === 'manual'
                          ? 'bg-cyan-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ✏️ Zip/Address
                    </button>
                  </div>

                  {locationMode === 'manual' && (
                    <input
                      type="text"
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder="Enter zip code or address..."
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                    />
                  )}

                  <button
                    onClick={() => captureGPSLocation('trapGPS')}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-cyan-600 transition shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                  >
                    <MapPin size={20} />
                    {locationMode === 'gps' ? 'Capture Trap Location' : 'Pin Trap Location'}
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Type of trap? *
              </label>
              <input
                type="text"
                value={details.trapType}
                onChange={(e) => setDetails({ ...details, trapType: e.target.value })}
                placeholder="Humane live trap, drop trap, etc..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                How often will you check it? *
              </label>
              <input
                type="text"
                value={details.checkingSchedule}
                onChange={(e) => setDetails({ ...details, checkingSchedule: e.target.value })}
                placeholder="Every 2 hours, every morning/evening, etc..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
              <p className="text-slate-400 text-xs mt-2">⚠️ Check traps at least every 2-4 hours to avoid stress to trapped animals</p>
            </div>
            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                What bait are you using?
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Favorite treats, smelly food, items with your scent..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={2}
              />
            </div>
          </div>
        );

      case 'SETUP_CAMERAS':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Where did you set up cameras? *
              </label>

              {details.cameraGPS ? (
                <div className="bg-emerald-900/20 border-2 border-emerald-500/30 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-emerald-200 font-semibold text-sm mb-2">
                        📹 Camera location captured {details.cameraGPS.isManual && '(manual entry)'}
                      </div>
                      <div className="text-emerald-400/60 text-xs space-y-1">
                        <div>{details.cameraGPS.lat.toFixed(5)}, {details.cameraGPS.lng.toFixed(5)}</div>
                        {details.cameraGPS.address && <div>{details.cameraGPS.address}</div>}
                        <div>{new Date(details.cameraGPS.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setDetails({ ...details, cameraGPS: null })}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Clear
                    </button>
                  </div>
                  <input
                    type="text"
                    value={details.cameraLocation}
                    onChange={(e) => setDetails({ ...details, cameraLocation: e.target.value })}
                    placeholder="Optional: 'near food station', 'back door'..."
                    className="w-full px-3 py-2 mt-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
                    style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
                    <button
                      onClick={() => setLocationMode('gps')}
                      className={`flex-1 py-2 px-4 rounded-md font-semibold text-sm transition ${
                        locationMode === 'gps'
                          ? 'bg-emerald-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📍 GPS
                    </button>
                    <button
                      onClick={() => setLocationMode('manual')}
                      className={`flex-1 py-2 px-4 rounded-md font-semibold text-sm transition ${
                        locationMode === 'manual'
                          ? 'bg-cyan-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ✏️ Zip/Address
                    </button>
                  </div>

                  {locationMode === 'manual' && (
                    <input
                      type="text"
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder="Enter zip code or address..."
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                    />
                  )}

                  <button
                    onClick={() => captureGPSLocation('cameraGPS')}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-cyan-600 transition shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                  >
                    <MapPin size={20} />
                    {locationMode === 'gps' ? 'Capture Camera Location' : 'Pin Camera Location'}
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Type of camera? *
              </label>
              <input
                type="text"
                value={details.cameraType}
                onChange={(e) => setDetails({ ...details, cameraType: e.target.value })}
                placeholder="Wildlife camera, Ring doorbell, security cam..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>
            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                Notes
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Motion activated? Night vision? How are you monitoring it?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      case 'CHECK_FOUND_LISTINGS':
      case 'MONITOR_MARKETPLACES':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Which sites did you check? *
              </label>
              <textarea
                value={details.sitesChecked}
                onChange={(e) => setDetails({ ...details, sitesChecked: e.target.value })}
                placeholder="PetFinder, Craigslist, Facebook Marketplace, local shelter websites..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <label className="flex items-center gap-2 text-slate-200 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={details.foundMatches}
                  onChange={(e) => setDetails({ ...details, foundMatches: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600"
                />
                <span>🎉 Found possible matches to follow up on</span>
              </label>
            </div>
            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                Details
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Any promising posts? Set up alerts for new listings?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      case 'FILE_POLICE_REPORT':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                Report confirmation/case number
              </label>
              <input
                type="text"
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Mission number or confirmation..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>
          </div>
        );

      case 'ALERT_NEIGHBORS':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                How did you alert them? *
              </label>
              <select
                value={details.contactResult}
                onChange={(e) => setDetails({ ...details, contactResult: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              >
                <option value="DOOR_TO_DOOR">Went door-to-door</option>
                <option value="FLYERS">Left flyers at doors</option>
                <option value="NEXTDOOR">Posted on Nextdoor</option>
                <option value="COMBINATION">Multiple methods</option>
              </select>
            </div>
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                How many neighbors did you reach?
              </label>
              <input
                type="text"
                value={details.organizationName}
                onChange={(e) => setDetails({ ...details, organizationName: e.target.value })}
                placeholder="Approximate number or area covered..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              />
            </div>
            <div>
              <label className="text-slate-200 text-sm font-medium block mb-2">
                Any leads or offers to help?
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Did anyone see them? Offer to watch out? Have suggestions?"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={3}
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-base font-semibold block mb-2">
                What did you do? *
              </label>
              <textarea
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                placeholder="Actions taken, locations visited, results..."
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                rows={4}
              />
            </div>
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
