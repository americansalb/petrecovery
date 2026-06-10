'use client';

/**
 * MissionShell - Mission Control, rebuilt from first principles
 *
 * One mission, three instruments:
 *   command (desktop)  - coordinate, document, strategize. No GPS.
 *   field (native app) - GPS legs, one-tap actions, big thumbs.
 *   bridge (mobile web)- orient, report, share, join.
 *
 * One continuous map canvas, never hidden behind tabs. State, not
 * navigation: the screen derives JUST_REPORTED / SEARCH_LIVE /
 * SIGHTING_HOT / REUNITED from live data and adapts the header chip,
 * the primary CTA, and the map. Roles adapt content: owners can close
 * the loop, first-time helpers get the 10-second brief, visitors get
 * a way in.
 */

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle, MapPin } from 'lucide-react';
import WaiverModal from '@/components/WaiverModal';

import useMissionControl from './hooks/useMissionControl';
import useSearchLeg from './hooks/useSearchLeg';
import useMissionChat from './hooks/useMissionChat';
import useSearchCoverage from './hooks/useSearchCoverage';
import usePOIs from './hooks/usePOIs';
import useCaseOutcome from './hooks/useCaseOutcome';
import useMissionState, { ROLES } from './hooks/useMissionState';
import useInstrument, { INSTRUMENTS } from '@/app/hooks/useInstrument';
import { calculateProbabilityZones } from '@/app/lib/searchProbability';
import { printFlyer } from '@/app/lib/flyerGenerator';

import MissionHeader from './components/MissionHeader';
import MapCanvas from './components/MapCanvas';
import BottomSheet, { DETENTS } from './components/sheet/BottomSheet';
import SheetPeek from './components/sheet/SheetPeek';
import SheetBrief from './components/sheet/SheetBrief';
import SheetTeam from './components/sheet/SheetTeam';
import CommandPanel from './components/desktop/CommandPanel';
import OperationsRail from './components/desktop/OperationsRail';
import { buildActivityItems } from './components/regions/ActivityLog';
import SightingFormModal from './components/modals/SightingFormModal';
import HelperBriefOverlay from './components/overlays/HelperBriefOverlay';
import MarkReunitedModal from './components/overlays/MarkReunitedModal';
import ReunitedCelebration from './components/overlays/ReunitedCelebration';

function getTimeElapsedCategory(lastSeenAt) {
  if (!lastSeenAt) return '6_to_24_hours';
  const hoursAgo = (Date.now() - new Date(lastSeenAt).getTime()) / 3600000;
  if (hoursAgo < 1) return 'less_than_hour';
  if (hoursAgo < 6) return '1_to_6_hours';
  if (hoursAgo < 24) return '6_to_24_hours';
  if (hoursAgo < 72) return '1_to_3_days';
  if (hoursAgo < 168) return '3_to_7_days';
  if (hoursAgo < 336) return '1_to_2_weeks';
  return 'more_than_2_weeks';
}

function MissionShellContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const { instrument, resolving: instrumentResolving } = useInstrument();

  // ----- Mission data (fetching, polling, waiver gate, toasts) -----
  const mission = useMissionControl(session);
  const {
    activeMission,
    loading,
    error,
    missionId,
    sightings,
    team,
    activeParticipants,
    showSightingForm,
    setShowSightingForm,
    fetchSightings,
    fetchMission,
    showNotification,
    notification,
    showWaiverModal,
    handleJoinMission,
    isJoining,
    timeMissing,
  } = mission;

  // ----- Geometry and zones (ported intact) -----
  const lastSeenLocation = useMemo(() => {
    if (activeMission?.lastSeenLatitude && activeMission?.lastSeenLongitude) {
      return { lat: activeMission.lastSeenLatitude, lng: activeMission.lastSeenLongitude };
    }
    if (activeMission?.lastSeenLat && activeMission?.lastSeenLng) {
      return { lat: activeMission.lastSeenLat, lng: activeMission.lastSeenLng };
    }
    return null;
  }, [activeMission?.lastSeenLatitude, activeMission?.lastSeenLongitude, activeMission?.lastSeenLat, activeMission?.lastSeenLng]);

  const [zoneMultiplier, setZoneMultiplier] = useState(1);
  const originalZoneSettings = useMemo(() => {
    const baseIsIndoorCat = activeMission?.petDescription?.includes('Indoor cat') ? true :
      activeMission?.petDescription?.includes('Outdoor access') ? false : null;
    return {
      size: activeMission?.petSize || 'MEDIUM',
      isIndoorCat: baseIsIndoorCat,
      timeElapsed: getTimeElapsedCategory(activeMission?.lastSeenAt),
      age: 'adult',
    };
  }, [activeMission]);

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
    if (baseZones && zoneMultiplier !== 1) {
      return {
        ...baseZones,
        zones: baseZones.zones.map((z) => ({ ...z, radius: z.radius * zoneMultiplier })),
      };
    }
    return baseZones;
  }, [activeMission, lastSeenLocation, originalZoneSettings, zoneMultiplier]);

  const hoursElapsed = activeMission?.lastSeenAt
    ? Math.floor((Date.now() - new Date(activeMission.lastSeenAt).getTime()) / 3600000)
    : 24;

  // ----- Live data: legs, coverage, chat, shelters -----
  const leg = useSearchLeg(activeMission?.id, lastSeenLocation);
  const coverage = useSearchCoverage(activeMission?.id, session?.user?.id);
  const coverageData = useMemo(() => coverage.getMapCoverageData(), [coverage.coverage]);
  const chat = useMissionChat(activeMission?.id);
  const { pois, isLoading: poisLoading } = usePOIs(activeMission?.id);
  const outcome = useCaseOutcome(activeMission?.id);

  // ----- The heartbeat -----
  const ms = useMissionState({
    mission: activeMission,
    session,
    sightings,
    isSearching: leg.isSearching,
    activeSearcherCount: coverageData.activeSearchersCount || 0,
    activeParticipants,
    lastPollAt: Date.now(),
  });

  // ----- Local UI state -----
  const [detent, setDetent] = useState(DETENTS.PEEK);
  const [focusPoint, setFocusPoint] = useState(null);
  const [rallyHighlight, setRallyHighlight] = useState(false);
  const [showMarkReunited, setShowMarkReunited] = useState(false);
  const [savingReunited, setSavingReunited] = useState(false);
  const [reunitedError, setReunitedError] = useState(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);

  const isCommand = instrument === INSTRUMENTS.COMMAND;
  const isField = instrument === INSTRUMENTS.FIELD;

  // ----- Celebration: once automatically, replayable forever -----
  const celebratedKey = activeMission?.id ? `mc_celebrated_${activeMission.id}` : null;
  useEffect(() => {
    if (ms.stateId !== 'REUNITED' || !celebratedKey) return;
    try {
      if (!localStorage.getItem(celebratedKey)) setCelebrationOpen(true);
    } catch (e) {}
  }, [ms.stateId, celebratedKey]);

  const closeCelebration = useCallback(() => {
    setCelebrationOpen(false);
    try {
      if (celebratedKey) localStorage.setItem(celebratedKey, '1');
    } catch (e) {}
  }, [celebratedKey]);

  // ----- Auto-focus the map once per hot sighting -----
  const focusedSightingsRef = useRef(new Set());
  useEffect(() => {
    const s = ms.hotSighting;
    if (!s?.id || !s.latitude || !s.longitude) return;
    if (focusedSightingsRef.current.has(s.id)) return;
    focusedSightingsRef.current.add(s.id);
    setFocusPoint({ lat: Number(s.latitude), lng: Number(s.longitude), zoom: 16, key: `sighting-${s.id}` });
  }, [ms.hotSighting]);

  // ----- Deep links: ?action=sighting, ?tab=flyer, ?tab=boost -----
  const deepLinkDoneRef = useRef(false);

  // ----- Actions -----
  const handleShare = useCallback((reunited = false) => {
    const url = typeof window !== 'undefined' ? window.location.href.split('&tab=')[0] : '';
    const name = activeMission?.petName || 'this pet';
    const payload = reunited
      ? { title: `${name} is home!`, text: `Great news: ${name} has been reunited with their family. Thank you to everyone who searched!`, url }
      : { title: `Help find ${name}!`, text: `${name} is missing near ${activeMission?.lastSeenAddress || 'your area'}. Every share is a searcher.`, url };
    if (navigator.share) {
      navigator.share(payload).catch(() => {});
    } else {
      navigator.clipboard.writeText(payload.url);
      showNotification('success', 'Link copied. Paste it everywhere.');
    }
  }, [activeMission, showNotification]);

  const handleFlyer = useCallback(() => {
    if (!activeMission) return;
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
      showNotification('success', 'Flyer opened for printing');
    } catch (err) {
      showNotification('error', 'Could not generate the flyer');
    }
  }, [activeMission, showNotification]);

  const handleBoost = useCallback(() => {
    if (activeMission?.caseNumber) router.push(`/cases/${activeMission.caseNumber}`);
  }, [activeMission, router]);

  const handleStartLeg = useCallback(async () => {
    const result = await leg.startLeg();
    if (result.success) {
      setDetent(DETENTS.PEEK);
      showNotification('success', 'GPS search started. Your path records as you walk.');
    } else if (result.error) {
      showNotification('error', result.error);
    }
  }, [leg, showNotification]);

  const handleMarkSpot = useCallback(async () => {
    const result = await leg.markSpot();
    if (result.success) showNotification('success', 'Spot marked. Keep going!');
    else if (result.error) showNotification('error', result.error);
  }, [leg, showNotification]);

  const handleEndLeg = useCallback(async () => {
    const result = await leg.endLeg();
    if (result.success) {
      showNotification('success', `Great work! You earned ${result.pointsEarned || 0} points.`);
    } else {
      showNotification('error', result.error || 'Could not end the search');
    }
  }, [leg, showNotification]);

  const handleHeadingThere = useCallback(async () => {
    const s = ms.hotSighting;
    if (s?.latitude && s?.longitude) {
      setFocusPoint({ lat: Number(s.latitude), lng: Number(s.longitude), zoom: 17, key: `head-${s.id}-${Date.now()}` });
    }
    if (!leg.isSearching) await handleStartLeg();
  }, [ms.hotSighting, leg.isSearching, handleStartLeg]);

  const handleFocusSighting = useCallback(() => {
    const s = ms.hotSighting || ms.newestSighting;
    if (s?.latitude && s?.longitude) {
      setFocusPoint({ lat: Number(s.latitude), lng: Number(s.longitude), zoom: 16, key: `focus-${s.id}-${Date.now()}` });
      if (!isCommand) setDetent(DETENTS.PEEK);
    }
  }, [ms.hotSighting, ms.newestSighting, isCommand]);

  const handleShareLocation = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        chat.sendMessage(`📍 My location: https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`);
      },
      () => showNotification('error', 'Could not get your location')
    );
  }, [chat, showNotification]);

  const handleSightingSuccess = useCallback(() => {
    setShowSightingForm(false);
    fetchSightings();
    showNotification('success', 'Sighting logged. The whole team can see it.');
  }, [setShowSightingForm, fetchSightings, showNotification]);

  const handleConfirmReunited = useCallback(async ({ resolution, resolutionNotes }) => {
    if (!activeMission?.id) return;
    setSavingReunited(true);
    setReunitedError(null);
    try {
      const res = await fetch(`/api/missions/${activeMission.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REUNITED', resolution, resolutionNotes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Could not update the case');
      }
      // Outcome metrics are best effort; the status flip is the truth
      outcome.closeCase({ outcome: 'REUNITED', foundMethod: resolution, notes: resolutionNotes }).catch(() => {});
      setShowMarkReunited(false);
      try {
        if (celebratedKey) localStorage.removeItem(celebratedKey);
      } catch (e) {}
      await fetchMission(missionId);
      setCelebrationOpen(true);
    } catch (err) {
      setReunitedError(err.message);
    } finally {
      setSavingReunited(false);
    }
  }, [activeMission?.id, outcome, fetchMission, missionId, celebratedKey]);

  // Deep links, once the mission is in hand
  useEffect(() => {
    if (!activeMission || deepLinkDoneRef.current) return;
    deepLinkDoneRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const tab = params.get('tab');
    if (action === 'sighting') setShowSightingForm(true);
    if (tab === 'flyer' || tab === 'boost') {
      setDetent(DETENTS.HALF);
      setRallyHighlight(true);
      setTimeout(() => setRallyHighlight(false), 3500);
      if (tab === 'flyer') setTimeout(() => handleFlyer(), 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMission]);

  // ----- Assemble per-instrument props -----
  const activityItems = useMemo(
    () => buildActivityItems({ sightings, completedLegs: coverage.coverage?.completed || [] }),
    [sightings, coverage.coverage]
  );

  const searchersActive = Math.max(coverageData.activeSearchersCount || 0, activeParticipants.length, leg.isSearching ? 1 : 0);

  const vitalsProps = {
    missingFor: ms.missingFor,
    sightingsCount: sightings?.length || 0,
    searchersActive,
    updatedAgo: 'just now',
  };

  const ctaProps = {
    stateId: ms.stateId,
    role: ms.role,
    instrument,
    resolving: instrumentResolving,
    petName: activeMission?.petName,
    isStarting: leg.isStarting,
    isJoining,
    onStartLeg: handleStartLeg,
    onReportSighting: () => setShowSightingForm(true),
    onShare: () => handleShare(false),
    onHeadingThere: handleHeadingThere,
    onJoin: handleJoinMission,
    onSeeCelebration: () => setCelebrationOpen(true),
  };

  const isArchived = ms.stateId === 'REUNITED' || ms.stateId === 'CLOSED';
  const briefProps = {
    mission: activeMission,
    now: ms.now,
    hotSighting: ms.hotSighting,
    onFocusSighting: handleFocusSighting,
    isOwner: ms.isOwner,
    onMarkReunited: () => setShowMarkReunited(true),
    readOnly: isArchived,
    rally: {
      onShare: () => handleShare(isArchived),
      onFlyer: handleFlyer,
      onBoost: handleBoost,
      showBoost: ms.isOwner && !!activeMission?.adFundEnabled,
      highlight: rallyHighlight,
    },
    activityItems,
  };

  const chatProps = {
    messages: chat.messages,
    onSend: async (text) => {
      const result = await chat.sendMessage(text);
      if (!result.success) showNotification('error', result.error || 'Message failed to send');
    },
    onShareLocation: handleShareLocation,
    currentUserId: session?.user?.id,
    isLoading: chat.isLoading,
    isSending: chat.isSending,
    connected: chat.connected,
  };

  const hudProps = {
    formattedDuration: leg.formattedDuration,
    stats: leg.stats,
    isMarking: leg.isMarking,
    isEnding: leg.isEnding,
    canUndo: leg.canUndo,
    error: leg.error,
    onMark: handleMarkSpot,
    onUndo: leg.undoLastPoint,
    onEnd: handleEndLeg,
  };

  // Peek grows for two-button states and the live HUD
  const twoButtonPeek = ms.stateId === 'JUST_REPORTED' || ms.role === ROLES.VISITOR;
  const peekHeight = leg.isSearching ? 264 : twoButtonPeek && !isArchived ? 252 : 178;

  const celebrationStats = useMemo(() => {
    const m = activeMission;
    let days = null;
    if (m?.lastSeenAt) {
      const end = m.resolvedAt ? new Date(m.resolvedAt) : new Date();
      days = Math.max(1, Math.round((end - new Date(m.lastSeenAt)) / 86400000));
    }
    const trailMiles = (coverage.coverage?.completed || []).reduce((sum, s) => sum + (s.distanceMiles || 0), 0);
    return {
      days,
      searchers: Math.max(team?.length || 0, coverageData.totalSearchers || 0) || null,
      miles: trailMiles > 0 ? trailMiles.toFixed(1) : null,
      sightings: sightings?.length || null,
    };
  }, [activeMission, coverage.coverage, coverageData.totalSearchers, team, sightings]);

  // ----- Gate states (after every hook) -----
  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-flash-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading mission...</p>
        </div>
      </div>
    );
  }

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
                className="px-6 py-2 bg-flash-400 text-midnight-950 rounded-xl font-semibold hover:bg-flash-300 transition"
              >
                Sign in
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

  if (showWaiverModal) {
    return <WaiverModal isOpen={true} onAccepted={() => window.location.reload()} />;
  }

  if (!activeMission) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-950 px-4">
        <div className="text-center max-w-md">
          <MapPin size={48} className="text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Case Selected</h2>
          <p className="text-slate-400 mb-4">Select a case from your dashboard to open mission control.</p>
          <a
            href="/dashboard"
            className="inline-block px-6 py-2 bg-flash-400 text-midnight-950 rounded-xl font-semibold hover:bg-flash-300 transition"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // ----- The screen -----
  return (
    <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden">
      <MissionHeader mission={activeMission} state={ms.state} chipLabel={ms.chipLabel} />

      <div className="relative flex-1">
        <MapCanvas
          mission={activeMission}
          lastSeenLocation={lastSeenLocation}
          sightings={sightings}
          searchPath={leg.path}
          coverageData={coverageData}
          pois={pois}
          showPOIs={isCommand || detent === DETENTS.FULL}
          probabilityZones={probabilityZones}
          originalZoneSettings={originalZoneSettings}
          zoneMultiplier={zoneMultiplier}
          onZoneMultiplierChange={setZoneMultiplier}
          hoursElapsed={hoursElapsed}
          focusPoint={focusPoint}
          isSearching={leg.isSearching}
          bottomInset={isCommand ? 24 : peekHeight + 18}
          leftOffset={isCommand ? 420 : 12}
          controlsOffset={isCommand ? { top: 16, right: 388 } : null}
          legendOffset={isCommand ? { top: 16, left: 410 } : null}
        />

        {isCommand ? (
          <>
            <CommandPanel vitals={vitalsProps} cta={ctaProps} brief={briefProps} />
            <OperationsRail
              missionId={activeMission.id}
              sightings={sightings}
              completedLegs={coverage.coverage?.completed || []}
              now={ms.now}
              chat={chatProps}
              pois={pois}
              poisLoading={poisLoading}
            />
          </>
        ) : (
          <BottomSheet detent={detent} onDetentChange={setDetent} peekHeight={peekHeight}>
            <SheetPeek
              isSearching={leg.isSearching}
              hud={hudProps}
              vitals={vitalsProps}
              cta={ctaProps}
            />
            <div className="mt-4">
              <SheetBrief {...briefProps} />
            </div>
            <div className="mt-4">
              <SheetTeam
                team={team}
                activeParticipants={activeParticipants}
                chat={chatProps}
                pois={pois}
                poisLoading={poisLoading}
                missionId={activeMission.id}
                showGpsHint={instrument === INSTRUMENTS.BRIDGE && !leg.isSearching && !isArchived}
                onTrackAnyway={handleStartLeg}
              />
            </div>
          </BottomSheet>
        )}
      </div>

      {/* Toast */}
      {notification && (
        <div className={`
          fixed top-20 left-4 right-4 lg:left-auto lg:right-6 lg:w-96 z-[900]
          p-4 rounded-xl border shadow-xl backdrop-blur-sm
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

      {/* Modals and overlays */}
      {showSightingForm && (
        <SightingFormModal
          missionId={activeMission.id}
          onClose={() => setShowSightingForm(false)}
          onSuccess={handleSightingSuccess}
        />
      )}

      {showMarkReunited && (
        <MarkReunitedModal
          mission={activeMission}
          onClose={() => setShowMarkReunited(false)}
          onConfirm={handleConfirmReunited}
          isSaving={savingReunited}
          error={reunitedError}
        />
      )}

      {ms.isFirstVisit && !celebrationOpen && !isArchived && (
        <HelperBriefOverlay
          mission={activeMission}
          now={ms.now}
          onStart={() => {
            ms.markBriefed();
            if (!isCommand) setDetent(DETENTS.HALF);
          }}
        />
      )}

      {celebrationOpen && (
        <ReunitedCelebration
          mission={activeMission}
          stats={celebrationStats}
          isHelper={!ms.isOwner}
          onShare={() => handleShare(true)}
          onClose={closeCelebration}
        />
      )}
    </div>
  );
}

export default function MissionShell() {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] flex items-center justify-center bg-slate-950">
          <Loader2 size={40} className="animate-spin text-flash-400" />
        </div>
      }
    >
      <MissionShellContent />
    </Suspense>
  );
}
