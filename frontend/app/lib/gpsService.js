'use client';

import { createContext, useContext, useState, useCallback } from 'react';

/**
 * Simplified GPS Service - One-Time Location Only
 *
 * IMPORTANT: Continuous GPS tracking does not work reliably in web browsers.
 * For real-time tracking, users should download the native mobile app.
 *
 * This service provides:
 * - One-time location capture via getPosition()
 * - Simple location state management
 *
 * For the "Mark Location as Searched" feature, users can capture their
 * current location with a button tap - this works well on mobile browsers.
 */

const GPSContext = createContext(null);

export function GPSProvider({ children }) {
  // Current location state (from last getPosition call)
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if geolocation is supported
  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  // Handle position error
  const handleError = useCallback((err) => {
    let errorMessage;
    switch (err.code) {
      case 1: // PERMISSION_DENIED
        errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
        break;
      case 2: // POSITION_UNAVAILABLE
        errorMessage = 'Location unavailable. Please check your GPS settings.';
        break;
      case 3: // TIMEOUT
        errorMessage = 'Location request timed out. Please try again.';
        break;
      default:
        errorMessage = err.message || 'Failed to get location';
    }
    setError(errorMessage);
    console.warn('[GPS Service] Error:', errorMessage);
    return errorMessage;
  }, []);

  // Request single position (one-shot) - THE ONLY WAY TO GET LOCATION
  const getPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!isSupported) {
        const err = new Error('Geolocation not supported by this browser');
        setError(err.message);
        reject(err);
        return;
      }

      setIsLoading(true);
      setError(null);

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
          setIsLoading(false);
          resolve(loc);
        },
        (err) => {
          setIsLoading(false);
          const message = handleError(err);
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000, // Accept cached position up to 30s old
          timeout: 15000,
        }
      );
    });
  }, [isSupported, handleError]);

  // Clear current location and error
  const clearLocation = useCallback(() => {
    setLocation(null);
    setError(null);
  }, []);

  const value = {
    // State
    location,
    error,
    isLoading,
    isSupported,

    // Actions
    getPosition,
    clearLocation,
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

// Simplified alias - useLocation now just returns the same thing
export function useLocation() {
  return useGPS();
}

export default GPSProvider;
