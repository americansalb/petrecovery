'use client';

/**
 * MissionControlSimple - Full-featured Mission Control with navigation
 *
 * 3-tab simplified structure (consolidates 5 tabs while preserving all features):
 * - Home: Overview with key info at a glance + contextual tips
 * - Map: GPS tracking + map view + search controls
 * - Team: Members + Chat + Share + Shelters (merged Team + Actions)
 *
 * Tips are now contextual hints woven into each tab instead of a dedicated tab.
 *
 * Design: Single-screen, no-scroll with bottom navigation
 */

import { useState, useCallback, useMemo, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Loader2, AlertTriangle, MapPin } from 'lucide-react';
import WaiverModal from '@/components/WaiverModal';

// Hooks
import useMissionControl from './hooks/useMissionControl';
import useSearchSession from './hooks/useSearchSession';
import useSearchCoverage from './hooks/useSearchCoverage';
import useMissionChat from './hooks/useMissionChat';
import usePOIs from './hooks/usePOIs';
import { calculateProbabilityZones } from '@/app/lib/searchProbability';

// Components
import CompactHeader from './components/simple/CompactHeader';
import BottomNav3Tab from './components/simple/BottomNav3Tab';
import BottomPanel from './components/simple/BottomPanel';
import LiveSearchOverlay from './components/simple/LiveSearchOverlay';
import OverviewPanel from './components/simple/OverviewPanel';
import TeamPanel from './components/simple/TeamPanel';
import SightingFormModal from './components/modals/SightingFormModal';
import AppDownloadPrompt from './components/modals/AppDownloadPrompt';
import ProbabilityZoneToggle from './components/simple/ProbabilityZoneToggle';
import ProbabilityZoneSlider from '@/app/components/mission/ProbabilityZoneSlider';
import ContextualTip, { TIPS } from './components/simple/ContextualTip';
import { printFlyer } from '@/app/lib/flyerGenerator';
import { isNativeAsync } from '@/app/lib/nativeGpsService';

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

  // Navigation state - start on home (overview) in 3-tab structure
  // Tab IDs: 'home', 'map', 'team'
  const [activeTab, setActiveTab] = useState('home');

  // Probability zones toggle - ON by default to guide searchers
  const [showProbabilityZones, setShowProbabilityZones] = useState(true);
  const [zoneMultiplier, setZoneMultiplier] = useState(1); // 1 = original, 0.5 = 50% smaller, 2 = 200% larger

  // App download prompt - shown when web users try to start GPS search
  const [showAppDownloadPrompt, setShowAppDownloadPrompt] = useState(false);

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
    showWaiverModal,
  } = mission;

  // GPS search session - API returns lastSeenLatitude/lastSeenLongitude
  // IMPORTANT: useMemo to prevent new object reference on every render
  const lastSeenLocation = useMemo(() => {
    if (activeMission?.lastSeenLatitude && activeMission?.lastSeenLongitude) {
      return { lat: activeMission.lastSeenLatitude, lng: activeMission.lastSeenLongitude };
    }
    if (activeMission?.lastSeenLat && activeMission?.lastSeenLng) {
      return { lat: activeMission.lastSeenLat, lng: activeMission.lastSeenLng };
    }
    return null;
  }, [activeMission?.lastSeenLatitude, activeMission?.lastSeenLongitude, activeMission?.lastSeenLat, activeMission?.lastSeenLng]);

  // Helper to get time elapsed category
  const getTimeElapsedCategory = useCallback((lastSeenAt) => {
    if (!lastSeenAt) return '6_to_24_hours';
    const hoursAgo = (Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 1) return 'less_than_hour';
    if (hoursAgo < 6) return '1_to_6_hours';
    if (hoursAgo < 24) return '6_to_24_hours';
    if (hoursAgo < 72) return '1_to_3_days';
    if (hoursAgo < 168) return '3_to_7_days';
    if (hoursAgo < 336) return '1_to_2_weeks';
    return 'more_than_2_weeks';
  }, []);

  // Original zone settings (from mission data - read-only for info display)
  const originalZoneSettings = useMemo(() => {
    const baseIsIndoorCat = activeMission?.petDescription?.includes('Indoor cat') ? true :
                            activeMission?.petDescription?.includes('Outdoor access') ? false : null;
    return {
      size: activeMission?.petSize || 'MEDIUM',
      isIndoorCat: baseIsIndoorCat,
      timeElapsed: getTimeElapsedCategory(activeMission?.lastSeenAt),
      age: 'adult',
    };
  }, [activeMission, getTimeElapsedCategory]);

  // Calculate probability zones with multiplier applied
  const probabilityZones = useMemo(() => {
    if (!activeMission || !lastSeenLocation) return null;

    const baseZones = calculateProbabilityZones({
      species: activeMission.petSpecies,
      size: originalZoneSettings.size,
      isIndoorCat: originalZoneSettings.isIndoorCat,
      timeElapsed: originalZoneSettings.timeElapsed,
      age: originalZoneSettings.age,
      lastSeenLocation: [lastSeenLocation.lat, lastSeenLocation.lng],
    });

    // Apply multiplier to zone radii if not 1
    if (baseZones && zoneMultiplier !== 1) {
      return {
        ...baseZones,
        zones: baseZones.zones.map(zone => ({
          ...zone,
          radius: zone.radius * zoneMultiplier,
        })),
      };
    }

    return baseZones;
  }, [activeMission, lastSeenLocation, originalZoneSettings, zoneMultiplier]);

  const searchSession = useSearchSession(activeMission?.id, lastSeenLocation);
  const {
    isActive: isSearching,
    isMarking,
    stats,
    path: gpsPath,
    startSession,
    endSession,
    cancelSession,
    markCurrentLocation,
  } = searchSession;

  // The hook reports duration in minutes; busy flags live here so the
  // buttons can show honest spinners around the async session calls.
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const formattedDuration = useMemo(() => {
    const m = stats.durationMinutes || 0;
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  }, [stats.durationMinutes]);

  // Chat - uses mission-level chat API (no squad membership required)
  const chat = useMissionChat(activeMission?.id);

  // Search coverage - historical trails from all team members
  // Pass current user ID so we can highlight their paths
  const coverage = useSearchCoverage(activeMission?.id, session?.user?.id);
  // Memoize coverage data to prevent re-renders causing trails to jitter
  const coverageData = useMemo(() => coverage.getMapCoverageData(), [coverage.coverage]);

  // POIs - nearby shelters, vets, animal control
  const { pois } = usePOIs(activeMission?.id);

  // Completed tasks (stored in state for now)
  const [completedTasks, setCompletedTasks] = useState([]);

  // Handle tab change
  const handleTabChange = useCallback((tab) => {
    // If searching and trying to leave search tab, still allow it
    // Search continues in background
    setActiveTab(tab);
  }, []);

  // Handle download flyer - MOVED UP to avoid TDZ error
  const handleDownloadFlyer = useCallback(() => {
    if (!activeMission) {
      showNotification('error', 'No mission data available');
      return;
    }

    try {
      printFlyer({
        petName: activeMission.petName,
        petSpecies: activeMission.petSpecies,
        petBreed: activeMission.petBreed,
        petColor: activeMission.petColor,
        petSize: activeMission.petSize,
        petDescription: activeMission.petDescription,
        petPhotoUrl: activeMission.petPhotoUrl,
        lastSeenAt: activeMission.lastSeenAt,
        lastSeenAddress: activeMission.lastSeenAddress,
        hasReward: activeMission.hasReward,
        rewardAmount: activeMission.rewardAmount,
        ownerPhone: activeMission.ownerPhone,
        ownerEmail: activeMission.ownerEmail,
        missionNumber: activeMission.missionNumber || activeMission.caseNumber,
        id: activeMission.id,
      });
      showNotification('success', 'Flyer opened for printing!');
      setCompletedTasks(prev => [...prev, 'flyer']);
    } catch (err) {
      console.error('Failed to generate flyer:', err);
      showNotification('error', 'Failed to generate flyer');
    }
  }, [activeMission, showNotification]);

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
          }).catch(() => { });
        } else {
          navigator.clipboard.writeText(window.location.href);
          showNotification('success', 'Link copied to clipboard!');
        }
        break;
      case 'flyer':
        handleDownloadFlyer();
        break;
      default:
        console.warn(`Unknown quick action: ${actionId}`);
    }
  }, [activeMission, lastSeenLocation, setShowSightingForm, showNotification, handleDownloadFlyer]);

  // Handle start search - check if native app first
  const handleStartSearch = useCallback(async () => {
    // Check if we're in the native app
    const isNative = await isNativeAsync();

    if (!isNative) {
      // Show app download prompt for web users
      setShowAppDownloadPrompt(true);
      return;
    }

    // Native app - proceed with GPS search
    setActiveTab('map'); // Switch to map when starting GPS search
    setIsStarting(true);
    const result = await startSession();
    setIsStarting(false);
    if (result.success) {
      showNotification('success', 'GPS search started! Mark spots as you walk to track your path.');
    } else {
      showNotification('error', result.error || 'Failed to start search');
    }
  }, [startSession, showNotification]);

  // Handle continuing with limited web GPS (user chose to proceed anyway)
  const handleContinueWithWebGPS = useCallback(async () => {
    setShowAppDownloadPrompt(false);
    setActiveTab('map');
    setIsStarting(true);
    const result = await startSession();
    setIsStarting(false);
    if (result.success) {
      showNotification('info', 'GPS search started. Keep the app visible for tracking to work.');
    } else {
      showNotification('error', result.error || 'Failed to start search');
    }
  }, [startSession, showNotification]);

  // Mark the searcher's current GPS spot onto the path
  const handleMarkSpot = useCallback(async () => {
    const result = await markCurrentLocation();
    if (result.success) {
      showNotification('success', 'Spot marked. Keep going!');
    } else if (result.error) {
      showNotification('error', result.error);
    }
  }, [markCurrentLocation, showNotification]);

  // Handle end search
  const handleEndSearch = useCallback(async () => {
    setIsEnding(true);
    const result = await endSession();
    setIsEnding(false);
    if (result.success) {
      showNotification('success', `Great work! You earned ${result.pointsEarned || 0} points!`);
      // Mark search task as completed
      setCompletedTasks(prev => [...prev, 'search']);
    } else {
      showNotification('error', result.error || 'Failed to end search');
    }
  }, [endSession, showNotification]);

  // Handle exit search (cancel)
  const handleExitSearch = useCallback(async () => {
    await cancelSession();
    showNotification('info', 'Search cancelled');
  }, [cancelSession, showNotification]);

  // Handle sighting success
  const handleSightingSuccess = useCallback(() => {
    setShowSightingForm(false);
    fetchSightings();
    showNotification('success', 'Sighting reported! Thank you for helping.');
    setCompletedTasks(prev => [...prev, 'sighting']);
  }, [setShowSightingForm, fetchSightings, showNotification]);

  // Handle share action
  const handleShare = useCallback((platform) => {
    if (navigator.share) {
      navigator.share({
        title: `Help find ${activeMission?.petName}!`,
        text: `Please help us find our missing pet. Share to spread the word!`,
        url: window.location.href
      }).catch(() => { });
    } else {
      navigator.clipboard.writeText(window.location.href);
      showNotification('success', 'Link copied to clipboard!');
    }
    setCompletedTasks(prev => [...prev, 'share']);
  }, [activeMission, showNotification]);

  // Handle view map from overview - 3-tab uses 'map' instead of 'search'
  const handleViewMap = useCallback(() => {
    setActiveTab('map');
  }, []);

  // Handle call shelters - now in Team tab (3-tab structure)
  const handleCallShelters = useCallback(() => {
    setActiveTab('team');
  }, []);

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
    const isAuthError = error.toLowerCase().includes('log in') || error.includes('401');
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-950 px-4">
        <div className="text-center max-w-md">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Mission</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            {isAuthError ? (
              <a
                href={`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                className="px-6 py-2 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-400 transition"
              >
                Log In
              </a>
            ) : (
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Waiver required for volunteers
  if (showWaiverModal) {
    return (
      <WaiverModal
        isOpen={true}
        onAccepted={() => {
          window.location.reload();
        }}
      />
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

  // Render mobile layout with persistent map - 3-tab structure
  const renderMobileLayout = () => {
    // Get species-specific tip for map view
    const mapTip = activeMission.petSpecies === 'CAT'
      ? TIPS.CAT_SEARCH_CLOSE
      : TIPS.DOG_TRAVEL_DIRECTION;

    return (
      <div className="lg:hidden flex-1 relative overflow-hidden h-full">
        {/* 1. Persistent Map Layer (Always mounted) - Tab: 'map' */}
        <div
          className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${activeTab === 'map' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
        >
          <div className="flex-1 relative h-full">
            <SARMapView
              center={lastSeenLocation
                ? [lastSeenLocation.lat, lastSeenLocation.lng]
                : [41.8781, -87.6298]
              }
              lastSeen={lastSeenLocation}
              sightings={sightings}
              petSpecies={activeMission.petSpecies}
              hoursElapsed={hoursElapsed}
              searchPath={gpsPath}
              coverageTrails={coverageData.trails}
              activeSearchersCount={coverageData.activeSearchersCount}
              pois={pois}
              showLegend={!isSearching}
              interactive={activeTab === 'map'} // Only interactive when visible
              showProbabilityZones={showProbabilityZones}
              probabilityZones={probabilityZones}
            />

            {/* Map Contextual Tip - Species-aware search guidance */}
            {!isSearching && (
              <div className="absolute top-4 left-4 right-4 z-20">
                <ContextualTip {...mapTip} />
              </div>
            )}

            {/* Mobile Probability Toggle + Slider - moved to bottom left, out of the way */}
            {!isSearching && lastSeenLocation && (
              <div className="absolute bottom-36 left-4 z-[500] flex flex-col gap-2">
                <ProbabilityZoneToggle
                  show={showProbabilityZones}
                  onToggle={() => setShowProbabilityZones(!showProbabilityZones)}
                />
                {/* Zone adjustment slider - show when zones are visible */}
                {showProbabilityZones && (
                  <ProbabilityZoneSlider
                    originalSettings={originalZoneSettings}
                    currentMultiplier={zoneMultiplier}
                    onMultiplierChange={setZoneMultiplier}
                    onReset={() => setZoneMultiplier(1)}
                    petSpecies={activeMission?.petSpecies}
                  />
                )}
              </div>
            )}

            {/* Mobile Search Controls */}
            {isSearching ? (
              <LiveSearchOverlay
                formattedDuration={formattedDuration}
                durationSeconds={(stats.durationMinutes || 0) * 60}
                distanceMiles={stats.distanceMiles}
                estimatedPoints={stats.estimatedPoints}
                isEnding={isEnding}
                isMarking={isMarking}
                onMark={handleMarkSpot}
                onEndSearch={handleEndSearch}
              />
            ) : (
              <BottomPanel
                isStarting={isStarting}
                onStartSearch={handleStartSearch}
                onReportSighting={() => setShowSightingForm(true)}
                disabled={loading}
              />
            )}
          </div>
        </div>

        {/* 2. Home Panel - Tab: 'home' */}
        {activeTab === 'home' && (
          <div className="absolute inset-0 z-20 bg-slate-950 overflow-y-auto">
            <OverviewPanel
              mission={activeMission}
              timeMissing={timeMissing}
              sightingsCount={sightings?.length || 0}
              teamCount={team?.length || 0}
              searchersActive={activeParticipants?.length || 0}
              recentActivity={[]}
              onStartSearch={handleStartSearch}
              onReportSighting={() => setShowSightingForm(true)}
              onShare={handleShare}
              onViewMap={handleViewMap}
              onCallShelters={handleCallShelters}
              isSearching={isSearching}
              petSpecies={activeMission.petSpecies}
            />
          </div>
        )}

        {/* 3. Team Panel - Tab: 'team' (merged Team + Actions + contextual tips) */}
        {activeTab === 'team' && (
          <div className="absolute inset-0 z-20 bg-slate-950 h-full flex flex-col">
            <TeamPanel
              mission={activeMission}
              team={team}
              activeParticipants={activeParticipants}
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
              isLoadingChat={chat.isLoading || chat.isSending}
              onShare={handleShare}
              onDownloadFlyer={handleDownloadFlyer}
              onCallShelter={(shelter) => {
                showNotification('info', `Calling ${shelter.name}...`);
              }}
            />
          </div>
        )}
      </div>
    );
  };

  // Render sidebar panel content (for desktop) - 3-tab structure with 2 sidebar panels
  const renderSidebarPanel = () => {
    // On desktop, 'map' tab means we focus the map, but sidebar should show Overview
    const effectiveTab = activeTab === 'map' ? 'home' : activeTab;

    switch (effectiveTab) {
      case 'home':
        return (
          <OverviewPanel
            mission={activeMission}
            timeMissing={timeMissing}
            sightingsCount={sightings?.length || 0}
            teamCount={team?.length || 0}
            searchersActive={activeParticipants?.length || 0}
            recentActivity={[]}
            onStartSearch={handleStartSearch}
            onReportSighting={() => setShowSightingForm(true)}
            onShare={handleShare}
            onViewMap={() => setActiveTab('map')}
            onCallShelters={() => setActiveTab('team')}
            isSearching={isSearching}
            petSpecies={activeMission.petSpecies}
          />
        );
      case 'team':
        return (
          <TeamPanel
            mission={activeMission}
            team={team}
            activeParticipants={activeParticipants}
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
            isLoadingChat={chat.isLoading || chat.isSending}
            onShare={handleShare}
            onDownloadFlyer={handleDownloadFlyer}
            onCallShelter={(shelter) => {
              showNotification('info', `Calling ${shelter.name}...`);
            }}
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

      {/* GPS Active Banner - Shows when searching but not on map tab */}
      {isSearching && activeTab !== 'map' && (
        <div
          onClick={() => setActiveTab('map')}
          className="bg-red-600 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-red-500 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="text-white font-bold text-sm">GPS SEARCH ACTIVE</span>
            <span className="text-white/80 text-sm">{formattedDuration} • {(stats?.distanceMiles || 0).toFixed(2)} mi</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEndSearch();
            }}
            disabled={isEnding}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isEnding ? 'Ending...' : 'End Search'}
          </button>
        </div>
      )}

      {/* DESKTOP LAYOUT (lg+): Map + Sidebar */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        {/* Map - Always visible on desktop, takes most of the space */}
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
            searchPath={gpsPath}
            coverageTrails={coverageData.trails}
            activeSearchersCount={coverageData.activeSearchersCount}
            pois={pois}
            showLegend={!isSearching}
            interactive={true}
            showProbabilityZones={showProbabilityZones}
            probabilityZones={probabilityZones}
          />

          {/* Probability Zones Toggle + Slider - Desktop */}
          {!isSearching && lastSeenLocation && (
            <div className="absolute bottom-28 left-6 z-[500] flex flex-col gap-3 max-w-xs">
              <ProbabilityZoneToggle
                show={showProbabilityZones}
                onToggle={() => setShowProbabilityZones(!showProbabilityZones)}
              />
              {/* Zone adjustment slider - show when zones visible */}
              {showProbabilityZones && (
                <ProbabilityZoneSlider
                  originalSettings={originalZoneSettings}
                  currentMultiplier={zoneMultiplier}
                  onMultiplierChange={setZoneMultiplier}
                  onReset={() => setZoneMultiplier(1)}
                  petSpecies={activeMission?.petSpecies}
                />
              )}
            </div>
          )}

          {/* Search controls overlay on map */}
          {isSearching && (
            <LiveSearchOverlay
              formattedDuration={formattedDuration}
              durationSeconds={(stats.durationMinutes || 0) * 60}
              distanceMiles={stats.distanceMiles}
              estimatedPoints={stats.estimatedPoints}
              isEnding={isEnding}
              isMarking={isMarking}
              onMark={handleMarkSpot}
              onEndSearch={handleEndSearch}
            />
          )}
        </div>

        {/* Sidebar - Panel content */}
        <div className="w-[420px] flex flex-col border-l border-slate-800 bg-slate-900">
          {/* Sidebar Tab Navigation - 2 tabs (3-tab structure) */}
          <div className="flex gap-2 p-3 border-b border-slate-800 bg-slate-900/50">
            {[
              { id: 'home', label: 'Overview' },
              { id: 'team', label: 'Team' },
            ].map(tab => {
              const isActive = (activeTab === 'map' ? 'home' : activeTab) === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wide rounded-lg transition-all duration-200 ${isActive
                    ? 'bg-gradient-to-br from-indigo-500/20 to-blue-500/10 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/30'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Sidebar Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {renderSidebarPanel()}
          </div>
        </div>
      </div>

      {/* MOBILE LAYOUT (< lg): Refactored for persistency */}
      {renderMobileLayout()}

      {/* Bottom Navigation - mobile only (3-tab structure) */}
      <div className="lg:hidden">
        <BottomNav3Tab
          activeTab={activeTab}
          onTabChange={handleTabChange}
          unreadChat={chat.unreadCount || 0}
          isSearching={isSearching}
        />
      </div>

      {/* Notification toast */}
      {notification && (
        <div className={`
          fixed top-20 left-4 right-4 lg:left-auto lg:right-6 lg:w-96 z-[600]
          p-4 rounded-xl border shadow-xl backdrop-blur-sm
          animate-in slide-in-from-top-4 fade-in duration-300
          ${notification.type === 'success'
            ? 'bg-slate-900/95 border-emerald-500/50 text-emerald-400'
            : notification.type === 'error'
              ? 'bg-slate-900/95 border-red-500/50 text-red-400'
              : 'bg-slate-900/95 border-slate-700 text-slate-300'
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

      {/* App Download Prompt - shown when web users try to start GPS search */}
      <AppDownloadPrompt
        isOpen={showAppDownloadPrompt}
        onClose={() => setShowAppDownloadPrompt(false)}
        onContinueAnyway={handleContinueWithWebGPS}
      />

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
