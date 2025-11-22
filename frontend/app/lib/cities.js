// US Cities database - inline data instead of JSON import for better compatibility
const citiesData = {
  cities: [
    {"city": "Lynwood", "state": "CA", "zip": "90262"},
    {"city": "Lynwood", "state": "IL", "zip": "60411"},
    {"city": "Chicago Heights", "state": "IL", "zip": "60411"},
    {"city": "Carpentersville", "state": "IL", "zip": "60110"},
    {"city": "Cortland", "state": "IL", "zip": "60112"},
    {"city": "New York", "state": "NY", "zip": "10001"},
    {"city": "Los Angeles", "state": "CA", "zip": "90001"},
    {"city": "Chicago", "state": "IL", "zip": "60601"},
    {"city": "Houston", "state": "TX", "zip": "77001"},
    {"city": "Phoenix", "state": "AZ", "zip": "85001"},
    {"city": "Philadelphia", "state": "PA", "zip": "19019"},
    {"city": "San Antonio", "state": "TX", "zip": "78201"},
    {"city": "San Diego", "state": "CA", "zip": "92101"},
    {"city": "Dallas", "state": "TX", "zip": "75201"},
    {"city": "San Jose", "state": "CA", "zip": "95101"},
    {"city": "Austin", "state": "TX", "zip": "78701"},
    {"city": "Jacksonville", "state": "FL", "zip": "32099"},
    {"city": "Fort Worth", "state": "TX", "zip": "76101"},
    {"city": "Columbus", "state": "OH", "zip": "43004"},
    {"city": "Charlotte", "state": "NC", "zip": "28201"},
    {"city": "San Francisco", "state": "CA", "zip": "94101"},
    {"city": "Indianapolis", "state": "IN", "zip": "46201"},
    {"city": "Seattle", "state": "WA", "zip": "98101"},
    {"city": "Denver", "state": "CO", "zip": "80201"},
    {"city": "Washington", "state": "DC", "zip": "20001"},
    {"city": "Boston", "state": "MA", "zip": "02101"},
    {"city": "El Paso", "state": "TX", "zip": "79901"},
    {"city": "Nashville", "state": "TN", "zip": "37201"},
    {"city": "Detroit", "state": "MI", "zip": "48201"},
    {"city": "Oklahoma City", "state": "OK", "zip": "73101"},
    {"city": "Portland", "state": "OR", "zip": "97201"},
    {"city": "Las Vegas", "state": "NV", "zip": "89101"},
    {"city": "Memphis", "state": "TN", "zip": "37501"},
    {"city": "Louisville", "state": "KY", "zip": "40201"},
    {"city": "Baltimore", "state": "MD", "zip": "21201"},
    {"city": "Milwaukee", "state": "WI", "zip": "53201"},
    {"city": "Albuquerque", "state": "NM", "zip": "87101"},
    {"city": "Tucson", "state": "AZ", "zip": "85701"},
    {"city": "Fresno", "state": "CA", "zip": "93650"},
    {"city": "Mesa", "state": "AZ", "zip": "85201"},
    {"city": "Sacramento", "state": "CA", "zip": "94203"},
    {"city": "Atlanta", "state": "GA", "zip": "30301"},
    {"city": "Kansas City", "state": "MO", "zip": "64101"},
    {"city": "Colorado Springs", "state": "CO", "zip": "80809"},
    {"city": "Omaha", "state": "NE", "zip": "68101"},
    {"city": "Raleigh", "state": "NC", "zip": "27601"},
    {"city": "Miami", "state": "FL", "zip": "33101"},
    {"city": "Long Beach", "state": "CA", "zip": "90801"},
    {"city": "Virginia Beach", "state": "VA", "zip": "23450"},
    {"city": "Oakland", "state": "CA", "zip": "94601"},
    {"city": "Minneapolis", "state": "MN", "zip": "55401"},
    {"city": "Tulsa", "state": "OK", "zip": "74101"},
    {"city": "Tampa", "state": "FL", "zip": "33601"},
    {"city": "Arlington", "state": "TX", "zip": "76010"},
    {"city": "New Orleans", "state": "LA", "zip": "70112"}
  ]
};

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
