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

// Compact GPS Search Button - opens modal with full tracker
function GPSSearchButton({ caseId, onPointsEarned }) {
  const [showModal, setShowModal] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  // Check for active session on mount
  useEffect(() => {
    if (!caseId) return;
    const checkSession = async () => {
      try {
        const res = await fetch(`/api/mission/${caseId}/search`);
        if (res.ok) {
          const data = await res.json();
          setHasActiveSession(!!data.activeSession);
        }
      } catch (err) {
        // Ignore
      }
    };
    checkSession();
  }, [caseId]);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl transition-all relative ${
          hasActiveSession
            ? 'bg-blue-500/20 border border-blue-500/50'
            : 'bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50'
        }`}
      >
        <Navigation className={hasActiveSession ? 'text-blue-400' : 'text-blue-400'} size={18} />
        <span className="text-xs text-slate-300 font-medium">GPS</span>
        {hasActiveSession && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></span>
        )}
      </button>

      {showModal && (
        <GPSSearchModal
          caseId={caseId}
          onClose={() => setShowModal(false)}
          onPointsEarned={(pts, dist) => {
            setHasActiveSession(false);
            if (onPointsEarned) onPointsEarned(pts, dist);
          }}
          onSessionStart={() => setHasActiveSession(true)}
        />
      )}
    </>
  );
}

// GPS Search Modal - Full tracking interface
function GPSSearchModal({ caseId, onClose, onPointsEarned, onSessionStart }) {
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
      durationIntervalRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => clearInterval(durationIntervalRef.current);
  }, [session?.status]);

  // Location ping
  useEffect(() => {
    if (session?.status === 'ACTIVE' && session?.id) {
      const pingLocation = async () => {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
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
            }),
          });
        } catch (err) {
          console.error('Location ping failed:', err);
        }
      };
      pingIntervalRef.current = setInterval(pingLocation, 30000);
      pingLocation();
    }
    return () => clearInterval(pingIntervalRef.current);
  }, [session?.status, session?.id, caseId]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
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
        if (onSessionStart) onSessionStart();
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to start');
      }
    } catch (err) {
      setError(err.message === 'User denied Geolocation' ? 'Enable location access to track your search' : 'Failed to get location');
    } finally {
      setStarting(false);
    }
  };

  const handleEnd = async () => {
    if (!session?.id) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/mission/${caseId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', sessionId: session.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setSession(null);
        clearInterval(pingIntervalRef.current);
        clearInterval(durationIntervalRef.current);
        if (onPointsEarned && data.pointsEarned > 0) {
          onPointsEarned(data.pointsEarned, data.distanceMiles);
        }
        onClose();
      }
    } catch (err) {
      console.error('Error ending search:', err);
    } finally {
      setEnding(false);
    }
  };

  const formatDuration = (s) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return hrs > 0
      ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isActive = session?.status === 'ACTIVE';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-sm w-full border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Navigation className="text-blue-400" size={24} />
            <div>
              <h3 className="text-white font-semibold">GPS Search Tracker</h3>
              <p className="text-xs text-slate-400">Earn 10 pts per mile walked</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="text-slate-400" size={20} />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="h-32 bg-slate-800/50 rounded-lg animate-pulse"></div>
          ) : error ? (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm mb-4">
              {error}
            </div>
          ) : isActive ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                  <Timer size={18} className="text-blue-400 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-white font-mono">{formatDuration(duration)}</div>
                  <div className="text-xs text-slate-400">Duration</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                  <Route size={18} className="text-blue-400 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-white">{distance.toFixed(2)}</div>
                  <div className="text-xs text-slate-400">Miles</div>
                </div>
              </div>
              <button
                onClick={handleEnd}
                disabled={ending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 text-white font-semibold rounded-lg"
              >
                {ending ? <Loader2 size={18} className="animate-spin" /> : <Square size={18} />}
                {ending ? 'Ending...' : 'End Search'}
              </button>
              <p className="text-xs text-slate-400 text-center">Points calculated when you end</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                <Navigation size={32} className="text-blue-400 mx-auto mb-2" />
                <p className="text-slate-300 text-sm">Start a GPS-tracked search walk</p>
                <p className="text-xs text-slate-500 mt-1">Earn verified points based on distance</p>
              </div>
              <button
                onClick={handleStart}
                disabled={starting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white font-semibold rounded-lg"
              >
                {starting ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                {starting ? 'Starting...' : 'Start GPS Search'}
              </button>
            </div>
          )}
        </div>
      </div>
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
  const [showSearchModal, setShowSearchModal] = useState(false);
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

  const handleAddShelter = async (place) => {
    try {
      const res = await fetch(`/api/mission/${caseId}/shelters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: place.place_id,
          name: place.name,
          address: place.vicinity || place.formatted_address,
          phone: place.formatted_phone_number,
          email: null, // Google Places doesn't provide email
          type: place.placeType || 'SHELTER',
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (!data.alreadyExists) {
          setShelters(prev => [...prev, {
            id: data.shelter.id,
            placeId: data.shelter.placeId,
            name: data.shelter.shelterName,
            address: data.shelter.shelterAddress,
            phone: data.shelter.shelterPhone,
            email: data.shelter.shelterEmail,
            type: data.shelter.shelterType,
            status: 'NOT_CONTACTED',
          }]);
        }
        return { success: true, alreadyExists: data.alreadyExists };
      }
      return { success: false };
    } catch (err) {
      console.error('Error adding shelter:', err);
      return { success: false };
    }
  };

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
          {/* Find Nearby Button - always visible when expanded */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg text-orange-300 font-medium text-sm transition-colors"
          >
            <Search size={16} />
            Find Nearby Shelters & Vets
          </button>

          {shelters.length === 0 ? (
            <div className="text-center py-4 text-slate-400">
              <p className="text-sm">No shelters tracked yet</p>
              <p className="text-xs text-slate-500 mt-1">Search to find shelters near the lost location</p>
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

      {/* Place Search Modal */}
      {showSearchModal && (
        <PlaceSearchModal
          mission={mission}
          existingPlaceIds={shelters.map(s => s.placeId)}
          onClose={() => setShowSearchModal(false)}
          onAddPlace={handleAddShelter}
        />
      )}
    </div>
  );
}

// Place Search Modal - search Apple Maps for shelters/vets
function PlaceSearchModal({ mission, existingPlaceIds = [], onClose, onAddPlace }) {
  const [searchType, setSearchType] = useState('shelter');
  const [radius, setRadius] = useState(25);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState({});
  const [hasSearched, setHasSearched] = useState(false);

  const searchPlaces = async () => {
    if (!mission?.lastSeenLatitude || !mission?.lastSeenLongitude) {
      setError('Case location not available');
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch(
        `/api/places/search?lat=${mission.lastSeenLatitude}&lng=${mission.lastSeenLongitude}&type=${searchType}&radius=${radius}`
      );

      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setError(data.error);
          setResults([]);
        } else {
          // Transform API response to expected format - handle both Apple Maps and database results
          const resultsWithType = (data.places || []).map(place => ({
            place_id: place.placeId || place.id,
            name: place.name,
            vicinity: place.address,
            distanceMiles: place.distanceMiles,
            phone: place.phone,
            website: place.website,
            hours: place.hours,
            // Handle both location object and direct lat/lng
            geometry: {
              location: {
                lat: place.location?.lat ?? place.latitude,
                lng: place.location?.lng ?? place.longitude
              }
            },
            rating: place.rating,
            user_ratings_total: place.userRatingsTotal,
            placeType: searchType === 'shelter' ? 'SHELTER' : searchType === 'vet' ? 'VET' : 'ANIMAL_CONTROL',
          }));
          setResults(resultsWithType);
        }
      } else {
        const errData = await res.json();
        setError(errData.error || 'Search failed');
      }
    } catch (err) {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // No auto-search - user must click Search button

  const handleAdd = async (place) => {
    setAdding(prev => ({ ...prev, [place.place_id]: true }));
    const result = await onAddPlace(place);
    setAdding(prev => ({ ...prev, [place.place_id]: false }));

    if (result.success && !result.alreadyExists) {
      setResults(prev => prev.filter(p => p.place_id !== place.place_id));
    }
  };

  const typeButtons = [
    { value: 'shelter', label: 'Shelters', icon: Building2 },
    { value: 'vet', label: 'Vets', icon: Building2 },
    { value: 'animal_control', label: 'Animal Ctrl', icon: Building2 },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl flex flex-col" style={{ height: '85vh', maxHeight: '700px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h3 className="text-white font-bold text-xl">Shelters & Vets</h3>
            <p className="text-slate-400 text-sm mt-0.5">Find nearby places to contact about this pet</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <X className="text-slate-400" size={24} />
          </button>
        </div>

        {/* Search Controls */}
        <div className="px-6 py-5 border-b border-slate-700 bg-slate-800/30">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Type Selection */}
            <div className="flex gap-2 flex-1">
              {typeButtons.map(btn => (
                <button
                  key={btn.value}
                  onClick={() => setSearchType(btn.value)}
                  className={`flex-1 py-3 px-4 text-sm font-semibold rounded-xl transition-all ${
                    searchType === btn.value
                      ? 'bg-orange-500 text-white shadow-lg'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Radius Selection */}
            <div className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-2">
              <span className="text-slate-400 text-sm whitespace-nowrap">Radius:</span>
              <div className="flex gap-1">
                {[10, 25, 50, 75].map(r => (
                  <button
                    key={r}
                    onClick={() => setRadius(r)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      radius === r
                        ? 'bg-orange-500 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {r}mi
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={searchPlaces}
            disabled={loading}
            className="w-full mt-4 py-4 bg-orange-500 hover:bg-orange-400 disabled:bg-orange-600 disabled:cursor-wait text-white font-bold text-lg rounded-xl transition-all flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                Searching nearby places...
              </>
            ) : (
              <>
                <Search size={22} />
                Search Now
              </>
            )}
          </button>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Error State */}
          {error && (
            <div className="m-6 p-6 bg-red-950/50 border-2 border-red-500/30 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500/20 rounded-xl">
                  <X className="text-red-400" size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="text-red-300 font-semibold text-lg">Search Failed</h4>
                  <p className="text-red-400/80 mt-1">{error}</p>
                  <button
                    onClick={searchPlaces}
                    className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Initial State */}
          {!hasSearched && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6">
              <div className="p-6 bg-slate-800/50 rounded-full mb-6">
                <Search size={48} className="text-slate-600" />
              </div>
              <h4 className="text-slate-300 font-semibold text-lg">Ready to Search</h4>
              <p className="text-slate-500 mt-2 text-center max-w-sm">
                Select the type of place and search radius above, then click Search Now
              </p>
            </div>
          )}

          {/* Empty Results */}
          {hasSearched && !loading && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6">
              <div className="p-6 bg-slate-800/50 rounded-full mb-6">
                <Building2 size={48} className="text-slate-600" />
              </div>
              <h4 className="text-slate-300 font-semibold text-lg">No Results Found</h4>
              <p className="text-slate-500 mt-2 text-center max-w-sm">
                No {searchType === 'shelter' ? 'shelters' : searchType === 'vet' ? 'veterinarians' : 'animal control offices'} found within {radius} miles
              </p>
              <button
                onClick={() => setRadius(Math.min(radius + 25, 75))}
                disabled={radius >= 75}
                className="mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-medium rounded-xl transition-colors"
              >
                Expand Search Radius
              </button>
            </div>
          )}

          {/* Results List */}
          {results.length > 0 && (
            <div className="p-4 space-y-3">
              <p className="text-slate-400 text-sm px-2 mb-2">
                Found {results.length} {searchType === 'shelter' ? 'shelters' : searchType === 'vet' ? 'veterinarians' : 'animal control offices'}
              </p>
              {results.map(place => {
                const isAdded = existingPlaceIds.includes(place.place_id);
                const isAdding = adding[place.place_id];

                return (
                  <div
                    key={place.place_id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isAdded
                        ? 'bg-green-950/30 border-green-500/30'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h4 className="text-white font-semibold text-base">{place.name}</h4>
                          {place.distanceMiles != null && (
                            <span className="px-2.5 py-1 bg-orange-500/20 text-orange-300 text-xs font-semibold rounded-full">
                              {place.distanceMiles} mi
                            </span>
                          )}
                          {isAdded && (
                            <span className="px-2.5 py-1 bg-green-500/20 text-green-300 text-xs font-semibold rounded-full">
                              Added
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm mt-1.5">{place.vicinity}</p>
                        {place.phone && (
                          <p className="text-slate-300 text-sm mt-2 font-medium">{place.phone}</p>
                        )}
                      </div>
                      {!isAdded && (
                        <button
                          onClick={() => handleAdd(place)}
                          disabled={isAdding}
                          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:bg-slate-700 text-white font-semibold rounded-xl transition-all shrink-0"
                        >
                          {isAdding ? <Loader2 size={18} className="animate-spin" /> : 'Add'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/30">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Flyer Generation Card (Compact)
function FlyerGenerationCard({ caseId }) {
  const [showModal, setShowModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [flyerHtml, setFlyerHtml] = useState(null);
  const [options, setOptions] = useState({
    size: 'half',
    template: 'classic',
    includeQrCode: true,
    customMessage: '',
  });

  const handleGenerate = async () => {
    if (!caseId) return;
    setGenerating(true);

    try {
      const res = await fetch(`/api/mission/${caseId}/flyers/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (res.ok) {
        const data = await res.json();
        setFlyerHtml(data.html);
      }
    } catch (err) {
      console.error('Error generating flyer:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!flyerHtml) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(flyerHtml);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex flex-col items-center justify-center gap-1 p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl transition-all"
      >
        <FileText className="text-purple-400" size={18} />
        <span className="text-xs text-slate-300 font-medium">Flyer</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full border border-slate-700 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <FileText className="text-purple-400" size={24} />
                <h3 className="text-white font-semibold">Generate Flyer</h3>
              </div>
              <button onClick={() => { setShowModal(false); setFlyerHtml(null); }} className="p-2 hover:bg-slate-800 rounded-lg">
                <X className="text-slate-400" size={20} />
              </button>
            </div>

            {!flyerHtml ? (
              <div className="p-4 space-y-4">
                {/* Size */}
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Size</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['full', 'half', 'quarter'].map(size => (
                      <button
                        key={size}
                        onClick={() => setOptions(prev => ({ ...prev, size }))}
                        className={`px-3 py-2 text-sm rounded-lg border capitalize ${
                          options.size === size
                            ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template */}
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Template</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['classic', 'modern', 'minimal'].map(template => (
                      <button
                        key={template}
                        onClick={() => setOptions(prev => ({ ...prev, template }))}
                        className={`px-3 py-2 text-sm rounded-lg border capitalize ${
                          options.template === template
                            ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        {template}
                      </button>
                    ))}
                  </div>
                </div>

                {/* QR Code */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeQrCode}
                    onChange={(e) => setOptions(prev => ({ ...prev, includeQrCode: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-slate-300 text-sm">Include QR code to case page</span>
                </label>

                {/* Custom Message */}
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Custom Message (optional)</label>
                  <textarea
                    value={options.customMessage}
                    onChange={(e) => setOptions(prev => ({ ...prev, customMessage: e.target.value }))}
                    placeholder="Any additional message..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:border-purple-500"
                    rows={2}
                  />
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="bg-white rounded-lg p-4 text-center text-gray-900 mb-4">
                  <p className="font-medium">Flyer generated!</p>
                  <p className="text-sm text-gray-600">Click Print to open in a new window</p>
                </div>
              </div>
            )}

            <div className="p-4 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => { setShowModal(false); setFlyerHtml(null); }}
                className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg font-medium"
              >
                Cancel
              </button>
              {!flyerHtml ? (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                  {generating ? 'Generating...' : 'Generate'}
                </button>
              ) : (
                <button
                  onClick={handlePrint}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <ExternalLink size={16} />
                  Print Flyer
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Volunteer Check-in Card (Compact)
function VolunteerCheckInCard({ caseId }) {
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (!caseId) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/mission/${caseId}/volunteer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: checkedIn ? 'CHECK_OUT' : 'CHECK_IN',
          estimatedMinutes: 60,
        }),
      });

      if (res.ok) {
        setCheckedIn(!checkedIn);
      }
    } catch (err) {
      console.error('Error toggling check-in:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl transition-all ${
        checkedIn
          ? 'bg-green-500/20 border border-green-500/50'
          : 'bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50'
      }`}
    >
      {loading ? (
        <Loader2 className="text-green-400 animate-spin" size={18} />
      ) : checkedIn ? (
        <CheckCircle className="text-green-400" size={18} />
      ) : (
        <Users className="text-green-400" size={18} />
      )}
      <span className="text-xs text-slate-300 font-medium">
        {checkedIn ? 'Active' : 'Join'}
      </span>
    </button>
  );
}

// Shelter Search Button (Compact - opens full modal)
function ShelterSearchButton({ caseId, mission, onPointsEarned }) {
  const [showModal, setShowModal] = useState(false);
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch shelters when modal opens
  const openModal = async () => {
    setShowModal(true);
    if (shelters.length === 0) {
      setLoading(true);
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
    }
  };

  const handleAddShelter = async (place) => {
    try {
      const res = await fetch(`/api/mission/${caseId}/shelters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: place.place_id,
          name: place.name,
          address: place.vicinity || place.formatted_address,
          phone: place.phone || place.formatted_phone_number,
          email: null,
          type: place.placeType || 'SHELTER',
          latitude: place.geometry?.location?.lat,
          longitude: place.geometry?.location?.lng,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (!data.alreadyExists) {
          setShelters(prev => [...prev, {
            id: data.shelter.id,
            placeId: data.shelter.placeId,
            name: data.shelter.shelterName,
            address: data.shelter.shelterAddress,
            phone: data.shelter.shelterPhone,
            type: data.shelter.shelterType,
            status: 'NOT_CONTACTED',
          }]);
        }
        return { success: true, alreadyExists: data.alreadyExists };
      }
      return { success: false };
    } catch (err) {
      return { success: false };
    }
  };

  const notContacted = shelters.filter(s => s.status === 'NOT_CONTACTED').length;

  return (
    <>
      <button
        onClick={openModal}
        className="flex flex-col items-center justify-center gap-1 p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl transition-all relative"
      >
        <Building2 className="text-orange-400" size={18} />
        <span className="text-xs text-slate-300 font-medium">Shelters</span>
        {notContacted > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center">
            {notContacted}
          </span>
        )}
      </button>

      {showModal && (
        <ShelterContactModal
          caseId={caseId}
          mission={mission}
          shelters={shelters}
          setShelters={setShelters}
          loading={loading}
          onClose={() => setShowModal(false)}
          onAddShelter={handleAddShelter}
          onPointsEarned={onPointsEarned}
        />
      )}
    </>
  );
}

// Full Shelter Contact Modal (combines search + contact list)
function ShelterContactModal({ caseId, mission, shelters, setShelters, loading, onClose, onAddShelter, onPointsEarned }) {
  const [activeTab, setActiveTab] = useState('contacts'); // 'contacts' | 'search'
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search state
  const [searchType, setSearchType] = useState('shelter');
  const [searchRadius, setSearchRadius] = useState(25);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState({});

  const searchPlaces = async () => {
    if (!mission?.lastSeenLatitude || !mission?.lastSeenLongitude) return;
    setSearching(true);
    setSearchError(null);

    try {
      const res = await fetch(
        `/api/places/search?lat=${mission.lastSeenLatitude}&lng=${mission.lastSeenLongitude}&type=${searchType}&radius=${searchRadius}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setSearchError(data.error);
          setSearchResults([]);
        } else {
          setSearchResults((data.places || []).map(place => ({
            place_id: place.placeId || place.id,
            name: place.name,
            vicinity: place.address,
            distanceMiles: place.distanceMiles,
            phone: place.phone,
            // Handle both location object (Apple Maps) and direct lat/lng (database)
            geometry: { location: { lat: place.location?.lat ?? place.latitude, lng: place.location?.lng ?? place.longitude } },
            rating: place.rating,
            user_ratings_total: place.userRatingsTotal,
            placeType: searchType === 'shelter' ? 'SHELTER' : searchType === 'vet' ? 'VET' : 'ANIMAL_CONTROL',
          })));
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  // Manual search only - no auto-search on tab/option change

  const handleAdd = async (place) => {
    setAdding(prev => ({ ...prev, [place.place_id]: true }));
    const result = await onAddShelter(place);
    setAdding(prev => ({ ...prev, [place.place_id]: false }));
    if (result.success && !result.alreadyExists) {
      setSearchResults(prev => prev.filter(p => p.place_id !== place.place_id));
    }
  };

  const handleLogCall = async (shelterId, outcome, staffResponse, notes) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/mission/${caseId}/shelters/${shelterId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'call', outcome, staffResponse, notes }),
      });
      if (res.ok) {
        const data = await res.json();
        setShelters(prev => prev.map(s =>
          s.id === shelterId ? { ...s, status: 'CONTACTED', lastContactMethod: 'CALL' } : s
        ));
        setShowCallModal(false);
        setSelectedShelter(null);
        if (onPointsEarned) onPointsEarned(data.pointsEarned);
      }
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
        body: JSON.stringify({ action: 'email', ...emailData }),
      });
      if (res.ok) {
        const data = await res.json();
        setShelters(prev => prev.map(s =>
          s.id === shelterId ? { ...s, status: 'CONTACTED', lastContactMethod: 'EMAIL' } : s
        ));
        setShowEmailModal(false);
        setSelectedShelter(null);
        if (onPointsEarned) onPointsEarned(data.pointsEarned);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const notContacted = shelters.filter(s => s.status === 'NOT_CONTACTED');
  const contacted = shelters.filter(s => s.status !== 'NOT_CONTACTED');
  const existingPlaceIds = shelters.map(s => s.placeId);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-700 shadow-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Building2 className="text-orange-400" size={24} />
            <div>
              <h3 className="text-white font-semibold">Shelters & Vets</h3>
              <p className="text-xs text-slate-400">Call: 8 pts • Email: 15 pts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
            <X className="text-slate-400" size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'contacts'
                ? 'text-orange-400 border-b-2 border-orange-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            My List ({shelters.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'search'
                ? 'text-orange-400 border-b-2 border-orange-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Find Nearby
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'contacts' ? (
            <div className="p-3 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="text-orange-400 animate-spin" size={24} />
                </div>
              ) : shelters.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Building2 size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No shelters added yet</p>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="mt-2 text-orange-400 text-sm hover:underline"
                  >
                    Find nearby shelters →
                  </button>
                </div>
              ) : (
                <>
                  {notContacted.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-500 uppercase px-1">To Contact ({notContacted.length})</p>
                      {notContacted.map(shelter => (
                        <ShelterListItem
                          key={shelter.id}
                          shelter={shelter}
                          onCall={() => { setSelectedShelter(shelter); setShowCallModal(true); }}
                          onEmail={() => { setSelectedShelter(shelter); setShowEmailModal(true); }}
                        />
                      ))}
                    </div>
                  )}
                  {contacted.length > 0 && (
                    <div className="space-y-1.5 mt-3">
                      <p className="text-xs text-slate-500 uppercase px-1">Contacted ({contacted.length})</p>
                      {contacted.map(shelter => (
                        <ShelterListItem
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
          ) : (
            <div className="p-3 space-y-3">
              {/* Type filter */}
              <div className="flex gap-2">
                {[
                  { value: 'shelter', label: 'Shelters' },
                  { value: 'vet', label: 'Vets' },
                  { value: 'animal_control', label: 'Animal Ctrl' },
                ].map(btn => (
                  <button
                    key={btn.value}
                    onClick={() => setSearchType(btn.value)}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      searchType === btn.value
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Radius filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Radius:</span>
                {[10, 25, 50, 75].map(r => (
                  <button
                    key={r}
                    onClick={() => setSearchRadius(r)}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                      searchRadius === r
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}mi
                  </button>
                ))}
              </div>

              {/* Search button */}
              <button
                onClick={searchPlaces}
                disabled={searching}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:bg-orange-500/50 text-white font-medium rounded-lg transition-colors"
              >
                {searching ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    Search Now
                  </>
                )}
              </button>

              {/* Error display */}
              {searchError && (
                <div className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-xs">
                  {searchError}
                </div>
              )}

              {/* Results */}
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="text-orange-400 animate-spin" size={24} />
                </div>
              ) : searchResults.length === 0 && !searchError ? (
                <div className="text-center py-6 text-slate-400">
                  <Search size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Select options and click Search Now</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {searchResults.map(place => {
                    const isAdded = existingPlaceIds.includes(place.place_id);
                    return (
                      <div
                        key={place.place_id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border ${
                          isAdded ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/50 border-slate-700/50'
                        }`}
                      >
                        <div className="flex-1 min-w-0 mr-2">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm text-white font-medium truncate">{place.name}</p>
                            {place.distanceMiles && (
                              <span className="text-[10px] text-slate-500 bg-slate-700 px-1 rounded shrink-0">
                                {place.distanceMiles}mi
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate">{place.vicinity}</p>
                        </div>
                        <button
                          onClick={() => handleAdd(place)}
                          disabled={isAdded || adding[place.place_id]}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg shrink-0 ${
                            isAdded
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-orange-500 hover:bg-orange-400 text-white'
                          }`}
                        >
                          {adding[place.place_id] ? '...' : isAdded ? '✓' : 'Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700"
          >
            Done
          </button>
        </div>

        {/* Sub-modals */}
        {showCallModal && selectedShelter && (
          <CallLogModal
            shelter={selectedShelter}
            onClose={() => { setShowCallModal(false); setSelectedShelter(null); }}
            onSubmit={(outcome, staffResponse, notes) => handleLogCall(selectedShelter.id, outcome, staffResponse, notes)}
            submitting={submitting}
          />
        )}
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
    </div>
  );
}

// Compact shelter list item
function ShelterListItem({ shelter, onCall, onEmail, contacted }) {
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
      contacted ? 'bg-green-500/5 border-green-500/30' : 'bg-slate-800/50 border-slate-700/50'
    }`}>
      <div className="flex-1 min-w-0 mr-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-white font-medium truncate">{shelter.name}</span>
          {contacted && <CheckCircle size={12} className="text-green-400 shrink-0" />}
        </div>
        <p className="text-xs text-slate-400 truncate">{shelter.address}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {shelter.phone && (
          <button
            onClick={onCall}
            className="p-1.5 bg-slate-700 hover:bg-orange-500/30 rounded-lg transition-colors"
          >
            <Phone size={14} className="text-slate-400 hover:text-orange-400" />
          </button>
        )}
        <button
          onClick={onEmail}
          className="p-1.5 bg-slate-700 hover:bg-green-500/30 rounded-lg transition-colors"
        >
          <Mail size={14} className="text-slate-400 hover:text-green-400" />
        </button>
      </div>
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
    <div className="space-y-3 pb-20">
      {/* Scout Tip - Compact */}
      {currentTip && (
        <ScoutTipBanner
          tip={currentTip}
          onDismiss={handleDismissTip}
          onAction={handleTipAction}
          dismissing={dismissingTip === currentTip.id}
        />
      )}

      {/* =================================================================== */}
      {/* SECTION 1: Points & Quick Actions Header                            */}
      {/* =================================================================== */}
      <div className="bg-gradient-to-r from-slate-800/80 to-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Points Row */}
        <div className="p-3 flex items-center justify-between border-b border-slate-700/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Star className="text-flash-400" size={18} />
              <span className="text-xl font-bold text-flash-400">{points?.caseTotal || 0}</span>
              <span className="text-xs text-slate-400">pts</span>
            </div>
            <div className="text-xs text-slate-500">|</div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-green-400">{points?.today?.verified || 0}</span>
              <span className="text-xs text-slate-500">verified</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-yellow-400">{points?.today?.selfReported || 0}</span>
              <span className="text-xs text-slate-500">logged</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded-lg">
            <Trophy size={14} className="text-yellow-400" />
            <span className="text-sm font-bold text-white">#{leaderboard.find((e) => e.userId === userId)?.rank || '–'}</span>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="p-2 grid grid-cols-4 gap-2">
          <GPSSearchButton caseId={mission?.id} onPointsEarned={handleExternalPointsEarned} />
          <ShelterSearchButton caseId={mission?.id} mission={mission} onPointsEarned={handleExternalPointsEarned} />
          <FlyerGenerationCard caseId={mission?.id} />
          <VolunteerCheckInCard caseId={mission?.id} />
        </div>
      </div>

      {/* =================================================================== */}
      {/* SECTION 2: Task Categories                                          */}
      {/* =================================================================== */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-400 px-1">Actions & Tasks</h3>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-slate-800/30 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : (
          <>
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

            {/* Log Other Activity */}
            <button
              onClick={() => setShowOtherActivityModal(true)}
              className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">✏️</span>
                <span className="text-slate-300 font-medium">Log Other Activity</span>
              </div>
              <span className="text-xs text-slate-500">+3 pts</span>
            </button>
          </>
        )}
      </div>

      {/* =================================================================== */}
      {/* SECTION 3: Leaderboard (Collapsed by default)                       */}
      {/* =================================================================== */}
      <details className="group">
        <summary className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl cursor-pointer list-none">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-yellow-400" />
            <span className="text-white font-medium">Leaderboard</span>
            <span className="text-xs text-slate-500">({leaderboard.length} helpers)</span>
          </div>
          <ChevronDown size={18} className="text-slate-400 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="mt-2">
          <Leaderboard entries={leaderboard} userId={userId} loading={loading} />
        </div>
      </details>

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
