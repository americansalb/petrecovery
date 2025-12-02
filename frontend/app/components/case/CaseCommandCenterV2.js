'use client';

/**
 * Case Command Center V2 - Clean Tab-Based Design
 *
 * Beautiful, focused interface for managing lost pet cases
 * Inspired by Squad Hub V2 design language
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import TaskCompletionModal from '@/components/case/TaskCompletionModal';
import {
  MapPin,
  Clock,
  Users,
  Award,
  Heart,
  AlertCircle,
  Camera,
  Phone,
  Share2,
  CheckCircle2,
  Edit,
  TrendingUp,
  MessageSquare,
  Activity as ActivityIcon,
  Settings,
  ChevronLeft,
  Eye,
  Send,
  Navigation,
} from 'lucide-react';

// Lazy load map for better performance
const MapView = dynamic(() => import('./SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="animate-pulse text-slate-500">Loading map...</div>
    </div>
  )
});

export default function CaseCommandCenterV2({ caseId, caseNumber, onClose }) {
  const { data: session } = useSession();
  const router = useRouter();

  // Core state
  const [caseData, setCaseData] = useState(null);
  const [sightings, setSightings] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // GPS tracking state (shared between Team and Map tabs)
  const [gpsPath, setGpsPath] = useState([]);
  const [tasks, setTasks] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState('overview'); // overview | map | activity | team | manage
  const [showSightingForm, setShowSightingForm] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // Load GPS path and tasks from localStorage on mount
  useEffect(() => {
    if (!caseData?.id) return;
    const storageKey = `case_${caseData.id}_gps`;
    const tasksKey = `case_${caseData.id}_tasks`;

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setGpsPath(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load GPS path:', e);
      }
    }

    const savedTasks = localStorage.getItem(tasksKey);
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {
        console.error('Failed to load tasks:', e);
      }
    }
  }, [caseData?.id]);

  // Save GPS path to localStorage whenever it changes
  useEffect(() => {
    if (!caseData?.id || gpsPath.length === 0) return;
    const storageKey = `case_${caseData.id}_gps`;
    localStorage.setItem(storageKey, JSON.stringify(gpsPath));
  }, [gpsPath, caseData?.id]);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (!caseData?.id || tasks.length === 0) return;
    const tasksKey = `case_${caseData.id}_tasks`;
    localStorage.setItem(tasksKey, JSON.stringify(tasks));
  }, [tasks, caseData?.id]);

  // Fetch case data
  const fetchCase = useCallback(async () => {
    try {
      const identifier = caseId || caseNumber;
      const res = await fetch(`/api/cases/${identifier}`);
      if (!res.ok) throw new Error('Case not found');
      const data = await res.json();
      setCaseData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching case:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId, caseNumber]);

  // Fetch sightings
  const fetchSightings = useCallback(async () => {
    if (!caseData?.id) return;
    try {
      const res = await fetch(`/api/cases/${caseData.id}/sightings`);
      if (res.ok) {
        const data = await res.json();
        setSightings(data.sightings || []);
      }
    } catch (err) {
      console.error('Error fetching sightings:', err);
    }
  }, [caseData?.id]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  useEffect(() => {
    if (caseData?.id) {
      fetchSightings();
      const interval = setInterval(fetchSightings, 30000);
      return () => clearInterval(interval);
    }
  }, [caseData?.id, fetchSightings]);

  // Calculate time missing
  const getTimeMissing = () => {
    if (!caseData?.lastSeenAt) return null;
    const hours = Math.floor((Date.now() - new Date(caseData.lastSeenAt).getTime()) / 3600000);
    if (hours < 1) return 'Less than 1 hour';
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ${hours % 24}h`;
  };

  const timeMissing = getTimeMissing();
  const isUrgent = caseData?.lastSeenAt && Math.floor((Date.now() - new Date(caseData.lastSeenAt).getTime()) / 3600000) < 24;
  const isReunited = caseData?.status === 'RESOLVED' || caseData?.resolution === 'REUNITED';

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading case...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-900/30 border-2 border-red-500/50 rounded-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Case</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <button
            onClick={onClose || (() => window.history.back())}
            className="px-6 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: AlertCircle },
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'activity', label: 'Activity', icon: ActivityIcon },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'manage', label: 'Manage', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b-2 border-slate-800/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Back button + Pet name */}
            <div className="flex items-center gap-4">
              <button
                onClick={onClose || (() => window.history.back())}
                className="p-2 rounded-xl bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="flex items-center gap-3">
                {caseData?.petPhotoUrl ? (
                  <img
                    src={caseData.petPhotoUrl}
                    alt={caseData.petName}
                    className="w-12 h-12 rounded-xl object-cover border-2 border-cyan-500/30"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl border-2 border-slate-700">
                    {caseData?.petSpecies === 'DOG' ? '🐕' : caseData?.petSpecies === 'CAT' ? '🐈' : '🐾'}
                  </div>
                )}

                <div>
                  <h1 className="text-xl font-bold text-white">{caseData?.petName || 'Unknown'}</h1>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span>Case #{caseData?.caseNumber || caseData?.id?.slice(0, 8).toUpperCase()}</span>
                    {timeMissing && (
                      <>
                        <span>•</span>
                        <span className={isUrgent ? 'text-red-400 font-semibold' : 'text-amber-400'}>
                          ⏱ {timeMissing} missing
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Status badge */}
            {isReunited && (
              <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold flex items-center gap-2">
                <Heart size={18} />
                Reunited!
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            caseData={caseData}
            timeMissing={timeMissing}
            isUrgent={isUrgent}
            isReunited={isReunited}
            sightingsCount={sightings.length}
            onReportSighting={() => setShowSightingForm(true)}
          />
        )}

        {activeTab === 'map' && (
          <MapTab
            caseData={caseData}
            sightings={sightings}
            timeMissing={timeMissing}
            gpsPath={gpsPath}
            onReportSighting={() => setShowSightingForm(true)}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityTab
            sightings={sightings}
            timeline={timeline}
            chatMessages={chatMessages}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
          />
        )}

        {activeTab === 'team' && (
          <TeamTab
            team={team}
            caseData={caseData}
            tasks={tasks}
            setTasks={setTasks}
            gpsPath={gpsPath}
            setGpsPath={setGpsPath}
          />
        )}

        {activeTab === 'manage' && (
          <ManageTab
            caseData={caseData}
            onUpdate={fetchCase}
          />
        )}
      </div>

      {/* Sighting Form Modal */}
      {showSightingForm && (
        <SightingFormModal
          caseId={caseData?.id}
          onClose={() => setShowSightingForm(false)}
          onSuccess={() => {
            setShowSightingForm(false);
            fetchSightings();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB - Pet info, urgency, quick stats
// ============================================================================
function OverviewTab({ caseData, timeMissing, isUrgent, isReunited, sightingsCount, onReportSighting }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column - Pet Details */}
      <div className="lg:col-span-2 space-y-6">
        {/* Urgency Alert */}
        {isUrgent && !isReunited && (
          <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border-2 border-red-500/50 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/30 rounded-xl">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-400 mb-2">🚨 TIME-SENSITIVE CASE</h3>
                <p className="text-red-200">
                  {caseData?.petName} has been missing for {timeMissing}. The first 24 hours are critical.
                  Every minute counts - please help search!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pet Info Card */}
        <div className="bg-slate-900/50 border-2 border-cyan-500/30 rounded-2xl p-6 shadow-xl shadow-cyan-500/10">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Camera size={20} className="text-cyan-400" />
            Pet Information
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-slate-500 mb-1">Species</div>
              <div className="text-white font-semibold capitalize">{caseData?.petSpecies?.toLowerCase() || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">Breed</div>
              <div className="text-white font-semibold">{caseData?.petBreed || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">Color</div>
              <div className="text-white font-semibold capitalize">{caseData?.petColor || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">Size</div>
              <div className="text-white font-semibold capitalize">{caseData?.petSize || 'Unknown'}</div>
            </div>
          </div>

          {caseData?.petDescription && (
            <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="text-sm text-slate-500 mb-2">Description</div>
              <div className="text-white">{caseData.petDescription}</div>
            </div>
          )}
        </div>

        {/* Last Seen Location */}
        <div className="bg-slate-900/50 border-2 border-amber-500/30 rounded-2xl p-6 shadow-xl shadow-amber-500/10">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <MapPin size={20} className="text-amber-400" />
            Last Seen Location
          </h3>

          <div className="space-y-3">
            <div>
              <div className="text-sm text-slate-500 mb-1">Address</div>
              <div className="text-white font-semibold">{caseData?.lastSeenAddress || 'Location not provided'}</div>
            </div>

            {caseData?.lastSeenAt && (
              <div>
                <div className="text-sm text-slate-500 mb-1">Time</div>
                <div className="text-white font-semibold">
                  {new Date(caseData.lastSeenAt).toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right column - Stats & Actions */}
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-500/50 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-400">{sightingsCount}</div>
            <div className="text-sm text-amber-200 mt-1">Sightings</div>
          </div>

          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/50 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-cyan-400">0</div>
            <div className="text-sm text-cyan-200 mt-1">Helpers</div>
          </div>

          {caseData?.rewardAmount > 0 && (
            <div className="col-span-2 bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-2 border-emerald-500/50 rounded-2xl p-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <Award size={24} className="text-emerald-400" />
                <span className="text-3xl font-bold text-emerald-400">${caseData.rewardAmount}</span>
              </div>
              <div className="text-sm text-emerald-200 mt-1">Reward Offered</div>
            </div>
          )}
        </div>

        {/* Primary Actions */}
        {!isReunited && (
          <div className="space-y-3">
            <button
              onClick={onReportSighting}
              className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/50 hover:scale-105 transition-all flex items-center justify-center gap-2"
            >
              <Eye size={20} />
              Report Sighting
            </button>

            <button className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/50 hover:scale-105 transition-all flex items-center justify-center gap-2">
              <Users size={20} />
              Join Search Team
            </button>
          </div>
        )}

        {/* Contact Owner */}
        {caseData?.ownerPhone && (
          <a
            href={`tel:${caseData.ownerPhone}`}
            className="block w-full py-4 px-6 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-cyan-500 hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <Phone size={20} />
            Call Owner
          </a>
        )}

        {/* Share Case */}
        <button className="w-full py-4 px-6 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-cyan-500 hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
          <Share2 size={20} />
          Share This Case
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAP TAB - Full-screen search coordination
// ============================================================================
function MapTab({ caseData, sightings, timeMissing, gpsPath, onReportSighting }) {
  return (
    <div className="relative">
      {/* Map Container */}
      <div className="bg-slate-900 border-2 border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/20" style={{ height: 'calc(100vh - 250px)' }}>
        <MapView
          center={caseData?.lastSeenLatitude && caseData?.lastSeenLongitude
            ? [caseData.lastSeenLatitude, caseData.lastSeenLongitude]
            : [41.8781, -87.6298]}
          lastSeen={caseData?.lastSeenLatitude ? {
            lat: caseData.lastSeenLatitude,
            lng: caseData.lastSeenLongitude,
            address: caseData.lastSeenAddress
          } : null}
          sightings={sightings}
          petSpecies={caseData?.petSpecies}
          hoursElapsed={timeMissing ? parseInt(timeMissing) : 24}
          gpsPath={gpsPath}
          showControls
        />

        {/* Floating Report Button */}
        <div className="absolute bottom-6 right-6">
          <button
            onClick={onReportSighting}
            className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/50 hover:shadow-xl hover:shadow-amber-500/70 hover:scale-105 transition-all flex items-center gap-2"
          >
            <Eye size={20} />
            Report Sighting
          </button>
        </div>

        {/* Sightings Counter */}
        {sightings.length > 0 && (
          <div className="absolute top-6 right-6 bg-amber-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-xl font-bold shadow-lg">
            👁 {sightings.length} sighting{sightings.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ACTIVITY TAB - Timeline + Chat
// ============================================================================
function ActivityTab({ sightings, timeline, chatMessages, newMessage, setNewMessage }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Sightings Feed */}
      <div className="bg-slate-900/50 border-2 border-amber-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Eye size={20} className="text-amber-400" />
          Sightings ({sightings.length})
        </h3>

        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {sightings.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <div className="text-5xl mb-3">👀</div>
              <p>No sightings reported yet</p>
            </div>
          ) : (
            sightings.map((s, i) => (
              <div key={s.id || i} className="bg-slate-800/50 rounded-xl p-4 border border-amber-500/30 hover:border-amber-500/50 transition">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    👁
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">Sighting #{sightings.length - i}</span>
                      <span className="text-slate-500 text-xs">
                        {new Date(s.sightedAt || s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm mb-2">{s.description || 'Sighting reported'}</p>
                    <p className="text-slate-500 text-xs">{s.address}</p>
                    {s.confidence && (
                      <span className={`inline-block mt-2 text-xs px-2 py-1 rounded ${
                        s.confidence === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' :
                        s.confidence === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' :
                        'bg-slate-500/20 text-slate-400 border border-slate-500/50'
                      }`}>
                        {s.confidence} confidence
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Case Updates / Chat */}
      <div className="bg-slate-900/50 border-2 border-cyan-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <MessageSquare size={20} className="text-cyan-400" />
          Case Updates
        </h3>

        <div className="space-y-4 max-h-[500px] overflow-y-auto mb-4">
          {chatMessages.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <div className="text-5xl mb-3">💬</div>
              <p>No updates yet</p>
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className="bg-slate-800/50 rounded-xl p-3 border border-cyan-500/20">
                <div className="text-cyan-400 text-sm font-semibold mb-1">{msg.author}</div>
                <div className="text-white text-sm">{msg.content}</div>
                <div className="text-slate-600 text-xs mt-1">{msg.timestamp}</div>
              </div>
            ))
          )}
        </div>

        {/* Message Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Add an update..."
            className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
          />
          <button className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:scale-105 transition">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TEAM TAB - Helpers and coordination
// ============================================================================
function TeamTab({ team, caseData, tasks, setTasks, gpsPath, setGpsPath }) {
  const defaultTasks = [
    { id: 1, label: 'Alert neighbors & nearby residents', type: 'ALERT_NEIGHBORS', completed: false, completions: [] },
    { id: 2, label: 'Post flyers in the area', type: 'POST_FLYERS', completed: false, completions: [] },
    { id: 3, label: 'Call local shelters', type: 'CALL_SHELTERS', completed: false, completions: [] },
    { id: 4, label: 'Check your property thoroughly', type: 'SEARCH_PROPERTY', completed: false, completions: [] },
    { id: 5, label: 'Post on social media', type: 'POST_SOCIAL_MEDIA', completed: false, completions: [] },
    { id: 6, label: 'Visit shelters in person', type: 'VISIT_SHELTERS', completed: false, completions: [] },
  ];

  // Initialize tasks if empty
  useEffect(() => {
    if (tasks.length === 0) {
      setTasks(defaultTasks);
    }
  }, []);

  const [selectedTask, setSelectedTask] = useState(null);
  const [isGPSTracking, setIsGPSTracking] = useState(false);

  const handleTaskClick = (task) => {
    // Open the detailed completion modal
    setSelectedTask(task);
  };

  const handleTaskComplete = async (completionData) => {
    console.log('Task completed:', completionData);

    // TODO: Save to backend API
    // await fetch(`/api/cases/${caseData.id}/tasks`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(completionData),
    // });

    // Update local state
    setTasks(prev => prev.map(t =>
      t.id === selectedTask.id
        ? {
            ...t,
            completed: true,
            completions: [...t.completions, completionData]
          }
        : t
    ));
  };

  const startGPSTracking = () => {
    if (!('geolocation' in navigator)) {
      alert('GPS not available on this device');
      return;
    }

    setIsGPSTracking(true);
    setGpsPath([]);

    // Track position every 10 seconds
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: Date.now(),
          accuracy: position.coords.accuracy
        };
        setGpsPath(prev => [...prev, point]);
      },
      (error) => {
        console.error('GPS error:', error);
        setIsGPSTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    // Store watchId for cleanup
    window._gpsWatchId = watchId;
  };

  const stopGPSTracking = async () => {
    if (window._gpsWatchId) {
      navigator.geolocation.clearWatch(window._gpsWatchId);
      window._gpsWatchId = null;
    }

    setIsGPSTracking(false);

    if (gpsPath.length > 0) {
      // Save the search area
      console.log('GPS path recorded:', gpsPath);

      // TODO: Save to backend
      // await fetch(`/api/cases/${caseData.id}/search-areas`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     method: 'GPS_AUTO',
      //     path: gpsPath,
      //   }),
      // });

      alert(`Recorded ${gpsPath.length} GPS points over your search area!`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Search Area Tracking */}
      <div className="bg-slate-900/50 border-2 border-purple-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Navigation size={20} className="text-purple-400" />
          GPS Search Tracking
        </h3>

        {!isGPSTracking ? (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              Track your search area automatically with GPS. Turn it on when you start searching.
            </p>
            <button
              onClick={startGPSTracking}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/50 hover:scale-105 transition flex items-center justify-center gap-2"
            >
              <Navigation size={20} />
              Start GPS Tracking
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-purple-400 font-bold mb-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
                Recording GPS Path
              </div>
              <div className="text-slate-300 text-sm">
                {gpsPath.length} points recorded
              </div>
            </div>

            <button
              onClick={stopGPSTracking}
              className="w-full py-4 bg-red-500/20 border-2 border-red-500/50 text-red-400 font-bold rounded-xl hover:bg-red-500/30 transition flex items-center justify-center gap-2"
            >
              Stop & Save Search Area
            </button>
          </div>
        )}
      </div>

      {/* Active Helpers */}
      <div className="bg-slate-900/50 border-2 border-cyan-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Users size={20} className="text-cyan-400" />
          Search Team (0)
        </h3>

        <div className="text-center py-12 text-slate-500">
          <div className="text-5xl mb-3">👥</div>
          <p className="mb-4">No team members yet</p>
          <button className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:scale-105 transition">
            + Invite Volunteers
          </button>
        </div>
      </div>

      {/* Search Checklist */}
      <div className="bg-slate-900/50 border-2 border-emerald-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <CheckCircle2 size={20} className="text-emerald-400" />
          Search Checklist
        </h3>

        <div className="space-y-2">
          {tasks.map(task => (
            <button
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className={`w-full text-left p-3 rounded-xl transition flex items-center gap-3 ${
                task.completed
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-slate-800/50 border border-slate-700 hover:bg-slate-800'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                task.completed
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-700 border-2 border-slate-600'
              }`}>
                {task.completed && '✓'}
              </div>
              <span className={`flex-1 text-sm ${task.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                {task.label}
              </span>
              {task.completions.length > 0 && (
                <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded">
                  {task.completions.length}×
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Progress</span>
            <span className="text-white font-bold">{tasks.filter(t => t.completed).length} / {tasks.length}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-300"
              style={{ width: `${(tasks.filter(t => t.completed).length / tasks.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Task Completion Modal */}
      {selectedTask && (
        <TaskCompletionModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onComplete={handleTaskComplete}
        />
      )}
    </div>
  );
}

// ============================================================================
// MANAGE TAB - Admin controls
// ============================================================================
function ManageTab({ caseData, onUpdate }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Status Management */}
      <div className="bg-slate-900/50 border-2 border-purple-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-purple-400" />
          Case Status
        </h3>

        <div className="space-y-3">
          <button className="w-full py-3 px-4 bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400 font-bold rounded-xl hover:bg-emerald-500/30 transition flex items-center justify-center gap-2">
            <Heart size={18} />
            Mark as Reunited
          </button>

          <button className="w-full py-3 px-4 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-cyan-500 transition flex items-center justify-center gap-2">
            <Edit size={18} />
            Update Case Details
          </button>

          <button className="w-full py-3 px-4 bg-amber-500/20 border-2 border-amber-500/50 text-amber-400 font-semibold rounded-xl hover:bg-amber-500/30 transition flex items-center justify-center gap-2">
            <AlertCircle size={18} />
            Change Urgency Level
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-900/50 border-2 border-cyan-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Settings size={20} className="text-cyan-400" />
          Quick Actions
        </h3>

        <div className="space-y-3">
          <button className="w-full py-3 px-4 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-cyan-500 transition flex items-center justify-center gap-2">
            <Share2 size={18} />
            Generate Flyer
          </button>

          <button className="w-full py-3 px-4 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-cyan-500 transition flex items-center justify-center gap-2">
            <Camera size={18} />
            Add Photos
          </button>

          <button className="w-full py-3 px-4 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-cyan-500 transition flex items-center justify-center gap-2">
            <Phone size={18} />
            Contact Information
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SIGHTING FORM MODAL
// ============================================================================
function SightingFormModal({ caseId, onClose, onSuccess }) {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [confidence, setConfidence] = useState('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGettingLocation(false);
          // Reverse geocode
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
            .then(r => r.json())
            .then(data => setAddress(data.display_name || ''))
            .catch(() => {});
        },
        () => setGettingLocation(false),
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSubmit = async () => {
    if (!location) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/cases/${caseId}/sightings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location.lat,
          longitude: location.lng,
          address,
          description,
          confidence
        })
      });

      if (res.ok) {
        onSuccess();
      } else {
        alert('Failed to submit sighting. Please try again.');
      }
    } catch (err) {
      alert('Error submitting sighting.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-cyan-500/30 rounded-2xl w-full max-w-lg shadow-2xl shadow-cyan-500/20"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b-2 border-slate-700/60">
          <h2 className="text-2xl font-bold text-white">Report Sighting</h2>
          <p className="text-slate-400 text-sm mt-1">Help us locate this pet by reporting where you saw them</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Location */}
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">Location *</label>
            {location ? (
              <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl p-4">
                <div className="text-emerald-400 font-semibold flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  Location captured
                </div>
                <div className="text-slate-400 text-sm mt-1">{address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</div>
              </div>
            ) : (
              <button
                onClick={getCurrentLocation}
                disabled={gettingLocation}
                className="w-full py-4 bg-cyan-500/20 border-2 border-cyan-500/50 text-cyan-400 font-bold rounded-xl hover:bg-cyan-500/30 transition flex items-center justify-center gap-2"
              >
                <MapPin size={20} />
                {gettingLocation ? 'Getting location...' : 'Use My Current Location'}
              </button>
            )}
          </div>

          {/* Confidence */}
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">How sure are you?</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'HIGH', label: "It's them!", color: 'emerald' },
                { value: 'MEDIUM', label: 'Looks like', color: 'amber' },
                { value: 'LOW', label: 'Maybe', color: 'slate' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setConfidence(opt.value)}
                  className={`py-3 px-2 rounded-xl text-sm font-bold transition ${
                    confidence === opt.value
                      ? opt.color === 'emerald' ? 'bg-emerald-500/30 text-emerald-400 border-2 border-emerald-500/50'
                        : opt.color === 'amber' ? 'bg-amber-500/30 text-amber-400 border-2 border-amber-500/50'
                        : 'bg-slate-700 text-slate-300 border-2 border-slate-600'
                      : 'bg-slate-800 text-slate-500 border-2 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">What did you see?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Direction they were heading, behavior, any other details..."
              className="w-full bg-slate-800 text-white rounded-xl p-4 border-2 border-slate-700 focus:border-cyan-500 focus:outline-none resize-none"
              style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              rows={4}
            />
          </div>
        </div>

        <div className="p-6 border-t-2 border-slate-700/60 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!location || submitting}
            className={`flex-1 py-3 font-bold rounded-xl transition ${
              location && !submitting
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/50'
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
