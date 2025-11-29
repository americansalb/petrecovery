'use client';

/**
 * SquadContext - Tactical Operations State Management
 *
 * Controls the Map-OS state:
 * - View mode (CITY_WIDE vs SINGLE_CASE_FOCUS)
 * - Selected case for focus
 * - Active volunteers tracking
 * - Alert states (sightings, containment)
 */

import { createContext, useContext, useReducer, useCallback } from 'react';

const SquadContext = createContext(null);

// View modes
export const VIEW_MODES = {
  CITY_WIDE: 'CITY_WIDE',           // All cases visible, squad overview
  SINGLE_CASE: 'SINGLE_CASE',       // Focused on one case
  CONTAINMENT: 'CONTAINMENT',       // Sighting reported, perimeter mode
};

// Alert levels
export const ALERT_LEVELS = {
  NORMAL: 'NORMAL',
  ELEVATED: 'ELEVATED',             // Recent sighting in area
  CRITICAL: 'CRITICAL',             // Confirmed sighting, freeze protocol
};

const initialState = {
  // View state
  viewMode: VIEW_MODES.CITY_WIDE,
  selectedCaseId: null,
  selectedCase: null,

  // Map state
  mapCenter: null,
  mapZoom: 13,

  // Data
  squad: null,
  cases: [],
  volunteers: [],
  myPosition: null,

  // Alert state
  alertLevel: ALERT_LEVELS.NORMAL,
  activeSighting: null,

  // User state
  userRole: null,
  isCheckedIn: false,

  // UI state
  bottomSheetExpanded: false,
  showVolunteerList: false,
};

function squadReducer(state, action) {
  switch (action.type) {
    case 'SET_SQUAD':
      return {
        ...state,
        squad: action.payload,
        mapCenter: action.payload.centerLatitude && action.payload.centerLongitude
          ? [action.payload.centerLatitude, action.payload.centerLongitude]
          : state.mapCenter,
      };

    case 'SET_CASES':
      return { ...state, cases: action.payload };

    case 'SET_VOLUNTEERS':
      return { ...state, volunteers: action.payload };

    case 'SET_USER_ROLE':
      return { ...state, userRole: action.payload };

    case 'SELECT_CASE':
      return {
        ...state,
        viewMode: action.payload ? VIEW_MODES.SINGLE_CASE : VIEW_MODES.CITY_WIDE,
        selectedCaseId: action.payload?.id || null,
        selectedCase: action.payload,
        mapZoom: action.payload ? 16 : 13,
        mapCenter: action.payload?.lastSeenLatitude && action.payload?.lastSeenLongitude
          ? [action.payload.lastSeenLatitude, action.payload.lastSeenLongitude]
          : state.mapCenter,
      };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        viewMode: VIEW_MODES.CITY_WIDE,
        selectedCaseId: null,
        selectedCase: null,
        mapZoom: 13,
        mapCenter: state.squad?.centerLatitude
          ? [state.squad.centerLatitude, state.squad.centerLongitude]
          : state.mapCenter,
      };

    case 'TRIGGER_CONTAINMENT':
      return {
        ...state,
        viewMode: VIEW_MODES.CONTAINMENT,
        alertLevel: ALERT_LEVELS.CRITICAL,
        activeSighting: action.payload,
      };

    case 'CLEAR_CONTAINMENT':
      return {
        ...state,
        viewMode: state.selectedCaseId ? VIEW_MODES.SINGLE_CASE : VIEW_MODES.CITY_WIDE,
        alertLevel: ALERT_LEVELS.NORMAL,
        activeSighting: null,
      };

    case 'CHECK_IN':
      return { ...state, isCheckedIn: true, myPosition: action.payload };

    case 'CHECK_OUT':
      return { ...state, isCheckedIn: false, myPosition: null };

    case 'UPDATE_MY_POSITION':
      return { ...state, myPosition: action.payload };

    case 'TOGGLE_BOTTOM_SHEET':
      return { ...state, bottomSheetExpanded: !state.bottomSheetExpanded };

    case 'SET_BOTTOM_SHEET':
      return { ...state, bottomSheetExpanded: action.payload };

    default:
      return state;
  }
}

export function SquadProvider({ children, initialSquad }) {
  const [state, dispatch] = useReducer(squadReducer, {
    ...initialState,
    squad: initialSquad,
    mapCenter: initialSquad?.centerLatitude
      ? [initialSquad.centerLatitude, initialSquad.centerLongitude]
      : null,
  });

  // Actions
  const selectCase = useCallback((caseData) => {
    dispatch({ type: 'SELECT_CASE', payload: caseData });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const triggerContainment = useCallback((sighting) => {
    dispatch({ type: 'TRIGGER_CONTAINMENT', payload: sighting });
  }, []);

  const clearContainment = useCallback(() => {
    dispatch({ type: 'CLEAR_CONTAINMENT' });
  }, []);

  const checkIn = useCallback((position) => {
    dispatch({ type: 'CHECK_IN', payload: position });
  }, []);

  const checkOut = useCallback(() => {
    dispatch({ type: 'CHECK_OUT' });
  }, []);

  const updatePosition = useCallback((position) => {
    dispatch({ type: 'UPDATE_MY_POSITION', payload: position });
  }, []);

  const setSquad = useCallback((squad) => {
    dispatch({ type: 'SET_SQUAD', payload: squad });
  }, []);

  const setCases = useCallback((cases) => {
    dispatch({ type: 'SET_CASES', payload: cases });
  }, []);

  const setVolunteers = useCallback((volunteers) => {
    dispatch({ type: 'SET_VOLUNTEERS', payload: volunteers });
  }, []);

  const setUserRole = useCallback((role) => {
    dispatch({ type: 'SET_USER_ROLE', payload: role });
  }, []);

  const toggleBottomSheet = useCallback(() => {
    dispatch({ type: 'TOGGLE_BOTTOM_SHEET' });
  }, []);

  const value = {
    ...state,
    dispatch,
    // Actions
    selectCase,
    clearSelection,
    triggerContainment,
    clearContainment,
    checkIn,
    checkOut,
    updatePosition,
    setSquad,
    setCases,
    setVolunteers,
    setUserRole,
    toggleBottomSheet,
  };

  return (
    <SquadContext.Provider value={value}>
      {children}
    </SquadContext.Provider>
  );
}

export function useSquad() {
  const context = useContext(SquadContext);
  if (!context) {
    throw new Error('useSquad must be used within a SquadProvider');
  }
  return context;
}

export default SquadContext;
