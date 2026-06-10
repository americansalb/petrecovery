'use client';

/**
 * useMissionState - the mission's heartbeat, derived, never stored
 *
 * One screen, adaptive: instead of tabs, Mission Control reflects what
 * is true right now. Everything here is derived from data the existing
 * polls already deliver; there is no new endpoint and no persisted
 * state machine to drift out of sync.
 *
 * State priority (first match wins):
 *   REUNITED > CLOSED > SIGHTING_HOT > SEARCH_LIVE > JUST_REPORTED
 *
 * Adding a state = add an entry to MISSION_STATES and a clause to
 * deriveStateId. Nothing else changes.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

const HOT_SIGHTING_WINDOW_MS = 60 * 60 * 1000; // sightings under an hour old re-anchor the search

export const MISSION_STATES = {
  JUST_REPORTED: {
    id: 'JUST_REPORTED',
    chipClass: 'bg-red-500/15 text-red-300 border border-red-500/40',
    dotClass: 'bg-red-400',
    pulse: true,
  },
  SEARCH_LIVE: {
    id: 'SEARCH_LIVE',
    chipClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
    dotClass: 'bg-emerald-400',
    pulse: true,
  },
  SIGHTING_HOT: {
    id: 'SIGHTING_HOT',
    chipClass: 'bg-flash-400/15 text-flash-300 border border-flash-400/40',
    dotClass: 'bg-flash-400',
    pulse: true,
  },
  REUNITED: {
    id: 'REUNITED',
    chipClass: 'bg-emerald-500 text-midnight-950 border border-emerald-400 font-bold',
    dotClass: 'bg-midnight-950',
    pulse: false,
  },
  CLOSED: {
    id: 'CLOSED',
    chipClass: 'bg-slate-700/60 text-slate-300 border border-slate-600',
    dotClass: 'bg-slate-400',
    pulse: false,
  },
};

export const ROLES = {
  OWNER: 'OWNER',
  HELPER: 'HELPER',
  VISITOR: 'VISITOR',
};

export function timeAgoShort(date, now = Date.now()) {
  if (!date) return null;
  const ms = now - new Date(date).getTime();
  if (ms < 0) return 'now';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function deriveStateId({ mission, hotSighting, isSearching, activeSearcherCount, participantCount }) {
  if (!mission) return 'JUST_REPORTED';
  if (mission.status === 'REUNITED' || mission.resolution === 'REUNITED') return 'REUNITED';
  if (mission.status === 'CLOSED_OTHER') return 'CLOSED';
  if (hotSighting) return 'SIGHTING_HOT';
  if (isSearching || activeSearcherCount > 0 || participantCount > 0) return 'SEARCH_LIVE';
  return 'JUST_REPORTED';
}

export default function useMissionState({
  mission,
  session,
  sightings = [],
  isSearching = false,
  activeSearcherCount = 0,
  activeParticipants = [],
  lastPollAt = null,
}) {
  // A slow shared clock so "14m ago" labels stay honest without
  // re-rendering every second
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Newest sighting, and whether it is hot (under an hour old)
  const newestSighting = useMemo(() => {
    if (!sightings.length) return null;
    return [...sightings].sort(
      (a, b) => new Date(b.sightedAt || b.createdAt) - new Date(a.sightedAt || a.createdAt)
    )[0];
  }, [sightings]);

  const hotSighting = useMemo(() => {
    if (!newestSighting) return null;
    const at = new Date(newestSighting.sightedAt || newestSighting.createdAt).getTime();
    return now - at <= HOT_SIGHTING_WINDOW_MS ? newestSighting : null;
  }, [newestSighting, now]);

  const stateId = deriveStateId({
    mission,
    hotSighting,
    isSearching,
    activeSearcherCount,
    participantCount: activeParticipants.length,
  });

  // Role: owner outranks helper outranks visitor
  const userId = session?.user?.id;
  const role = useMemo(() => {
    if (!mission || !userId) return ROLES.VISITOR;
    if (mission.reporterId === userId) return ROLES.OWNER;
    if (isSearching || activeParticipants.some((p) => p.userId === userId)) return ROLES.HELPER;
    return ROLES.VISITOR;
  }, [mission, userId, isSearching, activeParticipants]);

  // The 10-second brief: shown once per mission to anyone who is not
  // the owner, then never again on this device
  const briefKey = mission?.id ? `mc_briefed_${mission.id}` : null;
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  useEffect(() => {
    if (!briefKey || role === ROLES.OWNER) {
      setIsFirstVisit(false);
      return;
    }
    try {
      setIsFirstVisit(!localStorage.getItem(briefKey));
    } catch (e) {
      setIsFirstVisit(false);
    }
  }, [briefKey, role]);

  const markBriefed = useCallback(() => {
    try {
      if (briefKey) localStorage.setItem(briefKey, String(Date.now()));
    } catch (e) {}
    setIsFirstVisit(false);
  }, [briefKey]);

  // Elapsed-since-missing, short form, for the header chip
  const missingFor = useMemo(() => {
    if (!mission?.lastSeenAt) return null;
    const hours = Math.floor((now - new Date(mission.lastSeenAt).getTime()) / 3600000);
    if (hours < 1) return 'under 1h';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }, [mission?.lastSeenAt, now]);

  // Header chip text per state
  const chipLabel = useMemo(() => {
    switch (stateId) {
      case 'REUNITED': return 'Reunited';
      case 'CLOSED': return 'Closed';
      case 'SIGHTING_HOT': return `Sighted ${timeAgoShort(hotSighting?.sightedAt || hotSighting?.createdAt, now)}`;
      case 'SEARCH_LIVE': {
        const n = Math.max(activeSearcherCount, isSearching ? 1 : 0);
        return n > 0 ? `LIVE, ${n} searching` : 'LIVE';
      }
      default: return missingFor ? `Missing ${missingFor}` : 'Missing';
    }
  }, [stateId, hotSighting, now, activeSearcherCount, isSearching, missingFor]);

  const updatedAgo = lastPollAt ? timeAgoShort(lastPollAt, now) : null;

  return {
    state: MISSION_STATES[stateId],
    stateId,
    chipLabel,
    role,
    isOwner: role === ROLES.OWNER,
    isFirstVisit,
    markBriefed,
    hotSighting,
    newestSighting,
    missingFor,
    updatedAgo,
    now,
  };
}
