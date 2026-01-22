'use client';

/**
 * Debug Context for Mission Control
 *
 * Allows admins to override algorithm variables for testing:
 * - Current time (test dawn/dusk/night bonuses)
 * - Hours missing (test phase transitions)
 * - User role (test owner vs force views)
 * - User location (test proximity bonuses)
 * - Pet type (test cat vs dog actions)
 */

import { createContext, useContext, useState, useCallback } from 'react';

const DebugContext = createContext(null);

export const DEBUG_PRESETS = {
  'phase1_cat_dawn': {
    name: 'Phase 1 Cat - Dawn',
    description: 'Indoor cat missing 1 hour, 6am, owner nearby',
    hoursMissing: 1,
    simulatedHour: 6,
    petType: 'CAT',
    isIndoor: true,
    role: 'OWNER',
    proximityMiles: 0.5,
    healthCondition: 'NONE',
  },
  'phase2_dog_midday': {
    name: 'Phase 2 Dog - Midday',
    description: 'Medium dog missing 8 hours, 2pm, force member',
    hoursMissing: 8,
    simulatedHour: 14,
    petType: 'DOG',
    petSize: 'MEDIUM',
    role: 'FORCE',
    proximityMiles: 2,
    healthCondition: 'NONE',
  },
  'phase2_cat_dusk': {
    name: 'Phase 2 Cat - Dusk',
    description: 'Outdoor cat missing 18 hours, 6pm, owner',
    hoursMissing: 18,
    simulatedHour: 18,
    petType: 'CAT',
    isIndoor: false,
    role: 'OWNER',
    proximityMiles: 1,
    healthCondition: 'NONE',
  },
  'phase3_cat_night': {
    name: 'Phase 3 Cat - Night',
    description: 'Skittish cat missing 2 days, 10pm, flashlight search',
    hoursMissing: 48,
    simulatedHour: 22,
    petType: 'CAT',
    isIndoor: true,
    temperament: 'SKITTISH',
    role: 'BOTH',
    proximityMiles: 0.3,
    healthCondition: 'NONE',
  },
  'phase4_dog': {
    name: 'Phase 4 Dog - Long term',
    description: 'Large dog missing 5 days, persistence phase',
    hoursMissing: 120,
    simulatedHour: 10,
    petType: 'DOG',
    petSize: 'LARGE',
    role: 'OWNER',
    proximityMiles: 5,
    healthCondition: 'NONE',
  },
  'shelter_open': {
    name: 'Shelter Hours - Open',
    description: 'Test shelter call during business hours',
    hoursMissing: 6,
    simulatedHour: 14,
    petType: 'BOTH',
    role: 'FORCE',
    proximityMiles: 2.5,
    healthCondition: 'NONE',
  },
  'shelter_closed': {
    name: 'Shelter Hours - Closed',
    description: 'Test shelter call after hours',
    hoursMissing: 6,
    simulatedHour: 21,
    petType: 'BOTH',
    role: 'FORCE',
    proximityMiles: 2.5,
    healthCondition: 'NONE',
  },
  'sighting_hot': {
    name: 'Hot Sighting',
    description: 'Sighting 30 min ago, 0.2mi away',
    hoursMissing: 6,
    simulatedHour: 14,
    petType: 'CAT',
    isIndoor: false,
    role: 'BOTH',
    proximityMiles: 0.3,
    sightingHoursAgo: 0.5,
    sightingMilesAway: 0.2,
    healthCondition: 'NONE',
  },
  'medical_urgent': {
    name: 'Medical Emergency',
    description: 'Cat needs insulin, missing 8 hours',
    hoursMissing: 8,
    simulatedHour: 10,
    petType: 'CAT',
    isIndoor: true,
    role: 'OWNER',
    proximityMiles: 1,
    healthCondition: 'MEDICATION_CRITICAL',
  },
  'small_dog_lost': {
    name: 'Small Dog - High Risk',
    description: 'Small vulnerable dog, missing 4 hours',
    hoursMissing: 4,
    simulatedHour: 15,
    petType: 'DOG',
    petSize: 'SMALL',
    role: 'BOTH',
    proximityMiles: 0.5,
    healthCondition: 'NONE',
  },
  'rainy_day': {
    name: 'Rainy Day',
    description: 'Focus on indoor tasks, pets seek shelter',
    hoursMissing: 12,
    simulatedHour: 14,
    petType: 'CAT',
    isIndoor: false,
    role: 'BOTH',
    proximityMiles: 1,
    weather: 'RAIN',
    healthCondition: 'NONE',
  },
  'snow_tracking': {
    name: 'Snow - Track Prints',
    description: 'Fresh snow allows tracking!',
    hoursMissing: 6,
    simulatedHour: 8,
    petType: 'DOG',
    petSize: 'MEDIUM',
    role: 'BOTH',
    proximityMiles: 0.5,
    weather: 'SNOW',
    healthCondition: 'NONE',
  },
  'extreme_cold': {
    name: 'Extreme Cold Emergency',
    description: 'Dangerous weather, high urgency',
    hoursMissing: 4,
    simulatedHour: 10,
    petType: 'CAT',
    isIndoor: true,
    role: 'OWNER',
    proximityMiles: 0.3,
    weather: 'EXTREME_COLD',
    healthCondition: 'NONE',
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
    role: 'OWNER', // OWNER or FORCE

    // Location override
    useRealLocation: true,
    proximityMiles: 1,

    // Pet type override
    useRealPetType: true,
    petType: 'CAT',

    // Pet profile overrides (NEW)
    useRealPetProfile: true,
    isIndoor: true, // For cats: indoor vs outdoor
    petSize: 'MEDIUM', // For dogs: SMALL, MEDIUM, LARGE

    // Health urgency override (NEW)
    useRealHealth: true,
    healthCondition: 'NONE', // NONE, MEDICATION_DAILY, MEDICATION_CRITICAL, SENIOR, PUPPY_KITTEN, MEDICAL_CONDITION

    // Sighting override (NEW)
    useRealSightings: true,
    sightingHoursAgo: 2, // Hours since last sighting
    sightingMilesAway: 0.5, // Distance from task to sighting

    // Task history override for diminishing returns (NEW)
    useRealHistory: true,
    repeatTaskCount: 0, // How many times this task type was completed

    // Weather override (NEW)
    useRealWeather: true,
    weather: 'CLEAR', // CLEAR, CLOUDY, RAIN, HEAVY_RAIN, SNOW, EXTREME_COLD, EXTREME_HEAT, WINDY

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
      // New pet profile overrides
      useRealPetProfile: false,
      isIndoor: preset.isIndoor ?? true,
      petSize: preset.petSize || 'MEDIUM',
      // New health override
      useRealHealth: false,
      healthCondition: preset.healthCondition || 'NONE',
      // New temperament from preset
      useRealTemperament: false,
      temperament: preset.temperament || 'FRIENDLY',
      // Sighting override if present
      useRealSightings: preset.sightingHoursAgo === undefined,
      sightingHoursAgo: preset.sightingHoursAgo ?? 2,
      sightingMilesAway: preset.sightingMilesAway ?? 0.5,
      // Weather override if present
      useRealWeather: preset.weather === undefined,
      weather: preset.weather || 'CLEAR',
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
      useRealPetProfile: true,
      useRealHealth: true,
      useRealSightings: true,
      useRealHistory: true,
      useRealWeather: true,
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

    // Sighting override - create simulated sighting
    if (!overrides.useRealSightings) {
      const sightingTime = new Date();
      sightingTime.setHours(sightingTime.getHours() - overrides.sightingHoursAgo);

      // Create a simulated sighting at the specified distance
      // We'll use task location + offset for simulation
      effective.sightings = [{
        id: 'simulated',
        reportedAt: sightingTime,
        // Latitude/longitude will be calculated relative to task in the algorithm
        // For simulation, we pass the distance directly
        simulatedDistance: overrides.sightingMilesAway,
        latitude: realContext.userLocation?.latitude || 0,
        longitude: realContext.userLocation?.longitude || 0,
      }];
      effective.simulatedSightingDistance = overrides.sightingMilesAway;
    }

    // Task history override for diminishing returns
    if (!overrides.useRealHistory && overrides.repeatTaskCount > 0) {
      const completedTasks = [];
      const now = new Date();
      for (let i = 0; i < overrides.repeatTaskCount; i++) {
        completedTasks.push({
          actionId: '__current__', // Placeholder, will be matched in algorithm
          completedAt: new Date(now - (i + 1) * 4 * 60 * 60 * 1000), // 4 hours apart
        });
      }
      effective.completedTasks = completedTasks;
      effective.simulatedRepeatCount = overrides.repeatTaskCount;
    }

    // Weather override
    if (!overrides.useRealWeather) {
      effective.weather = overrides.weather;
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

    // Pet profile overrides (indoor/outdoor, size)
    if (!overrides.useRealPetProfile) {
      effective.isIndoor = overrides.isIndoor;
      effective.petSize = overrides.petSize;
    }

    // Health urgency override
    if (!overrides.useRealHealth) {
      effective.healthCondition = overrides.healthCondition;
      effective.healthUrgency = overrides.healthCondition;
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
