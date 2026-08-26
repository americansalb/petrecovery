/**
 * Cities Database - US, Puerto Rico, Mexico, Canada, and more
 *
 * Data shape:
 * {
 *   city: string;        // "Lynwood"
 *   state_id: string;    // "IL" or "CDMX"
 *   state_name: string;  // "Illinois" or "Ciudad de México"
 *   zips: string[];      // ["60411"] - may be empty for international
 *   country?: string;    // "US", "MX", "CA", etc.
 * }
 */

// Import all city data files
import usCitiesRaw from './uscities.full.json';
import prCitiesRaw from './prcities.json';
import mxCitiesRaw from './mxcities.json';
import caCitiesRaw from './cacities.json';
import coCitiesRaw from './cocities.json';
import naCitiesRaw from './nacities.json';

// Normalize city format - ensure all have zips array and country code
function normalizeCities(cities, country) {
  return (cities || []).map(c => ({
    ...c,
    zips: c.zips || [],
    country: c.country || country,
  }));
}

// Merge all city data
const allCitiesData = [
  ...normalizeCities(usCitiesRaw, 'US'),
  ...normalizeCities(prCitiesRaw, 'US'),  // PR is US territory
  ...normalizeCities(mxCitiesRaw, 'MX'),
  ...normalizeCities(caCitiesRaw, 'CA'),
  ...normalizeCities(coCitiesRaw, 'CO'),
  ...normalizeCities(naCitiesRaw, 'NA'),  // Cuba, Dominican Republic, etc.
];

console.log(`[Cities] Loaded ${allCitiesData.length} cities (US: ${(usCitiesRaw?.length || 0) + (prCitiesRaw?.length || 0)}, MX: ${mxCitiesRaw?.length || 0}, CA: ${caCitiesRaw?.length || 0})`);

const ZIP_REGEX = /^\d{5}$/;

/**
 * Normalize city name for search matching
 * Handles: St. → Saint, hyphens → spaces, etc.
 */
function normalizeForSearch(str) {
  return str
    .toLowerCase()
    .replace(/\bst\.\s*/gi, 'saint ')  // St. Louis → Saint Louis
    .replace(/\bmt\.\s*/gi, 'mount ')  // Mt. Vernon → Mount Vernon
    .replace(/\bft\.\s*/gi, 'fort ')   // Ft. Worth → Fort Worth
    .replace(/-/g, ' ')                 // Winston-Salem → Winston Salem
    .replace(/\s+/g, ' ')               // Multiple spaces → single
    .trim();
}

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
    return allCitiesData.filter(c => (c.zips || []).includes(trimmed));
  }

  // City search with normalization (handles St. → Saint, hyphens, etc.)
  const q = normalizeForSearch(trimmed);
  return allCitiesData.filter(c => {
    const normalizedCity = normalizeForSearch(c.city);
    const normalizedFull = normalizeForSearch(`${c.city}, ${c.state_id}`);
    return normalizedCity.startsWith(q) || normalizedFull.startsWith(q);
  }).slice(0, 50); // Limit results for performance
}

/**
 * Get autocomplete suggestions for city names
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 10)
 * @returns {Array} - Array of city records
 */
export function getCitySuggestions(query, limit = 10) {
  if (!query || query.trim().length < 3) return [];

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
  return allCitiesData.filter(c => (c.zips || []).includes(zipCode));
}

/**
 * Find a city by exact name and state
 * @param {string} cityName - City name (can be "City" or "City, ST" format)
 * @param {string} stateId - Optional 2-letter state code
 * @returns {Object|null} - City record or null
 */
export function getCityByName(cityName, stateId = null) {
  if (!cityName) return null;

  let inputCity = cityName.trim();
  let state = stateId;

  // Handle "City, ST" format
  if (!state && inputCity.includes(',')) {
    const parts = inputCity.split(',').map(p => p.trim());
    if (parts.length === 2 && parts[1].length === 2) {
      inputCity = parts[0];
      state = parts[1];
    }
  }

  // Normalize for comparison (St. → Saint, etc.)
  const normalizedInput = normalizeForSearch(inputCity);

  if (state) {
    return allCitiesData.find(
      c => normalizeForSearch(c.city) === normalizedInput &&
           c.state_id.toUpperCase() === state.toUpperCase()
    );
  }

  // Without a state, prefer the largest match rather than dataset order:
  // ZIP count is the size proxy this dataset has. Plain "Austin" used to
  // resolve to Austin, AR (one ZIP) instead of Austin, TX because the
  // Arkansas row happened to sort first.
  let best = null;
  for (const c of allCitiesData) {
    if (normalizeForSearch(c.city) !== normalizedInput) continue;
    if (!best || (c.zips?.length || 0) > (best.zips?.length || 0)) best = c;
  }
  return best;
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
 * @param {string} cityName - City name to validate
 * @param {string} stateId - Optional state to validate against
 * @returns {boolean}
 */
export function isValidCity(cityName, stateId = null) {
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
 * @returns {string} - e.g., "Lynwood, IL (60411)" or "Toronto, ON, Canada"
 */
export function formatCityDisplay(city) {
  const zips = city.zips || [];
  const zipPart = zips.length > 0 ? ` (${zips[0]})` : '';
  const countryPart = city.country && city.country !== 'US' ? `, ${getCountryName(city.country)}` : '';
  return `${city.city}, ${city.state_id}${zipPart}${countryPart}`;
}

/**
 * Get country display name
 */
function getCountryName(code) {
  const names = {
    'US': 'USA',
    'MX': 'Mexico',
    'CA': 'Canada',
    'CO': 'Colombia',
    'CU': 'Cuba',
    'DO': 'Dominican Republic',
    'NA': 'Caribbean',
  };
  return names[code] || code;
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
