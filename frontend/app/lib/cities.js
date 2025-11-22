import citiesData from './uscities.json';

// Get all unique city names (across all states)
export const ALL_CITIES = Array.from(
  new Set(citiesData.cities.map(c => c.city))
).sort();

// Get all cities with their state info
export const CITIES_WITH_STATES = citiesData.cities;

// Find cities by ZIP code
export function getCitiesByZip(zipCode) {
  return citiesData.cities.filter(c => c.zip === zipCode);
}

// Find city data by name (case-insensitive)
export function getCityByName(cityName) {
  if (!cityName) return null;
  const normalized = cityName.trim();
  return citiesData.cities.find(
    c => c.city.toLowerCase() === normalized.toLowerCase()
  );
}

// Check if a city name is valid
export function isValidCity(cityName) {
  if (!cityName) return false;
  const normalized = cityName.trim();
  return citiesData.cities.some(
    c => c.city.toLowerCase() === normalized.toLowerCase()
  );
}

// Get autocomplete suggestions for city names
export function getCitySuggestions(query, limit = 10) {
  if (!query || query.trim().length < 2) return [];

  const normalized = query.trim().toLowerCase();
  const matches = citiesData.cities.filter(c =>
    c.city.toLowerCase().includes(normalized)
  );

  // Remove duplicates (same city name in multiple states)
  const uniqueCities = new Map();
  matches.forEach(city => {
    const key = `${city.city}, ${city.state}`;
    if (!uniqueCities.has(key)) {
      uniqueCities.set(key, city);
    }
  });

  return Array.from(uniqueCities.values()).slice(0, limit);
}

// Get city and state from ZIP code (returns first match)
export function getCityFromZip(zipCode) {
  const cities = getCitiesByZip(zipCode);
  return cities.length > 0 ? cities[0] : null;
}
