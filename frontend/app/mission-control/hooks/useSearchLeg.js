'use client';

/**
 * useSearchLeg - the field unit's GPS leg, with honest names
 *
 * Facade over useSearchSession that gives the UI what it actually
 * needs during a live leg:
 *   - correctly named actions (startLeg / endLeg / cancelLeg / markSpot)
 *   - busy flags around the async calls
 *   - a second-level mm:ss timer (the base hook only ticks minutes)
 *   - a 60s auto-mark heartbeat while a leg is live and the screen is
 *     visible, so the path draws itself even if the searcher never
 *     taps Mark
 *
 * Field-only by doctrine: command and bridge instruments never start
 * legs. The auto-mark quietly swallows "too close" rejections; standing
 * still is not an error.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import useSearchSession from './useSearchSession';

const AUTO_MARK_INTERVAL_MS = 60000;

function formatClock(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function useSearchLeg(missionId, lastSeenLocation, { autoMark = true } = {}) {
  const session = useSearchSession(missionId, lastSeenLocation);
  const {
    isActive,
    isMarking,
    path,
    stats,
    startedAt,
    error,
    startSession,
    endSession,
    cancelSession,
    markCurrentLocation,
    undoLastPoint,
    canUndo,
    gpsSupported,
  } = session;

  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Second-level clock while live
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!isActive || !startedAt) {
      setElapsedMs(0);
      return;
    }
    const tick = () => setElapsedMs(Date.now() - startedAt);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [isActive, startedAt]);

  const startLeg = useCallback(async () => {
    setIsStarting(true);
    try {
      return await startSession();
    } finally {
      setIsStarting(false);
    }
  }, [startSession]);

  const endLeg = useCallback(async () => {
    setIsEnding(true);
    try {
      return await endSession();
    } finally {
      setIsEnding(false);
    }
  }, [endSession]);

  const cancelLeg = useCallback(async () => {
    await cancelSession();
  }, [cancelSession]);

  const markSpot = useCallback(async () => {
    return await markCurrentLocation();
  }, [markCurrentLocation]);

  // Auto-mark heartbeat: only while live, only while the app is on
  // screen (GPS in a backgrounded browser tab lies)
  const markRef = useRef(markCurrentLocation);
  markRef.current = markCurrentLocation;
  useEffect(() => {
    if (!autoMark || !isActive) return;
    const beat = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      markRef.current().catch(() => {});
    };
    const t = setInterval(beat, AUTO_MARK_INTERVAL_MS);
    return () => clearInterval(t);
  }, [autoMark, isActive]);

  return {
    isSearching: isActive,
    isStarting,
    isEnding,
    isMarking,
    path,
    stats,
    formattedDuration: formatClock(elapsedMs),
    startLeg,
    endLeg,
    cancelLeg,
    markSpot,
    undoLastPoint,
    canUndo,
    gpsSupported,
    error,
  };
}
