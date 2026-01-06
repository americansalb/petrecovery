'use client';

/**
 * Native GPS Service - DEPRECATED
 *
 * Continuous GPS tracking is not supported in web browsers.
 * For real-time GPS tracking, users should download the native mobile app.
 *
 * This file provides stub functions for backwards compatibility.
 * All functions return false/null to indicate native GPS is not available.
 */

/**
 * Check if running in a native Capacitor environment
 * Always returns false for web - native tracking disabled
 */
export function isNative() {
  return false;
}

/**
 * Async version of isNative
 */
export async function isNativeAsync() {
  return false;
}

/**
 * Initialize the native GPS plugin
 * Returns false - native GPS not available in web
 */
export async function initNativeGPS() {
  console.log('[Native GPS] Native GPS tracking is not available in web browsers. Please use the mobile app for GPS tracking features.');
  return false;
}

/**
 * Request necessary permissions for background location
 * Returns false - not available in web
 */
export async function requestNativeGPSPermissions() {
  return false;
}

/**
 * Start background GPS tracking
 * Returns null - not available in web
 */
export async function startNativeGPSTracking() {
  console.warn('[Native GPS] Continuous GPS tracking is not available in web browsers. Please use the mobile app.');
  return null;
}

/**
 * Stop GPS tracking for a specific watcher
 * No-op in web
 */
export async function stopNativeGPSTracking() {
  // No-op
}

/**
 * Open device location settings
 * Returns false - not available in web
 */
export async function openLocationSettings() {
  return false;
}

/**
 * Get single location (one-shot)
 * Uses browser geolocation API
 */
export async function getNativeGPSPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          coords: [position.coords.latitude, position.coords.longitude],
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          isNative: false,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 15000,
      }
    );
  });
}

export default {
  isNative,
  isNativeAsync,
  initNativeGPS,
  requestNativeGPSPermissions,
  startNativeGPSTracking,
  stopNativeGPSTracking,
  openLocationSettings,
  getNativeGPSPosition,
};
