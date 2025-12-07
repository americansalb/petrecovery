'use client';

/**
 * ActionsTab - Mission Actions & Points System
 *
 * Features per Actions_Guide.md v2.5:
 * - Points summary (today + all-time) with daily cap warning
 * - Scout mascot tip banner
 * - Team progress indicator
 * - Task categories: SEARCH, OUTREACH, AT_HOME, OTHER
 * - Task completion modal with photo upload
 * - GPS task integration
 * - Custom "Other" activity logging
 * - Case leaderboard
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy,
  Star,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  Mail,
  Camera,
  Search,
  FileText,
  Home,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  Users,
  Award,
  X,
  Upload,
  Navigation,
  MessageSquare,
  History,
  Loader2,
  AlertCircle,
  Crown,
  Edit3,
  Plus,
  Building2,
  PhoneCall,
  Send,
  ExternalLink,
  Play,
  Square,
  Timer,
  Route,
} from 'lucide-react';
import ScoutTipBanner from '@/app/components/missionControl/ScoutTipBanner';

// Category icons and colors - per Actions_Guide.md spec
// SEARCH = Blue (#3B82F6), OUTREACH = Orange (#F97316), AT_HOME = Green (#22C55E), OTHER = Gray (#6B7280)
const CATEGORY_CONFIG = {
  SEARCH: { icon: Search, emoji: '🔍', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30', label: 'Search', desc: 'Physical searching for the pet' },
  OUTREACH: { icon: MessageSquare, emoji: '📢', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30', label: 'Outreach', desc: 'Contact shelters & spread the word' },
  AT_HOME: { icon: Home, emoji: '🏠', color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30', label: 'At Home', desc: 'Attract your pet back home' },
  OTHER: { icon: FileText, emoji: '✏️', color: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/30', label: 'Other', desc: 'Custom activity logging' },
};

// Team Progress Bar component - shows overall mission progress
function TeamProgressBar({ completed, total, loading }) {
  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 animate-pulse">
        <div className="h-12 bg-slate-700/50 rounded"></div>
      </div>
    );
  }

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">📊 Team Progress</span>
        <span className="text-sm font-medium text-white">{completed}/{total} actions completed</span>
      </div>
      <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-flash-500 to-green-500 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-right mt-1">
        <span className="text-xs text-slate-500">{percentage}%</span>
      </div>
    </div>
  );
}

// "Other" Activity Modal - for custom activity logging
function OtherActivityModal({ isOpen, onClose, onSubmit, submitting }) {
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [timeSpent, setTimeSpent] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = () => {
    if (!description.trim()) return;
    onSubmit({ description, location, timeSpent: timeSpent ? parseInt(timeSpent) : null, photo });
    setDescription('');
    setLocation('');
    setTimeSpent('');
    setPhoto(null);
    setPhotoPreview(null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-md w-full border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✏️</span>
            <div>
              <h3 className="text-white font-semibold">Log Other Activity</h3>
              <p className="text-xs text-slate-400">+3 pts (self-reported)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="text-slate-400" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Activity description - required */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              What did you do? <span className="text-flash-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Checked with construction crew, Asked homeless community, etc."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-flash-500"
              rows={3}
            />
          </div>

          {/* Location - optional */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Location <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where did you do this?"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-flash-500"
            />
          </div>

          {/* Time spent - optional */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Time spent <span className="text-slate-500">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={timeSpent}
                onChange={(e) => setTimeSpent(e.target.value)}
                placeholder="30"
                min="1"
                className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-flash-500"
              />
              <span className="text-slate-400 text-sm">minutes</span>
            </div>
          </div>

          {/* Photo - optional */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Photo <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoChange}
              accept="image/*"
              className="hidden"
            />
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                <button
                  onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-20 border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center gap-2 hover:border-flash-500/50 transition-colors"
              >
                <Camera className="text-slate-500" size={20} />
                <span className="text-slate-400 text-sm">Add photo</span>
              </button>
            )}
          </div>

          {/* Info */}
          <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
            💡 Use this for any helpful activity not covered by other tasks. Photos are for context only and don&apos;t provide extra verification.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            className="flex-1 px-4 py-2.5 bg-flash-600 text-white rounded-lg font-medium hover:bg-flash-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Logging...
              </>
            ) : (
              <>
                <Plus size={16} />
                Log Activity
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// GPS Search Tracker Component - tracks search sessions with location
function GPSSearchTracker({ caseId, onPointsEarned }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const pingIntervalRef = useRef(null);
  const durationIntervalRef = useRef(null);

  // Fetch active session on mount
  useEffect(() => {
    if (!caseId) return;

    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/mission/${caseId}/search`);
        if (res.ok) {
          const data = await res.json();
          if (data.activeSession) {
            setSession(data.activeSession);
            // Calculate elapsed time
            const elapsed = Math.floor((Date.now() - new Date(data.activeSession.startedAt).getTime()) / 1000);
            setDuration(elapsed);
            setDistance(data.activeSession.distanceMiles || 0);
          }
        }
      } catch (err) {
        console.error('Error fetching search session:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [caseId]);

  // Duration timer
  useEffect(() => {
    if (session?.status === 'ACTIVE') {
      durationIntervalRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
    return () => clearInterval(durationIntervalRef.current);
  }, [session?.status]);

  // Location ping interval
  useEffect(() => {
    if (session?.status === 'ACTIVE' && session?.id) {
      const pingLocation = async () => {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            });
          });

          await fetch(`/api/mission/${caseId}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'ping',
              sessionId: session.id,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading,
            }),
          });
        } catch (err) {
          console.error('Location ping failed:', err);
        }
      };

      // Ping every 30 seconds
      pingIntervalRef.current = setInterval(pingLocation, 30000);
      pingLocation(); // Initial ping
    }

    return () => clearInterval(pingIntervalRef.current);
  }, [session?.status, session?.id, caseId]);

  const handleStartSearch = async () => {
    setStarting(true);
    setError(null);

    try {
      // Get current position
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const res = await fetch(`/api/mission/${caseId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSession({ id: data.sessionId, status: 'ACTIVE', startedAt: data.startedAt });
        setDuration(0);
        setDistance(0);
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to start search');
      }
    } catch (err) {
      setError(err.message === 'User denied Geolocation'
        ? 'Please enable location access to track your search'
        : 'Failed to get your location');
    } finally {
      setStarting(false);
    }
  };

  const handleEndSearch = async () => {
    if (!session?.id) return;
    setEnding(true);

    try {
      const res = await fetch(`/api/mission/${caseId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          sessionId: session.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSession(null);
        setDuration(0);
        clearInterval(pingIntervalRef.current);
        clearInterval(durationIntervalRef.current);

        if (onPointsEarned && data.pointsEarned > 0) {
          onPointsEarned(data.pointsEarned, data.distanceMiles);
        }
      }
    } catch (err) {
      console.error('Error ending search:', err);
    } finally {
      setEnding(false);
    }
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 animate-pulse">
        <div className="h-16 bg-blue-500/20 rounded"></div>
      </div>
    );
  }

  const isActive = session?.status === 'ACTIVE';

  return (
    <div className={`rounded-xl p-4 border transition-all ${
      isActive
        ? 'bg-blue-500/20 border-blue-500/50'
        : 'bg-slate-800/50 border-slate-700/50'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Navigation className={isActive ? 'text-blue-400' : 'text-slate-400'} size={20} />
          <span className="text-white font-semibold">GPS Search Tracker</span>
          {isActive && (
            <span className="px-2 py-0.5 bg-blue-500/30 text-blue-300 text-xs rounded-full animate-pulse">
              ACTIVE
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">10 pts/mile (verified)</span>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {isActive ? (
        <div className="space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                <Timer size={14} />
                <span className="text-xs">Duration</span>
              </div>
              <div className="text-xl font-bold text-white font-mono">{formatDuration(duration)}</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                <Route size={14} />
                <span className="text-xs">Distance</span>
              </div>
              <div className="text-xl font-bold text-white">{distance.toFixed(2)} mi</div>
            </div>
          </div>

          {/* End button */}
          <button
            onClick={handleEndSearch}
            disabled={ending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          >
            {ending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Square size={18} />
            )}
            {ending ? 'Ending...' : 'End Search'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Points will be calculated when you end the search
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Start a GPS-tracked search to earn verified points based on distance covered.
          </p>
          <button
            onClick={handleStartSearch}
            disabled={starting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          >
            {starting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Play size={18} />
            )}
            {starting ? 'Starting...' : 'Start GPS Search'}
          </button>
        </div>
      )}
    </div>
  );
}

// Shelter Contact Section - for contacting shelters/vets
function ShelterContactSection({ caseId, mission, onPointsEarned }) {
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!caseId) return;

    const fetchShelters = async () => {
      try {
        const res = await fetch(`/api/mission/${caseId}/shelters`);
        if (res.ok) {
          const data = await res.json();
          setShelters(data.shelters || []);
        }
      } catch (err) {
        console.error('Error fetching shelters:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchShelters();
  }, [caseId]);

  const handleLogCall = async (shelterId, outcome, staffResponse, notes) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/mission/${caseId}/shelters/${shelterId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'call',
          outcome,
          staffResponse,
          notes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update shelter status in list
        setShelters(prev => prev.map(s =>
          s.id === shelterId
            ? { ...s, status: 'CONTACTED', lastContactMethod: 'CALL', lastContactedAt: new Date().toISOString() }
            : s
        ));
        setShowCallModal(false);
        setSelectedShelter(null);
        if (onPointsEarned) onPointsEarned(data.pointsEarned);
      }
    } catch (err) {
      console.error('Error logging call:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendEmail = async (shelterId, emailData) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/mission/${caseId}/shelters/${shelterId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'email',
          ...emailData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShelters(prev => prev.map(s =>
          s.id === shelterId
            ? { ...s, status: 'CONTACTED', lastContactMethod: 'EMAIL', lastContactedAt: new Date().toISOString() }
            : s
        ));
        setShowEmailModal(false);
        setSelectedShelter(null);
        if (onPointsEarned) onPointsEarned(data.pointsEarned);
      }
    } catch (err) {
      console.error('Error sending email:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const notContacted = shelters.filter(s => s.status === 'NOT_CONTACTED');
  const contacted = shelters.filter(s => s.status !== 'NOT_CONTACTED');

  if (loading) {
    return (
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 animate-pulse">
        <div className="h-20 bg-orange-500/20 rounded"></div>
      </div>
    );
  }

  return (
    <div className="border border-orange-500/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-4 transition-colors ${
          expanded ? 'bg-orange-500/20' : 'bg-slate-800/30 hover:bg-slate-800/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Building2 className="text-orange-400" size={20} />
          </div>
          <div className="text-left">
            <div className="text-white font-semibold flex items-center gap-2">
              Contact Shelters & Vets
              {notContacted.length > 0 && (
                <span className="text-xs bg-orange-500/30 text-orange-300 px-1.5 py-0.5 rounded">
                  {notContacted.length} pending
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400">Call: 8 pts • Email: 15 pts (verified)</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-orange-400">{shelters.length}</span>
          {expanded ? (
            <ChevronUp className="text-orange-400" size={20} />
          ) : (
            <ChevronDown className="text-slate-400" size={20} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-3 bg-slate-900/50 border-t border-slate-700/30 space-y-2">
          {shelters.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <Building2 size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No shelters tracked yet</p>
              <p className="text-xs text-slate-500 mt-1">Shelters near the lost location will appear here</p>
            </div>
          ) : (
            <>
              {/* Not contacted */}
              {notContacted.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider px-1">Not Contacted</p>
                  {notContacted.map(shelter => (
                    <ShelterCard
                      key={shelter.id}
                      shelter={shelter}
                      onCall={() => { setSelectedShelter(shelter); setShowCallModal(true); }}
                      onEmail={() => { setSelectedShelter(shelter); setShowEmailModal(true); }}
                    />
                  ))}
                </div>
              )}

              {/* Contacted */}
              {contacted.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wider px-1">Already Contacted</p>
                  {contacted.map(shelter => (
                    <ShelterCard
                      key={shelter.id}
                      shelter={shelter}
                      onCall={() => { setSelectedShelter(shelter); setShowCallModal(true); }}
                      onEmail={() => { setSelectedShelter(shelter); setShowEmailModal(true); }}
                      contacted
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Call Log Modal */}
      {showCallModal && selectedShelter && (
        <CallLogModal
          shelter={selectedShelter}
          onClose={() => { setShowCallModal(false); setSelectedShelter(null); }}
          onSubmit={(outcome, staffResponse, notes) => handleLogCall(selectedShelter.id, outcome, staffResponse, notes)}
          submitting={submitting}
        />
      )}

      {/* Email Modal */}
      {showEmailModal && selectedShelter && (
        <ShelterEmailModal
          shelter={selectedShelter}
          mission={mission}
          onClose={() => { setShowEmailModal(false); setSelectedShelter(null); }}
          onSubmit={(data) => handleSendEmail(selectedShelter.id, data)}
          submitting={submitting}
        />
      )}
    </div>
  );
}

// Individual shelter card
function ShelterCard({ shelter, onCall, onEmail, contacted }) {
  const typeColors = {
    SHELTER: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Shelter' },
    VET: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Vet' },
    ANIMAL_CONTROL: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Animal Control' },
  };
  const typeStyle = typeColors[shelter.type] || typeColors.SHELTER;

  return (
    <div className={`bg-slate-800/50 rounded-lg p-3 border transition-all ${
      contacted ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700/50 hover:border-orange-500/50'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-white font-medium truncate">{shelter.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${typeStyle.bg} ${typeStyle.text}`}>
              {typeStyle.label}
            </span>
            {contacted && <CheckCircle size={14} className="text-green-400 shrink-0" />}
          </div>
          <p className="text-xs text-slate-400 truncate">{shelter.address}</p>
          {shelter.lastContactedAt && (
            <p className="text-xs text-slate-500 mt-1">
              Last: {shelter.lastContactMethod?.toLowerCase()} • {new Date(shelter.lastContactedAt).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {shelter.phone && (
            <button
              onClick={onCall}
              className="p-2 bg-slate-700 hover:bg-orange-500/30 rounded-lg transition-colors group"
              title="Log a call"
            >
              <Phone size={16} className="text-slate-400 group-hover:text-orange-400" />
            </button>
          )}
          {shelter.email && (
            <button
              onClick={onEmail}
              className="p-2 bg-slate-700 hover:bg-green-500/30 rounded-lg transition-colors group"
              title="Send email"
            >
              <Mail size={16} className="text-slate-400 group-hover:text-green-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Call Log Modal
function CallLogModal({ shelter, onClose, onSubmit, submitting }) {
  const [outcome, setOutcome] = useState('');
  const [staffResponse, setStaffResponse] = useState('');
  const [notes, setNotes] = useState('');

  const outcomes = [
    { value: 'SPOKE_WITH_STAFF', label: 'Spoke with staff' },
    { value: 'LEFT_VOICEMAIL', label: 'Left voicemail' },
    { value: 'NO_ANSWER', label: 'No answer' },
    { value: 'BUSY', label: 'Line busy' },
    { value: 'WRONG_NUMBER', label: 'Wrong number' },
  ];

  const responses = [
    { value: 'NO_MATCHING_ANIMALS', label: 'No matching animals' },
    { value: 'POSSIBLE_MATCH', label: 'Possible match!' },
    { value: 'CONFIRMED_MATCH', label: 'Confirmed match!' },
    { value: 'WILL_CHECK_AND_CALL_BACK', label: 'Will check and call back' },
    { value: 'OTHER', label: 'Other' },
  ];

  const handleSubmit = () => {
    if (!outcome) return;
    onSubmit(outcome, staffResponse || null, notes || null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-md w-full border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <PhoneCall className="text-orange-400" size={24} />
            <div>
              <h3 className="text-white font-semibold">Log Call</h3>
              <p className="text-xs text-slate-400">{shelter.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="text-slate-400" size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Quick dial */}
          {shelter.phone && (
            <a
              href={`tel:${shelter.phone}`}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
            >
              <Phone size={18} />
              Call {shelter.phone}
            </a>
          )}

          {/* Outcome */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              What happened? <span className="text-flash-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {outcomes.map(o => (
                <button
                  key={o.value}
                  onClick={() => setOutcome(o.value)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    outcome === o.value
                      ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Staff response (only if spoke with staff) */}
          {outcome === 'SPOKE_WITH_STAFF' && (
            <div>
              <label className="block text-sm text-slate-300 mb-2">Staff Response</label>
              <div className="space-y-2">
                {responses.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setStaffResponse(r.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border text-left transition-colors ${
                      staffResponse === r.value
                        ? r.value.includes('MATCH')
                          ? 'bg-green-500/20 border-green-500 text-green-300'
                          : 'bg-orange-500/20 border-orange-500 text-orange-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-orange-500"
              rows={2}
            />
          </div>

          <div className="text-xs text-slate-500 text-center">
            +8 pts (self-reported, counts toward daily cap)
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !outcome}
            className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {submitting ? 'Logging...' : 'Log Call'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Shelter Email Modal
function ShelterEmailModal({ shelter, mission, onClose, onSubmit, submitting }) {
  // Pre-fill from mission data
  const [petName, setPetName] = useState(mission?.petName || '');
  const [petType, setPetType] = useState(mission?.petType || 'DOG');
  const [petBreed, setPetBreed] = useState(mission?.breed || '');
  const [petColor, setPetColor] = useState(mission?.color || '');
  const [lastSeenLocation, setLastSeenLocation] = useState(mission?.lastSeenLocation || '');
  const [lastSeenDate, setLastSeenDate] = useState(mission?.lastSeenDate || new Date().toISOString().split('T')[0]);
  const [ownerName, setOwnerName] = useState(mission?.ownerName || '');
  const [ownerPhone, setOwnerPhone] = useState(mission?.ownerPhone || '');
  const [ownerEmail, setOwnerEmail] = useState(mission?.ownerEmail || '');

  const handleSubmit = () => {
    if (!petName || !lastSeenLocation || !ownerName || !ownerPhone || !ownerEmail) return;
    onSubmit({
      petName,
      petType,
      petBreed,
      petColor,
      lastSeenLocation,
      lastSeenDate,
      ownerName,
      ownerPhone,
      ownerEmail,
      petPhotoUrl: mission?.photoUrl,
      caseUrl: typeof window !== 'undefined' ? window.location.href : '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-700 shadow-xl my-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Mail className="text-green-400" size={24} />
            <div>
              <h3 className="text-white font-semibold">Send Email</h3>
              <p className="text-xs text-slate-400">{shelter.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="text-slate-400" size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-300">
            <p className="font-medium">✓ Verified Action (+15 pts)</p>
            <p className="text-xs text-green-400/70 mt-1">Email sent via platform - no daily cap</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Pet Name *</label>
              <input
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Pet Type</label>
              <select
                value={petType}
                onChange={(e) => setPetType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              >
                <option value="DOG">Dog</option>
                <option value="CAT">Cat</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Breed</label>
              <input
                value={petBreed}
                onChange={(e) => setPetBreed(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Color</label>
              <input
                value={petColor}
                onChange={(e) => setPetColor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Last Seen Location *</label>
            <input
              value={lastSeenLocation}
              onChange={(e) => setLastSeenLocation(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Last Seen Date *</label>
            <input
              type="date"
              value={lastSeenDate}
              onChange={(e) => setLastSeenDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          <div className="border-t border-slate-700 pt-3 mt-3">
            <p className="text-xs text-slate-400 mb-2">Your Contact Info</p>
            <div className="space-y-2">
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Your name *"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              />
              <input
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="Your phone *"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              />
              <input
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="Your email *"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !petName || !lastSeenLocation || !ownerName || !ownerPhone || !ownerEmail}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Task Completion Modal
function TaskCompletionModal({ task, isOpen, onClose, onSubmit, submitting }) {
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen || !task) return null;

  const isPhotoRequired = task.verificationMethod === 'PHOTO';
  const isGPSTask = task.verificationMethod === 'GPS';

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = () => {
    onSubmit({ notes, photo });
    setNotes('');
    setPhoto(null);
    setPhotoPreview(null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-md w-full border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{task.icon}</span>
            <div>
              <h3 className="text-white font-semibold">{task.displayName}</h3>
              <p className="text-xs text-flash-400">+{typeof task.basePoints === 'object' ? task.basePoints.default : task.basePoints} pts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="text-slate-400" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* GPS Task Notice */}
          {isGPSTask && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-3">
              <Navigation className="text-blue-400 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-blue-300 text-sm font-medium">GPS Verification Available</p>
                <p className="text-blue-400/70 text-xs mt-1">
                  For verified points, use the Map tab to track your search with GPS.
                  You can also log this manually below.
                </p>
              </div>
            </div>
          )}

          {/* Photo Upload for PHOTO tasks */}
          {isPhotoRequired && (
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Photo Proof {isPhotoRequired && <span className="text-flash-400">*</span>}
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoChange}
                accept="image/*"
                className="hidden"
              />
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                  <button
                    onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full"
                  >
                    <X size={16} className="text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-flash-500/50 transition-colors"
                >
                  <Camera className="text-slate-500" size={24} />
                  <span className="text-slate-400 text-sm">Tap to add photo</span>
                </button>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Notes <span className="text-slate-500">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any details about this action..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-flash-500"
              rows={3}
            />
          </div>

          {/* Tips */}
          {task.tips && task.tips.length > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 font-medium mb-2">Tips:</p>
              <ul className="space-y-1">
                {task.tips.slice(0, 2).map((tip, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-flash-400">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (isPhotoRequired && !photo)}
            className="flex-1 px-4 py-2.5 bg-flash-600 text-white rounded-lg font-medium hover:bg-flash-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Logging...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Log Action
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Points display component
function PointsSummary({ points, loading, recentActions }) {
  if (loading) {
    return (
      <div className="bg-gradient-to-r from-flash-600/20 to-purple-600/20 rounded-xl p-4 border border-flash-500/30 animate-pulse">
        <div className="h-24 bg-slate-700/50 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-flash-600/20 to-purple-600/20 rounded-xl p-4 border border-flash-500/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="text-flash-400" size={20} />
          <span className="text-white font-semibold">Your Points</span>
        </div>
        {points?.today?.total > 0 && (
          <div className="flex items-center gap-1 text-flash-400">
            <Zap size={16} />
            <span className="text-sm font-medium">+{points.today.total} today</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{points?.today?.verified || 0}</div>
          <div className="text-xs text-slate-400">Verified</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{points?.allTime?.total || 0}</div>
          <div className="text-xs text-slate-400">All Time</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-flash-400">{points?.caseTotal || 0}</div>
          <div className="text-xs text-slate-400">This Case</div>
        </div>
      </div>

      {/* Recent Activity */}
      {recentActions && recentActions.length > 0 && (
        <div className="border-t border-slate-700/50 pt-3 mt-3">
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
            <History size={12} />
            <span>Recent</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentActions.slice(0, 3).map((action) => (
              <div key={action.id} className="flex-shrink-0 bg-slate-800/50 px-2 py-1 rounded text-xs">
                <span className="text-flash-400">+{action.points}</span>
                <span className="text-slate-400 ml-1">{action.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {points?.today?.remaining !== undefined && points.today.remaining < 100 && (
        <div className="mt-3 text-xs text-slate-400 text-center flex items-center justify-center gap-1">
          <AlertCircle size={12} />
          {points.today.remaining} self-report points left today
        </div>
      )}
    </div>
  );
}

// Task card component - improved styling per Actions_Guide.md spec
function TaskCard({ task, onComplete, completing, completedToday }) {
  const getPointsDisplay = () => {
    if (typeof task.basePoints === 'object') {
      return `${task.basePoints.call || task.basePoints.default}–${task.basePoints.email || task.basePoints.default}`;
    }
    return task.basePoints;
  };

  const getVerificationBadge = () => {
    switch (task.verificationMethod) {
      case 'GPS':
        return (
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-500/30">
            <MapPin size={10} /> GPS
          </span>
        );
      case 'PHOTO':
        return (
          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-500/30">
            <Camera size={10} /> Photo
          </span>
        );
      case 'PLATFORM_EMAIL':
        return (
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1 border border-green-500/30">
            <Mail size={10} /> Verified
          </span>
        );
      default:
        return (
          <span className="text-xs bg-slate-600/50 text-slate-400 px-2 py-0.5 rounded-full border border-slate-500/30">
            Self-report
          </span>
        );
    }
  };

  const isCompleting = completing === task.id;
  const category = task.category || 'OTHER';
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.OTHER;

  return (
    <div className={`bg-slate-800/50 rounded-lg p-3 border transition-all duration-200 ${
      completedToday
        ? 'border-green-500/30 bg-green-500/5'
        : `${config.border} hover:border-flash-500/50 hover:bg-slate-800/70`
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header with icon, name, and badges */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-lg">{task.icon}</span>
            <span className="text-white font-semibold">{task.displayName}</span>
            {task.ownerRequested && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-medium">
                <Crown size={10} /> +25%
              </span>
            )}
            {completedToday && <CheckCircle size={14} className="text-green-400 shrink-0" />}
          </div>

          {/* Description */}
          <p className="text-sm text-slate-400 mb-2 line-clamp-2">{task.description}</p>

          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            {getVerificationBadge()}
            <span className={`text-xs font-bold ${config.color}`}>
              +{getPointsDisplay()} pts
            </span>
            {task.role === 'OWNER' && (
              <span className="text-xs bg-slate-600/50 text-slate-400 px-1.5 py-0.5 rounded">
                Owner only
              </span>
            )}
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={() => onComplete(task)}
          disabled={isCompleting}
          className="shrink-0 px-4 py-2.5 bg-flash-600 hover:bg-flash-500 disabled:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 shadow-lg shadow-flash-500/20 hover:shadow-flash-500/30"
        >
          {isCompleting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckCircle size={14} />
          )}
          <span>{completedToday ? 'Again' : 'Log'}</span>
        </button>
      </div>
    </div>
  );
}

// Category section component - improved styling per Actions_Guide.md spec
function CategorySection({ category, tasks, expanded, onToggle, onCompleteTask, completing, completedTasks }) {
  const config = CATEGORY_CONFIG[category] || { icon: Target, emoji: '📋', color: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/30', label: category, desc: '' };
  const completedCount = tasks.filter(t => completedTasks?.includes(t.id)).length;
  const hasOwnerRequested = tasks.some(t => t.ownerRequested);

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${expanded ? config.border : 'border-slate-700/50'}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 transition-colors ${expanded ? config.bg : 'bg-slate-800/30 hover:bg-slate-800/50'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center text-xl`}>
            {config.emoji}
          </div>
          <div className="text-left">
            <div className="text-white font-semibold flex items-center gap-2">
              {config.label}
              {hasOwnerRequested && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-medium">
                  <Crown size={10} />
                </span>
              )}
              {completedCount > 0 && (
                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30">
                  {completedCount} done
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400">{config.desc}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${config.color}`}>{tasks.length}</span>
          {expanded ? (
            <ChevronUp className={config.color} size={20} />
          ) : (
            <ChevronDown className="text-slate-400" size={20} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-2 bg-slate-900/50 border-t border-slate-700/30">
          {/* Sort tasks: owner-requested first, then by priority */}
          {tasks
            .sort((a, b) => {
              if (a.ownerRequested && !b.ownerRequested) return -1;
              if (!a.ownerRequested && b.ownerRequested) return 1;
              return (b.basePriority || 50) - (a.basePriority || 50);
            })
            .map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onCompleteTask}
                completing={completing}
                completedToday={completedTasks?.includes(task.id)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// Leaderboard component
function Leaderboard({ entries, userId, loading }) {
  if (loading) {
    return (
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 animate-pulse">
        <div className="h-32 bg-slate-700/50 rounded"></div>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50 text-center">
        <Users className="text-slate-500 mx-auto mb-2" size={24} />
        <p className="text-slate-400 text-sm">No contributions yet</p>
        <p className="text-slate-500 text-xs mt-1">Be the first to help!</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="p-3 border-b border-slate-700/50 flex items-center gap-2">
        <Award className="text-flash-400" size={18} />
        <span className="text-white font-medium">Top Contributors</span>
      </div>
      <div className="divide-y divide-slate-700/30">
        {entries.slice(0, 5).map((entry) => (
          <div
            key={entry.userId}
            className={`flex items-center justify-between p-3 ${
              entry.userId === userId ? 'bg-flash-500/10' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                entry.rank === 1 ? 'bg-yellow-500 text-yellow-900' :
                entry.rank === 2 ? 'bg-slate-300 text-slate-700' :
                entry.rank === 3 ? 'bg-amber-600 text-amber-100' :
                'bg-slate-600 text-slate-300'
              }`}>
                {entry.rank}
              </div>
              <span className={`text-sm ${entry.userId === userId ? 'text-flash-400 font-medium' : 'text-white'}`}>
                {entry.userName}
                {entry.userId === userId && ' (You)'}
              </span>
            </div>
            <span className="text-flash-400 font-medium">{entry.points} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main ActionsTab component
export default function ActionsTab({ mission, userId, onTaskComplete, onNavigateToMap }) {
  const [points, setPoints] = useState(null);
  const [tasks, setTasks] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState('SEARCH');
  const [completing, setCompleting] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [completedTasks, setCompletedTasks] = useState([]);

  // New state for Scout tips and other activity
  const [tips, setTips] = useState([]);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [dismissingTip, setDismissingTip] = useState(null);
  const [showOtherActivityModal, setShowOtherActivityModal] = useState(false);
  const [submittingOther, setSubmittingOther] = useState(false);
  const [teamProgress, setTeamProgress] = useState({ completed: 0, total: 0 });

  // Fetch points, tasks, and tips
  useEffect(() => {
    if (!mission?.id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch points summary
        const pointsRes = await fetch(`/api/users/me/points?caseId=${mission.id}`);
        if (pointsRes.ok) {
          const data = await pointsRes.json();
          setPoints(data);
        }

        // Fetch leaderboard
        const leaderRes = await fetch(`/api/mission/${mission.id}/points/leaderboard`);
        if (leaderRes.ok) {
          const data = await leaderRes.json();
          setLeaderboard(data.entries || []);
        }

        // Fetch task definitions
        const tasksRes = await fetch('/api/tasks/definitions');
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          // Group by category - filter to only show spec categories
          const validCategories = ['SEARCH', 'OUTREACH', 'AT_HOME', 'OTHER'];
          const grouped = {};
          Object.values(data.tasks || {}).forEach((task) => {
            // Map any non-standard categories to OUTREACH
            let category = task.category;
            if (!validCategories.includes(category)) {
              category = 'OUTREACH';
            }
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(task);
          });
          setTasks(grouped);

          // Calculate team progress (count total tasks)
          const totalTasks = Object.values(grouped).flat().length;
          setTeamProgress((prev) => ({ ...prev, total: totalTasks }));
        }

        // Fetch Scout tips
        try {
          const tipsRes = await fetch(`/api/mission/${mission.id}/tips`);
          if (tipsRes.ok) {
            const data = await tipsRes.json();
            setTips(data.tips || []);
          }
        } catch (tipErr) {
          // Tips are optional, don't fail if API doesn't exist
          console.log('Tips API not available:', tipErr);
        }
      } catch (err) {
        console.error('Error fetching actions data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mission?.id]);

  // Handle opening task modal
  const handleOpenTask = (task) => {
    setSelectedTask(task);
  };

  // Helper function to upload photo to CDN
  const uploadPhoto = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', 'general'); // Task photos are general context

    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      const errorData = await uploadRes.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to upload photo');
    }

    const uploadData = await uploadRes.json();
    return uploadData.url;
  };

  // Handle task completion
  const handleCompleteTask = async ({ notes, photo }) => {
    if (!selectedTask) return;

    setCompleting(selectedTask.id);
    try {
      // Upload photo to CDN if provided
      let photoUrl = null;
      if (photo) {
        try {
          photoUrl = await uploadPhoto(photo);
        } catch (uploadErr) {
          console.error('Photo upload failed:', uploadErr);
          // Continue without photo - don't block task completion
        }
      }

      const res = await fetch('/api/tasks/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: mission.id,
          taskId: selectedTask.id,
          actionType: selectedTask.id,
          notes,
          photoUrl,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Update points display
        setPoints((prev) => ({
          ...prev,
          today: {
            ...prev?.today,
            selfReported: (prev?.today?.selfReported || 0) + (data.pointsEarned || 0),
            total: (prev?.today?.total || 0) + (data.pointsEarned || 0),
            remaining: data.remainingDaily ?? prev?.today?.remaining,
          },
          caseTotal: (prev?.caseTotal || 0) + (data.pointsEarned || 0),
        }));

        // Track completed task
        setCompletedTasks((prev) => [...new Set([...prev, selectedTask.id])]);

        // Notify parent
        if (onTaskComplete) {
          onTaskComplete(selectedTask, data);
        }
      }
    } catch (err) {
      console.error('Error logging task:', err);
    } finally {
      setCompleting(null);
      setSelectedTask(null);
    }
  };

  // Handle dismissing a Scout tip
  const handleDismissTip = useCallback(async (tipId) => {
    if (!mission?.id || !tipId) return;
    setDismissingTip(tipId);
    try {
      const res = await fetch(`/api/mission/${mission.id}/tips/${tipId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTips((prev) => prev.filter((t) => t.id !== tipId));
        if (currentTipIndex >= tips.length - 1) {
          setCurrentTipIndex(Math.max(0, currentTipIndex - 1));
        }
      }
    } catch (err) {
      console.error('Error dismissing tip:', err);
    } finally {
      setDismissingTip(null);
    }
  }, [mission?.id, tips.length, currentTipIndex]);

  // Handle tip action (e.g., navigate to search)
  const handleTipAction = useCallback((actionType, tip) => {
    if (actionType?.startsWith('navigate:')) {
      const target = actionType.replace('navigate:', '');
      if (target === 'search' && onNavigateToMap) {
        onNavigateToMap();
      }
    }
  }, [onNavigateToMap]);

  // Handle "Other" activity submission
  const handleOtherActivitySubmit = async ({ description, location, timeSpent, photo }) => {
    if (!mission?.id || !description.trim()) return;

    setSubmittingOther(true);
    try {
      // Upload photo if provided (for context only, not verification)
      let photoUrl = null;
      if (photo) {
        try {
          photoUrl = await uploadPhoto(photo);
        } catch (uploadErr) {
          console.error('Photo upload failed:', uploadErr);
          // Continue without photo
        }
      }

      const res = await fetch('/api/tasks/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: mission.id,
          taskId: 'other',
          actionType: 'other',
          notes: description,
          photoUrl,
          metadata: {
            location: location || null,
            timeSpentMinutes: timeSpent || null,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Update points display
        setPoints((prev) => ({
          ...prev,
          today: {
            ...prev?.today,
            selfReported: (prev?.today?.selfReported || 0) + (data.pointsEarned || 0),
            total: (prev?.today?.total || 0) + (data.pointsEarned || 0),
            remaining: data.remainingDaily ?? prev?.today?.remaining,
          },
          caseTotal: (prev?.caseTotal || 0) + (data.pointsEarned || 0),
        }));

        // Update team progress
        setTeamProgress((prev) => ({
          ...prev,
          completed: prev.completed + 1,
        }));

        // Notify parent
        if (onTaskComplete) {
          onTaskComplete({ id: 'other', displayName: 'Other Activity' }, data);
        }

        setShowOtherActivityModal(false);
      }
    } catch (err) {
      console.error('Error logging other activity:', err);
    } finally {
      setSubmittingOther(false);
    }
  };

  const categories = Object.keys(tasks).sort((a, b) => {
    // Per spec: SEARCH, OUTREACH, AT_HOME, OTHER (removed VISIBILITY and DIGITAL)
    const order = ['SEARCH', 'OUTREACH', 'AT_HOME', 'OTHER'];
    return order.indexOf(a) - order.indexOf(b);
  });

  // Get the current tip to display
  const currentTip = tips[currentTipIndex];

  // Handler for points earned from GPS or shelter actions
  const handleExternalPointsEarned = useCallback((pointsEarned, distanceMiles = null) => {
    setPoints((prev) => ({
      ...prev,
      today: {
        ...prev?.today,
        verified: (prev?.today?.verified || 0) + pointsEarned,
        total: (prev?.today?.total || 0) + pointsEarned,
      },
      caseTotal: (prev?.caseTotal || 0) + pointsEarned,
    }));
  }, []);

  return (
    <div className="space-y-4 pb-20">
      {/* Scout Tip Banner - shown when tips are available */}
      {currentTip && (
        <ScoutTipBanner
          tip={currentTip}
          onDismiss={handleDismissTip}
          onAction={handleTipAction}
          dismissing={dismissingTip === currentTip.id}
        />
      )}

      {/* Points Summary */}
      <PointsSummary
        points={points}
        loading={loading}
        recentActions={points?.recentActions}
      />

      {/* GPS Search Tracker - prominent placement for search missions */}
      <GPSSearchTracker
        caseId={mission?.id}
        onPointsEarned={handleExternalPointsEarned}
      />

      {/* Team Progress Bar */}
      <TeamProgressBar
        completed={teamProgress.completed + completedTasks.length}
        total={teamProgress.total}
        loading={loading}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/50 text-center">
          <div className="text-lg font-bold text-green-400">
            {points?.today?.verified || 0}
          </div>
          <div className="text-xs text-slate-400">Verified Today</div>
        </div>
        <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/50 text-center">
          <div className="text-lg font-bold text-orange-400">
            {leaderboard.find((e) => e.userId === userId)?.rank || '–'}
          </div>
          <div className="text-xs text-slate-400">Your Rank</div>
        </div>
      </div>

      {/* Task Categories */}
      <div className="space-y-3">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Target size={18} className="text-flash-400" />
          Available Actions
        </h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-800/30 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Target size={32} className="mx-auto mb-2 opacity-50" />
            <p>No actions available</p>
          </div>
        ) : (
          <>
            {/* Regular categories: SEARCH, OUTREACH, AT_HOME */}
            {categories.filter((c) => c !== 'OTHER').map((category) => (
              <CategorySection
                key={category}
                category={category}
                tasks={tasks[category] || []}
                expanded={expandedCategory === category}
                onToggle={() => setExpandedCategory(expandedCategory === category ? null : category)}
                onCompleteTask={handleOpenTask}
                completing={completing}
                completedTasks={completedTasks}
              />
            ))}

            {/* Shelter Contact Section - Outreach category key feature */}
            <ShelterContactSection
              caseId={mission?.id}
              mission={mission}
              onPointsEarned={handleExternalPointsEarned}
            />

            {/* OTHER category - special "Log Activity" button per spec */}
            <div className="border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="p-4 bg-slate-800/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-slate-500/20">
                    <Edit3 className="text-slate-400" size={20} />
                  </div>
                  <div>
                    <div className="text-white font-medium">Other</div>
                    <div className="text-xs text-slate-400">Log any other helpful activity</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowOtherActivityModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 font-medium transition-colors"
                >
                  <Plus size={18} />
                  <span>Log Activity (+3 pts)</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Leaderboard */}
      <div className="space-y-3">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Trophy size={18} className="text-flash-400" />
          Leaderboard
        </h3>
        <Leaderboard entries={leaderboard} userId={userId} loading={loading} />
      </div>

      {/* Task Completion Modal */}
      <TaskCompletionModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onSubmit={handleCompleteTask}
        submitting={completing === selectedTask?.id}
      />

      {/* Other Activity Modal */}
      <OtherActivityModal
        isOpen={showOtherActivityModal}
        onClose={() => setShowOtherActivityModal(false)}
        onSubmit={handleOtherActivitySubmit}
        submitting={submittingOther}
      />
    </div>
  );
}
