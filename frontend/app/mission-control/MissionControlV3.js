'use client';

/**
 * Mission Control V3 - Refactored Single-Page Experience
 *
 * Now uses modular components:
 * - Tab components from ./components/tabs/
 * - Modal components from ./components/modals/
 * - State management via useMissionControl hook
 *
 * Layout:
 * - Top: Compact hero with pet info
 * - Middle: Tab navigation
 * - Content: Tab-specific content (scrollable)
 * - Bottom: Mission switcher (if multiple missions)
 *
 * All features from original V3 preserved.
 */

import { Suspense } from 'react';
import { useSession } from 'next-auth/react';

// Components
import WaiverModal from '@/components/WaiverModal';
import TaskCompletionModal from '@/components/case/TaskCompletionModal';
import { PageLoading } from '@/components/LoadingSkeleton';
import { normalizePhotoUrl } from '@/app/lib/utils';

// Extracted Tab Components
import {
  OverviewTab,
  MapTab,
  TeamTab,
  ActivityTab,
  ManageTab,
} from './components/tabs';

// Extracted Modal Components
import {
  MissionsModal,
  SightingFormModal,
  CustomActionModal,
  EmptyState,
} from './components/modals';

// State Management Hook
import useMissionControl from './hooks/useMissionControl';

// Icons
import {
  MapPin,
  Clock,
  Users,
  AlertCircle,
  RefreshCw,
  Shield,
  ChevronLeft,
  ChevronRight,
  Crown,
  Activity as ActivityIcon,
  Settings,
  CheckCircle,
  Info,
  X,
} from 'lucide-react';

function MissionControlV3Content() {
  const { data: session } = useSession();

  // Use centralized state management hook
  const {
    // Mission state
    activeMission,
    availableMissions,
    currentMissionIndex,
    loading,
    switching,
    error,
    missionId,

    // UI state
    activeTab,
    setActiveTab,
    showMissionsModal,
    setShowMissionsModal,
    showWaiverModal,
    setShowWaiverModal,
    showSightingForm,
    setShowSightingForm,
    showCustomActionModal,
    setShowCustomActionModal,
    notification,
    showNotification,

    // Data state
    sightings,
    team,
    gpsPath,
    setGpsPath,
    tasks,
    setTasks,
    isGPSTracking,
    setIsGPSTracking,
    selectedTask,
    setSelectedTask,
    expandedCategories,
    setExpandedCategories,

    // Computed values
    timeMissing,
    isUrgent,
    isReunited,
    isDeployed,
    isOwner,
    activeParticipants,

    // Actions
    fetchMission,
    fetchAvailableMissions,
    fetchSightings,
    goToPrevMission,
    goToNextMission,
    selectMission,
    handleJoinMission,
    startGPSTracking,
    stopGPSTracking,

    // Router
    router,
  } = useMissionControl(session);

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
              onClick={() => {
                if (missionId) fetchMission(missionId);
              }}
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
    { id: 'team', label: 'Actions', icon: CheckCircle },
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

      {/* Toast Notification Banner */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm flex items-center gap-3 animate-in slide-in-from-top-2 ${
          notification.type === 'success' ? 'bg-emerald-500/90 text-white' :
          notification.type === 'error' ? 'bg-red-500/90 text-white' :
          'bg-blue-500/90 text-white'
        }`}>
          {notification.type === 'success' && <CheckCircle size={20} />}
          {notification.type === 'error' && <AlertCircle size={20} />}
          {notification.type === 'info' && <Info size={20} />}
          <span className="flex-1 font-medium text-sm">{notification.message}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* COMPACT HERO SECTION - Pet Photo & Info */}
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
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border-2 border-flash-500/50 shadow-lg shadow-flash-500/20"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-3xl border-2 border-slate-600">
                  {activeMission.petSpecies === 'DOG' ? '🐕' : activeMission.petSpecies === 'CAT' ? '🐈' : '🐾'}
                </div>
              )}
            </div>

            {/* Pet Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-lg sm:text-xl font-bold text-white">
                  {activeMission.petName}
                </h1>
                {timeMissing && !isReunited && (
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                    isUrgent ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-flash-500/20 text-flash-400 border border-flash-500/30'
                  }`}>
                    <Clock size={10} />
                    {timeMissing.text}
                  </span>
                )}
                {isReunited && (
                  <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Reunited
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-sm truncate">
                {activeMission.petBreed || activeMission.petSpecies} • {activeMission.lastSeenAddress?.split(',').slice(0, 2).join(',') || 'Location unknown'}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-flash-400 text-xs font-semibold">{activeParticipants.length} helpers</span>
                <span className="text-amber-400 text-xs font-semibold">{sightings.length} sightings</span>
              </div>
            </div>

            {/* Join Button */}
            {!isReunited && session && (
              <div className="flex-shrink-0">
                {isOwner ? (
                  <div className="p-2 rounded-lg bg-flash-500/10 border border-flash-500/30">
                    <Crown size={20} className="text-flash-400" />
                  </div>
                ) : isDeployed ? (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <Shield size={20} className="text-emerald-400" />
                  </div>
                ) : (
                  <button
                    onClick={handleJoinMission}
                    className="px-3 py-1.5 rounded-lg bg-flash-500 text-slate-900 font-bold text-sm hover:bg-flash-400 transition"
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
      {/* TAB NAVIGATION - Full width mobile-optimized tabs */}
      {/* ============================================================ */}
      <div className="bg-slate-900/80 border-b border-slate-700/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-2">
          <div className="flex items-stretch py-1.5 gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 rounded-lg font-semibold text-xs transition min-h-[52px] ${
                    activeTab === tab.id
                      ? 'bg-flash-500/20 text-flash-400 border border-flash-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon size={20} />
                  <span className="truncate">{tab.label}</span>
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
            sightings={sightings}
            onReportSighting={() => setShowSightingForm(true)}
            onLogActivity={() => setShowCustomActionModal(true)}
            onMessageGroup={() => setActiveTab('team')} // TODO: Open chat modal when implemented
            onNavigateToMap={() => setActiveTab('map')}
          />
        )}

        {activeTab === 'map' && (
          <MapTab
            mission={activeMission}
            sightings={sightings}
            gpsPath={gpsPath}
            onReportSighting={() => setShowSightingForm(true)}
            onStartGPSTracking={startGPSTracking}
            onStopGPSTracking={stopGPSTracking}
            isGPSTracking={isGPSTracking}
          />
        )}

        {activeTab === 'team' && (
          <TeamTab
            mission={activeMission}
            showNotification={showNotification}
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
            onMarkReunited={() => {
              // TODO: Implement mark as reunited
              alert('Mark as reunited functionality coming soon');
            }}
            onEditCase={() => {
              // TODO: Implement edit case
              router.push(`/cases/${activeMission.id}/edit`);
            }}
            onGenerateFlyer={() => {
              // TODO: Implement generate flyer
              router.push(`/cases/${activeMission.id}/flyer`);
            }}
            onAddPhotos={() => {
              // TODO: Implement add photos
              alert('Add photos functionality coming soon');
            }}
          />
        )}
      </div>

      {/* ============================================================ */}
      {/* MISSION SWITCHER - Fixed bottom (if multiple missions) */}
      {/* ============================================================ */}
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
                ? { ...t, completed: true, completions: [...(t.completions || []), completionData] }
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

      {/* Waiver Modal (when mission is loaded) */}
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
// MAIN EXPORT WITH SUSPENSE
// ============================================================================
export default function MissionControlV3() {
  return (
    <Suspense fallback={<PageLoading message="Initializing Mission Control..." />}>
      <MissionControlV3Content />
    </Suspense>
  );
}
