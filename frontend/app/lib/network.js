'use client';

/**
 * Network Utilities
 *
 * Provides robust network handling with retries, timeouts, and error handling.
 * Per Actions_Guide.md Phase 7 specification.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

// =============================================================================
// ERROR TYPES
// =============================================================================

export class NetworkError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'NetworkError';
    this.status = status;
    this.data = data;
    this.isNetworkError = true;
  }
}

export class TimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
    this.isTimeoutError = true;
  }
}

export class OfflineError extends Error {
  constructor(message = 'No internet connection') {
    super(message);
    this.name = 'OfflineError';
    this.isOfflineError = true;
  }
}

// =============================================================================
// FETCH WITH RETRY
// =============================================================================

/**
 * Enhanced fetch with retry, timeout, and error handling
 */
export async function fetchWithRetry(url, options = {}) {
  const {
    retries = DEFAULT_RETRIES,
    timeout = DEFAULT_TIMEOUT,
    onRetry,
    ...fetchOptions
  } = options;

  // Check if online
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new OfflineError();
  }

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new NetworkError(
          data.error || `HTTP ${response.status}`,
          response.status,
          data
        );
      }

      return response;
    } catch (error) {
      lastError = error;

      // Don't retry on abort (user cancelled)
      if (error.name === 'AbortError') {
        throw new TimeoutError();
      }

      // Don't retry on offline
      if (error.isOfflineError) {
        throw error;
      }

      // Don't retry on 4xx errors (client errors)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Retry on network errors or 5xx
      if (attempt < retries) {
        const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

        if (onRetry) {
          onRetry(attempt + 1, retries, delay);
        }

        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * JSON fetch helper
 */
export async function fetchJSON(url, options = {}) {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return response.json();
}

/**
 * POST JSON helper
 */
export async function postJSON(url, data, options = {}) {
  return fetchJSON(url, {
    method: 'POST',
    body: JSON.stringify(data),
    ...options,
  });
}

// =============================================================================
// ERROR HANDLING UTILS
// =============================================================================

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error) {
  if (error.isOfflineError) {
    return 'No internet connection. Please check your network and try again.';
  }

  if (error.isTimeoutError) {
    return 'Request timed out. Please try again.';
  }

  if (error.isNetworkError) {
    switch (error.status) {
      case 400:
        return error.data?.error || 'Invalid request. Please check your input.';
      case 401:
        return 'Please sign in to continue.';
      case 403:
        return "You don't have permission to do this.";
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
      case 502:
      case 503:
        return 'Server error. Our team has been notified.';
      default:
        return error.message || 'Something went wrong.';
    }
  }

  return error.message || 'An unexpected error occurred.';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error) {
  if (error.isTimeoutError) return true;
  if (error.isNetworkError && error.status >= 500) return true;
  if (error.message?.includes('fetch')) return true;
  return false;
}

/**
 * Check if error is network-related
 */
export function isNetworkRelatedError(error) {
  return (
    error.isNetworkError ||
    error.isTimeoutError ||
    error.isOfflineError ||
    error.message?.includes('network') ||
    error.message?.includes('fetch')
  );
}

// =============================================================================
// CONNECTION MONITORING
// =============================================================================

let connectionListeners = new Set();

/**
 * Subscribe to connection changes
 */
export function onConnectionChange(callback) {
  connectionListeners.add(callback);

  // Set up listeners on first subscription
  if (connectionListeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('online', notifyOnline);
    window.addEventListener('offline', notifyOffline);
  }

  // Return unsubscribe function
  return () => {
    connectionListeners.delete(callback);
    if (connectionListeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('online', notifyOnline);
      window.removeEventListener('offline', notifyOffline);
    }
  };
}

function notifyOnline() {
  connectionListeners.forEach((cb) => cb(true));
}

function notifyOffline() {
  connectionListeners.forEach((cb) => cb(false));
}

/**
 * Get current connection status
 */
export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Wait for connection to be restored
 */
export function waitForConnection(timeout = 30000) {
  return new Promise((resolve, reject) => {
    if (isOnline()) {
      resolve();
      return;
    }

    const cleanup = onConnectionChange((online) => {
      if (online) {
        cleanup();
        resolve();
      }
    });

    setTimeout(() => {
      cleanup();
      reject(new TimeoutError('Timed out waiting for connection'));
    }, timeout);
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle(fn, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export default {
  fetchWithRetry,
  fetchJSON,
  postJSON,
  getErrorMessage,
  isRetryableError,
  isNetworkRelatedError,
  onConnectionChange,
  isOnline,
  waitForConnection,
  debounce,
  throttle,
  NetworkError,
  TimeoutError,
  OfflineError,
};
