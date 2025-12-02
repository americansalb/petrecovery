/**
 * Utility functions for common operations
 */

/**
 * Normalize a photo URL to ensure it has a valid protocol
 * Handles cases where URLs are stored without the protocol prefix
 *
 * @param {string|null|undefined} url - The URL to normalize
 * @param {string} defaultUrl - Optional default URL if input is falsy
 * @returns {string|null} - Normalized URL with protocol, or null if invalid
 *
 * @example
 * normalizePhotoUrl('example.com/image.jpg') // 'https://example.com/image.jpg'
 * normalizePhotoUrl('https://example.com/image.jpg') // 'https://example.com/image.jpg'
 * normalizePhotoUrl('http://example.com/image.jpg') // 'http://example.com/image.jpg'
 * normalizePhotoUrl('//cdn.example.com/image.jpg') // 'https://cdn.example.com/image.jpg'
 * normalizePhotoUrl(null) // null
 * normalizePhotoUrl('', '/default.jpg') // '/default.jpg'
 */
export function normalizePhotoUrl(url, defaultUrl = null) {
  // Return default if no URL provided
  if (!url || typeof url !== 'string') {
    return defaultUrl;
  }

  const trimmedUrl = url.trim();

  // Return default for empty strings
  if (!trimmedUrl) {
    return defaultUrl;
  }

  // Already has a protocol (http:// or https://)
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }

  // Protocol-relative URL (//example.com/image.jpg)
  if (trimmedUrl.startsWith('//')) {
    return `https:${trimmedUrl}`;
  }

  // Absolute path (/images/photo.jpg) - keep as is
  if (trimmedUrl.startsWith('/')) {
    return trimmedUrl;
  }

  // Data URL (data:image/png;base64,...)
  if (trimmedUrl.startsWith('data:')) {
    return trimmedUrl;
  }

  // Blob URL (blob:http://...)
  if (trimmedUrl.startsWith('blob:')) {
    return trimmedUrl;
  }

  // Otherwise, assume it's a domain without protocol - add https://
  return `https://${trimmedUrl}`;
}

/**
 * Normalize an array of photo URLs
 *
 * @param {Array<string>|string|null} urls - Array of URLs, JSON string, or single URL
 * @returns {Array<string>} - Array of normalized URLs
 *
 * @example
 * normalizePhotoUrls(['example.com/1.jpg', 'https://cdn.com/2.jpg'])
 * // ['https://example.com/1.jpg', 'https://cdn.com/2.jpg']
 *
 * normalizePhotoUrls('["example.com/1.jpg"]')
 * // ['https://example.com/1.jpg']
 */
export function normalizePhotoUrls(urls) {
  // Handle null/undefined
  if (!urls) {
    return [];
  }

  // Parse JSON string if needed
  let urlArray = urls;
  if (typeof urls === 'string') {
    try {
      urlArray = JSON.parse(urls);
    } catch (e) {
      // If not valid JSON, treat as single URL
      const normalized = normalizePhotoUrl(urls);
      return normalized ? [normalized] : [];
    }
  }

  // Ensure we have an array
  if (!Array.isArray(urlArray)) {
    const normalized = normalizePhotoUrl(urlArray);
    return normalized ? [normalized] : [];
  }

  // Normalize each URL in the array
  return urlArray
    .map(url => normalizePhotoUrl(url))
    .filter(url => url !== null);
}

/**
 * Get the primary photo URL from various photo field formats
 * Handles both single URLs and arrays of URLs
 *
 * @param {Object} data - Object containing photo fields
 * @param {string} data.petPhotoUrl - Single photo URL
 * @param {string|Array} data.photos - Array of photo URLs or JSON string
 * @param {string|Array} data.photoUrls - Array of photo URLs or JSON string
 * @param {string} fallbackUrl - Optional fallback URL
 * @returns {string|null} - Normalized primary photo URL
 */
export function getPrimaryPhotoUrl(data, fallbackUrl = null) {
  // Try petPhotoUrl first (single photo field)
  if (data?.petPhotoUrl) {
    return normalizePhotoUrl(data.petPhotoUrl, fallbackUrl);
  }

  // Try photos array
  if (data?.photos) {
    const photosArray = normalizePhotoUrls(data.photos);
    if (photosArray.length > 0) {
      return photosArray[0];
    }
  }

  // Try photoUrls array
  if (data?.photoUrls) {
    const photosArray = normalizePhotoUrls(data.photoUrls);
    if (photosArray.length > 0) {
      return photosArray[0];
    }
  }

  // Try primaryPhotoUrl
  if (data?.primaryPhotoUrl) {
    return normalizePhotoUrl(data.primaryPhotoUrl, fallbackUrl);
  }

  return fallbackUrl;
}

/**
 * Fetch with retry logic and better error handling
 *
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} retryDelay - Delay between retries in ms (default: 1000)
 * @returns {Promise<Response>} - Fetch response
 *
 * @example
 * const data = await fetchWithRetry('/api/cases')
 *   .then(res => res.json())
 *   .catch(err => console.error(err));
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3, retryDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // If successful or client error (4xx), return immediately
      // Don't retry client errors as they won't succeed on retry
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // Server error (5xx) - will retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      // Network error or other fetch failure
      lastError = error;

      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`Network error, retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  throw lastError || new Error('Request failed after retries');
}

/**
 * Check if the browser is online
 * @returns {boolean} - True if online
 */
export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Add online/offline event listeners
 * @param {Function} onOnline - Callback when going online
 * @param {Function} onOffline - Callback when going offline
 * @returns {Function} - Cleanup function to remove listeners
 */
export function addNetworkListeners(onOnline, onOffline) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

/**
 * Format error message for user display
 * @param {Error|string} error - Error object or message
 * @returns {string} - User-friendly error message
 */
export function formatErrorMessage(error) {
  if (!error) return 'An unknown error occurred';

  if (typeof error === 'string') return error;

  // Network errors
  if (error.message?.includes('Failed to fetch') || error.message?.includes('Network')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  // Timeout errors
  if (error.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // HTTP errors
  if (error.message?.match(/HTTP \d+/)) {
    return `Server error: ${error.message}. Please try again later.`;
  }

  // Generic error
  return error.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Async timeout wrapper
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} - Promise that rejects on timeout
 */
export function withTimeout(promise, timeoutMs = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}
