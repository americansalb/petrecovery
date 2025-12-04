'use client';

/**
 * Mission Control V3 - Redesigned Single-Page Experience
 *
 * Layout:
 * - Top 1/4: Static hero with pet info
 * - Middle 2/4: Functional content (scrollable tab content)
 * - Bottom 1/4: Navigation tabs + mission cycling
 *
 * All features from V1/V2 preserved.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import WaiverModal from '@/components/WaiverModal';
import TaskCompletionModal from '@/components/case/TaskCompletionModal';
import { PageLoading } from '@/components/LoadingSkeleton';
import { fetchWithRetry, formatErrorMessage, isOnline, normalizePhotoUrl } from '@/app/lib/utils';
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
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Send,
  Navigation,
  RefreshCw,
  Sparkles,
  Shield,
  List,
  X,
  Search,
  Radio,
  Crown,
} from 'lucide-react';

// Lazy load map for better performance
const MapView = dynamic(() => import('@/app/components/case/SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="animate-pulse text-slate-500">Loading map...</div>
    </div>
  )
});

function MissionControlV3Content() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const missionId = searchParams.get('mission');

  // Mission state
  const [activeMission, setActiveMission] = useState(null);
  const [availableMissions, setAvailableMissions] = useState([]);
  const [currentMissionIndex, setCurrentMissionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState('overview');
  const [showMissionsModal, setShowMissionsModal] = useState(false);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [showSightingForm, setShowSightingForm] = useState(false);

  // Data state
  const [sightings, setSightings] = useState([]);
  const [team, setTeam] = useState([]);
  const [gpsPath, setGpsPath] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isGPSTracking, setIsGPSTracking] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(['immediate']);
  const [showCustomActionModal, setShowCustomActionModal] = useState(false);

  // Fetch available missions
  const fetchAvailableMissions = useCallback(async () => {
    try {
      if (!session?.user) return;
      const res = await fetchWithRetry('/api/cases/my-missions');
      if (res.ok) {
        const data = await res.json();
        setAvailableMissions(data.missions || []);
      }
    } catch (err) {
      console.error('Error fetching available missions:', err);
    }
  }, [session]);

  // Fetch specific mission
  const fetchMission = useCallback(async (id) => {
    if (!id) return;
    setSwitching(true);
    setError(null);

    try {
      if (!isOnline()) {
        setError('You are offline. Please check your internet connection.');
        setSwitching(false);
        setLoading(false);
        return;
      }

      const res = await fetchWithRetry(`/api/cases/${id}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Mission not found');
        } else if (res.status === 403) {
          let errorData = null;
          try {
            errorData = await res.json();
          } catch (e) {}
          if (!errorData || errorData.code === 'WAIVER_NOT_ACCEPTED' || errorData.message?.includes('waiver')) {
            setShowWaiverModal(true);
            setSwitching(false);
            setLoading(false);
            return;
          }
          throw new Error(errorData?.message || 'Permission denied');
        }
        throw new Error(`Failed to load mission (${res.status})`);
      }

      const data = await res.json();
      setActiveMission(data);

      // Extract team from assignments
      if (data.assignments?.length > 0) {
        const allParticipants = data.assignments.flatMap(a =>
          a.participants?.map(p => ({
            id: p.id,
            userId: p.userId,
            name: `${p.user.firstName} ${p.user.lastName || ''}`.trim(),
            firstName: p.user.firstName,
            lastName: p.user.lastName,
            isActive: p.isActive !== false,
          })) || []
        );
        const unique = Array.from(new Map(allParticipants.map(p => [p.userId, p])).values());
        setTeam(unique);
      } else {
        setTeam([]);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching mission:', err);
      setError(formatErrorMessage(err));
    } finally {
      setSwitching(false);
      setLoading(false);
    }
  }, []);

  // Fetch sightings
  const fetchSightings = useCallback(async () => {
    if (!activeMission?.id) return;
    try {
      const res = await fetch(`/api/cases/${activeMission.id}/sightings`);
      if (res.ok) {
        const data = await res.json();
        setSightings(data.sightings || []);
      }
    } catch (err) {
      console.error('Error fetching sightings:', err);
    }
  }, [activeMission?.id]);

  // Load GPS path and tasks from localStorage
  useEffect(() => {
    if (!activeMission?.id) return;
    const storageKey = `case_${activeMission.id}_gps`;
    const tasksKey = `case_${activeMission.id}_tasks`;

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { setGpsPath(JSON.parse(saved)); } catch (e) {}
    }

    const savedTasks = localStorage.getItem(tasksKey);
    if (savedTasks) {
      try { setTasks(JSON.parse(savedTasks)); } catch (e) {}
    }
  }, [activeMission?.id]);

  // Save GPS path to localStorage
  useEffect(() => {
    if (!activeMission?.id || gpsPath.length === 0) return;
    localStorage.setItem(`case_${activeMission.id}_gps`, JSON.stringify(gpsPath));
  }, [gpsPath, activeMission?.id]);

  // Save tasks to localStorage
  useEffect(() => {
    if (!activeMission?.id || tasks.length === 0) return;
    localStorage.setItem(`case_${activeMission.id}_tasks`, JSON.stringify(tasks));
  }, [tasks, activeMission?.id]);

  // Initial load
  useEffect(() => {
    fetchAvailableMissions();
  }, [fetchAvailableMissions]);

  // Load mission when URL changes
  useEffect(() => {
    if (missionId) {
      fetchMission(missionId);
    } else {
      setLoading(false);
      setActiveMission(null);
    }
  }, [missionId, fetchMission]);

  // Fetch sightings when mission changes
  useEffect(() => {
    if (activeMission?.id) {
      fetchSightings();
      const interval = setInterval(fetchSightings, 30000);
      return () => clearInterval(interval);
    }
  }, [activeMission?.id, fetchSightings]);

  // Update current mission index when missions or active mission changes
  useEffect(() => {
    if (availableMissions.length > 0 && activeMission) {
      const idx = availableMissions.findIndex(m => m.id === activeMission.id);
      if (idx >= 0) setCurrentMissionIndex(idx);
    }
  }, [availableMissions, activeMission]);

  // Mission navigation
  const goToPrevMission = () => {
    if (availableMissions.length === 0) return;
    const newIndex = (currentMissionIndex - 1 + availableMissions.length) % availableMissions.length;
    const newMission = availableMissions[newIndex];
    router.push(`/mission-control?mission=${newMission.id}`, { scroll: false });
  };

  const goToNextMission = () => {
    if (availableMissions.length === 0) return;
    const newIndex = (currentMissionIndex + 1) % availableMissions.length;
    const newMission = availableMissions[newIndex];
    router.push(`/mission-control?mission=${newMission.id}`, { scroll: false });
  };

  const selectMission = (missionId) => {
    setShowMissionsModal(false);
    router.push(`/mission-control?mission=${missionId}`, { scroll: false });
  };

  // Join mission
  const handleJoinMission = async () => {
    if (!activeMission) return;
    try {
      const squadId = activeMission.rescueSquadId || activeMission.squadId || activeMission.assignments?.[0]?.rescueSquadId;
      if (!squadId) return;

      const res = await fetchWithRetry(`/api/rescue-squads/${squadId}/cases/${activeMission.id}/help`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok || (res.status === 400)) {
        await fetchMission(missionId);
        await fetchAvailableMissions();
      }
    } catch (err) {
      console.error('Error joining mission:', err);
    }
  };

  // Calculate time missing
  const getTimeMissing = () => {
    if (!activeMission?.lastSeenAt) return null;
    const hours = Math.floor((Date.now() - new Date(activeMission.lastSeenAt).getTime()) / 3600000);
    if (hours < 1) return { text: 'Less than 1 hour', hours: 0 };
    if (hours < 24) return { text: `${hours} hour${hours !== 1 ? 's' : ''}`, hours };
    const days = Math.floor(hours / 24);
    return { text: `${days} day${days !== 1 ? 's' : ''} ${hours % 24}h`, hours };
  };

  const timeMissing = getTimeMissing();
  const isUrgent = timeMissing && timeMissing.hours < 24;
  const isReunited = activeMission?.status === 'RESOLVED' || activeMission?.resolution === 'REUNITED';

  // Check user status
  const participants = activeMission?.assignments?.flatMap(a => a.participants || []) || [];
  const activeParticipants = participants.filter(p => p.isActive !== false);
  const isDeployed = session && activeParticipants.some(p => p.userId === session.user.id);
  const isOwner = session && activeMission?.ownerId === session.user.id;

  // Loading state
  if (loading) {
    return <PageLoading message="Initializing Mission Control..." />;
  }

  // Waiver modal (no mission loaded yet)
  if (showWaiverModal && !activeMission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <div className="inline-block p-4 bg-flash-500/20 rounded-full border-2 border-flash-500/50">
              <Shield size={48} className="text-flash-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Liability Waiver Required</h2>
          <p className="text-slate-400 mb-6">Please accept the liability waiver to view mission details.</p>
        </div>
        <WaiverModal
          isOpen={showWaiverModal}
          onClose={() => {
            setShowWaiverModal(false);
            router.push('/mission-control');
          }}
          onAccepted={() => {
            setShowWaiverModal(false);
            if (missionId) fetchMission(missionId);
          }}
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/80 border-2 border-red-500/30 rounded-2xl p-8">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-500/20 rounded-full border-2 border-red-500/50">
              <AlertCircle size={48} className="text-red-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-3">Unable to Load Mission</h2>
          <p className="text-red-300 text-center mb-8">{error}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setError(null); setLoading(true); if (missionId) fetchMission(missionId); }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-flash-500 text-slate-900 font-bold rounded-xl hover:bg-flash-400 transition"
            >
              <RefreshCw size={20} />
              Try Again
            </button>
            <button
              onClick={() => router.push('/mission-control')}
              className="px-6 py-3 bg-slate-800 text-slate-300 font-semibold rounded-xl border border-slate-700 hover:border-slate-600 transition"
            >
              Back to Mission Control
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No mission selected - show empty state
  if (!activeMission) {
    return (
      <EmptyState
        missions={availableMissions}
        onSelectMission={selectMission}
        onRefresh={fetchAvailableMissions}
      />
    );
  }

  // Define tabs
  const tabs = [
    { id: 'overview', label: 'Overview', icon: AlertCircle },
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'activity', label: 'Activity', icon: ActivityIcon },
  ];

  // Add manage tab for owners
  if (isOwner) {
    tabs.push({ id: 'manage', label: 'Manage', icon: Settings });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Switching overlay */}
      {switching && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-flash-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white font-semibold">Loading...</p>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* HERO SECTION - Pet Photo & Info */}
      {/* ============================================================ */}
      <div className="bg-slate-900/95 border-b border-flash-500/30 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            {/* Pet Photo */}
            <div className="flex-shrink-0">
              {activeMission.petPhotoUrl ? (
                <img
                  src={normalizePhotoUrl(activeMission.petPhotoUrl)}
                  alt={activeMission.petName}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border-2 border-flash-500/50 shadow-lg shadow-flash-500/20"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-4xl border-2 border-slate-600">
                  {activeMission.petSpecies === 'DOG' ? '🐕' : activeMission.petSpecies === 'CAT' ? '🐈' : '🐾'}
                </div>
              )}
            </div>

            {/* Pet Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  {activeMission.petName}
                </h1>
                {timeMissing && !isReunited && (
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                    isUrgent ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-flash-500/20 text-flash-400 border border-flash-500/30'
                  }`}>
                    {timeMissing.text}
                  </span>
                )}
                {isReunited && (
                  <span className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ✓ Reunited
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-sm mb-2">
                {activeMission.petBreed || activeMission.petSpecies} • {activeMission.lastSeenAddress?.split(',').slice(0, 2).join(',') || 'Location unknown'}
              </p>
              <div className="flex items-center gap-4">
                <span className="text-flash-400 text-sm font-semibold">{activeParticipants.length} helpers</span>
                <span className="text-amber-400 text-sm font-semibold">{sightings.length} sightings</span>
              </div>
            </div>

            {/* Join Button */}
            {!isReunited && session && (
              <div className="flex-shrink-0">
                {isOwner ? (
                  <div className="p-3 rounded-xl bg-flash-500/10 border-2 border-flash-500/30">
                    <Crown size={24} className="text-flash-400" />
                  </div>
                ) : isDeployed ? (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30">
                    <Shield size={24} className="text-emerald-400" />
                  </div>
                ) : (
                  <button
                    onClick={handleJoinMission}
                    className="px-4 py-2 rounded-xl bg-flash-500 text-slate-900 font-bold text-sm hover:bg-flash-400 transition"
                  >
                    Join
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB NAVIGATION - More visible */}
      {/* ============================================================ */}
      <div className="bg-slate-900/80 border-b border-slate-700/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition ${
                    activeTab === tab.id
                      ? 'bg-flash-500/20 text-flash-400 border border-flash-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* CONTENT AREA */}
      {/* ============================================================ */}
      <div className="max-w-4xl mx-auto px-4 py-4">
          {activeTab === 'overview' && (
            <OverviewTab
              mission={activeMission}
              timeMissing={timeMissing}
              isUrgent={isUrgent}
              isReunited={isReunited}
              sightingsCount={sightings.length}
              onReportSighting={() => setShowSightingForm(true)}
            />
          )}

          {activeTab === 'map' && (
            <MapTab
              mission={activeMission}
              sightings={sightings}
              gpsPath={gpsPath}
              onReportSighting={() => setShowSightingForm(true)}
            />
          )}

          {activeTab === 'team' && (
            <TeamTab
              team={team}
              mission={activeMission}
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
              session={session}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityTab
              sightings={sightings}
              tasks={tasks}
              gpsPath={gpsPath}
              onLocationClick={() => setActiveTab('map')}
            />
          )}

          {activeTab === 'manage' && (
            <ManageTab
              mission={activeMission}
              onUpdate={() => fetchMission(missionId)}
            />
          )}

      {/* Mission Switcher - Fixed bottom */}
      {availableMissions.length > 1 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 bg-slate-900/95 backdrop-blur-lg rounded-full px-2 py-1 border border-flash-500/30 shadow-lg">
            <button
              onClick={goToPrevMission}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setShowMissionsModal(true)}
              className="px-3 py-1 rounded-full bg-slate-800 text-white font-semibold text-sm hover:bg-slate-700"
            >
              {currentMissionIndex + 1} / {availableMissions.length}
            </button>
            <button
              onClick={goToNextMission}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
      </div>

      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}

      {/* View All Missions Modal */}
      {showMissionsModal && (
        <MissionsModal
          missions={availableMissions}
          activeMissionId={activeMission?.id}
          onSelect={selectMission}
          onClose={() => setShowMissionsModal(false)}
        />
      )}

      {/* Sighting Form Modal */}
      {showSightingForm && (
        <SightingFormModal
          caseId={activeMission?.id}
          onClose={() => setShowSightingForm(false)}
          onSuccess={() => {
            setShowSightingForm(false);
            fetchSightings();
          }}
        />
      )}

      {/* Task Completion Modal */}
      {selectedTask && (
        <TaskCompletionModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onComplete={(completionData) => {
            setTasks(prev => prev.map(t =>
              t.id === selectedTask.id
                ? { ...t, completed: true, completions: [...t.completions, completionData] }
                : t
            ));
            setSelectedTask(null);
          }}
        />
      )}

      {/* Custom Action Modal */}
      {showCustomActionModal && (
        <CustomActionModal
          onClose={() => setShowCustomActionModal(false)}
          onComplete={(actionData) => {
            const newTask = {
              id: Date.now(),
              label: actionData.actionName,
              type: 'CUSTOM',
              completed: true,
              completions: [{
                taskId: Date.now(),
                taskType: 'CUSTOM',
                details: { notes: actionData.details },
                completedAt: new Date().toISOString(),
                completedBy: session?.user,
              }],
            };
            setTasks(prev => [...prev, newTask]);
            setShowCustomActionModal(false);
          }}
        />
      )}

      {/* Waiver Modal */}
      {showWaiverModal && (
        <WaiverModal
          isOpen={showWaiverModal}
          onClose={() => setShowWaiverModal(false)}
          onAccepted={() => {
            setShowWaiverModal(false);
            if (missionId) fetchMission(missionId);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================
function EmptyState({ missions, onSelectMission, onRefresh }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-flash-500/20 border-2 border-flash-500/30 mb-6">
          <Radio size={48} className="text-flash-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Mission Control</h1>
        <p className="text-slate-400">Your command center for rescue missions</p>
      </div>

      {missions && missions.length > 0 ? (
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Your Missions ({missions.length})</h3>
            <button onClick={onRefresh} className="text-slate-400 hover:text-white p-2">
              <RefreshCw size={20} />
            </button>
          </div>
          <div className="space-y-3">
            {missions.slice(0, 5).map(mission => (
              <button
                key={mission.id}
                onClick={() => onSelectMission(mission.id)}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-flash-500/50 transition text-left"
              >
                {mission.photoUrl ? (
                  <img src={normalizePhotoUrl(mission.photoUrl)} alt={mission.petName} className="w-14 h-14 rounded-xl object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center text-2xl">
                    {mission.petSpecies === 'DOG' ? '🐕' : '🐈'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-bold truncate">{mission.petName}</h4>
                  <p className="text-slate-400 text-sm">{mission.timeMissing} • {mission.helperCount || 0} helpers</p>
                </div>
                <ChevronRight size={20} className="text-slate-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-slate-400 mb-6">No active missions yet</p>
          <a
            href="/rescue-squads"
            className="inline-block px-6 py-3 bg-flash-500 text-slate-900 font-bold rounded-xl text-lg hover:bg-flash-400 transition"
          >
            Join a Rescue Squad
          </a>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MISSIONS MODAL
// ============================================================================
function MissionsModal({ missions, activeMissionId, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-900 border-t sm:border border-flash-500/30 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Your Missions</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {missions.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No missions yet</p>
          ) : (
            <div className="space-y-2">
              {missions.map(mission => (
                <button
                  key={mission.id}
                  onClick={() => onSelect(mission.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-left ${
                    mission.id === activeMissionId
                      ? 'bg-flash-500/20 border border-flash-500/50'
                      : 'bg-slate-800/50 border border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  {mission.photoUrl ? (
                    <img src={mission.photoUrl} alt={mission.petName} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-xl">
                      {mission.petSpecies === 'DOG' ? '🐕' : '🐈'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold truncate">{mission.petName}</h4>
                    <p className="text-slate-400 text-xs">{mission.timeMissing}</p>
                  </div>
                  {mission.id === activeMissionId && (
                    <CheckCircle2 size={20} className="text-flash-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800">
          <a
            href="/rescue-squads"
            className="block w-full py-3 px-4 rounded-xl bg-slate-800 border border-slate-700 text-center text-white font-semibold hover:border-flash-500/50 transition"
          >
            <Search size={18} className="inline mr-2" />
            Discover New Cases
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================
function OverviewTab({ mission, timeMissing, isUrgent, isReunited, sightingsCount, onReportSighting }) {
  return (
    <div className="space-y-4">
      {/* Urgency Alert */}
      {isUrgent && !isReunited && (
        <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-400 font-bold mb-1">Act Fast - Every Moment Matters</h3>
              <p className="text-red-200 text-sm">
                {mission.petName} has been missing for {timeMissing?.text}. The first 24 hours are critical.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pet Info */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Camera size={18} className="text-flash-400" />
          Pet Details
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-slate-500 text-sm">Species</span>
            <p className="text-white font-semibold capitalize">{mission.petSpecies?.toLowerCase()}</p>
          </div>
          <div>
            <span className="text-slate-500 text-sm">Breed</span>
            <p className="text-white font-semibold">{mission.petBreed || 'Unknown'}</p>
          </div>
          <div>
            <span className="text-slate-500 text-sm">Color</span>
            <p className="text-white font-semibold capitalize">{mission.petColor || 'Unknown'}</p>
          </div>
          <div>
            <span className="text-slate-500 text-sm">Size</span>
            <p className="text-white font-semibold capitalize">{mission.petSize || 'Unknown'}</p>
          </div>
        </div>
        {mission.petDescription && (
          <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
            <p className="text-slate-300 text-sm">{mission.petDescription}</p>
          </div>
        )}
      </div>

      {/* Last Seen */}
      <div className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-4">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <MapPin size={18} className="text-amber-400" />
          Last Seen Location
        </h3>
        <p className="text-white">{mission.lastSeenAddress || 'Location not provided'}</p>
        {mission.lastSeenAt && (
          <p className="text-slate-400 text-sm mt-2">
            {new Date(mission.lastSeenAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Actions */}
      {!isReunited && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onReportSighting}
            className="py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 hover:scale-105 transition flex items-center justify-center gap-2"
          >
            <Eye size={20} />
            Report Sighting
          </button>
          {mission.ownerPhone && (
            <a
              href={`tel:${mission.ownerPhone}`}
              className="py-3 px-4 bg-slate-800 border border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500 transition flex items-center justify-center gap-2"
            >
              <Phone size={20} />
              Call Owner
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAP TAB
// ============================================================================
function MapTab({ mission, sightings, gpsPath, onReportSighting }) {
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-flash-500/30 rounded-xl overflow-hidden" style={{ height: '50vh' }}>
        <MapView
          center={mission.lastSeenLatitude && mission.lastSeenLongitude
            ? [mission.lastSeenLatitude, mission.lastSeenLongitude]
            : [41.8781, -87.6298]}
          lastSeen={mission.lastSeenLatitude ? {
            lat: mission.lastSeenLatitude,
            lng: mission.lastSeenLongitude,
            address: mission.lastSeenAddress,
          } : null}
          sightings={sightings}
          petSpecies={mission.petSpecies}
          gpsPath={gpsPath}
          showControls
        />
      </div>

      <button
        onClick={onReportSighting}
        className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 hover:scale-105 transition flex items-center justify-center gap-2"
      >
        <Eye size={20} />
        Report Sighting at My Location
      </button>

      {sightings.length > 0 && (
        <div className="text-center text-amber-400">
          👁 {sightings.length} sighting{sightings.length !== 1 ? 's' : ''} reported
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ACTIVITY TAB
// ============================================================================
function ActivityTab({ sightings, tasks, gpsPath, onLocationClick }) {
  const buildTimeline = () => {
    const items = [];

    sightings.forEach(s => {
      items.push({
        type: 'sighting',
        timestamp: new Date(s.sightedAt || s.createdAt).getTime(),
        data: s,
      });
    });

    tasks.forEach(task => {
      task.completions?.forEach(completion => {
        items.push({
          type: 'task',
          timestamp: new Date(completion.completedAt).getTime(),
          data: { ...completion, task },
        });
      });
    });

    if (gpsPath?.length > 0) {
      items.push({
        type: 'gps_search',
        timestamp: gpsPath[0].timestamp,
        data: { pointCount: gpsPath.length, path: gpsPath },
      });
    }

    return items.sort((a, b) => b.timestamp - a.timestamp);
  };

  const timelineItems = buildTimeline();

  return (
    <div className="space-y-3">
      {timelineItems.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <ActivityIcon size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-white font-semibold mb-2">No Activity Yet</p>
          <p className="text-sm">Sightings and task completions will appear here</p>
        </div>
      ) : (
        timelineItems.map((item, index) => (
          <div
            key={index}
            onClick={onLocationClick}
            className={`p-4 rounded-xl border cursor-pointer hover:scale-[1.02] transition ${
              item.type === 'sighting'
                ? 'bg-amber-500/10 border-amber-500/30'
                : item.type === 'task'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-purple-500/10 border-purple-500/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                item.type === 'sighting' ? 'bg-amber-500/20' :
                item.type === 'task' ? 'bg-emerald-500/20' : 'bg-purple-500/20'
              }`}>
                {item.type === 'sighting' ? '👁' : item.type === 'task' ? '✓' : '📍'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-bold ${
                    item.type === 'sighting' ? 'text-amber-400' :
                    item.type === 'task' ? 'text-emerald-400' : 'text-purple-400'
                  }`}>
                    {item.type === 'sighting' ? 'Sighting Reported' :
                     item.type === 'task' ? item.data.task?.label : 'GPS Search'}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {item.type === 'sighting' && (
                  <>
                    <p className="text-slate-300 text-sm">{item.data.description || 'No description'}</p>
                    <p className="text-slate-500 text-xs mt-1">📍 {item.data.address}</p>
                  </>
                )}
                {item.type === 'gps_search' && (
                  <p className="text-slate-300 text-sm">{item.data.pointCount} GPS points recorded</p>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================================
// TEAM TAB (abbreviated - full implementation in CaseCommandCenterV2)
// ============================================================================
function TeamTab({ team, mission, tasks, setTasks, gpsPath, setGpsPath, isGPSTracking, setIsGPSTracking, expandedCategories, setExpandedCategories, selectedTask, setSelectedTask, showCustomActionModal, setShowCustomActionModal, session }) {
  // Default tasks - same as in CaseCommandCenterV2
  const defaultTasks = [
    { id: 1, label: 'Search property & immediate area thoroughly', type: 'SEARCH_PROPERTY', completed: false, completions: [] },
    { id: 2, label: 'Alert neighbors & nearby residents', type: 'ALERT_NEIGHBORS', completed: false, completions: [] },
    { id: 3, label: 'Post flyers in the area', type: 'POST_FLYERS', completed: false, completions: [] },
    { id: 4, label: 'Set up food/water/scent station', type: 'SETUP_STATION', completed: false, completions: [] },
    { id: 5, label: 'Call local animal shelters', type: 'CALL_SHELTERS', completed: false, completions: [] },
    { id: 6, label: 'Visit local shelters in person', type: 'VISIT_SHELTERS', completed: false, completions: [] },
    { id: 7, label: 'Contact animal control', type: 'CONTACT_ANIMAL_CONTROL', completed: false, completions: [] },
    { id: 8, label: 'Call local veterinary offices', type: 'CALL_VETS', completed: false, completions: [] },
    { id: 9, label: 'Contact microchip company', type: 'CONTACT_MICROCHIP', completed: false, completions: [] },
    { id: 10, label: 'Post on social media & lost pet sites', type: 'POST_SOCIAL_MEDIA', completed: false, completions: [] },
    { id: 11, label: 'Contact local rescue groups', type: 'CONTACT_RESCUES', completed: false, completions: [] },
    { id: 12, label: 'Alert mail carriers & delivery drivers', type: 'ALERT_MAIL_CARRIERS', completed: false, completions: [] },
    { id: 13, label: 'Contact nearby businesses', type: 'CONTACT_BUSINESSES', completed: false, completions: [] },
    { id: 14, label: 'Search at dawn/dusk', type: 'SEARCH_DAWN_DUSK', completed: false, completions: [] },
    { id: 15, label: 'Walk area calling their name', type: 'WALK_CALLING', completed: false, completions: [] },
    { id: 16, label: 'Check hiding spots (sheds, garages)', type: 'CHECK_HIDING_SPOTS', completed: false, completions: [] },
    { id: 17, label: 'Search construction sites & dumpsters', type: 'SEARCH_CONSTRUCTION', completed: false, completions: [] },
    { id: 18, label: 'Set up humane trap', type: 'SETUP_TRAP', completed: false, completions: [] },
    { id: 19, label: 'Set up wildlife/security cameras', type: 'SETUP_CAMERAS', completed: false, completions: [] },
    { id: 20, label: 'Check found pet listings online', type: 'CHECK_FOUND_LISTINGS', completed: false, completions: [] },
    { id: 21, label: 'Monitor Craigslist & marketplace sites', type: 'MONITOR_MARKETPLACES', completed: false, completions: [] },
    { id: 22, label: 'File lost pet report with police', type: 'FILE_POLICE_REPORT', completed: false, completions: [] },
    { id: 23, label: 'Contact local dog parks & pet stores', type: 'CONTACT_PET_LOCATIONS', completed: false, completions: [] },
    { id: 24, label: 'Alert schools in the area', type: 'ALERT_SCHOOLS', completed: false, completions: [] },
    { id: 25, label: 'Contact breed-specific rescue groups', type: 'CONTACT_BREED_RESCUES', completed: false, completions: [] },
  ];

  useEffect(() => {
    if (tasks.length === 0) {
      setTasks(defaultTasks);
    } else if (tasks.length < 25) {
      const upgradedTasks = defaultTasks.map(newTask => {
        const oldTask = tasks.find(t => t.type === newTask.type);
        if (oldTask?.completed) {
          return { ...newTask, completed: oldTask.completed, completions: oldTask.completions };
        }
        return newTask;
      });
      setTasks(upgradedTasks);
    }
  }, []);

  const startGPSTracking = () => {
    if (!('geolocation' in navigator)) {
      alert('GPS not available');
      return;
    }
    setIsGPSTracking(true);
    setGpsPath([]);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPath(prev => [...prev, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        }]);
      },
      () => setIsGPSTracking(false),
      { enableHighAccuracy: true }
    );
    window._gpsWatchId = watchId;
  };

  const stopGPSTracking = () => {
    if (window._gpsWatchId) {
      navigator.geolocation.clearWatch(window._gpsWatchId);
    }
    setIsGPSTracking(false);
    if (gpsPath.length > 0) {
      alert(`Recorded ${gpsPath.length} GPS points. View your search path on the Map tab.`);
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="space-y-4">
      {/* GPS Tracking */}
      <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-4">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Navigation size={18} className="text-purple-400" />
          GPS Search Tracking
        </h3>
        {!isGPSTracking ? (
          <button
            onClick={startGPSTracking}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:scale-105 transition"
          >
            Start GPS Tracking
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-purple-400">
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
              Recording... {gpsPath.length} points
            </div>
            <button
              onClick={stopGPSTracking}
              className="w-full py-3 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold rounded-xl"
            >
              ✓ Done Searching
            </button>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="bg-slate-800/50 border border-flash-500/30 rounded-xl p-4">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <Users size={18} className="text-flash-400" />
          Search Team ({team.length})
        </h3>
        {team.length === 0 ? (
          <p className="text-slate-400">No team members yet</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {team.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-flash-500/20 flex items-center justify-center text-flash-400 font-bold">
                  {member.firstName?.[0]}
                </div>
                <span className="text-white">{member.name}</span>
                {member.isActive && <div className="w-2 h-2 bg-emerald-500 rounded-full" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Checklist Summary */}
      <div className="bg-slate-800/50 border border-emerald-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            Actions ({completedCount}/{tasks.length})
          </h3>
          <button
            onClick={() => setShowCustomActionModal(true)}
            className="text-flash-400 font-semibold"
          >
            + Log Action
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all"
            style={{ width: `${(completedCount / tasks.length) * 100}%` }}
          />
        </div>

        {/* Quick Tasks */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {tasks.slice(0, 10).map(task => (
            <button
              key={task.id}
              onClick={() => setSelectedTask(task)}
              className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition ${
                task.completed
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-slate-900/50 border border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                task.completed ? 'bg-emerald-500 text-white' : 'bg-slate-700 border border-slate-600'
              }`}>
                {task.completed && '✓'}
              </div>
              <span className={`flex-1 text-sm ${task.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                {task.label}
              </span>
            </button>
          ))}
          {tasks.length > 10 && (
            <p className="text-slate-500 text-sm text-center py-2">
              +{tasks.length - 10} more tasks
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MANAGE TAB
// ============================================================================
function ManageTab({ mission, onUpdate }) {
  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-4">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Settings size={18} className="text-purple-400" />
          Case Management
        </h3>
        <div className="space-y-3">
          <button className="w-full py-3 px-4 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold rounded-xl hover:bg-emerald-500/30 transition flex items-center justify-center gap-2">
            <Heart size={18} />
            Mark as Reunited
          </button>
          <button className="w-full py-3 px-4 bg-slate-900 border border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500/50 transition flex items-center justify-center gap-2">
            <Edit size={18} />
            Edit Case Details
          </button>
          <button className="w-full py-3 px-4 bg-slate-900 border border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500/50 transition flex items-center justify-center gap-2">
            <Share2 size={18} />
            Generate Flyer
          </button>
          <button className="w-full py-3 px-4 bg-slate-900 border border-slate-700 text-white font-semibold rounded-xl hover:border-flash-500/50 transition flex items-center justify-center gap-2">
            <Camera size={18} />
            Add Photos
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGettingLocation(false);
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
          .then(r => r.json())
          .then(data => setAddress(data.display_name || ''))
          .catch(() => {});
      },
      () => setGettingLocation(false),
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async () => {
    if (!location) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/sightings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: location.lat, longitude: location.lng, address, description, confidence }),
      });
      if (res.ok) onSuccess();
      else alert('Failed to submit sighting');
    } catch (err) {
      alert('Error submitting sighting');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-900 border-t sm:border border-flash-500/30 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Report Sighting</h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Location */}
          {location ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-emerald-400 font-semibold flex items-center gap-2">
                <CheckCircle2 size={18} />
                Location captured
              </p>
              <p className="text-slate-400 text-sm mt-1">{address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}</p>
            </div>
          ) : (
            <button
              onClick={getCurrentLocation}
              disabled={gettingLocation}
              className="w-full py-4 bg-flash-500/20 border border-flash-500/50 text-flash-400 font-bold rounded-xl"
            >
              {gettingLocation ? 'Getting location...' : 'Use My Current Location'}
            </button>
          )}

          {/* Confidence */}
          <div>
            <label className="text-slate-300 text-sm font-semibold block mb-2">How sure are you?</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'HIGH', label: "It's them!" },
                { value: 'MEDIUM', label: 'Looks like' },
                { value: 'LOW', label: 'Maybe' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setConfidence(opt.value)}
                  className={`py-3 rounded-xl text-sm font-bold transition ${
                    confidence === opt.value
                      ? 'bg-flash-500/20 text-flash-400 border border-flash-500/50'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
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
              placeholder="Direction, behavior, any details..."
              className="w-full bg-slate-800 text-white rounded-xl p-4 border border-slate-700 focus:border-flash-500 focus:outline-none resize-none"
              rows={4}
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-800 text-white font-semibold rounded-xl">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!location || submitting}
            className={`flex-1 py-3 font-bold rounded-xl transition ${
              location && !submitting
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CUSTOM ACTION MODAL
// ============================================================================
function CustomActionModal({ onClose, onComplete }) {
  const [actionName, setActionName] = useState('');
  const [details, setDetails] = useState('');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-900 border-t sm:border border-flash-500/30 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Log Custom Action</h2>
        </div>

        <div className="p-4 space-y-4">
          <input
            type="text"
            value={actionName}
            onChange={(e) => setActionName(e.target.value)}
            placeholder="What did you do?"
            className="w-full bg-slate-800 text-white rounded-xl p-4 border border-slate-700 focus:border-flash-500 focus:outline-none"
          />
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Details (optional)"
            className="w-full bg-slate-800 text-white rounded-xl p-4 border border-slate-700 focus:border-flash-500 focus:outline-none resize-none"
            rows={3}
          />
        </div>

        <div className="p-4 border-t border-slate-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-800 text-white font-semibold rounded-xl">
            Cancel
          </button>
          <button
            onClick={() => onComplete({ actionName, details })}
            disabled={!actionName.trim()}
            className={`flex-1 py-3 font-bold rounded-xl transition ${
              actionName.trim()
                ? 'bg-gradient-to-r from-flash-500 to-flash-400 text-slate-900'
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

// ============================================================================
// MAIN EXPORT
// ============================================================================
export default function MissionControlV3() {
  return (
    <Suspense fallback={<PageLoading message="Initializing Mission Control..." />}>
      <MissionControlV3Content />
    </Suspense>
  );
}
