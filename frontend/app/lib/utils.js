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
