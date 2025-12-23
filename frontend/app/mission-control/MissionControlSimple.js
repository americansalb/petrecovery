'use client';

/**
 * MissionControlSimple - Single-screen, no-scroll Mission Control
 *
 * Design goals:
 * - 100dvh viewport - no scrolling
 * - Map fills most of the screen (~70%)
 * - Compact header with essential info
 * - Extensible bottom panel with quick actions
 * - Clean GPS search experience
 */

import { useState, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Loader2, AlertTriangle, MapPin } from 'lucide-react';

// Hooks
import useMissionControl from './hooks/useMissionControl';
import useSearchSession from './hooks/useSearchSession';

// Components
import CompactHeader from './components/simple/CompactHeader';
import BottomPanel from './components/simple/BottomPanel';
import LiveSearchOverlay from './components/simple/LiveSearchOverlay';
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

  // Main mission state
  const mission = useMissionControl(session);
  const {
    activeMission,
    loading,
    error,
    timeMissing,
    sightings,
    showSightingForm,
    setShowSightingForm,
    fetchSightings,
    showNotification,
    notification,
  } = mission;

  // GPS search session
  const lastSeenLocation = activeMission?.lastSeenLat && activeMission?.lastSeenLng
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

  // Handle quick actions
  const handleQuickAction = useCallback((actionId) => {
    switch (actionId) {
      case 'sighting':
        setShowSightingForm(true);
        break;
      case 'lastSeen':
        // Pan map to last seen location
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
      case 'log':
        showNotification('info', 'Activity log coming soon!');
        break;
      default:
        showNotification('info', `${actionId} coming soon!`);
    }
  }, [activeMission, lastSeenLocation, setShowSightingForm, showNotification]);

  // Handle start search
  const handleStartSearch = useCallback(async () => {
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
    } else {
      showNotification('error', result.error || 'Failed to end search');
    }
  }, [endSearch, showNotification]);

  // Handle exit search (cancel without saving)
  const handleExitSearch = useCallback(async () => {
    await cancelSearch();
    showNotification('info', 'Search cancelled');
  }, [cancelSearch, showNotification]);

  // Handle sighting success
  const handleSightingSuccess = useCallback(() => {
    setShowSightingForm(false);
    fetchSightings();
    showNotification('success', 'Sighting reported! Thank you for helping.');
  }, [setShowSightingForm, fetchSightings, showNotification]);

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

      {/* Map Container - fills remaining space */}
      <div className="flex-1 relative overflow-hidden">
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

        {/* Bottom Panel - either quick actions or search overlay */}
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

      {/* Notification toast */}
      {notification && (
        <div className={`
          fixed top-20 left-4 right-4 z-50
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
