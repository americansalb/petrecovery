'use client';

/**
 * MissionControlSimple - Full-featured Mission Control with navigation
 *
 * Features:
 * - Map: GPS search, sightings, location tracking
 * - Team: Squad members, coordination
 * - Chat: Team communication
 * - Tasks: Actions and assignments
 * - More: Settings, details, share
 *
 * Design: Single-screen, no-scroll with bottom navigation
 */

import { useState, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Loader2, AlertTriangle, MapPin } from 'lucide-react';

// Hooks
import useMissionControl from './hooks/useMissionControl';
import useSearchSession from './hooks/useSearchSession';
import useMissionChat from './hooks/useMissionChat';

// Components
import CompactHeader from './components/simple/CompactHeader';
import BottomNav from './components/simple/BottomNav';
import BottomPanel from './components/simple/BottomPanel';
import LiveSearchOverlay from './components/simple/LiveSearchOverlay';
import TeamPanel from './components/simple/TeamPanel';
import ChatPanel from './components/simple/ChatPanel';
import TasksPanel from './components/simple/TasksPanel';
import MorePanel from './components/simple/MorePanel';
import SightingFormModal from './components/modals/SightingFormModal';

// Dynamic import for map (no SSR)
const SARMapView = dynamic(
  () => import('@/app/components/mission/SARMapView'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <Loader2 size={32} className="animate-spin text-slate-400" />
      </div>
    )
  }
);

function MissionControlContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const missionId = searchParams.get('mission');

  // Navigation state
  const [activeTab, setActiveTab] = useState('map');

  // Main mission state
  const mission = useMissionControl(session);
  const {
    activeMission,
    loading,
    error,
    timeMissing,
    sightings,
    team,
    showSightingForm,
    setShowSightingForm,
    fetchSightings,
    showNotification,
    notification,
    isDeployed,
    isOwner,
    handleJoinMission,
    isJoining,
    activeParticipants,
  } = mission;

  // GPS search session - API returns lastSeenLatitude/lastSeenLongitude
  const lastSeenLocation = (activeMission?.lastSeenLatitude && activeMission?.lastSeenLongitude)
    ? { lat: activeMission.lastSeenLatitude, lng: activeMission.lastSeenLongitude }
    : (activeMission?.lastSeenLat && activeMission?.lastSeenLng)
    ? { lat: activeMission.lastSeenLat, lng: activeMission.lastSeenLng }
    : null;

  const searchSession = useSearchSession(activeMission?.id, lastSeenLocation);
  const {
    isActive: isSearching,
    isStarting,
    isEnding,
    stats,
    formattedDuration,
    path: gpsPath,
    validation,
    startSearch,
    endSearch,
    cancelSearch,
  } = searchSession;

  // Chat - uses mission-level chat API (no squad membership required)
  const chat = useMissionChat(activeMission?.id);

  // Completed tasks (stored in state for now)
  const [completedTasks, setCompletedTasks] = useState([]);

  // Handle tab change
  const handleTabChange = useCallback((tab) => {
    // If searching and trying to leave map, warn user
    if (isSearching && tab !== 'map') {
      // Still allow switching but keep search running
    }
    setActiveTab(tab);
  }, [isSearching]);

  // Handle quick actions from map panel
  const handleQuickAction = useCallback((actionId) => {
    switch (actionId) {
      case 'sighting':
        setShowSightingForm(true);
        break;
      case 'lastSeen':
        if (lastSeenLocation) {
          showNotification('info', 'Centering on last seen location...');
        }
        break;
      case 'share':
        if (navigator.share) {
          navigator.share({
            title: `Help find ${activeMission?.petName}!`,
            text: `Please help us find our missing pet. Share to spread the word!`,
            url: window.location.href
          }).catch(() => {});
        } else {
          navigator.clipboard.writeText(window.location.href);
          showNotification('success', 'Link copied to clipboard!');
        }
        break;
      default:
        showNotification('info', `${actionId} - coming soon!`);
    }
  }, [activeMission, lastSeenLocation, setShowSightingForm, showNotification]);

  // Handle start search
  const handleStartSearch = useCallback(async () => {
    setActiveTab('map'); // Switch to map when starting search
    const result = await startSearch();
    if (result.success) {
      showNotification('success', 'GPS search started! Your path is being tracked.');
    } else {
      showNotification('error', result.error || 'Failed to start search');
    }
  }, [startSearch, showNotification]);

  // Handle end search
  const handleEndSearch = useCallback(async () => {
    const result = await endSearch();
    if (result.success) {
      showNotification('success', `Great work! You earned ${result.points?.total || 0} points!`);
      // Mark search task as completed
      setCompletedTasks(prev => [...prev, 'search']);
    } else {
      showNotification('error', result.error || 'Failed to end search');
    }
  }, [endSearch, showNotification]);

  // Handle exit search (cancel)
  const handleExitSearch = useCallback(async () => {
    await cancelSearch();
    showNotification('info', 'Search cancelled');
  }, [cancelSearch, showNotification]);

  // Handle sighting success
  const handleSightingSuccess = useCallback(() => {
    setShowSightingForm(false);
    fetchSightings();
    showNotification('success', 'Sighting reported! Thank you for helping.');
    setCompletedTasks(prev => [...prev, 'sighting']);
  }, [setShowSightingForm, fetchSightings, showNotification]);

  // Handle task actions
  const handleTaskAction = useCallback((taskId) => {
    switch (taskId) {
      case 'search':
        handleStartSearch();
        setActiveTab('map');
        break;
      case 'sighting':
        setShowSightingForm(true);
        break;
      case 'share':
        handleQuickAction('share');
        setCompletedTasks(prev => [...prev, 'share']);
        break;
      default:
        showNotification('info', `${taskId} action - opening...`);
    }
  }, [handleStartSearch, setShowSightingForm, handleQuickAction, showNotification]);

  // Handle more panel actions
  const handleMoreAction = useCallback((actionId) => {
    switch (actionId) {
      case 'share':
        handleQuickAction('share');
        break;
      case 'details':
        showNotification('info', 'Pet details - opening...');
        break;
      default:
        showNotification('info', `${actionId} - coming soon!`);
    }
  }, [handleQuickAction, showNotification]);

  // Loading state
  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-amber-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading mission...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-950 px-4">
        <div className="text-center max-w-md">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Mission</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No mission selected
  if (!activeMission) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-950 px-4">
        <div className="text-center max-w-md">
          <MapPin size={48} className="text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Case Selected</h2>
          <p className="text-slate-400 mb-4">
            Select a case from your dashboard to view mission control.
          </p>
          <a
            href="/dashboard"
            className="inline-block px-6 py-2 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-400 transition"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Calculate hours elapsed for map
  const hoursElapsed = activeMission.lastSeenAt
    ? Math.floor((Date.now() - new Date(activeMission.lastSeenAt).getTime()) / 3600000)
    : 24;

  // Render the active panel based on tab
  const renderPanel = () => {
    switch (activeTab) {
      case 'map':
        return (
          <div className="flex-1 relative">
            <SARMapView
              center={lastSeenLocation
                ? [lastSeenLocation.lat, lastSeenLocation.lng]
                : [41.8781, -87.6298]
              }
              lastSeen={lastSeenLocation}
              sightings={sightings}
              petSpecies={activeMission.petSpecies}
              hoursElapsed={hoursElapsed}
              gpsPath={gpsPath}
              showLegend={!isSearching}
              interactive={true}
            />

            {/* Map-specific bottom panel */}
            {isSearching ? (
              <LiveSearchOverlay
                formattedDuration={formattedDuration}
                distanceMiles={stats.validatedDistanceMiles}
                estimatedPoints={stats.estimatedPoints}
                transportMethod={stats.transportMethod}
                validation={validation}
                isEnding={isEnding}
                onEndSearch={handleEndSearch}
              />
            ) : (
              <BottomPanel
                isSearching={isSearching}
                isStarting={isStarting}
                isEnding={isEnding}
                onStartSearch={handleStartSearch}
                onEndSearch={handleEndSearch}
                onAction={handleQuickAction}
                estimatedPoints={stats.estimatedPoints}
                disabled={loading}
              />
            )}
          </div>
        );

      case 'team':
        return (
          <TeamPanel
            team={team}
            activeParticipants={activeParticipants}
            isDeployed={isDeployed}
            isOwner={isOwner}
            onJoinMission={handleJoinMission}
            isJoining={isJoining}
          />
        );

      case 'chat':
        return (
          <ChatPanel
            messages={chat.messages}
            onSendMessage={async (msg) => {
              const result = await chat.sendMessage(msg);
              if (!result.success) {
                showNotification('error', result.error || 'Failed to send message');
              }
            }}
            onShareLocation={() => {
              if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const locationMsg = `📍 My location: https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
                    chat.sendMessage(locationMsg);
                  },
                  () => showNotification('error', 'Could not get location')
                );
              }
            }}
            currentUserId={session?.user?.id}
            isLoading={chat.isLoading || chat.isSending}
          />
        );

      case 'tasks':
        return (
          <TasksPanel
            completedTasks={completedTasks}
            onTaskAction={handleTaskAction}
            onStartSearch={handleStartSearch}
            onReportSighting={() => setShowSightingForm(true)}
          />
        );

      case 'more':
        return (
          <MorePanel
            mission={activeMission}
            onAction={handleMoreAction}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden">
      {/* Compact Header */}
      <CompactHeader
        mission={activeMission}
        timeMissing={timeMissing}
        isSearching={isSearching}
        onExitSearch={handleExitSearch}
        onShowSighting={() => setShowSightingForm(true)}
      />

      {/* Main Content Area */}
      {renderPanel()}

      {/* Bottom Navigation - always visible */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadChat={chat.messages.length > 0 ? 0 : 0}
        pendingTasks={completedTasks.length < 9 ? 9 - completedTasks.length : 0}
        isSearching={isSearching}
      />

      {/* Notification toast */}
      {notification && (
        <div className={`
          fixed top-20 left-4 right-4 z-[600]
          p-4 rounded-xl border shadow-lg
          animate-in slide-in-from-top-4 fade-in duration-300
          ${notification.type === 'success'
            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
            : notification.type === 'error'
            ? 'bg-red-500/20 border-red-500/30 text-red-400'
            : 'bg-slate-800 border-slate-700 text-slate-300'
          }
        `}>
          <p className="font-medium text-sm">{notification.message}</p>
        </div>
      )}

      {/* Sighting Form Modal */}
      {showSightingForm && (
        <SightingFormModal
          missionId={activeMission.id}
          onClose={() => setShowSightingForm(false)}
          onSuccess={handleSightingSuccess}
        />
      )}
    </div>
  );
}

export default function MissionControlSimple() {
  return (
    <Suspense fallback={
      <div className="h-[100dvh] flex items-center justify-center bg-slate-950">
        <Loader2 size={40} className="animate-spin text-amber-400" />
      </div>
    }>
      <MissionControlContent />
    </Suspense>
  );
}
