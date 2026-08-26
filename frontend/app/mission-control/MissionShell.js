'use client';

/**
 * MissionShell - Mission Control, rebuilt around three questions
 *
 * Every state of this screen answers, in order: What's happening?
 * (situation line + state chip) - What should I do right now? (the
 * ActionDock's ONE primary + the ranked HelpChecklist) - Where? (the
 * map, edge-to-edge under everything, dark cartography).
 *
 * One mission, three instruments:
 *   command (desktop)  - mission panel + operations rail. No GPS.
 *   field (native app) - GPS legs, one-tap actions, big thumbs.
 *   bridge (mobile web)- orient, report, share, join.
 *
 * State, not navigation: JUST_REPORTED / SEARCH_LIVE / SIGHTING_HOT /
 * REUNITED are derived live (useMissionState) and re-skin the header
 * chip, the banner, the dock, and the map. Roles adapt content:
 * owners can close the loop, first-timers get the 10-second brief,
 * visitors get a way in.
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
import useMissionState, { ROLES, timeAgoShort } from './hooks/useMissionState';
import useSearchGrid from './hooks/useSearchGrid';
import useInstrument, { INSTRUMENTS } from '@/app/hooks/useInstrument';
import { calculateProbabilityZones } from '@/app/lib/searchProbability';

import MissionHeader from './components/MissionHeader';
import HotSightingBanner from './components/HotSightingBanner';
import { CoverageStrip, CellActionSheet } from './components/GridHud';
import MapCanvas from './components/MapCanvas';
import { getPrimaryActionId } from './components/ActionDock';
import { markLocalAction } from './components/HelpChecklist';
import BottomSheet, { DETENTS } from './components/sheet/BottomSheet';
import SheetPeek from './components/sheet/SheetPeek';
import SheetBrief from './components/sheet/SheetBrief';
import SheetTeam from './components/sheet/SheetTeam';
import CommandPanel from './components/desktop/CommandPanel';
import OperationsRail from './components/desktop/OperationsRail';
import { buildActivityItems } from './components/regions/ActivityLog';
import SightingFormModal from './components/modals/SightingFormModal';
import FlyerPickerModal from './components/FlyerPickerModal';
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
  const { data: session, status: authStatus } = useSession();
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

  // ----- The search board -----
  // GridCell had a full status machine and zero readers; this hook is the
  // reader. A sighting arriving on the stream also refreshes the sighting
  // pins, so the board and the pins move together.
  const gridBoard = useSearchGrid(activeMission?.id, session?.user?.id, {
    onSighting: fetchSightings,
  });
  const [selectedCellId, setSelectedCellId] = useState(null);
  const selectedCell = useMemo(
    () => gridBoard.cells.find((c) => c.id === selectedCellId) || null,
    [gridBoard.cells, selectedCellId]
  );

  const handleCellClick = useCallback((cell) => {
    gridBoard.clearActionError();
    setSelectedCellId((prev) => (prev === cell.id ? null : cell.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClaimCell = useCallback(async (cellId) => {
    const result = await gridBoard.claim(cellId);
    if (result.success) {
      setSelectedCellId(null);
      showNotification('success', `${result.cell.label} is yours. Walk it, then mark it searched.`);
    }
  }, [gridBoard, showNotification]);

  const handleReleaseCell = useCallback(async (cellId) => {
    const result = await gridBoard.release(cellId);
    if (result.success) {
      setSelectedCellId(null);
      showNotification('info', 'Block released. Thanks for the legwork.');
    }
  }, [gridBoard, showNotification]);

  const handleMarkCellSearched = useCallback(async (cellId) => {
    const result = await gridBoard.markSearched(cellId);
    if (result.success) {
      setSelectedCellId(null);
      const left = Math.max(0, gridBoard.totalCells - gridBoard.searchedCells - 1);
      showNotification('success', `${result.cell.label} searched. ${left} blocks to go.`);
    }
  }, [gridBoard, showNotification]);

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
  const [railTab, setRailTab] = useState('activity');
  const [focusPoint, setFocusPoint] = useState(null);
  const [checklistHighlight, setChecklistHighlight] = useState(false);
  const [showMarkReunited, setShowMarkReunited] = useState(false);
  const [savingReunited, setSavingReunited] = useState(false);
  const [reunitedError, setReunitedError] = useState(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [showFlyerPicker, setShowFlyerPicker] = useState(false);

  const isCommand = instrument === INSTRUMENTS.COMMAND;

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
    const mark = () => markLocalAction(activeMission?.id, 'share');
    if (navigator.share) {
      navigator.share(payload).then(mark).catch(() => {});
    } else {
      navigator.clipboard.writeText(payload.url);
      mark();
      showNotification('success', 'Link copied. Paste it everywhere.');
    }
  }, [activeMission, showNotification]);

  // Primary flyer action: open the picker, which surfaces the on-brand
  // flyers the recovery cascade already generated for this case.
  const handleFlyer = useCallback(() => {
    if (!activeMission) return;
    setShowFlyerPicker(true);
    markLocalAction(activeMission.id, 'flyer');
  }, [activeMission]);

  // Fallback used only when a case has no cascade-generated flyers: a simple
  // server-rendered printable flyer opened in a new tab.
  const handleQuickFlyer = useCallback(async () => {
    if (!activeMission) return;
    // Open the tab synchronously (inside the click gesture) so pop-up
    // blockers don't eat it, show a placeholder, then swap in the finished
    // flyer from the server generator once it's ready.
    const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (win) {
      win.document.write(
        '<!doctype html><meta charset="utf-8"><title>Preparing flyer…</title>' +
        '<body style="font-family:Arial,sans-serif;display:flex;height:100vh;margin:0;align-items:center;justify-content:center;color:#374151">Preparing flyer…</body>'
      );
    }
    try {
      const res = await fetch(`/api/mission/${activeMission.id}/flyers/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: 'full', template: 'classic', includeQrCode: true }),
      });
      if (!res.ok) throw new Error('generate_failed');
      const data = await res.json();
      if (!data?.html) throw new Error('generate_failed');
      if (win) {
        win.document.open();
        win.document.write(data.html);
        win.document.close();
        win.focus();
      }
      markLocalAction(activeMission.id, 'flyer');
      showNotification('success', 'Flyer opened in a new tab.');
    } catch (err) {
      if (win) win.close();
      showNotification(
        'error',
        !win ? 'Allow pop-ups for this site to open the flyer.' : 'Could not generate the flyer.'
      );
    }
  }, [activeMission, showNotification]);

  const handleBoost = useCallback(() => {
    if (activeMission?.caseNumber) router.push(`/cases/${activeMission.caseNumber}`);
  }, [activeMission, router]);

  const handleCallShelters = useCallback(() => {
    if (isCommand) {
      setRailTab('shelters');
    } else {
      setDetent(DETENTS.FULL);
    }
  }, [isCommand]);

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
      setChecklistHighlight(true);
      setTimeout(() => setChecklistHighlight(false), 3500);
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
  const isArchived = ms.stateId === 'REUNITED' || ms.stateId === 'CLOSED';

  const daysSearched = useMemo(() => {
    if (!activeMission?.lastSeenAt) return null;
    const end = activeMission.resolvedAt ? new Date(activeMission.resolvedAt) : new Date();
    const days = Math.max(1, Math.round((end - new Date(activeMission.lastSeenAt)) / 86400000));
    return `${days}d`;
  }, [activeMission?.lastSeenAt, activeMission?.resolvedAt]);

  const vitalsProps = {
    missingFor: ms.missingFor,
    sightingsCount: sightings?.length || 0,
    searchersActive,
    live: !isArchived,
    archived: isArchived,
    searchedFor: daysSearched,
  };

  const dockProps = {
    stateId: ms.stateId,
    role: ms.role,
    instrument,
    resolving: instrumentResolving,
    petName: activeMission?.petName,
    searchersActive,
    hotWhen: ms.hotSighting ? timeAgoShort(ms.hotSighting.sightedAt || ms.hotSighting.createdAt, ms.now) : null,
    isStarting: leg.isStarting,
    isJoining,
    onStartLeg: handleStartLeg,
    onReportSighting: () => setShowSightingForm(true),
    onShare: () => handleShare(isArchived),
    onHeadingThere: handleHeadingThere,
    onJoin: handleJoinMission,
    onSeeCelebration: () => setCelebrationOpen(true),
  };

  const checklistProps = {
    missionId: activeMission?.id,
    petName: activeMission?.petName,
    sheltersTotal: pois?.length || 0,
    showBoost: ms.isOwner && !!activeMission?.adFundEnabled,
    excludeAction: getPrimaryActionId(ms.stateId, ms.role, instrument),
    highlight: checklistHighlight,
    onShare: () => handleShare(false),
    onReportSighting: () => setShowSightingForm(true),
    onFlyer: handleFlyer,
    onCallShelters: handleCallShelters,
    onBoost: handleBoost,
  };

  const briefProps = {
    mission: activeMission,
    now: ms.now,
    checklist: checklistProps,
    activityItems,
    isOwner: ms.isOwner,
    onMarkReunited: () => setShowMarkReunited(true),
    readOnly: isArchived,
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

  // Peek grows for the visitor's two-button dock and the live HUD
  const visitorPeek = ms.role === ROLES.VISITOR && !isArchived;
  const peekHeight = leg.isSearching ? 264 : visitorPeek ? 272 : 208;

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

  // A share link opened without an account used to sit on the spinner
  // forever: fetchMission bails when there is no session and loading never
  // clears. Guests get real doors instead - sign in, or the no-account
  // join flow, which takes sightings too.
  if (authStatus === 'unauthenticated') {
    const target =
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : '/mission-control';
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-950 px-4">
        <div className="text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-2xl bg-flash-400 flex items-center justify-center mx-auto mb-5">
            <MapPin size={30} className="text-midnight-950" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            This search board needs an account
          </h1>
          <p className="text-slate-400 mb-6">
            Mission Control is where the search team coordinates. Sign in to
            open it{missionId ? ', or help right now without an account' : ''}.
          </p>
          <a
            href={`/login?callbackUrl=${encodeURIComponent(target)}`}
            className="block w-full py-3.5 bg-flash-400 text-midnight-950 rounded-xl font-bold hover:bg-flash-300 transition mb-3"
          >
            Sign in
          </a>
          {missionId && (
            <a
              href={`/join/${missionId}`}
              className="block w-full py-3.5 bg-white/5 border border-white/15 text-slate-200 rounded-xl font-semibold hover:bg-white/10 transition"
            >
              Report a sighting or join the search
            </a>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-flash-400 mx-auto mb-4" />
          <p className="text-slate-400">Opening mission control...</p>
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
          <h2 className="text-xl font-bold text-white mb-2">No Mission Selected</h2>
          <p className="text-slate-400 mb-4">Open a mission from your dashboard, or browse active searches near you.</p>
          <div className="flex gap-2 justify-center">
            <a
              href="/dashboard"
              className="inline-block px-5 py-2 bg-flash-400 text-midnight-950 rounded-xl font-semibold hover:bg-flash-300 transition"
            >
              My dashboard
            </a>
            <a
              href="/lost-and-found"
              className="inline-block px-5 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl font-semibold hover:bg-slate-700 transition"
            >
              Lost &amp; Found
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ----- The screen -----
  const hotBanner = ms.stateId === 'SIGHTING_HOT' && ms.hotSighting;

  return (
    <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden">
      <MissionHeader mission={activeMission} state={ms.state} chipLabel={ms.chipLabel} />

      {hotBanner && <HotSightingBanner sighting={ms.hotSighting} now={ms.now} onFocus={handleFocusSighting} />}

      <div className="relative flex-1 min-h-0">
        <MapCanvas
          mission={activeMission}
          lastSeenLocation={lastSeenLocation}
          sightings={sightings}
          searchPath={leg.path}
          coverageData={coverageData}
          pois={pois}
          defaultShowPOIs={isCommand}
          probabilityZones={probabilityZones}
          zoneMultiplier={zoneMultiplier}
          onZoneMultiplierChange={setZoneMultiplier}
          hoursElapsed={hoursElapsed}
          focusPoint={focusPoint}
          isSearching={leg.isSearching}
          keyOffset={isCommand ? { bottom: 24, left: 440 } : { bottom: peekHeight + 16, left: 16 }}
          controlsOffset={isCommand ? { top: 16, right: 380 } : null}
          archived={isArchived}
          gridCells={gridBoard.cells}
          selectedCellId={selectedCellId}
          onCellClick={isArchived ? null : handleCellClick}
        />

        {/* The board's furniture: coverage up top, the one question below */}
        <CoverageStrip
          searched={gridBoard.searchedCells}
          inProgress={gridBoard.inProgressCells}
          total={gridBoard.totalCells}
        />
        {!isArchived && (
          <CellActionSheet
            cell={selectedCell}
            myCell={gridBoard.myCell}
            onClaim={handleClaimCell}
            onRelease={handleReleaseCell}
            onMarkSearched={handleMarkCellSearched}
            onClose={() => { setSelectedCellId(null); gridBoard.clearActionError(); }}
            acting={gridBoard.acting}
            actionError={gridBoard.actionError}
            bottomOffset={isCommand ? 24 : 12}
          />
        )}

        {isCommand ? (
          <>
            <CommandPanel
              mission={activeMission}
              now={ms.now}
              vitals={vitalsProps}
              dock={dockProps}
              checklist={checklistProps}
              activityItems={activityItems}
              isOwner={ms.isOwner}
              onMarkReunited={() => setShowMarkReunited(true)}
              readOnly={isArchived}
            />
            <OperationsRail
              missionId={activeMission.id}
              sightings={sightings}
              completedLegs={coverage.coverage?.completed || []}
              now={ms.now}
              chat={chatProps}
              pois={pois}
              poisLoading={poisLoading}
              activeTab={railTab}
              onTabChange={setRailTab}
              readOnly={isArchived}
            />
          </>
        ) : (
          <BottomSheet detent={detent} onDetentChange={setDetent} peekHeight={peekHeight}>
            <SheetPeek
              isSearching={leg.isSearching}
              hud={hudProps}
              vitals={vitalsProps}
              dock={dockProps}
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
          fixed top-[68px] left-4 right-4 lg:left-auto lg:right-6 lg:w-96 z-[900]
          px-4 py-3 rounded-xl border shadow-xl backdrop-blur-sm
          ${notification.type === 'success'
            ? 'bg-slate-950/95 border-emerald-500/50 text-emerald-300'
            : notification.type === 'error'
              ? 'bg-slate-950/95 border-red-500/50 text-red-300'
              : 'bg-slate-950/95 border-white/10 text-slate-300'
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

      {showFlyerPicker && (
        <FlyerPickerModal
          caseNumber={activeMission.caseNumber || activeMission.missionNumber}
          petName={activeMission.petName}
          onClose={() => setShowFlyerPicker(false)}
          onQuickFlyer={handleQuickFlyer}
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
