'use client';

/**
 * Debug Context for Mission Control
 *
 * Allows admins to override algorithm variables for testing:
 * - Current time (test dawn/dusk/night bonuses)
 * - Hours missing (test phase transitions)
 * - User role (test owner vs squad views)
 * - User location (test proximity bonuses)
 * - Pet type (test cat vs dog actions)
 */

import { createContext, useContext, useState, useCallback } from 'react';

const DebugContext = createContext(null);

export const DEBUG_PRESETS = {
  'phase1_cat_dawn': {
    name: 'Phase 1 Cat - Dawn',
    description: 'Cat missing 1 hour, 6am, owner nearby',
    hoursMissing: 1,
    simulatedHour: 6,
    petType: 'CAT',
    role: 'OWNER',
    proximityMiles: 0.5,
  },
  'phase2_dog_midday': {
    name: 'Phase 2 Dog - Midday',
    description: 'Dog missing 8 hours, 2pm, squad member',
    hoursMissing: 8,
    simulatedHour: 14,
    petType: 'DOG',
    role: 'SQUAD',
    proximityMiles: 2,
  },
  'phase2_cat_dusk': {
    name: 'Phase 2 Cat - Dusk',
    description: 'Cat missing 18 hours, 6pm, owner',
    hoursMissing: 18,
    simulatedHour: 18,
    petType: 'CAT',
    role: 'OWNER',
    proximityMiles: 1,
  },
  'phase3_cat_night': {
    name: 'Phase 3 Cat - Night',
    description: 'Cat missing 2 days, 10pm, flashlight search',
    hoursMissing: 48,
    simulatedHour: 22,
    petType: 'CAT',
    role: 'BOTH',
    proximityMiles: 0.3,
  },
  'phase4_dog': {
    name: 'Phase 4 Dog - Long term',
    description: 'Dog missing 5 days, persistence phase',
    hoursMissing: 120,
    simulatedHour: 10,
    petType: 'DOG',
    role: 'OWNER',
    proximityMiles: 5,
  },
  'shelter_open': {
    name: 'Shelter Hours - Open',
    description: 'Test shelter call during business hours',
    hoursMissing: 6,
    simulatedHour: 14,
    petType: 'BOTH',
    role: 'SQUAD',
    proximityMiles: 2.5,
  },
  'shelter_closed': {
    name: 'Shelter Hours - Closed',
    description: 'Test shelter call after hours',
    hoursMissing: 6,
    simulatedHour: 21,
    petType: 'BOTH',
    role: 'SQUAD',
    proximityMiles: 2.5,
  },
};

export function DebugProvider({ children, isAdmin = false }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Override states
  const [overrides, setOverrides] = useState({
    // Time overrides
    useRealTime: true,
    simulatedHour: 14, // 2pm default

    // Hours missing override
    useRealHoursMissing: true,
    hoursMissing: 6,

    // Role override
    useRealRole: true,
    role: 'OWNER', // OWNER or SQUAD

    // Location override
    useRealLocation: true,
    proximityMiles: 1,

    // Pet type override
    useRealPetType: true,
    petType: 'CAT',

    // Microchip override
    useRealMicrochip: true,
    isMicrochipped: true,

    // Temperament override
    useRealTemperament: true,
    temperament: 'FRIENDLY', // FRIENDLY or SKITTISH

    // Show score breakdown
    showScoreBreakdown: true,
  });

  // Selected task for detailed breakdown
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const updateOverride = useCallback((key, value) => {
    setOverrides(prev => ({ ...prev, [key]: value }));
  }, []);

  const applyPreset = useCallback((presetKey) => {
    const preset = DEBUG_PRESETS[presetKey];
    if (!preset) return;

    setOverrides(prev => ({
      ...prev,
      useRealTime: false,
      simulatedHour: preset.simulatedHour,
      useRealHoursMissing: false,
      hoursMissing: preset.hoursMissing,
      useRealRole: false,
      role: preset.role,
      useRealLocation: false,
      proximityMiles: preset.proximityMiles,
      useRealPetType: false,
      petType: preset.petType,
    }));
  }, []);

  const resetToReal = useCallback(() => {
    setOverrides(prev => ({
      ...prev,
      useRealTime: true,
      useRealHoursMissing: true,
      useRealRole: true,
      useRealLocation: true,
      useRealPetType: true,
      useRealMicrochip: true,
      useRealTemperament: true,
    }));
  }, []);

  /**
   * Get the effective context for algorithm calculation
   * Merges real values with overrides
   */
  const getEffectiveContext = useCallback((realContext = {}) => {
    if (!isEnabled) {
      return realContext;
    }

    const effective = { ...realContext };

    // Time override
    if (!overrides.useRealTime) {
      const now = new Date();
      now.setHours(overrides.simulatedHour, 0, 0, 0);
      effective.currentTime = now;
    }

    // Hours missing is handled differently - it modifies the case data
    // This is returned separately

    // Location override
    if (!overrides.useRealLocation && realContext.userLocation) {
      // We'll simulate being X miles from task location
      effective.simulatedProximity = overrides.proximityMiles;
    }

    return effective;
  }, [isEnabled, overrides]);

  /**
   * Get effective case data with overrides
   */
  const getEffectiveCaseData = useCallback((realCaseData = {}) => {
    if (!isEnabled) {
      return realCaseData;
    }

    const effective = { ...realCaseData };

    // Hours missing override - adjust missingAt
    if (!overrides.useRealHoursMissing) {
      const now = new Date();
      effective.missingAt = new Date(now - overrides.hoursMissing * 60 * 60 * 1000);
    }

    // Pet type override
    if (!overrides.useRealPetType) {
      effective.petType = overrides.petType;
    }

    // Microchip override
    if (!overrides.useRealMicrochip) {
      effective.isMicrochipped = overrides.isMicrochipped;
    }

    // Temperament override
    if (!overrides.useRealTemperament) {
      effective.temperament = overrides.temperament;
    }

    return effective;
  }, [isEnabled, overrides]);

  /**
   * Get effective user role
   */
  const getEffectiveRole = useCallback((realRole) => {
    if (!isEnabled || overrides.useRealRole) {
      return realRole;
    }
    return overrides.role;
  }, [isEnabled, overrides]);

  const value = {
    // Admin check
    isAdmin,

    // Enable/disable debug mode
    isEnabled,
    setIsEnabled,

    // Panel visibility
    isPanelOpen,
    setIsPanelOpen,

    // Overrides
    overrides,
    updateOverride,

    // Presets
    presets: DEBUG_PRESETS,
    applyPreset,
    resetToReal,

    // Effective values
    getEffectiveContext,
    getEffectiveCaseData,
    getEffectiveRole,

    // Selected task for breakdown
    selectedTaskId,
    setSelectedTaskId,
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const context = useContext(DebugContext);
  if (!context) {
    // Return a no-op version if not wrapped in provider
    return {
      isAdmin: false,
      isEnabled: false,
      isPanelOpen: false,
      overrides: {},
      getEffectiveContext: (ctx) => ctx,
      getEffectiveCaseData: (data) => data,
      getEffectiveRole: (role) => role,
    };
  }
  return context;
}

export default DebugContext;
