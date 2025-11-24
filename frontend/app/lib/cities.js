/**
 * US Cities Database - Complete coverage of ~29k US cities
 *
 * Data shape:
 * {
 *   city: string;        // "Lynwood"
 *   state_id: string;    // "IL"
 *   state_name: string;  // "Illinois"
 *   zips: string[];      // ["60411"]
 * }
 */

import allCitiesData from './uscities.full.json' with { type: 'json' };

const ZIP_REGEX = /^\d{5}$/;

/**
 * Create a canonical key for a city (for storage/validation)
 * @param {Object} city - City record
 * @returns {string} - e.g., "lynwood-il"
 */
export function cityKey(city) {
  return `${city.city.toLowerCase()}-${city.state_id.toLowerCase()}`;
}

/**
 * Parse a city key back to components
 * @param {string} key - e.g., "lynwood-il"
 * @returns {Object|null} - { city: "Lynwood", stateId: "IL" } or null
 */
export function parseCityKey(key) {
  if (!key) return null;
  const parts = key.split('-');
  if (parts.length < 2) return null;

  // State ID is last part, city is everything before
  const stateId = parts[parts.length - 1].toUpperCase();
  const cityName = parts.slice(0, -1).join('-');

  // Capitalize each word
  const city = cityName.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');

  return { city, stateId };
}

/**
 * Search for cities by ZIP code or city name
 * @param {string} input - ZIP code or city name (with optional ", ST")
 * @returns {Array} - Array of matching city records
 */
export function searchCityOrZip(input) {
  const trimmed = input?.trim();
  if (!trimmed) return [];

  // ZIP search
  if (ZIP_REGEX.test(trimmed)) {
    return allCitiesData.filter(c => c.zips.includes(trimmed));
  }

  // City search (with optional ", ST" format)
  const q = trimmed.toLowerCase();
  return allCitiesData.filter(c => {
    const cityMatch = c.city.toLowerCase().startsWith(q);
    const fullMatch = `${c.city}, ${c.state_id}`.toLowerCase().startsWith(q);
    return cityMatch || fullMatch;
  }).slice(0, 50); // Limit results for performance
}

/**
 * Parse "City, ST" format into city name and state
 * @param {string} input - Input string (e.g., "Springfield, IL" or "Springfield")
 * @returns {Object} - { cityName: string, stateId: string|null }
 */
export function parseCityState(input) {
  if (!input) return { cityName: '', stateId: null };

  const trimmed = input.trim();

  // Check for "City, ST" format
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.length === 2 && parts[1].length === 2) {
      return { cityName: parts[0], stateId: parts[1].toUpperCase() };
    }
  }

  // Just city name
  return { cityName: trimmed, stateId: null };
}

/**
 * Get autocomplete suggestions for city names
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 10)
 * @returns {Array} - Array of city records
 */
export function getCitySuggestions(query, limit = 10) {
  if (!query || query.trim().length < 2) return [];

  const results = searchCityOrZip(query);
  return results.slice(0, limit);
}

/**
 * Get all cities for a given ZIP code
 * @param {string} zipCode - 5-digit ZIP code
 * @returns {Array} - Array of city records
 */
export function getCitiesByZip(zipCode) {
  if (!zipCode || !ZIP_REGEX.test(zipCode)) return [];
  return allCitiesData.filter(c => c.zips.includes(zipCode));
}

/**
 * Find a city by exact name and state
 * @param {string} cityName - City name
 * @param {string} stateId - Optional 2-letter state code
 * @returns {Object|null} - City record or null
 */
export function getCityByName(cityName, stateId = null) {
  if (!cityName) return null;

  const normalized = cityName.trim().toLowerCase();

  if (stateId) {
    return allCitiesData.find(
      c => c.city.toLowerCase() === normalized &&
           c.state_id.toUpperCase() === stateId.toUpperCase()
    );
  }

  // Without state, return first match
  return allCitiesData.find(c => c.city.toLowerCase() === normalized);
}

/**
 * Get city by canonical key
 * @param {string} key - e.g., "lynwood-il"
 * @returns {Object|null} - City record or null
 */
export function getCityByKey(key) {
  const parsed = parseCityKey(key);
  if (!parsed) return null;
  return getCityByName(parsed.city, parsed.stateId);
}

/**
 * Check if a city name is valid
 * @param {string} cityName - City name to validate (can be "City" or "City, ST")
 * @param {string} stateId - Optional state to validate against
 * @returns {boolean}
 */
export function isValidCity(cityName, stateId = null) {
  if (!cityName) return false;

  // Handle "City, ST" format
  if (cityName.includes(',')) {
    const parts = cityName.split(',').map(p => p.trim());
    if (parts.length === 2) {
      return getCityByName(parts[0], parts[1]) !== null;
    }
  }

  return getCityByName(cityName, stateId) !== null;
}

/**
 * Check if a city key is valid
 * @param {string} key - City key to validate (e.g., "lynwood-il")
 * @returns {boolean}
 */
export function isValidCityKey(key) {
  return getCityByKey(key) !== null;
}

/**
 * Get city from ZIP code (returns first match)
 * @param {string} zipCode - 5-digit ZIP code
 * @returns {Object|null} - City record or null
 */
export function getCityFromZip(zipCode) {
  const cities = getCitiesByZip(zipCode);
  return cities.length > 0 ? cities[0] : null;
}

/**
 * Format city for display
 * @param {Object} city - City record
 * @returns {string} - e.g., "Lynwood, IL (60411)"
 */
export function formatCityDisplay(city) {
  const zipPart = city.zips.length > 0 ? ` (${city.zips[0]})` : '';
  return `${city.city}, ${city.state_id}${zipPart}`;
}

/**
 * Get all unique city names (for backward compatibility)
 */
export const ALL_CITIES = Array.from(
  new Set(allCitiesData.map(c => c.city))
).sort();

/**
 * Get all cities with their state info (for backward compatibility)
 */
export const CITIES_WITH_STATES = allCitiesData;

// Export total count for logging/debugging
export const TOTAL_CITIES = allCitiesData.length;
