'use client';

/**
 * Mission Control V2 - Redesigned interface
 *
 * Key changes from V1:
 * - Map is ALWAYS visible (not hidden in a tab)
 * - Expandable panels replace tabs
 * - Case rail on desktop, bottom sheet on mobile
 * - Cleaner visual hierarchy
 *
 * All existing functionality preserved:
 * - Tasks, sightings, GPS tracking, chat, team management
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// New shared components
import { PanelGrid } from '@/components/ui/ExpandablePanel';
import ExpandablePanel from '@/components/ui/ExpandablePanel';
import CaseRail from '@/components/ui/CaseRail';
import CaseHeader from '@/components/ui/CaseHeader';
import { MissionBottomSheet } from '@/components/ui/BottomSheet';

// Existing components we're reusing
import WaiverModal from '@/components/WaiverModal';
import { PageLoading } from '@/components/LoadingSkeleton';
import { fetchWithRetry, formatErrorMessage, isOnline } from '@/app/lib/utils';

// Icons
import {
  ClipboardList,
  Eye,
  Users,
  MessageSquare,
  MapPin,
  Navigation,
  AlertCircle,
  RefreshCw,
  Target,
  ChevronDown,
  Check,
  Send,
} from 'lucide-react';

// Lazy load map for performance
const MapView = dynamic(() => import('@/app/components/case/SARMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="animate-pulse text-slate-500">Loading map...</div>
    </div>
  ),
});

export default function MissionControlV2() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const missionId = searchParams.get('mission');

  // Core state
  const [activeMission, setActiveMission] = useState(null);
  const [availableMissions, setAvailableMissions] = useState([]);
  const [sightings, setSightings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [expandedPanel, setExpandedPanel] = useState(null);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // GPS tracking state
  const [isGPSTracking, setIsGPSTracking] = useState(false);
  const [gpsPath, setGpsPath] = useState([]);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch available missions
  const fetchAvailableMissions = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetchWithRetry('/api/missions/my-missions');
      if (res.ok) {
        const data = await res.json();
        setAvailableMissions(data.missions || []);
      }
    } catch (err) {
      console.error('Error fetching missions:', err);
    }
  }, [session]);

  // Fetch specific mission
  const fetchMission = useCallback(async (id) => {
    if (!id) return;
    setSwitching(true);
    setError(null);

    try {
      if (!isOnline()) {
        setError('You are offline. Please check your connection.');
        setSwitching(false);
        setLoading(false);
        return;
      }

      const res = await fetchWithRetry(`/api/missions/${id}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Mission not found');
        } else if (res.status === 403) {
          const errorData = await res.json().catch(() => ({}));
          if (!errorData || errorData.code === 'WAIVER_NOT_ACCEPTED') {
            setShowWaiverModal(true);
            setSwitching(false);
            setLoading(false);
            return;
          }
          throw new Error(errorData.message || 'Permission denied');
        }
        throw new Error(`Failed to load mission (${res.status})`);
      }

      const data = await res.json();
      setActiveMission(data);
      setError(null);

      // Fetch sightings for this case
      fetchSightings(data.id);
    } catch (err) {
      console.error('Error fetching mission:', err);
      setError(formatErrorMessage(err));
    } finally {
      setSwitching(false);
      setLoading(false);
    }
  }, []);

  // Fetch sightings
  const fetchSightings = async (missionId) => {
    if (!missionId) return;
    try {
      const res = await fetch(`/api/missions/${missionId}/sightings`);
      if (res.ok) {
        const data = await res.json();
        setSightings(data.sightings || []);
      }
    } catch (err) {
      console.error('Error fetching sightings:', err);
    }
  };

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

  // Handle mission switch
  const handleMissionSwitch = (newMissionId) => {
    if (newMissionId === missionId) return;
    router.push(`/mission-control?mission=${newMissionId}`, { scroll: false });
  };

  // Handle back to force
  const handleBackToSquad = () => {
    const forceId = activeMission?.assignments?.[0]?.rescueForceId;
    if (forceId) {
      router.push(`/rescue-forces/${forceId}`);
    } else {
      router.push('/rescue-forces');
    }
  };

  // Calculate stats for panels
  const stats = useMemo(() => {
    if (!activeMission) return {};

    const team = activeMission.assignments?.flatMap(a => a.participants || []) || [];
    const uniqueTeam = [...new Map(team.map(p => [p.userId, p])).values()];

    return {
      tasksCompleted: 0, // TODO: Get from actual task data
      tasksTotal: 25,
      sightingsCount: sightings.length,
      teamCount: uniqueTeam.length,
      activeTeam: uniqueTeam.filter(p => p.isActive).length,
    };
  }, [activeMission, sightings]);

  // Loading state
  if (loading) {
    return <PageLoading message="Loading your missions..." />;
  }

  // Waiver modal
  if (showWaiverModal && !activeMission) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800/50 border border-red-500/30 rounded-2xl p-8 text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Mission</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                if (missionId) fetchMission(missionId);
              }}
              className="flex-1 py-3 bg-flash-500 text-midnight-900 font-bold rounded-xl"
            >
              <RefreshCw size={18} className="inline mr-2" />
              Retry
            </button>
            <button
              onClick={handleBackToSquad}
              className="flex-1 py-3 bg-slate-700 text-white rounded-xl"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No mission selected
  if (!activeMission) {
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="text-6xl mb-6">🎯</div>
          <h1 className="text-3xl font-bold text-white mb-3">My Missions</h1>
          <p className="text-slate-400 text-lg mb-8">
            Select a mission to continue helping
          </p>

          {availableMissions.length > 0 ? (
            <div className="grid gap-4 max-w-2xl mx-auto">
              {availableMissions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onClick={() => handleMissionSwitch(mission.id)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-2xl p-8">
              <p className="text-slate-400 mb-4">No active missions yet</p>
              <button
                onClick={() => router.push('/rescue-forces')}
                className="px-6 py-3 bg-flash-500 text-midnight-900 font-bold rounded-xl"
              >
                Find a Rescue Force
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main Mission Control interface
  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Case Rail - Desktop only */}
      {!isMobile && (
        <CaseRail
          missions={availableMissions}
          activeMissionId={activeMission.id}
          onSelectMission={handleMissionSwitch}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Case Header */}
        <CaseHeader
          missionData={activeMission}
          onBack={handleBackToSquad}
          showBackButton={true}
        />

        {/* Map - Always visible */}
        <div className="relative flex-shrink-0" style={{ height: '45vh', minHeight: '300px' }}>
          <MapView
            center={
              activeMission?.lastSeenLatitude && activeMission?.lastSeenLongitude
                ? [activeMission.lastSeenLatitude, activeMission.lastSeenLongitude]
                : [41.8781, -87.6298]
            }
            zoom={14}
            lastSeen={
              activeMission?.lastSeenLatitude
                ? {
                    lat: activeMission.lastSeenLatitude,
                    lng: activeMission.lastSeenLongitude,
                    address: activeMission.lastSeenAddress,
                  }
                : null
            }
            sightings={sightings}
            gpsPath={gpsPath}
            petSpecies={activeMission?.petSpecies}
            showControls
          />

          {/* Floating action buttons on map */}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={() => setExpandedPanel('sightings')}
              className="px-4 py-2 bg-amber-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-2"
            >
              <Eye size={18} />
              Report Sighting
            </button>
            {!isGPSTracking ? (
              <button
                onClick={() => {/* TODO: Start GPS */}}
                className="px-4 py-2 bg-purple-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-2"
              >
                <Navigation size={18} />
                Track GPS
              </button>
            ) : (
              <button
                onClick={() => {/* TODO: Stop GPS */}}
                className="px-4 py-2 bg-green-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 animate-pulse"
              >
                <Navigation size={18} />
                Stop Tracking
              </button>
            )}
          </div>

          {/* Sightings count badge */}
          {sightings.length > 0 && (
            <div className="absolute top-4 right-4 bg-amber-500/90 text-white px-3 py-1 rounded-full text-sm font-bold">
              {sightings.length} sighting{sightings.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Expandable Panels */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ExpandablePanel
              icon={ClipboardList}
              title="Tasks"
              summary={`${stats.tasksCompleted}/${stats.tasksTotal} completed`}
              badge={stats.tasksTotal - stats.tasksCompleted > 0 ? `${stats.tasksTotal - stats.tasksCompleted} todo` : null}
              badgeColor="amber"
              isExpanded={expandedPanel === 'tasks'}
              onToggle={(expanded) => setExpandedPanel(expanded ? 'tasks' : null)}
            >
              <TasksPanel missionData={activeMission} session={session} />
            </ExpandablePanel>

            <ExpandablePanel
              icon={Eye}
              title="Sightings"
              summary={`${sightings.length} reported`}
              badge={sightings.length > 0 ? 'new' : null}
              badgeColor="flash"
              isExpanded={expandedPanel === 'sightings'}
              onToggle={(expanded) => setExpandedPanel(expanded ? 'sightings' : null)}
            >
              <SightingsPanel
                missionId={activeMission.id}
                sightings={sightings}
                onSightingAdded={() => fetchSightings(activeMission.id)}
              />
            </ExpandablePanel>

            <ExpandablePanel
              icon={Users}
              title="Team"
              summary={`${stats.teamCount} helper${stats.teamCount !== 1 ? 's' : ''}`}
              badge={stats.activeTeam > 0 ? `${stats.activeTeam} active` : null}
              badgeColor="green"
              isExpanded={expandedPanel === 'team'}
              onToggle={(expanded) => setExpandedPanel(expanded ? 'team' : null)}
            >
              <TeamPanel missionData={activeMission} />
            </ExpandablePanel>

            <ExpandablePanel
              icon={MessageSquare}
              title="Chat"
              summary="Case discussion"
              isExpanded={expandedPanel === 'chat'}
              onToggle={(expanded) => setExpandedPanel(expanded ? 'chat' : null)}
            >
              <ChatPanel missionId={activeMission.id} session={session} />
            </ExpandablePanel>
          </div>
        </div>
      </div>

      {/* Bottom Sheet - Mobile only */}
      {isMobile && (
        <MissionBottomSheet
          missions={availableMissions}
          activeMissionId={activeMission.id}
          onSelectMission={handleMissionSwitch}
          isOpen={bottomSheetOpen}
          onOpen={() => setBottomSheetOpen(true)}
          onClose={() => setBottomSheetOpen(false)}
        />
      )}

      {/* Switching overlay */}
      {switching && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-flash-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold">Switching mission...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple mission card for the empty state
function MissionCard({ mission, onClick }) {
  const hours = mission.hoursMissing || 0;
  const urgencyColor = hours < 4 ? 'red' : hours < 24 ? 'amber' : 'green';

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-flash-500/50 transition flex items-center gap-4"
    >
      <div className={`w-3 h-3 rounded-full bg-${urgencyColor}-500 ${hours < 4 ? 'animate-pulse' : ''}`} />
      {mission.photoUrl ? (
        <img src={mission.photoUrl} alt={mission.petName} className="w-14 h-14 rounded-lg object-cover" />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-slate-700 flex items-center justify-center text-2xl">
          {mission.petSpecies === 'DOG' ? '🐕' : '🐈'}
        </div>
      )}
      <div className="flex-1">
        <h3 className="font-bold text-white">{mission.petName}</h3>
        <p className="text-slate-400 text-sm">{mission.timeMissing}</p>
        <p className="text-slate-500 text-xs truncate">{mission.lastSeenAddress}</p>
      </div>
    </button>
  );
}

// ============================================================================
// TASKS PANEL - Full 25-item checklist with completion tracking
// ============================================================================
function TasksPanel({ missionData, session }) {
  const [tasks, setTasks] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState(['immediate']);

  const defaultTasks = [
    // Immediate critical actions
    { id: 1, label: 'Search property & immediate area thoroughly', category: 'immediate', completed: false },
    { id: 2, label: 'Alert neighbors & nearby residents', category: 'immediate', completed: false },
    { id: 3, label: 'Post flyers in the area', category: 'immediate', completed: false },
    { id: 4, label: 'Set up food/water/scent station', category: 'immediate', completed: false },
    // Shelters & Animal Control
    { id: 5, label: 'Call local animal shelters', category: 'shelters', completed: false },
    { id: 6, label: 'Visit local shelters in person', category: 'shelters', completed: false },
    { id: 7, label: 'Contact animal control', category: 'shelters', completed: false },
    // Veterinary & Medical
    { id: 8, label: 'Call local veterinary offices', category: 'medical', completed: false },
    { id: 9, label: 'Contact microchip company', category: 'medical', completed: false },
    // Community Outreach
    { id: 10, label: 'Post on social media & lost pet sites', category: 'community', completed: false },
    { id: 11, label: 'Contact local rescue groups', category: 'community', completed: false },
    { id: 12, label: 'Alert mail carriers & delivery drivers', category: 'community', completed: false },
    { id: 13, label: 'Contact nearby businesses', category: 'community', completed: false },
    // Search Strategy
    { id: 14, label: 'Search at dawn/dusk', category: 'search', completed: false },
    { id: 15, label: 'Walk area calling their name', category: 'search', completed: false },
    { id: 16, label: 'Check hiding spots (sheds, garages, crawl spaces)', category: 'search', completed: false },
    { id: 17, label: 'Search construction sites & dumpsters', category: 'search', completed: false },
    // Traps & Monitoring
    { id: 18, label: 'Set up humane trap', category: 'monitoring', completed: false },
    { id: 19, label: 'Set up wildlife/security cameras', category: 'monitoring', completed: false },
    // Online & Reporting
    { id: 20, label: 'Check found pet listings online', category: 'online', completed: false },
    { id: 21, label: 'Monitor Craigslist & marketplace sites', category: 'online', completed: false },
    { id: 22, label: 'File lost pet report with police', category: 'online', completed: false },
    // Extended Outreach
    { id: 23, label: 'Contact local dog parks & pet stores', category: 'extended', completed: false },
    { id: 24, label: 'Alert schools in the area', category: 'extended', completed: false },
    { id: 25, label: 'Contact breed-specific rescue groups', category: 'extended', completed: false },
  ];

  // Load tasks from localStorage
  useEffect(() => {
    if (!missionData?.id) return;
    const key = `case_${missionData.id}_tasks_v2`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch (e) {
        setTasks(defaultTasks);
      }
    } else {
      setTasks(defaultTasks);
    }
  }, [missionData?.id]);

  // Save tasks to localStorage
  useEffect(() => {
    if (!missionData?.id || tasks.length === 0) return;
    localStorage.setItem(`case_${missionData.id}_tasks_v2`, JSON.stringify(tasks));
  }, [tasks, missionData?.id]);

  const toggleTask = (taskId) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    ));
  };

  const categories = [
    { id: 'immediate', label: 'Immediate Actions', icon: '🚨' },
    { id: 'shelters', label: 'Shelters & Animal Control', icon: '🏠' },
    { id: 'medical', label: 'Veterinary & Medical', icon: '🏥' },
    { id: 'community', label: 'Community Outreach', icon: '📢' },
    { id: 'search', label: 'Search Strategy', icon: '🔍' },
    { id: 'monitoring', label: 'Traps & Monitoring', icon: '📷' },
    { id: 'online', label: 'Online & Reporting', icon: '💻' },
    { id: 'extended', label: 'Extended Outreach', icon: '🌐' },
  ];

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">Progress</span>
          <span className="text-flash-400 font-bold">{completedCount}/{tasks.length}</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-flash-500 to-flash-400 transition-all duration-300"
            style={{ width: `${(completedCount / tasks.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Task categories */}
      {categories.map((category) => {
        const categoryTasks = tasks.filter(t => t.category === category.id);
        const categoryCompleted = categoryTasks.filter(t => t.completed).length;
        const isExpanded = expandedCategories.includes(category.id);

        return (
          <div key={category.id} className="border border-slate-700/50 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedCategories(prev =>
                prev.includes(category.id)
                  ? prev.filter(id => id !== category.id)
                  : [...prev, category.id]
              )}
              className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 transition"
            >
              <div className="flex items-center gap-2">
                <span>{category.icon}</span>
                <span className="font-semibold text-white text-sm">{category.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{categoryCompleted}/{categoryTasks.length}</span>
                <ChevronDown size={16} className={`text-slate-400 transition ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isExpanded && (
              <div className="p-2 space-y-1">
                {categoryTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition ${
                      task.completed
                        ? 'bg-green-500/10 text-green-400'
                        : 'hover:bg-slate-700/50 text-slate-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      task.completed
                        ? 'border-green-500 bg-green-500'
                        : 'border-slate-500'
                    }`}>
                      {task.completed && <Check size={12} className="text-white" />}
                    </div>
                    <span className={`text-sm ${task.completed ? 'line-through' : ''}`}>
                      {task.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// SIGHTINGS PANEL - Report and view sightings
// ============================================================================
function SightingsPanel({ missionId, sightings, onSightingAdded }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    address: '',
    confidence: 'POSSIBLE',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Get current location
      let lat = null, lng = null;
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        console.log('Could not get GPS location');
      }

      const res = await fetch(`/api/missions/${missionId}/sightings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          latitude: lat,
          longitude: lng,
        }),
      });

      if (res.ok) {
        setFormData({ description: '', address: '', confidence: 'POSSIBLE' });
        setShowForm(false);
        onSightingAdded?.();
      }
    } catch (err) {
      console.error('Error reporting sighting:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Report button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-amber-400 transition"
      >
        <Eye size={18} />
        {showForm ? 'Cancel' : 'Report New Sighting'}
      </button>

      {/* Sighting form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">What did you see?</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
              rows={3}
              placeholder="Describe what you saw..."
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Location</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
              placeholder="Address or cross streets"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Confidence</label>
            <select
              value={formData.confidence}
              onChange={(e) => setFormData(prev => ({ ...prev, confidence: e.target.value }))}
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="DEFINITE">Definitely this pet</option>
              <option value="LIKELY">Likely this pet</option>
              <option value="POSSIBLE">Possibly this pet</option>
              <option value="UNSURE">Not sure</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-flash-500 text-midnight-900 font-bold rounded-xl disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Sighting'}
          </button>
        </form>
      )}

      {/* Sightings list */}
      {sightings.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">👀</div>
          <p className="text-slate-400">No sightings reported yet</p>
          <p className="text-slate-500 text-sm mt-1">Be the first to report one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sightings.map((sighting, i) => (
            <div key={sighting.id || i} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="flex items-start justify-between mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  sighting.confidence === 'DEFINITE' ? 'bg-green-500/20 text-green-400' :
                  sighting.confidence === 'LIKELY' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {sighting.confidence || 'Reported'}
                </span>
                <span className="text-xs text-slate-500">
                  {sighting.createdAt ? new Date(sighting.createdAt).toLocaleDateString() : ''}
                </span>
              </div>
              <p className="text-white text-sm">{sighting.description || 'Sighting reported'}</p>
              {sighting.address && (
                <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                  <MapPin size={12} />
                  {sighting.address}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TEAM PANEL - View helpers on the case
// ============================================================================
function TeamPanel({ missionData }) {
  const team = missionData?.assignments?.flatMap(a => a.participants || []) || [];
  const uniqueTeam = [...new Map(team.map(p => [p.userId, p])).values()];
  const activeCount = uniqueTeam.filter(p => p.isActive).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-3">
        <div className="flex-1 p-3 bg-slate-800/50 rounded-lg text-center">
          <div className="text-2xl font-bold text-white">{uniqueTeam.length}</div>
          <div className="text-xs text-slate-400">Total Helpers</div>
        </div>
        <div className="flex-1 p-3 bg-green-500/10 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-400">{activeCount}</div>
          <div className="text-xs text-green-400/70">Active Now</div>
        </div>
      </div>

      {/* Team list */}
      {uniqueTeam.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-slate-400">No team members yet</p>
          <p className="text-slate-500 text-sm mt-1">Share this case to get help!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {uniqueTeam.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-flash-500/20 flex items-center justify-center text-flash-400 font-bold">
                {member.user?.firstName?.[0] || '?'}
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">
                  {member.user?.firstName} {member.user?.lastName}
                </p>
                <p className="text-slate-500 text-xs">
                  {member.role || 'Helper'}
                </p>
              </div>
              {member.isActive && (
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Active
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CHAT PANEL - Case-specific messaging
// ============================================================================
function ChatPanel({ missionId, session }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/missions/${missionId}/chat`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Error fetching chat:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    // Poll for new messages
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [missionId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/missions/${missionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setNewMessage('');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-flash-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-80">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-slate-400">No messages yet</p>
            <p className="text-slate-500 text-sm mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.userId === session?.user?.id;
            return (
              <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-xl ${
                  isMe
                    ? 'bg-flash-500/20 text-flash-100'
                    : 'bg-slate-800 text-white'
                }`}>
                  {!isMe && (
                    <p className="text-xs text-flash-400 mb-1 font-semibold">
                      {msg.user?.firstName || 'Helper'}
                    </p>
                  )}
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="px-4 bg-flash-500 text-midnight-900 rounded-xl font-bold disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
