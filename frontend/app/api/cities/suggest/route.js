import { NextResponse } from 'next/server';
import { getCitySuggestions, getCitiesByZip } from '@/app/lib/cities';
import mxCitiesData from '@/app/lib/mxcities.json';
import caCitiesData from '@/app/lib/cacities.json';
import prCitiesData from '@/app/lib/prcities.json';
import naCitiesData from '@/app/lib/nacities.json';
import coCitiesData from '@/app/lib/cocities.json';
import cityPopulations from '@/app/lib/city-populations.json';

// Load cities data
const mxCities = mxCitiesData || [];
const caCities = caCitiesData || [];
const prCities = prCitiesData || [];
const naCities = naCitiesData || [];
const coCities = coCitiesData || [];
console.log(`[Cities API] Loaded ${mxCities.length} MX + ${caCities.length} CA + ${prCities.length} PR + ${naCities.length} NA + ${coCities.length} CO cities`);

// Normalize text for accent-insensitive search (Bogotá -> bogota, São Paulo -> sao paulo)
function normalizeText(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Calculate Levenshtein distance for fuzzy matching
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Check if query fuzzy-matches city name (allows 1-2 typos)
function fuzzyMatch(cityNorm, queryNorm) {
  // Exact prefix match
  if (cityNorm.startsWith(queryNorm) || cityNorm.includes(queryNorm)) {
    return { match: true, distance: 0 };
  }

  // For fuzzy matching, check edit distance on city prefix
  // Use a slightly longer prefix to catch insertions
  const cityPrefix = cityNorm.substring(0, queryNorm.length + 2);
  const distance = levenshteinDistance(queryNorm, cityPrefix);

  // Allow 2 typos for most queries (covers "bogat" -> "bogota")
  const maxDistance = queryNorm.length <= 3 ? 1 : 2;

  if (distance <= maxDistance) {
    return { match: true, distance };
  }

  return { match: false, distance: Infinity };
}

// GET /api/cities/suggest?q=search_term - Unified search for North & South America
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit')) || 10;

    if (!query || query.trim().length < 3) {
      return NextResponse.json({ suggestions: [] });
    }

    const trimmed = query.trim();
    const isZip = /^\d{5}$/.test(trimmed);
    const isCanadianPostal = /^[A-Za-z]\d[A-Za-z]/.test(trimmed);

    // Search all countries/territories
    const usResults = searchUSLocations(trimmed, isZip, limit * 2);
    const mxResults = searchLocations(mxCities, trimmed, 'MX', limit * 2);
    const caResults = searchLocations(caCities, trimmed, 'CA', limit * 2);
    const prResults = searchLocations(prCities, trimmed, 'US', limit * 2); // PR is a US territory
    const naResults = searchNACities(naCities, trimmed, limit * 2); // Caribbean, Central America, etc.
    const coResults = searchLocations(coCities, trimmed, 'CO', limit * 2); // Colombia

    // Combine results
    const allResults = [...usResults, ...mxResults, ...caResults, ...prResults, ...naResults, ...coResults];
    const queryNorm = normalizeText(trimmed);

    // For ZIP codes, return US results directly (don't filter by city name)
    if (isZip && usResults.length > 0) {
      return NextResponse.json({
        suggestions: usResults.slice(0, limit),
        isZip: true,
        isValid: true
      });
    }

    // Filter exact matches (startsWith or includes)
    const exactMatches = allResults.filter(r => {
      const cityNorm = normalizeText(r.city);
      return cityNorm.startsWith(queryNorm) || cityNorm.includes(queryNorm);
    });

    // Sort exact matches by relevance
    exactMatches.sort((a, b) => {
      const aName = normalizeText(a.city);
      const bName = normalizeText(b.city);

      // Exact match gets highest priority
      const aExact = aName === queryNorm;
      const bExact = bName === queryNorm;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      // Starts with gets second priority
      const aStarts = aName.startsWith(queryNorm);
      const bStarts = bName.startsWith(queryNorm);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      // Population
      const aPop = getPopulation(a);
      const bPop = getPopulation(b);
      if (aPop !== bPop) return bPop - aPop;

      // City matches state name (for MX capitals like Puebla, Oaxaca)
      if (a.country === 'MX' || b.country === 'MX') {
        const aMatchesState = matchesStateName(a.city, a.state_name);
        const bMatchesState = matchesStateName(b.city, b.state_name);
        if (aMatchesState && !bMatchesState) return -1;
        if (bMatchesState && !aMatchesState) return 1;
      }

      return aName.localeCompare(bName);
    });

    // If no exact matches or only small cities, find fuzzy "did you mean?" suggestions
    let didYouMean = [];
    const hasLargeCity = exactMatches.some(r => getPopulation(r) > 100000);

    if (exactMatches.length === 0 || !hasLargeCity) {
      // Find fuzzy matches from large cities only (pop > 100k)
      const fuzzyMatches = allResults.filter(r => {
        if (getPopulation(r) < 100000) return false;
        const cityNorm = normalizeText(r.city);
        if (cityNorm.startsWith(queryNorm) || cityNorm.includes(queryNorm)) return false; // Already in exact
        const fuzzy = fuzzyMatch(cityNorm, queryNorm);
        return fuzzy.match && fuzzy.distance <= 2;
      }).sort((a, b) => getPopulation(b) - getPopulation(a));

      didYouMean = fuzzyMatches.slice(0, 3);
    }

    const allSuggestions = exactMatches.slice(0, limit);

    return NextResponse.json({
      suggestions: allSuggestions,
      didYouMean: didYouMean.length > 0 ? didYouMean : undefined,
      isZip: isZip || isCanadianPostal,
      isValid: allSuggestions.length > 0
    });
  } catch (error) {
    console.error('City suggest error:', error);
    return NextResponse.json({ suggestions: [], error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}

// Get population for a city (returns 0 if not in lookup)
function getPopulation(city) {
  const key = `${city.city.toLowerCase()}-${city.state_id.toLowerCase()}-${city.country.toLowerCase()}`;
  return cityPopulations[key] || city.pop || 0;
}

// Check if city name matches its state (likely the capital/main city)
function matchesStateName(city, stateName) {
  if (!city || !stateName) return false;
  const cityLower = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const stateLower = stateName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return cityLower === stateLower ||
         stateLower.startsWith(cityLower) ||
         stateLower.split(' ')[0] === cityLower;
}

// Search US locations using local database
function searchUSLocations(query, isZip, limit) {
  try {
    if (isZip) {
      const cities = getCitiesByZip(query);
      return cities.slice(0, limit).map(c => ({
        ...c,
        country: 'US'
      }));
    }

    const suggestions = getCitySuggestions(query, limit);
    return suggestions.map(c => ({
      ...c,
      country: 'US'
    }));
  } catch (error) {
    console.error('US search error:', error);
    return [];
  }
}

// Search locations in a country database (MX, CA, CO, etc.)
function searchLocations(cities, query, country, limit) {
  try {
    const queryNorm = normalizeText(query);

    // Search for cities that start with or contain the query (accent-insensitive)
    const matches = cities.filter(c => {
      const cityNorm = normalizeText(c.city);
      return cityNorm.startsWith(queryNorm) || cityNorm.includes(queryNorm);
    });

    // Deduplicate by city+state
    const seen = new Set();
    const unique = matches.filter(c => {
      const key = `${c.city}-${c.state_id}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.slice(0, limit).map(c => ({
      city: c.city,
      state_id: c.state_id,
      state_name: c.state_name,
      lat: c.lat,
      lng: c.lng,
      pop: c.pop || 0,
      zips: [],
      country: country
    }));
  } catch (error) {
    console.error(`${country} search error:`, error);
    return [];
  }
}

// Search North American cities (Caribbean, Central America, US territories, etc.)
// These cities already have their country field set in the JSON
function searchNACities(cities, query, limit) {
  try {
    const queryNorm = normalizeText(query);

    // Search for cities that start with or contain the query (accent-insensitive)
    const matches = cities.filter(c => {
      const cityNorm = normalizeText(c.city);
      return cityNorm.startsWith(queryNorm) || cityNorm.includes(queryNorm);
    });

    // Deduplicate by city+state+country
    const seen = new Set();
    const unique = matches.filter(c => {
      const key = `${c.city}-${c.state_id}-${c.country}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.slice(0, limit).map(c => ({
      city: c.city,
      state_id: c.state_id,
      state_name: c.state_name,
      lat: c.lat,
      lng: c.lng,
      pop: c.pop || 0,
      zips: [],
      country: c.country // Use the country from the data (US for territories, country code for others)
    }));
  } catch (error) {
    console.error('NA cities search error:', error);
    return [];
  }
}
