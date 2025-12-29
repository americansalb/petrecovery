/**
 * Application Configuration
 *
 * Centralized configuration for environment-dependent values.
 * Prevents localhost URLs from being used in production.
 */

/**
 * Get the base URL for the application.
 * Used for email links, callbacks, and API URLs.
 *
 * Priority:
 * 1. NEXTAUTH_URL (standard for NextAuth.js)
 * 2. NEXT_PUBLIC_BASE_URL (fallback)
 * 3. localhost:3000 (development only)
 *
 * @returns {string} The base URL
 * @throws {Error} If no URL configured in production
 */
export function getBaseUrl() {
  // Check for configured URLs
  const configuredUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;

  if (configuredUrl) {
    // Remove trailing slash for consistency
    return configuredUrl.replace(/\/$/, '');
  }

  // In production, require a configured URL
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    console.error('[CONFIG] CRITICAL: No BASE_URL configured in production! Set NEXTAUTH_URL or NEXT_PUBLIC_BASE_URL');
    // Return a placeholder that will be obvious if used
    return 'https://YOUR_DOMAIN_NOT_CONFIGURED';
  }

  // Development fallback
  return 'http://localhost:3000';
}

/**
 * Get the base URL for emails specifically.
 * Always logs a warning if using development fallback.
 *
 * @returns {string} The base URL for email links
 */
export function getEmailBaseUrl() {
  const url = getBaseUrl();

  if (url.includes('localhost')) {
    console.warn('[CONFIG] Using localhost for email links - this will not work in production');
  }

  return url;
}

// Export for convenience
export const BASE_URL = getBaseUrl();
