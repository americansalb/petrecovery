/**
 * Mission Control - Real-time Tactical Coordination
 *
 * The coordination layer that activates when a pet search goes live.
 * Philosophy: "Calm Urgency" - clear, focused, reassuring.
 *
 * Design Principles:
 * - Action over Admin (tap, swipe, walk - no typing)
 * - Probability over Fog (guide to high-probability zones)
 * - Accessible (colorblind-safe, screen reader support)
 * - Works offline, syncs when connected
 */

export { default as MissionState } from './state';
export { default as Activation } from './activation';
export { default as VolunteerOps } from './volunteerOps';
export { default as SightingResponse } from './sightingResponse';
export { default as CommandCenter } from './commandCenter';
export { default as OwnerHub } from './ownerHub';
export { default as EndStates } from './endStates';
export { default as Accessibility } from './accessibility';

// Re-export types
export const OPERATION_MODES = {
  INACTIVE: 'INACTIVE',           // Standard case page
  LIVE_SEARCH: 'LIVE_SEARCH',     // Active walking search
  CONTAINMENT: 'CONTAINMENT',     // Pet sighted, forming perimeter
  TRAP_OPS: 'TRAP_OPS',           // Passive trapping mode
  STANDBY: 'STANDBY',             // Paused but ready
  RESOLVED: 'RESOLVED',           // Pet found
  CLOSED: 'CLOSED',               // Case closed
};

export const VOLUNTEER_STATUS = {
  AVAILABLE: 'AVAILABLE',
  ACTIVE: 'ACTIVE',
  ON_BREAK: 'ON_BREAK',
  RESPONDING: 'RESPONDING',       // En route to sighting
  PERIMETER: 'PERIMETER',         // Holding perimeter position
  OFFLINE: 'OFFLINE',
};

export const SIGHTING_PRIORITY = {
  CONFIRMED: 'CONFIRMED',         // Volunteer is with the pet
  HIGH: 'HIGH',                   // Photo match, recent
  MEDIUM: 'MEDIUM',               // Possible sighting
  LOW: 'LOW',                     // Maybe/uncertain
};

export const ZONE_STATUS = {
  UNSEARCHED: 'UNSEARCHED',
  IN_PROGRESS: 'IN_PROGRESS',
  SEARCHED: 'SEARCHED',
  STALE: 'STALE',                 // Searched but needs re-check
  HIGH_PROBABILITY: 'HIGH_PROBABILITY',
  SIGHTING: 'SIGHTING',           // Recent sighting here
};

// Accessibility color palette (colorblind-safe)
export const COLORS = {
  // Primary actions
  urgent: '#D32F2F',              // Deep red - sighting button
  urgentAlt: '#B71C1C',           // Darker for pressed state

  // Status colors (colorblind-safe: blue/orange/purple)
  active: '#1976D2',              // Blue - active/live
  warning: '#F57C00',             // Orange - attention needed
  success: '#388E3C',             // Green - success (with icon backup)
  neutral: '#616161',             // Gray - inactive

  // Zone colors (pattern + color for accessibility)
  unsearched: '#37474F',          // Dark gray
  searched: '#1565C0',            // Blue
  stale: '#FF8F00',               // Amber
  highProbability: '#7B1FA2',     // Purple
  sighting: '#D32F2F',            // Red

  // UI
  background: '#121212',          // Dark mode base
  surface: '#1E1E1E',             // Cards/panels
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
};
