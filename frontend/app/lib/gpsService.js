'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  isNative,
  initNativeGPS,
  startNativeGPSTracking,
  stopNativeGPSTracking,
  getNativeGPSPosition,
  openLocationSettings,
} from './nativeGpsService';

/**
 * Centralized GPS Service
 *
 * Solves the problem of multiple competing GPS watchers by providing
 * a single geolocation.watchPosition() that broadcasts to all subscribers.
 *
 * On native platforms (iOS/Android via Capacitor), uses background
 * geolocation for reliable tracking even when the app is backgrounded.
 *
 * Benefits:
 * - Single browser resource (accurate, no conflicts)
 * - Consistent location across all components
 * - Background GPS on native (foreground service on Android, always-on iOS)
 * - Proper cleanup on unmount
 * - Clear error states
 * - Battery-friendly (one watcher, not four)
 */

const GPSContext = createContext(null);

// GPS accuracy modes
export const GPS_MODE = {
  HIGH_ACCURACY: 'high',      // For active searching (more battery)
  BALANCED: 'balanced',       // Default - good accuracy, reasonable battery
  LOW_POWER: 'low',           // For background/passive tracking
};

// Default options per mode
const MODE_OPTIONS = {
  [GPS_MODE.HIGH_ACCURACY]: {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000,
  },
  [GPS_MODE.BALANCED]: {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 20000,
  },
  [GPS_MODE.LOW_POWER]: {
    enableHighAccuracy: false,
    maximumAge: 30000,
    timeout: 30000,
  },
};

export function GPSProvider({ children }) {
  // Current location state
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [usingNative, setUsingNative] = useState(false);

  // Refs for managing the watcher
  const watchIdRef = useRef(null);
  const nativeWatcherIdRef = useRef(null);
  const subscribersRef = useRef(new Set());
  const currentModeRef = useRef(GPS_MODE.BALANCED);
  const isNativeRef = useRef(false);

  // Check if geolocation is supported
  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  // Initialize native GPS on mount
  useEffect(() => {
    if (isNative()) {
      initNativeGPS().then((initialized) => {
        isNativeRef.current = initialized;
        if (initialized) {
          console.log('[GPS Service] Native GPS available - background tracking enabled');
        }
      });
    }
  }, []);

  // Handle position update (supports both web geolocation and native GPS formats)
  const handlePosition = useCallback((position) => {
    let newLocation;

    // Check if this is a native GPS location (has lat/lng directly)
    if (position.lat !== undefined && position.lng !== undefined) {
      newLocation = {
        lat: position.lat,
        lng: position.lng,
        coords: [position.lat, position.lng],
        accuracy: position.accuracy,
        timestamp: position.timestamp || Date.now(),
        isNative: position.isNative || false,
      };
    } else {
      // Web geolocation format (position.coords)
      const { latitude, longitude, accuracy: posAccuracy } = position.coords;
      newLocation = {
        lat: latitude,
        lng: longitude,
        coords: [latitude, longitude],
        accuracy: posAccuracy,
        timestamp: position.timestamp,
        isNative: false,
      };
    }

    setLocation(newLocation);
    setAccuracy(newLocation.accuracy);
    setLastUpdate(Date.now());
    setError(null);

    // Notify all subscribers
    subscribersRef.current.forEach((callback) => {
      try {
        callback(newLocation);
      } catch (err) {
        console.error('[GPS Service] Subscriber error:', err);
      }
    });
  }, []);

  // Handle position error
  const handleError = useCallback((err) => {
    let errorMessage;
    switch (err.code) {
      case 1: // PERMISSION_DENIED
        errorMessage = 'Location permission denied. Please enable location access.';
        break;
      case 2: // POSITION_UNAVAILABLE
        errorMessage = 'Location unavailable. Please check your GPS settings.';
        break;
      case 3: // TIMEOUT
        errorMessage = 'Location request timed out. Retrying...';
        break;
      default:
        errorMessage = err.message || 'Failed to get location';
    }

    setError(errorMessage);
    console.warn('[GPS Service] Error:', errorMessage);
  }, []);

  // Start tracking
  const startTracking = useCallback(async (mode = GPS_MODE.BALANCED) => {
    // If already tracking with same mode, do nothing
    if ((watchIdRef.current !== null || nativeWatcherIdRef.current !== null) &&
        currentModeRef.current === mode) {
      return true;
    }

    // Stop existing watchers if different mode requested
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (nativeWatcherIdRef.current !== null) {
      await stopNativeGPSTracking(nativeWatcherIdRef.current);
      nativeWatcherIdRef.current = null;
    }

    currentModeRef.current = mode;
    const highAccuracy = mode === GPS_MODE.HIGH_ACCURACY || mode === GPS_MODE.BALANCED;

    // Try native GPS first (for background support)
    if (isNativeRef.current) {
      console.log('[GPS Service] Starting native GPS tracking...');

      const watcherId = await startNativeGPSTracking({
        onLocation: handlePosition,
        onError: (err) => handleError({ code: err.code, message: err.message }),
        highAccuracy,
        notificationTitle: 'ReunitePets Active Search',
        notificationText: 'GPS tracking is on to help find lost pets',
      });

      if (watcherId) {
        nativeWatcherIdRef.current = watcherId;
        setIsTracking(true);
        setUsingNative(true);
        setError(null);
        console.log('[GPS Service] Started native GPS tracking in', mode, 'mode');
        return true;
      }

      console.log('[GPS Service] Native GPS failed, falling back to web geolocation');
    }

    // Fall back to web geolocation
    if (!isSupported) {
      setError('Geolocation is not supported by this browser');
      return false;
    }

    const options = MODE_OPTIONS[mode] || MODE_OPTIONS[GPS_MODE.BALANCED];

    // Get initial position quickly
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      handleError,
      { ...options, maximumAge: 60000 } // Accept cached position for initial
    );

    // Start watching
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      options
    );

    setIsTracking(true);
    setUsingNative(false);
    setError(null);
    console.log('[GPS Service] Started web GPS tracking in', mode, 'mode');
    return true;
  }, [isSupported, handlePosition, handleError]);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    if (nativeWatcherIdRef.current !== null) {
      await stopNativeGPSTracking(nativeWatcherIdRef.current);
      nativeWatcherIdRef.current = null;
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setUsingNative(false);
    console.log('[GPS Service] Stopped tracking');
  }, []);

  // Keep a ref to current location for subscribe's initial callback
  // This prevents subscribe from recreating when location changes
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // Subscribe to location updates
  // IMPORTANT: No dependencies on location - use ref instead
  // This prevents infinite subscribe/unsubscribe cycles
  const subscribe = useCallback((callback) => {
    subscribersRef.current.add(callback);

    // Immediately call with current location if available (use ref, not state)
    if (locationRef.current) {
      try {
        callback(locationRef.current);
      } catch (err) {
        console.error('[GPS Service] Subscriber initial call error:', err);
      }
    }

    // Return unsubscribe function
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []); // Empty deps - stable reference

  // Request single position (one-shot)
  const getPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!isSupported) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      // If we have recent location (< 10s), return it
      if (location && lastUpdate && (Date.now() - lastUpdate) < 10000) {
        resolve(location);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            coords: [position.coords.latitude, position.coords.longitude],
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          setLocation(loc);
          setLastUpdate(Date.now());
          resolve(loc);
        },
        (err) => {
          handleError(err);
          reject(err);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    });
  }, [isSupported, location, lastUpdate, handleError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (nativeWatcherIdRef.current !== null) {
        stopNativeGPSTracking(nativeWatcherIdRef.current);
        nativeWatcherIdRef.current = null;
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      subscribersRef.current.clear();
    };
  }, []);

  const value = {
    // State
    location,
    error,
    isTracking,
    accuracy,
    lastUpdate,
    isSupported,
    usingNative,

    // Actions
    startTracking,
    stopTracking,
    subscribe,
    getPosition,
    openLocationSettings,

    // Constants
    GPS_MODE,
  };

  return (
    <GPSContext.Provider value={value}>
      {children}
    </GPSContext.Provider>
  );
}

// Hook to use GPS service
export function useGPS() {
  const context = useContext(GPSContext);
  if (!context) {
    throw new Error('useGPS must be used within a GPSProvider');
  }
  return context;
}

// Hook for components that just need current location (no tracking)
export function useLocation() {
  const { location, error, getPosition, isSupported } = useGPS();
  return { location, error, getPosition, isSupported };
}

// Hook for components that need to track location changes
export function useLocationTracking(mode = GPS_MODE.BALANCED) {
  const {
    location,
    error,
    isTracking,
    accuracy,
    startTracking,
    stopTracking,
    subscribe
  } = useGPS();

  const [path, setPath] = useState([]);

  // Start tracking on mount if mode provided
  useEffect(() => {
    if (mode) {
      startTracking(mode);
    }
    return () => {
      // Don't stop tracking on unmount - let other components continue
      // The provider handles cleanup
    };
  }, [mode, startTracking]);

  // Track path of locations
  useEffect(() => {
    const unsubscribe = subscribe((loc) => {
      setPath((prev) => [...prev, { ...loc, timestamp: Date.now() }]);
    });
    return unsubscribe;
  }, [subscribe]);

  return {
    location,
    error,
    isTracking,
    accuracy,
    path,
    startTracking,
    stopTracking,
    clearPath: () => setPath([]),
  };
}

export default GPSProvider;
