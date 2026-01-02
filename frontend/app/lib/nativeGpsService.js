'use client';

/**
 * Native GPS Service for Capacitor
 *
 * Provides background GPS tracking on iOS and Android using Capacitor.
 * This enables reliable GPS tracking even when the app is backgrounded.
 *
 * Features:
 * - Continuous GPS tracking in foreground AND background
 * - Foreground service notification on Android (prevents OS killing)
 * - "Always allow" location permission support on iOS
 * - Battery-efficient modes
 * - Automatic reconnection
 */

import { Capacitor } from '@capacitor/core';

// Dynamic import for background geolocation (only works in native)
let BackgroundGeolocation = null;

/**
 * Check if running in a native Capacitor environment
 */
export function isNative() {
  return Capacitor.isNativePlatform();
}

/**
 * Initialize the native GPS plugin
 * Call this once on app startup
 */
export async function initNativeGPS() {
  if (!isNative()) {
    console.log('[Native GPS] Not running in native environment, skipping init');
    return false;
  }

  try {
    // Dynamic import to avoid issues in web builds
    const module = await import('@capacitor-community/background-geolocation');
    BackgroundGeolocation = module.BackgroundGeolocation;
    console.log('[Native GPS] Plugin loaded successfully');
    return true;
  } catch (error) {
    console.error('[Native GPS] Failed to load plugin:', error);
    return false;
  }
}

/**
 * Request necessary permissions for background location
 * Returns true if all permissions granted
 */
export async function requestNativeGPSPermissions() {
  if (!BackgroundGeolocation) {
    console.warn('[Native GPS] Plugin not initialized');
    return false;
  }

  try {
    // Check current permissions
    const { location } = await BackgroundGeolocation.checkPermissions();
    console.log('[Native GPS] Current permission status:', location);

    if (location === 'granted') {
      return true;
    }

    // Request permissions
    const result = await BackgroundGeolocation.requestPermissions();
    console.log('[Native GPS] Permission request result:', result.location);

    return result.location === 'granted';
  } catch (error) {
    console.error('[Native GPS] Permission request failed:', error);
    return false;
  }
}

/**
 * Start background GPS tracking
 *
 * @param {object} options
 * @param {function} options.onLocation - Callback for location updates
 * @param {function} options.onError - Callback for errors
 * @param {boolean} options.highAccuracy - Use high accuracy mode
 * @param {string} options.notificationTitle - Android notification title
 * @param {string} options.notificationText - Android notification text
 *
 * @returns {Promise<string|null>} Watcher ID or null on failure
 */
export async function startNativeGPSTracking({
  onLocation,
  onError,
  highAccuracy = true,
  notificationTitle = 'ReunitePets Active Search',
  notificationText = 'GPS tracking is on to help find lost pets',
} = {}) {
  if (!BackgroundGeolocation) {
    const initialized = await initNativeGPS();
    if (!initialized) {
      onError?.({ message: 'Native GPS not available' });
      return null;
    }
  }

  // Request permissions first
  const hasPermission = await requestNativeGPSPermissions();
  if (!hasPermission) {
    onError?.({ message: 'Location permission not granted', code: 'PERMISSION_DENIED' });
    return null;
  }

  try {
    // Start watching location
    const watcherId = await BackgroundGeolocation.addWatcher(
      {
        // Background options
        backgroundMessage: notificationText,
        backgroundTitle: notificationTitle,

        // Request high accuracy on iOS
        requestAlwaysPermission: true,

        // Accuracy settings
        stale: false, // Don't accept cached locations
        distanceFilter: highAccuracy ? 5 : 20, // meters
      },
      (location, error) => {
        if (error) {
          console.warn('[Native GPS] Error:', error);
          onError?.({
            message: error.message || 'Location error',
            code: error.code,
          });
          return;
        }

        if (location) {
          // Convert to our standard format
          const standardLocation = {
            lat: location.latitude,
            lng: location.longitude,
            coords: [location.latitude, location.longitude],
            accuracy: location.accuracy,
            altitude: location.altitude,
            altitudeAccuracy: location.altitudeAccuracy,
            bearing: location.bearing,
            speed: location.speed,
            timestamp: location.time || Date.now(),
            isNative: true,
          };

          console.log('[Native GPS] Location update:',
            standardLocation.lat.toFixed(6),
            standardLocation.lng.toFixed(6),
            `accuracy: ${standardLocation.accuracy?.toFixed(0)}m`
          );

          onLocation?.(standardLocation);
        }
      }
    );

    console.log('[Native GPS] Started tracking with watcher ID:', watcherId);
    return watcherId;
  } catch (error) {
    console.error('[Native GPS] Failed to start tracking:', error);
    onError?.({ message: error.message || 'Failed to start GPS' });
    return null;
  }
}

/**
 * Stop GPS tracking for a specific watcher
 * @param {string} watcherId - The watcher ID returned from startNativeGPSTracking
 */
export async function stopNativeGPSTracking(watcherId) {
  if (!BackgroundGeolocation || !watcherId) {
    return;
  }

  try {
    await BackgroundGeolocation.removeWatcher({ id: watcherId });
    console.log('[Native GPS] Stopped tracking for watcher:', watcherId);
  } catch (error) {
    console.error('[Native GPS] Failed to stop tracking:', error);
  }
}

/**
 * Open device location settings
 * Useful when user has denied permission
 */
export async function openLocationSettings() {
  if (!BackgroundGeolocation) {
    return false;
  }

  try {
    await BackgroundGeolocation.openSettings();
    return true;
  } catch (error) {
    console.error('[Native GPS] Failed to open settings:', error);
    return false;
  }
}

/**
 * Get single location (one-shot)
 * @returns {Promise<object>} Location object
 */
export async function getNativeGPSPosition() {
  return new Promise(async (resolve, reject) => {
    if (!BackgroundGeolocation) {
      const initialized = await initNativeGPS();
      if (!initialized) {
        reject(new Error('Native GPS not available'));
        return;
      }
    }

    // Use a temporary watcher that resolves after first location
    let watcherId = null;
    const timeout = setTimeout(() => {
      if (watcherId) {
        stopNativeGPSTracking(watcherId);
      }
      reject(new Error('Location request timed out'));
    }, 30000);

    watcherId = await startNativeGPSTracking({
      onLocation: (location) => {
        clearTimeout(timeout);
        stopNativeGPSTracking(watcherId);
        resolve(location);
      },
      onError: (error) => {
        clearTimeout(timeout);
        if (watcherId) {
          stopNativeGPSTracking(watcherId);
        }
        reject(error);
      },
      highAccuracy: true,
    });

    if (!watcherId) {
      clearTimeout(timeout);
      reject(new Error('Failed to start location watcher'));
    }
  });
}

/**
 * Hybrid GPS Provider
 *
 * Use this in components to automatically use native GPS when available,
 * falling back to web geolocation otherwise.
 */
export class HybridGPSTracker {
  constructor() {
    this.watcherId = null;
    this.webWatchId = null;
    this.callbacks = new Set();
    this.currentLocation = null;
    this.isTracking = false;
    this.useNative = false;
  }

  async start({ highAccuracy = true } = {}) {
    if (this.isTracking) {
      return true;
    }

    // Check if native is available
    if (isNative()) {
      const initialized = await initNativeGPS();
      if (initialized) {
        this.useNative = true;
        this.watcherId = await startNativeGPSTracking({
          onLocation: (location) => this._handleLocation(location),
          onError: (error) => this._handleError(error),
          highAccuracy,
        });

        if (this.watcherId) {
          this.isTracking = true;
          console.log('[Hybrid GPS] Using native GPS');
          return true;
        }
      }
    }

    // Fall back to web geolocation
    console.log('[Hybrid GPS] Using web geolocation');
    this.useNative = false;

    if (!navigator.geolocation) {
      console.error('[Hybrid GPS] Geolocation not supported');
      return false;
    }

    this.webWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          coords: [position.coords.latitude, position.coords.longitude],
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          isNative: false,
        };
        this._handleLocation(location);
      },
      (error) => {
        this._handleError({
          message: error.message,
          code: error.code,
        });
      },
      {
        enableHighAccuracy: highAccuracy,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    this.isTracking = true;
    return true;
  }

  stop() {
    if (this.useNative && this.watcherId) {
      stopNativeGPSTracking(this.watcherId);
      this.watcherId = null;
    }

    if (this.webWatchId !== null) {
      navigator.geolocation.clearWatch(this.webWatchId);
      this.webWatchId = null;
    }

    this.isTracking = false;
    console.log('[Hybrid GPS] Stopped tracking');
  }

  subscribe(callback) {
    this.callbacks.add(callback);

    // Send current location immediately if available
    if (this.currentLocation) {
      try {
        callback(this.currentLocation);
      } catch (err) {
        console.error('[Hybrid GPS] Subscriber error:', err);
      }
    }

    return () => {
      this.callbacks.delete(callback);
    };
  }

  _handleLocation(location) {
    this.currentLocation = location;
    this.callbacks.forEach((callback) => {
      try {
        callback(location);
      } catch (err) {
        console.error('[Hybrid GPS] Subscriber error:', err);
      }
    });
  }

  _handleError(error) {
    console.warn('[Hybrid GPS] Error:', error);
    // Could also notify subscribers of errors
  }

  getLocation() {
    return this.currentLocation;
  }

  isNativeTracking() {
    return this.useNative && this.isTracking;
  }
}

// Singleton instance for app-wide use
let globalTracker = null;

export function getGlobalTracker() {
  if (!globalTracker) {
    globalTracker = new HybridGPSTracker();
  }
  return globalTracker;
}

export default {
  isNative,
  initNativeGPS,
  requestNativeGPSPermissions,
  startNativeGPSTracking,
  stopNativeGPSTracking,
  openLocationSettings,
  getNativeGPSPosition,
  HybridGPSTracker,
  getGlobalTracker,
};
