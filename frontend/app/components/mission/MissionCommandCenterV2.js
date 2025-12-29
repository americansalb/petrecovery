'use client';

/**
 * Mission Command Center V2 - Clean Tab-Based Design
 *
 * Beautiful, focused interface for managing lost pet cases
 * Inspired by Squad Hub V2 design language
 *
 * Version: 2.1.0 - Build 2025-12-03
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import TaskCompletionModal from '@/components/case/TaskCompletionModal';
import WaiverModal from '@/components/WaiverModal';
import { normalizePhotoUrl, fetchWithRetry, formatErrorMessage, isOnline } from '@/app/lib/utils';
import { PageLoading } from '@/components/LoadingSkeleton';
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
  ChevronDown,
  ChevronUp,
  Eye,
  Send,
  Navigation,
  RefreshCw,
  Sparkles,
  Shield,
} from 'lucide-react';
import { SARAMA_AVATAR } from '@/lib/brandAssets';

// Lazy load map for better performance
const MapView = dynamic(() => import('./SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="animate-pulse text-slate-500">Loading map...</div>
    </div>
  )
});

export default function MissionCommandCenterV2({ missionId, missionNumber, onClose, hideHeader = false, initialData = null }) {
  const { data: session } = useSession();
  const router = useRouter();

  // Core state
  const [missionData, setMissionData] = useState(initialData);
  const [sightings, setSightings] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // GPS tracking state (shared between Team and Map tabs)
  const [gpsPath, setGpsPath] = useState([]);
  const [tasks, setTasks] = useState([]);

  // UI state - All useState hooks must be at component top level
  const [activeTab, setActiveTab] = useState('overview'); // overview | map | activity | team | manage
  const [showSightingForm, setShowSightingForm] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [selectedLocationHighlight, setSelectedLocationHighlight] = useState(null); // For highlighting locations on map
  const [expandedCategories, setExpandedCategories] = useState(['immediate']); // Start with immediate expanded
  const [selectedTask, setSelectedTask] = useState(null);
  const [isGPSTracking, setIsGPSTracking] = useState(false);
  const [showCustomActionModal, setShowCustomActionModal] = useState(false);
  const [showWaiverModal, setShowWaiverModal] = useState(false);

  // Load GPS path and tasks from localStorage on mount
  useEffect(() => {
    if (!missionData?.id) return;
    const storageKey = `case_${missionData.id}_gps`;
    const tasksKey = `case_${missionData.id}_tasks`;

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
  }, [missionData?.id]);

  // Save GPS path to localStorage whenever it changes
  useEffect(() => {
    if (!missionData?.id || gpsPath.length === 0) return;
    const storageKey = `case_${missionData.id}_gps`;
    localStorage.setItem(storageKey, JSON.stringify(gpsPath));
  }, [gpsPath, missionData?.id]);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (!missionData?.id || tasks.length === 0) return;
    const tasksKey = `case_${missionData.id}_tasks`;
    localStorage.setItem(tasksKey, JSON.stringify(tasks));
  }, [tasks, missionData?.id]);

  // Fetch case data with retry logic
  const fetchMission = useCallback(async () => {
    try {
      const identifier = missionId || missionNumber;

      // Debug logging to track case loading
      console.log('[MissionCommandCenter] fetchMission called with:', { missionId, missionNumber, identifier });

      // Check if online before making request
      if (!isOnline()) {
        setError('You are offline. Please check your internet connection.');
        setLoading(false);
        return;
      }

      const apiUrl = `/api/missions/${identifier}`;
      console.log('[MissionCommandCenter] Fetching from:', apiUrl);
      const res = await fetchWithRetry(apiUrl);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Mission not found');
        } else if (res.status === 403) {
          // Check if it's a waiver error
          let errorData = null;
          try {
            errorData = await res.json();
            console.log('[MissionCommandCenter] 403 error data:', errorData);
          } catch (jsonError) {
            console.error('[MissionCommandCenter] Failed to parse 403 response as JSON:', jsonError);
          }

          // Show waiver modal for WAIVER_NOT_ACCEPTED or if we can't parse the error (assume waiver issue)
          if (!errorData || errorData.code === 'WAIVER_NOT_ACCEPTED' || errorData.message?.includes('waiver')) {
            console.log('[MissionCommandCenter] Waiver not accepted - showing modal');
            setLoading(false);
            setShowWaiverModal(true);
            return;
          }

          // Some other permission issue
          throw new Error(errorData.message || 'You do not have permission to view this case');
        } else {
          throw new Error(`Failed to load case (${res.status})`);
        }
      }

      const data = await res.json();
      setMissionData(data);

      // Extract team members from assignments
      if (data.assignments && data.assignments.length > 0) {
        const allParticipants = data.assignments.flatMap(assignment =>
          assignment.participants?.map(p => ({
            id: p.id,
            userId: p.userId,
            name: `${p.user.firstName} ${p.user.lastName || ''}`.trim(),
            firstName: p.user.firstName,
            lastName: p.user.lastName,
            isActive: p.isActive !== false, // Default to true if not specified
          })) || []
        );

        // Remove duplicates by userId
        const uniqueParticipants = Array.from(
          new Map(allParticipants.map(p => [p.userId, p])).values()
        );

        setTeam(uniqueParticipants);
      } else {
        setTeam([]);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching case:', err);
      setError(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [missionId, missionNumber]);

  // Fetch sightings
  const fetchSightings = useCallback(async () => {
    if (!missionData?.id) return;
    try {
      const res = await fetch(`/api/missions/${missionData.id}/sightings`);
      if (res.ok) {
        const data = await res.json();
        setSightings(data.sightings || []);
      }
    } catch (err) {
      console.error('Error fetching sightings:', err);
    }
  }, [missionData?.id]);

  useEffect(() => {
    // Skip fetching if initialData is provided (Mission Control mode)
    if (!initialData) {
      fetchMission();
    } else {
      setLoading(false);
    }
  }, [fetchMission, initialData]);

  useEffect(() => {
    if (missionData?.id) {
      fetchSightings();
      const interval = setInterval(fetchSightings, 30000);
      return () => clearInterval(interval);
    }
  }, [missionData?.id, fetchSightings]);

  // Calculate time missing
  const getTimeMissing = () => {
    if (!missionData?.lastSeenAt) return null;
    const hours = Math.floor((Date.now() - new Date(missionData.lastSeenAt).getTime()) / 3600000);
    if (hours < 1) return 'Less than 1 hour';
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ${hours % 24}h`;
  };

  const timeMissing = getTimeMissing();
  const isUrgent = missionData?.lastSeenAt && Math.floor((Date.now() - new Date(missionData.lastSeenAt).getTime()) / 3600000) < 24;
  const isReunited = missionData?.status === 'RESOLVED' || missionData?.resolution === 'REUNITED';

  // Loading state
  if (loading) {
    return <PageLoading message="Loading case details..." />;
  }

  // Waiting for waiver acceptance
  if (showWaiverModal && !missionData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <div className="inline-block p-4 bg-flash-500/20 rounded-full border-2 border-flash-500/50">
              <Shield size={48} className="text-flash-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            Liability Waiver Required
          </h2>
          <p className="text-slate-400 mb-6">
            Please accept the liability waiver to view case details and join the search effort.
          </p>
        </div>

        {/* Waiver Modal */}
        <WaiverModal
          isOpen={showWaiverModal}
          onClose={() => {
            setShowWaiverModal(false);
            window.history.back();
          }}
          onAccepted={() => {
            setShowWaiverModal(false);
            setLoading(true);
            fetchMission();
          }}
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border-2 border-red-500/30 rounded-2xl p-8 shadow-2xl">
          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-500/20 rounded-full border-2 border-red-500/50">
              <AlertCircle size={48} className="text-red-400" />
            </div>
          </div>

          {/* Error Message */}
          <h2 className="text-2xl font-bold text-white text-center mb-3">
            Unable to Load Mission
          </h2>
          <p className="text-red-300 text-center mb-8">
            {error}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchMission();
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-flash-500 to-blue-500 text-white font-bold rounded-xl hover:scale-105 transition shadow-lg shadow-flash-500/30"
            >
              <RefreshCw size={20} />
              Try Again
            </button>
            <button
              onClick={onClose || (() => window.history.back())}
              className="px-6 py-3 bg-slate-800/80 text-slate-300 font-bold rounded-xl hover:bg-slate-800 hover:text-white transition border-2 border-slate-700"
            >
              Go Back
            </button>
          </div>
        </div>

        {/* Waiver Modal - Render even in error state */}
        {showWaiverModal && (
          <WaiverModal
            isOpen={showWaiverModal}
            onClose={() => setShowWaiverModal(false)}
            onAccepted={() => {
              setShowWaiverModal(false);
              setError(null);
              setLoading(true);
              fetchMission();
            }}
          />
        )}
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header - conditional rendering based on hideHeader */}
      {!hideHeader && (
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
                {missionData?.petPhotoUrl ? (
                  <img
                    src={normalizePhotoUrl(missionData.petPhotoUrl)}
                    alt={missionData.petName}
                    className="w-12 h-12 rounded-xl object-cover border-2 border-flash-500/30"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl border-2 border-slate-700">
                    {missionData?.petSpecies === 'DOG' ? '🐕' : missionData?.petSpecies === 'CAT' ? '🐈' : '🐾'}
                  </div>
                )}

                <div>
                  <h1 className="text-xl font-bold text-white">{missionData?.petName || 'Unknown'}</h1>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span>Case #{missionData?.missionNumber || missionData?.id?.slice(0, 8).toUpperCase()}</span>
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
        </div>
      </div>
      )}

      {/* Tabs - ALWAYS VISIBLE */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b-2 border-slate-800/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-flash-500/20 text-flash-400 border-2 border-flash-500/50 shadow-lg shadow-flash-500/20'
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
            missionData={missionData}
            timeMissing={timeMissing}
            isUrgent={isUrgent}
            isReunited={isReunited}
            sightingsCount={sightings.length}
            onReportSighting={() => setShowSightingForm(true)}
          />
        )}

        {activeTab === 'map' && (
          <MapTab
            missionData={missionData}
            sightings={sightings}
            timeMissing={timeMissing}
            gpsPath={gpsPath}
            highlightLocation={selectedLocationHighlight}
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
            tasks={tasks}
            gpsPath={gpsPath}
            onLocationClick={(location) => {
              setSelectedLocationHighlight(location);
              setActiveTab('map');
            }}
          />
        )}

        {activeTab === 'team' && (
          <TeamTab
            team={team}
            missionData={missionData}
            tasks={tasks}
            setTasks={setTasks}
            gpsPath={gpsPath}
            setGpsPath={setGpsPath}
            isGPSTracking={isGPSTracking}
            setIsGPSTracking={setIsGPSTracking}
            expandedCategories={expandedCategories}
            setExpandedCategories={setExpandedCategories}
            selectedTask={selectedTask}
            setSelectedTask={setSelectedTask}
            showCustomActionModal={showCustomActionModal}
            setShowCustomActionModal={setShowCustomActionModal}
            showWaiverModal={showWaiverModal}
            setShowWaiverModal={setShowWaiverModal}
            session={session}
          />
        )}

        {activeTab === 'manage' && (
          <ManageTab
            missionData={missionData}
            onUpdate={fetchMission}
          />
        )}
      </div>

      {/* Sighting Form Modal */}
      {showSightingForm && (
        <SightingFormModal
          missionId={missionData?.id}
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
function OverviewTab({ missionData, timeMissing, isUrgent, isReunited, sightingsCount, onReportSighting }) {
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
                <h3 className="text-xl font-bold text-red-400 mb-2">⏰ Act Fast - Every Moment Matters</h3>
                <p className="text-red-200">
                  {missionData?.petName} has been missing for {timeMissing}. The first 24 hours are when pets are most likely to be found nearby.
                  Let's bring them home! 💪
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pet Info Card */}
        <div className="bg-slate-900/50 border-2 border-flash-500/30 rounded-2xl p-6 shadow-xl shadow-flash-500/10">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Camera size={20} className="text-flash-400" />
            Pet Information
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-slate-500 mb-1">Species</div>
              <div className="text-white font-semibold capitalize">{missionData?.petSpecies?.toLowerCase() || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">Breed</div>
              <div className="text-white font-semibold">{missionData?.petBreed || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">Color</div>
              <div className="text-white font-semibold capitalize">{missionData?.petColor || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">Size</div>
              <div className="text-white font-semibold capitalize">{missionData?.petSize || 'Unknown'}</div>
            </div>
          </div>

          {missionData?.petDescription && (
            <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <div className="text-sm text-slate-500 mb-2">Description</div>
              <div className="text-white">{missionData.petDescription}</div>
            </div>
          )}
        </div>

        {/* Last Seen Location */}
        <div className="bg-slate-900/50 border-2 border-amber-500/30 rounded-2xl p-6 shadow-xl shadow-amber-500/10">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <MapPin size={20} className="text-amber-400" />
            Where They Ran Away From
          </h3>

          <div className="space-y-3">
            <div>
              <div className="text-sm text-slate-500 mb-1">Address</div>
              <div className="text-white font-semibold">{missionData?.lastSeenAddress || 'Location not provided'}</div>
            </div>

            {missionData?.lastSeenAt && (
              <div>
                <div className="text-sm text-slate-500 mb-1">Time</div>
                <div className="text-white font-semibold">
                  {new Date(missionData.lastSeenAt).toLocaleString('en-US', {
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

          <div className="bg-gradient-to-br from-flash-500/20 to-blue-500/20 border-2 border-flash-500/50 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-flash-400">0</div>
            <div className="text-sm text-flash-200 mt-1">Helpers</div>
          </div>

          {missionData?.rewardAmount > 0 && (
            <div className="col-span-2 bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-2 border-emerald-500/50 rounded-2xl p-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <Award size={24} className="text-emerald-400" />
                <span className="text-3xl font-bold text-emerald-400">${missionData.rewardAmount}</span>
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

            <button className="w-full py-4 px-6 bg-gradient-to-r from-flash-500 to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-flash-500/30 hover:shadow-xl hover:shadow-flash-500/50 hover:scale-105 transition-all flex items-center justify-center gap-2">
              <Users size={20} />
              Join Search Team
            </button>
          </div>
        )}

        {/* Contact Owner */}
        {missionData?.ownerPhone && (
          <a
            href={`tel:${missionData.ownerPhone}`}
            className="block w-full py-4 px-6 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500 hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <Phone size={20} />
            Call Owner
          </a>
        )}

        {/* Share Case */}
        <button className="w-full py-4 px-6 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500 hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
          <Share2 size={20} />
          Share This Mission
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAP TAB - Full-screen search coordination
// ============================================================================
function MapTab({ missionData, sightings, timeMissing, gpsPath, highlightLocation, onReportSighting }) {
  return (
    <div className="relative">
      {/* Map Container */}
      <div className="bg-slate-900 border-2 border-flash-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-flash-500/20" style={{ height: 'calc(100vh - 250px)' }}>
        <MapView
          center={missionData?.lastSeenLatitude && missionData?.lastSeenLongitude
            ? [missionData.lastSeenLatitude, missionData.lastSeenLongitude]
            : [41.8781, -87.6298]}
          lastSeen={missionData?.lastSeenLatitude ? {
            lat: missionData.lastSeenLatitude,
            lng: missionData.lastSeenLongitude,
            address: missionData.lastSeenAddress
          } : null}
          sightings={sightings}
          petSpecies={missionData?.petSpecies}
          hoursElapsed={timeMissing ? parseInt(timeMissing) : 24}
          gpsPath={gpsPath}
          highlightLocation={highlightLocation}
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
// ACTIVITY TAB - Unified Timeline
// ============================================================================
function ActivityTab({ sightings, tasks, gpsPath, onLocationClick }) {
  // Build unified timeline from all activities
  const buildTimeline = () => {
    const items = [];

    // Add sightings
    sightings.forEach(s => {
      items.push({
        type: 'sighting',
        timestamp: new Date(s.sightedAt || s.createdAt).getTime(),
        data: s
      });
    });

    // Add task completions
    tasks.forEach(task => {
      task.completions?.forEach(completion => {
        items.push({
          type: 'task',
          timestamp: new Date(completion.completedAt).getTime(),
          data: { ...completion, task }
        });
      });
    });

    // Add GPS search if exists
    if (gpsPath && gpsPath.length > 0) {
      const startTime = gpsPath[0].timestamp;
      const endTime = gpsPath[gpsPath.length - 1].timestamp;
      items.push({
        type: 'gps_search',
        timestamp: startTime,
        data: { startTime, endTime, pointCount: gpsPath.length, path: gpsPath }
      });
    }

    // Sort by timestamp (newest first)
    return items.sort((a, b) => b.timestamp - a.timestamp);
  };

  const timelineItems = buildTimeline();

  const renderTimelineItem = (item, index) => {
    const timestamp = new Date(item.timestamp);

    // Helper to extract location from sighting
    const getSightingLocation = (s) => {
      if (s.latitude && s.longitude) {
        return { lat: s.latitude, lng: s.longitude, label: 'Sighting', description: s.address };
      }
      return null;
    };

    // Helper to extract first location from task
    const getTaskLocation = (details) => {
      // Check multi-location GPS fields
      if (details.flyerLocations?.length > 0) {
        const loc = details.flyerLocations[0];
        return { lat: loc.lat, lng: loc.lng, label: 'Flyer Location', description: loc.description };
      }
      if (details.areasGPS?.length > 0) {
        const loc = details.areasGPS[0];
        return { lat: loc.lat, lng: loc.lng, label: 'Search Area', description: loc.description };
      }
      if (details.searchGPS?.length > 0) {
        const loc = details.searchGPS[0];
        return { lat: loc.lat, lng: loc.lng, label: 'Search Point', description: loc.description };
      }
      // Check single-location GPS fields
      if (details.stationGPS) {
        return { lat: details.stationGPS.lat, lng: details.stationGPS.lng, label: 'Station', description: details.stationLocation };
      }
      if (details.trapGPS) {
        return { lat: details.trapGPS.lat, lng: details.trapGPS.lng, label: 'Trap', description: details.trapLocation };
      }
      if (details.cameraGPS) {
        return { lat: details.cameraGPS.lat, lng: details.cameraGPS.lng, label: 'Camera', description: details.cameraLocation };
      }
      return null;
    };

    switch (item.type) {
      case 'sighting':
        const s = item.data;
        const sightingLocation = getSightingLocation(s);
        return (
          <div
            key={`sighting-${index}`}
            onClick={() => sightingLocation && onLocationClick(sightingLocation)}
            className={`bg-slate-800/50 rounded-xl p-4 border-2 border-amber-500/30 hover:border-amber-500/50 transition ${sightingLocation ? 'cursor-pointer hover:bg-slate-800/70' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 text-xl">
                👁
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold">Sighting Reported</span>
                    {sightingLocation && (
                      <span className="text-xs text-flash-400">Click to view on map →</span>
                    )}
                  </div>
                  <span className="text-slate-500 text-xs">
                    {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-300 text-sm mb-2">{s.description || 'Sighting reported'}</p>
                <p className="text-slate-500 text-xs mb-2">📍 {s.address}</p>
                {s.confidence && (
                  <span className={`inline-block text-xs px-2 py-1 rounded font-semibold ${
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
        );

      case 'task':
        const { task, taskType, details, completedBy } = item.data;
        const taskLocation = getTaskLocation(details);
        return (
          <div
            key={`task-${index}`}
            onClick={() => taskLocation && onLocationClick(taskLocation)}
            className={`bg-slate-800/50 rounded-xl p-4 border-2 border-emerald-500/30 hover:border-emerald-500/50 transition ${taskLocation ? 'cursor-pointer hover:bg-slate-800/70' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 text-xl">
                ✓
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">{task.label}</span>
                      {taskLocation && (
                        <span className="text-xs text-flash-400">Click to view on map →</span>
                      )}
                    </div>
                    {completedBy && (
                      <p className="text-slate-400 text-xs mt-1">
                        👤 {completedBy.name || completedBy.email || 'Team member'}
                      </p>
                    )}
                  </div>
                  <span className="text-slate-500 text-xs">
                    {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Render task-specific details */}
                {taskType === 'CALL_SHELTERS' || taskType === 'VISIT_SHELTERS' ? (
                  <div className="space-y-1 text-sm">
                    {details.shelterName && <p className="text-white">🏥 <strong>{details.shelterName}</strong></p>}
                    {details.shelterResult && (
                      <p className="text-slate-300">
                        {details.shelterResult === 'POSSIBLE_MATCH' ? '🎉 They might have them!' :
                         details.shelterResult === 'VISITED' ? '✓ Visited in person - no match yet' :
                         details.shelterResult === 'CALLED' ? '📞 Called - no match yet' :
                         details.shelterResult === 'LEFT_INFO' ? '📝 Left contact info' : details.shelterResult}
                      </p>
                    )}
                    {details.shelterContact && <p className="text-slate-400 text-xs">Contact: {details.shelterContact}</p>}
                    {details.notes && <p className="text-slate-400 text-xs mt-2">{details.notes}</p>}
                  </div>
                ) : taskType === 'POST_FLYERS' ? (
                  <div className="space-y-1 text-sm">
                    {details.flyerLocations?.length > 0 && (
                      <div>
                        <p className="text-white">📍 Posted at {details.flyerLocations.length} location{details.flyerLocations.length !== 1 ? 's' : ''}:</p>
                        {details.flyerLocations.map((loc, i) => (
                          <p key={i} className="text-slate-300 text-xs ml-4">• {loc.description || 'Flyer posted'}</p>
                        ))}
                      </div>
                    )}
                    {details.notes && <p className="text-slate-400 text-xs mt-2">{details.notes}</p>}
                  </div>
                ) : taskType === 'POST_SOCIAL_MEDIA' ? (
                  <div className="space-y-1 text-sm">
                    {details.platform && <p className="text-white">📱 Posted on <strong>{details.platform}</strong></p>}
                    {details.postUrl && (
                      <a href={details.postUrl} target="_blank" rel="noopener noreferrer" className="text-flash-400 hover:text-flash-300 text-xs underline block">
                        View post →
                      </a>
                    )}
                    {details.notes && <p className="text-slate-400 text-xs mt-2">{details.notes}</p>}
                  </div>
                ) : taskType === 'SEARCH_PROPERTY' ? (
                  <div className="space-y-1 text-sm">
                    {details.areasChecked && <p className="text-slate-300">🔍 {details.areasChecked}</p>}
                    {details.notes && <p className="text-slate-400 text-xs mt-2">{details.notes}</p>}
                  </div>
                ) : (
                  details.notes && <p className="text-slate-300 text-sm">{details.notes}</p>
                )}
              </div>
            </div>
          </div>
        );

      case 'gps_search':
        const { startTime, endTime, pointCount } = item.data;
        const duration = Math.round((endTime - startTime) / 60000); // minutes
        return (
          <div key={`gps-${index}`} className="bg-slate-800/50 rounded-xl p-4 border-2 border-purple-500/30 hover:border-purple-500/50 transition">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 text-xl">
                📍
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-400 font-bold">Area Searched (GPS Tracked)</span>
                  <span className="text-slate-500 text-xs">
                    {new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-300 text-sm">
                  Searched for {duration} minute{duration !== 1 ? 's' : ''} • {pointCount} GPS points recorded
                </p>
                <p className="text-slate-400 text-xs mt-1">View the purple path on the Map tab to see where they searched</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-900/50 border-2 border-flash-500/30 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <ActivityIcon size={24} className="text-flash-400" />
          Search Activity Timeline
        </h3>

        <div className="space-y-3 max-h-[800px] overflow-y-auto">
          {timelineItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <img
                src="https://petrescue.b-cdn.net/Logos%20(1).svg"
                alt="Sarama"
                className="h-40 w-auto mx-auto mb-6 drop-shadow-xl"
              />
              <p className="text-white text-lg font-semibold mb-2">Activity Timeline</p>
              <p className="text-slate-400 text-sm">
                As people complete tasks, report sightings, and search areas,<br />
                everything will show up here with all the details
              </p>
            </div>
          ) : (
            timelineItems.map((item, index) => renderTimelineItem(item, index))
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TEAM TAB - Helpers and coordination
// ============================================================================
function TeamTab({ team, missionData, tasks, setTasks, gpsPath, setGpsPath, isGPSTracking, setIsGPSTracking, expandedCategories, setExpandedCategories, selectedTask, setSelectedTask, showCustomActionModal, setShowCustomActionModal, showWaiverModal, setShowWaiverModal, session }) {
  const defaultTasks = [
    // Immediate critical actions
    { id: 1, label: 'Search property & immediate area thoroughly', type: 'SEARCH_PROPERTY', completed: false, completions: [] },
    { id: 2, label: 'Alert neighbors & nearby residents', type: 'ALERT_NEIGHBORS', completed: false, completions: [] },
    { id: 3, label: 'Post flyers in the area', type: 'POST_FLYERS', completed: false, completions: [] },
    { id: 4, label: 'Set up food/water/scent station', type: 'SETUP_STATION', completed: false, completions: [] },

    // Shelters & Animal Control (critical)
    { id: 5, label: 'Call local animal shelters', type: 'CALL_SHELTERS', completed: false, completions: [] },
    { id: 6, label: 'Visit local shelters in person', type: 'VISIT_SHELTERS', completed: false, completions: [] },
    { id: 7, label: 'Contact animal control', type: 'CONTACT_ANIMAL_CONTROL', completed: false, completions: [] },

    // Veterinary & Medical
    { id: 8, label: 'Call local veterinary offices', type: 'CALL_VETS', completed: false, completions: [] },
    { id: 9, label: 'Contact microchip company', type: 'CONTACT_MICROCHIP', completed: false, completions: [] },

    // Community Outreach
    { id: 10, label: 'Post on social media & lost pet sites', type: 'POST_SOCIAL_MEDIA', completed: false, completions: [] },
    { id: 11, label: 'Contact local rescue groups', type: 'CONTACT_RESCUES', completed: false, completions: [] },
    { id: 12, label: 'Alert mail carriers & delivery drivers', type: 'ALERT_MAIL_CARRIERS', completed: false, completions: [] },
    { id: 13, label: 'Contact nearby businesses', type: 'CONTACT_BUSINESSES', completed: false, completions: [] },

    // Search Strategy
    { id: 14, label: 'Search at dawn/dusk', type: 'SEARCH_DAWN_DUSK', completed: false, completions: [] },
    { id: 15, label: 'Walk area calling their name', type: 'WALK_CALLING', completed: false, completions: [] },
    { id: 16, label: 'Check hiding spots (sheds, garages, crawl spaces)', type: 'CHECK_HIDING_SPOTS', completed: false, completions: [] },
    { id: 17, label: 'Search construction sites & dumpsters', type: 'SEARCH_CONSTRUCTION', completed: false, completions: [] },

    // Traps & Monitoring
    { id: 18, label: 'Set up humane trap', type: 'SETUP_TRAP', completed: false, completions: [] },
    { id: 19, label: 'Set up wildlife/security cameras', type: 'SETUP_CAMERAS', completed: false, completions: [] },

    // Online & Reporting
    { id: 20, label: 'Check found pet listings online', type: 'CHECK_FOUND_LISTINGS', completed: false, completions: [] },
    { id: 21, label: 'Monitor Craigslist & marketplace sites', type: 'MONITOR_MARKETPLACES', completed: false, completions: [] },
    { id: 22, label: 'File lost pet report with police', type: 'FILE_POLICE_REPORT', completed: false, completions: [] },

    // Extended Outreach
    { id: 23, label: 'Contact local dog parks & pet stores', type: 'CONTACT_PET_LOCATIONS', completed: false, completions: [] },
    { id: 24, label: 'Alert schools in the area', type: 'ALERT_SCHOOLS', completed: false, completions: [] },
    { id: 25, label: 'Contact breed-specific rescue groups', type: 'CONTACT_BREED_RESCUES', completed: false, completions: [] },
  ];

  // Initialize tasks - force update to v2 (25 tasks) if user has old v1 (6 tasks)
  useEffect(() => {
    if (tasks.length === 0) {
      setTasks(defaultTasks);
    } else if (tasks.length < 25) {
      // User has old 6-task version, force upgrade to 25-task version
      // Preserve any completions from matching old tasks
      const upgradedTasks = defaultTasks.map(newTask => {
        const oldTask = tasks.find(t => t.type === newTask.type);
        if (oldTask && oldTask.completed) {
          return { ...newTask, completed: oldTask.completed, completions: oldTask.completions };
        }
        return newTask;
      });
      setTasks(upgradedTasks);
    }
  }, []);

  // Auto-save GPS path when tab closes (people forget to click "Done Searching")
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isGPSTracking && gpsPath.length > 0) {
        // Stop GPS tracking
        if (window._gpsWatchId) {
          navigator.geolocation.clearWatch(window._gpsWatchId);
          window._gpsWatchId = null;
        }

        // Path is already saved to localStorage via parent component's useEffect
        // No need to show confirmation dialog - just let it save silently
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isGPSTracking, gpsPath]);

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleTaskClick = (task) => {
    // Open the detailed completion modal
    setSelectedTask(task);
  };

  const handleTaskComplete = async (completionData) => {
    console.log('Task completed:', completionData);

    // Add user attribution
    const completionWithUser = {
      ...completionData,
      completedBy: session?.user ? {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email
      } : null
    };

    // Extract GPS data and add to map
    const extractGPSMarkers = (data) => {
      const markers = [];
      const { details, taskType } = data;

      // Multi-location tasks (flyers, search paths)
      if (details.flyerLocations && details.flyerLocations.length > 0) {
        details.flyerLocations.forEach(loc => {
          markers.push({
            lat: loc.lat,
            lng: loc.lng,
            type: 'flyer',
            label: 'Flyer Posted',
            description: loc.description || 'Flyer location',
            timestamp: loc.timestamp || loc.date,
            taskType: 'POST_FLYERS'
          });
        });
      }

      if (details.areasGPS && details.areasGPS.length > 0) {
        details.areasGPS.forEach(loc => {
          markers.push({
            lat: loc.lat,
            lng: loc.lng,
            type: 'search',
            label: 'Searched',
            description: loc.description || 'Search area',
            timestamp: loc.timestamp,
            taskType
          });
        });
      }

      if (details.searchGPS && details.searchGPS.length > 0) {
        details.searchGPS.forEach(loc => {
          markers.push({
            lat: loc.lat,
            lng: loc.lng,
            type: 'search_route',
            label: 'Search Route',
            description: loc.description || 'Search point',
            timestamp: loc.timestamp,
            taskType
          });
        });
      }

      // Single-location tasks (stations, traps, cameras)
      if (details.stationGPS) {
        markers.push({
          lat: details.stationGPS.lat,
          lng: details.stationGPS.lng,
          type: 'station',
          label: details.stationType || 'Station',
          description: details.stationLocation || 'Recovery station',
          timestamp: details.stationGPS.timestamp,
          taskType: 'SETUP_STATION'
        });
      }

      if (details.trapGPS) {
        markers.push({
          lat: details.trapGPS.lat,
          lng: details.trapGPS.lng,
          type: 'trap',
          label: 'Trap',
          description: details.trapLocation || 'Humane trap',
          timestamp: details.trapGPS.timestamp,
          taskType: 'SETUP_TRAP'
        });
      }

      if (details.cameraGPS) {
        markers.push({
          lat: details.cameraGPS.lat,
          lng: details.cameraGPS.lng,
          type: 'camera',
          label: 'Camera',
          description: details.cameraLocation || 'Surveillance camera',
          timestamp: details.cameraGPS.timestamp,
          taskType: 'SETUP_CAMERAS'
        });
      }

      return markers;
    };

    // Add extracted markers to gpsPath
    const newMarkers = extractGPSMarkers(completionWithUser);
    if (newMarkers.length > 0) {
      setGpsPath(prev => [...prev, ...newMarkers]);
    }

    // Save to backend API
    try {
      const response = await fetch(`/api/missions/${missionData.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedTask.label,
          description: `Task completed: ${selectedTask.label}`,
          type: completionWithUser.taskType || 'OTHER',
          priority: 'MEDIUM',
          status: 'COMPLETED',
          completionNotes: JSON.stringify(completionWithUser.details),
          assigneeId: session?.user?.id,
        }),
      });

      if (!response.ok) {
        console.error('Failed to save task completion to backend');
        // Continue anyway - data is in localStorage
      } else {
        console.log('Task completion saved to backend successfully');
      }
    } catch (error) {
      console.error('Error saving task completion:', error);
      // Continue anyway - data is in localStorage
    }

    // Update local state
    setTasks(prev => prev.map(t =>
      t.id === selectedTask.id
        ? {
            ...t,
            completed: true,
            completions: [...t.completions, completionWithUser]
          }
        : t
    ));
  };

  const handleCustomActionComplete = async (actionData) => {
    // Create a new custom task
    const newTask = {
      id: Date.now(), // Use timestamp as unique ID
      label: actionData.actionName,
      type: 'CUSTOM',
      completed: true,
      completions: [{
        taskId: Date.now(),
        taskType: 'CUSTOM',
        details: {
          notes: actionData.details
        },
        completedAt: new Date().toISOString(),
        completedBy: session?.user ? {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email
        } : null
      }]
    };

    // Add to tasks list
    setTasks(prev => [...prev, newTask]);
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
      // Save the search area to backend
      console.log('GPS path recorded:', gpsPath);

      try {
        const response = await fetch(`/api/missions/${missionData.id}/search-areas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'GPS_AUTO',
            path: gpsPath,
            notes: `GPS-tracked search with ${gpsPath.length} waypoints`,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('GPS search area saved successfully:', data);
          alert(`🎉 Amazing work! We recorded ${gpsPath.length} GPS points (~${data.searchArea?.acreage?.toFixed(2)} acres) showing where you searched. This helps everyone coordinate better!`);
        } else {
          console.error('Failed to save GPS search area to backend');
          alert(`📍 Recorded ${gpsPath.length} GPS points locally. (Note: Server save failed, but your data is stored on your device)`);
        }
      } catch (error) {
        console.error('Error saving GPS search area:', error);
        alert(`📍 Recorded ${gpsPath.length} GPS points locally. (Note: Server save failed, but your data is stored on your device)`);
      }
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
            <p className="text-slate-300 text-sm mb-1">
              📍 Going out to search?
            </p>
            <p className="text-slate-400 text-sm">
              Turn on GPS tracking so everyone knows which areas you've already covered. It helps coordinate the search!
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
              className="w-full py-4 bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400 font-bold rounded-xl hover:bg-emerald-500/30 transition flex items-center justify-center gap-2"
            >
              ✓ Done Searching - Save My Path
            </button>
          </div>
        )}
      </div>

      {/* Active Helpers */}
      <div className="bg-slate-900/50 border-2 border-flash-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Users size={20} className="text-flash-400" />
          Search Team ({team.length})
        </h3>

        {team.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <img
              src="https://petrescue.b-cdn.net/Logos%20(2).svg"
              alt="Sarama"
              className="h-32 w-auto mx-auto mb-4 drop-shadow-xl"
            />
            <p className="text-white font-semibold mb-2">Build Your Search Team</p>
            <p className="text-slate-400 text-sm mb-4">Invite friends, family, and neighbors to coordinate the search</p>
            <button className="px-6 py-3 bg-gradient-to-r from-flash-500 to-blue-500 text-white font-bold rounded-xl hover:scale-105 transition">
              + Invite Volunteers
            </button>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {team.map(member => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-flash-500/20 hover:border-flash-500/40 transition"
              >
                {/* Avatar */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-flash-500 to-blue-500 flex items-center justify-center text-white font-bold">
                  {member.firstName?.[0]}{member.lastName?.[0] || ''}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm truncate">
                    {member.name}
                  </div>
                  <div className="text-slate-400 text-xs">
                    Search volunteer
                  </div>
                </div>

                {/* Active indicator */}
                {member.isActive && (
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search Checklist */}
      <div className="bg-slate-900/50 border-2 border-emerald-500/30 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckCircle2 size={20} className="text-emerald-400" />
            Actions Taken
          </h3>
          <button
            onClick={() => setShowCustomActionModal(true)}
            className="px-3 py-1.5 bg-flash-500/20 border border-flash-500/50 text-flash-400 text-sm font-semibold rounded-lg hover:bg-flash-500/30 transition"
          >
            + Log Action
          </button>
        </div>

        {/* Suggested Next Steps */}
        {(() => {
          const incompleteTasks = tasks.filter(t => !t.completed);
          const suggestedTasks = incompleteTasks.slice(0, 3);
          if (suggestedTasks.length > 0) {
            return (
              <div className="mb-6 p-4 bg-gradient-to-r from-flash-500/10 to-blue-500/10 border border-flash-500/30 rounded-xl">
                <h4 className="text-sm font-bold text-flash-400 mb-3 flex items-center gap-2">
                  <Sparkles size={16} />
                  Suggested Next Steps
                </h4>
                <div className="space-y-2">
                  {suggestedTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className="w-full text-left p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition flex items-center gap-3"
                    >
                      <div className="w-5 h-5 rounded-full bg-slate-700 border-2 border-slate-600 flex-shrink-0"></div>
                      <span className="flex-1 text-sm text-white">{task.label}</span>
                      <ChevronLeft size={16} className="text-slate-500 rotate-180" />
                    </button>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Task Categories */}
        {[
          { id: 'immediate', name: '🚨 Immediate', color: 'emerald', range: [0, 4] },
          { id: 'shelters', name: '🏥 Shelters & Authorities', color: 'blue', range: [4, 7] },
          { id: 'veterinary', name: '💉 Veterinary', color: 'purple', range: [7, 9] },
          { id: 'community', name: '👥 Community', color: 'flash', range: [9, 13] },
          { id: 'search', name: '🔍 Search Operations', color: 'amber', range: [13, 17] },
          { id: 'advanced', name: '🎯 Advanced Tactics', color: 'rose', range: [17, 19] },
          { id: 'online', name: '💻 Online & Documentation', color: 'indigo', range: [19, 22] },
          { id: 'extended', name: '🌟 Extended Outreach', color: 'yellow', range: [22, 25] },
        ].map(category => {
          const categoryTasks = tasks.slice(category.range[0], category.range[1]);
          const completed = categoryTasks.filter(t => t.completed).length;
          const total = categoryTasks.length;
          const isExpanded = expandedCategories.includes(category.id);
          const progressPercent = (completed / total) * 100;

          return (
            <div key={category.id} className="mb-3">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 rounded-lg transition border border-slate-700/50"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronLeft size={16} className="text-slate-400" />}
                  <h4 className={`text-sm font-bold text-${category.color}-400`}>{category.name}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{completed}/{total}</span>
                  <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-${category.color}-500 transition-all`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </button>

              {/* Category Tasks */}
              {isExpanded && (
                <div className="mt-2 space-y-2 pl-2">
                  {categoryTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className={`w-full text-left p-3 rounded-lg transition flex items-center gap-3 ${
                        task.completed
                          ? 'bg-emerald-500/10 border border-emerald-500/30'
                          : 'bg-slate-800/50 border border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
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
                        <span className="text-xs bg-flash-500/20 text-flash-400 px-2 py-1 rounded">
                          {task.completions.length}×
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Overall Progress - Less Prominent */}
        <div className="mt-6 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs">Overall Progress</span>
            <span className="text-slate-300 font-semibold text-sm">{tasks.filter(t => t.completed).length}/{tasks.length}</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
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

      {/* Custom Action Modal */}
      {showCustomActionModal && (
        <CustomActionModal
          onClose={() => setShowCustomActionModal(false)}
          onComplete={(actionData) => {
            handleCustomActionComplete(actionData);
            setShowCustomActionModal(false);
          }}
        />
      )}

      {/* Waiver Modal - Pops up automatically when waiver hasn't been accepted */}
      {showWaiverModal && (
        <WaiverModal
          isOpen={showWaiverModal}
          onClose={() => setShowWaiverModal(false)}
          onAccepted={() => {
            setShowWaiverModal(false);
            setLoading(true);
            fetchMission(); // Retry loading the case after waiver accepted
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// MANAGE TAB - Admin controls
// ============================================================================
function ManageTab({ missionData, onUpdate }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Status Management */}
      <div className="bg-slate-900/50 border-2 border-purple-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-purple-400" />
          Mission Status
        </h3>

        <div className="space-y-3">
          <button className="w-full py-3 px-4 bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400 font-bold rounded-xl hover:bg-emerald-500/30 transition flex items-center justify-center gap-2">
            <Heart size={18} />
            Mark as Reunited
          </button>

          <button className="w-full py-3 px-4 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500 transition flex items-center justify-center gap-2">
            <Edit size={18} />
            Update Mission Details
          </button>

          <button className="w-full py-3 px-4 bg-amber-500/20 border-2 border-amber-500/50 text-amber-400 font-semibold rounded-xl hover:bg-amber-500/30 transition flex items-center justify-center gap-2">
            <AlertCircle size={18} />
            Change Urgency Level
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-900/50 border-2 border-flash-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Settings size={20} className="text-flash-400" />
          Quick Actions
        </h3>

        <div className="space-y-3">
          <button className="w-full py-3 px-4 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500 transition flex items-center justify-center gap-2">
            <Share2 size={18} />
            Generate Flyer
          </button>

          <button className="w-full py-3 px-4 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500 transition flex items-center justify-center gap-2">
            <Camera size={18} />
            Add Photos
          </button>

          <button className="w-full py-3 px-4 bg-slate-800 border-2 border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500 transition flex items-center justify-center gap-2">
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
function SightingFormModal({ missionId, onClose, onSuccess }) {
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
      const res = await fetch(`/api/missions/${missionId}/sightings`, {
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
        className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-flash-500/30 rounded-2xl w-full max-w-lg shadow-2xl shadow-flash-500/20"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b-2 border-slate-700/60">
          <h2 className="text-2xl font-bold text-white">👁 Report Sighting</h2>
          <p className="text-slate-300 text-sm mt-2">
            Every sighting helps! Even if you're not 100% sure, it's worth reporting.
          </p>
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
                className="w-full py-4 bg-flash-500/20 border-2 border-flash-500/50 text-flash-400 font-bold rounded-xl hover:bg-flash-500/30 transition flex items-center justify-center gap-2"
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
              className="w-full bg-slate-800 text-white rounded-xl p-4 border-2 border-slate-700 focus:border-flash-500 focus:outline-none resize-none"
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

function CustomActionModal({ onClose, onComplete }) {
  const [actionName, setActionName] = useState('');
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState([]);

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);

    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert(`${file.name} is too large. Please use photos under 10MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotos(prev => [...prev, {
          name: file.name,
          url: event.target.result,
          size: file.size,
          type: file.type
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!actionName.trim()) return;
    onComplete({
      actionName: actionName.trim(),
      details: details.trim(),
      photos: photos
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-flash-500/30 rounded-2xl w-full max-w-lg shadow-2xl shadow-flash-500/20" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b-2 border-slate-700/60">
          <h2 className="text-2xl font-bold text-white">✨ Log Custom Action</h2>
          <p className="text-slate-300 text-sm mt-2">
            Did something not on the list? Log it here! Every action matters.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Action Name */}
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">What did you do? *</label>
            <input
              type="text"
              value={actionName}
              onChange={(e) => setActionName(e.target.value)}
              placeholder="e.g., Called local vet offices, Checked with mail carrier..."
              className="w-full bg-slate-800 text-white rounded-xl p-4 border-2 border-slate-700 focus:border-flash-500 focus:outline-none"
              style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              autoFocus
            />
          </div>

          {/* Details */}
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">Details (optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Any notes about what you did, what you learned, etc..."
              className="w-full bg-slate-800 text-white rounded-xl p-4 border-2 border-slate-700 focus:border-flash-500 focus:outline-none resize-none"
              style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              rows={4}
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">
              Photos (optional)
            </label>

            {/* Photo preview grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={photo.url}
                      alt={photo.name}
                      className="w-full h-24 object-cover rounded-lg border-2 border-slate-700"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition shadow-lg"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            <label className="block">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <div className="w-full py-3 px-4 bg-slate-800 border-2 border-dashed border-slate-600 text-slate-400 rounded-xl hover:border-flash-500 hover:text-flash-400 transition cursor-pointer flex items-center justify-center gap-2 text-sm font-semibold">
                <Camera size={18} />
                {photos.length > 0 ? 'Add More Photos' : 'Upload Photos'}
              </div>
            </label>
            <p className="text-slate-500 text-xs mt-2">
              📸 Add photos of flyers, sightings, or anything relevant (max 10MB each)
            </p>
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
            disabled={!actionName.trim()}
            className={`flex-1 py-3 font-bold rounded-xl transition ${
              actionName.trim()
                ? 'bg-gradient-to-r from-flash-500 to-blue-500 text-white shadow-lg shadow-flash-500/30 hover:shadow-xl hover:shadow-flash-500/50'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            Log Action
          </button>
        </div>
      </div>
    </div>
  );
}
