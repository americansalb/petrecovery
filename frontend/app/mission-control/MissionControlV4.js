'use client';

/**
 * Mission Control V4 - Complete Redesign
 *
 * Clean 3-view structure:
 * 1. Dashboard - Pet info, Suramaa tips, points, quick actions, activity feed
 * 2. Map - Full-screen map with all layers and floating action buttons
 * 3. Actions - Points header, task categories, leaderboard
 *
 * Plus slide-out menu for settings and owner controls
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';

// Components
import WaiverModal from '@/components/WaiverModal';
import { PageLoading } from '@/components/LoadingSkeleton';
import { normalizePhotoUrl } from '@/app/lib/utils';

// New V4 Tab Components
import DashboardTab from './components/tabs/DashboardTab';
import MapTabV2 from './components/tabs/MapTabV2';
import ActionsTabV2 from './components/tabs/ActionsTabV2';
import MenuDrawer from './components/MenuDrawer';

// Modals
import {
  MissionsModal,
  SightingFormModal,
  EmptyState,
} from './components/modals';

// State Management Hook
import useMissionControl from './hooks/useMissionControl';

// Icons
import {
  Home,
  Map,
  Zap,
  Menu,
  Clock,
  Crown,
  Shield,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function MissionControlV4Content() {
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);

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
    notification,
    showNotification,

    // Data state
    sightings,
    team,
    gpsPath,
    setGpsPath,
    isGPSTracking,
    setIsGPSTracking,

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

  // V4 uses simplified 3-tab structure
  const [v4Tab, setV4Tab] = useState('dashboard'); // 'dashboard' | 'map' | 'actions'

  // Loading state
  if (loading) {
    return <PageLoading message="Loading your missions..." />;
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
              Back to My Missions
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

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'map', label: 'Map', icon: Map },
    { id: 'actions', label: 'Actions', icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Switching overlay */}
      {switching && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-flash-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white font-semibold">Loading...</p>
          </div>
        </div>
      )}

      {/* Toast Notification */}
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
      {/* COMPACT HEADER - Pet Info + Menu Button */}
      {/* ============================================================ */}
      <header className="bg-slate-900/95 border-b border-slate-700/50 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Pet Photo */}
          <div className="flex-shrink-0">
            {activeMission.photoUrl || activeMission.petPhotoUrl ? (
              <img
                src={normalizePhotoUrl(activeMission.photoUrl || activeMission.petPhotoUrl)}
                alt={activeMission.petName}
                className="w-12 h-12 rounded-xl object-cover border-2 border-flash-500/50"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-2xl border-2 border-slate-600">
                {activeMission.petSpecies === 'DOG' ? '🐕' : activeMission.petSpecies === 'CAT' ? '🐈' : '🐾'}
              </div>
            )}
          </div>

          {/* Pet Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-white truncate">
                {activeMission.petName}
              </h1>
              {isOwner && <Crown size={14} className="text-flash-400" />}
              {isDeployed && !isOwner && <Shield size={14} className="text-emerald-400" />}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {timeMissing && !isReunited && (
                <span className={`flex items-center gap-1 ${isUrgent ? 'text-red-400' : 'text-slate-400'}`}>
                  <Clock size={12} />
                  {timeMissing.text}
                </span>
              )}
              {isReunited && (
                <span className="text-emerald-400 font-semibold">Reunited!</span>
              )}
              <span className="text-slate-500">•</span>
              <span className="text-flash-400">{activeParticipants.length} helpers</span>
            </div>
          </div>

          {/* Join Button or Menu */}
          {!isReunited && !isOwner && !isDeployed && (
            <button
              onClick={handleJoinMission}
              className="px-3 py-1.5 rounded-lg bg-flash-500 text-slate-900 font-bold text-sm hover:bg-flash-400 transition flex-shrink-0"
            >
              Join
            </button>
          )}

          <button
            onClick={() => setShowMenu(true)}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition flex-shrink-0"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* MAIN CONTENT AREA */}
      {/* ============================================================ */}
      <main className="flex-1 overflow-hidden">
        {v4Tab === 'dashboard' && (
          <DashboardTab
            mission={activeMission}
            userId={session?.user?.id}
            sightings={sightings}
            team={activeParticipants}
            timeMissing={timeMissing}
            isUrgent={isUrgent}
            isReunited={isReunited}
            isOwner={isOwner}
            onNavigate={setV4Tab}
            onReportSighting={() => setShowSightingForm(true)}
            showNotification={showNotification}
          />
        )}

        {v4Tab === 'map' && (
          <MapTabV2
            mission={activeMission}
            sightings={sightings}
            gpsPath={gpsPath}
            isGPSTracking={isGPSTracking}
            onStartGPS={startGPSTracking}
            onStopGPS={stopGPSTracking}
            onReportSighting={() => setShowSightingForm(true)}
            showNotification={showNotification}
          />
        )}

        {v4Tab === 'actions' && (
          <ActionsTabV2
            mission={activeMission}
            userId={session?.user?.id}
            isOwner={isOwner}
            showNotification={showNotification}
          />
        )}
      </main>

      {/* ============================================================ */}
      {/* BOTTOM TAB BAR */}
      {/* ============================================================ */}
      <nav className="bg-slate-900/95 border-t border-slate-700/50 px-4 py-2 flex-shrink-0 safe-area-bottom">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = v4Tab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setV4Tab(tab.id)}
                className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition ${
                  isActive
                    ? 'text-flash-400 bg-flash-500/10'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ============================================================ */}
      {/* MISSION SWITCHER (if multiple missions) */}
      {/* ============================================================ */}
      {availableMissions.length > 1 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 bg-slate-900/95 backdrop-blur-lg rounded-full px-2 py-1 border border-slate-700 shadow-lg">
            <button
              onClick={goToPrevMission}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setShowMissionsModal(true)}
              className="px-3 py-1 text-white font-medium text-sm"
            >
              {currentMissionIndex + 1} / {availableMissions.length}
            </button>
            <button
              onClick={goToNextMission}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODALS & DRAWERS */}
      {/* ============================================================ */}

      {/* Menu Drawer */}
      {showMenu && (
        <MenuDrawer
          mission={activeMission}
          isOwner={isOwner}
          onClose={() => setShowMenu(false)}
          onNavigate={(tab) => {
            setV4Tab(tab);
            setShowMenu(false);
          }}
          router={router}
        />
      )}

      {/* Missions Modal */}
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
            showNotification({ type: 'success', message: 'Sighting reported!' });
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
export default function MissionControlV4() {
  return (
    <Suspense fallback={<PageLoading message="Loading your missions..." />}>
      <MissionControlV4Content />
    </Suspense>
  );
}
