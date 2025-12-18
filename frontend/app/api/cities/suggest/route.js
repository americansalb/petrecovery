import { NextResponse } from 'next/server';
import { getCitySuggestions, getCitiesByZip } from '@/app/lib/cities';
import mxCitiesData from '@/app/lib/mxcities.json';

// Load Mexican cities data
const mxCities = mxCitiesData || [];
console.log(`[Cities API] Loaded ${mxCities.length} Mexican cities`);

// GET /api/cities/suggest?q=search_term - Unified search for US and Mexico
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

    // Search both US and Mexico
    const usResults = searchUSLocations(trimmed, isZip, limit * 2);
    const mxResults = searchMexicanLocations(trimmed, limit * 2);

    // Combine results
    const allResults = [...usResults, ...mxResults];
    const queryLower = trimmed.toLowerCase();

    // Filter out results that don't match the query
    const filteredResults = allResults.filter(r => {
      const cityLower = r.city.toLowerCase();
      return cityLower.startsWith(queryLower) || cityLower.includes(queryLower);
    });

    // Sort by relevance: exact match > starts with > contains
    filteredResults.sort((a, b) => {
      const aName = a.city.toLowerCase();
      const bName = b.city.toLowerCase();

      // Exact match gets highest priority
      const aExact = aName === queryLower;
      const bExact = bName === queryLower;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      // Starts with gets second priority
      const aStarts = aName.startsWith(queryLower);
      const bStarts = bName.startsWith(queryLower);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      // For equal relevance, sort alphabetically by city name
      return aName.localeCompare(bName);
    });

    const allSuggestions = filteredResults.slice(0, limit);

    return NextResponse.json({
      suggestions: allSuggestions,
      isZip,
      isValid: allSuggestions.length > 0
    });
  } catch (error) {
    console.error('City suggest error:', error);
    return NextResponse.json({ suggestions: [], error: 'Failed to fetch suggestions' }, { status: 500 });
  }
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

// Check if city name matches its state (likely the capital/main city)
function matchesStateName(city, stateName) {
  if (!city || !stateName) return false;
  const cityLower = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const stateLower = stateName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Exact match, or state contains city name, or city is first word of state
  return cityLower === stateLower ||
         stateLower.startsWith(cityLower) ||
         stateLower.split(' ')[0] === cityLower;
}

// Search Mexican locations using local database (9,321 cities)
function searchMexicanLocations(query, limit) {
  try {
    const queryLower = query.toLowerCase();

    // Search for cities that start with or contain the query
    const matches = mxCities.filter(c => {
      const cityLower = c.city.toLowerCase();
      return cityLower.startsWith(queryLower) || cityLower.includes(queryLower);
    });

    // Sort by relevance: starts with > matches state name > alphabetical
    matches.sort((a, b) => {
      const aName = a.city.toLowerCase();
      const bName = b.city.toLowerCase();

      // Starts with query gets priority
      const aStarts = aName.startsWith(queryLower);
      const bStarts = bName.startsWith(queryLower);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      // City that matches its state name gets priority (it's the main city)
      const aMatchesState = matchesStateName(a.city, a.state_name);
      const bMatchesState = matchesStateName(b.city, b.state_name);
      if (aMatchesState && !bMatchesState) return -1;
      if (bMatchesState && !aMatchesState) return 1;

      return aName.localeCompare(bName);
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
      zips: [],
      country: 'MX'
    }));
  } catch (error) {
    console.error('Mexican search error:', error);
    return [];
  }
}
