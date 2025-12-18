import { NextResponse } from 'next/server';
import { getCitySuggestions, getCitiesByZip } from '@/app/lib/cities';
import mxCitiesData from '@/app/lib/mxcities.json';
import caCitiesData from '@/app/lib/cacities.json';
import cityPopulations from '@/app/lib/city-populations.json';

// Load cities data
const mxCities = mxCitiesData || [];
const caCities = caCitiesData || [];
console.log(`[Cities API] Loaded ${mxCities.length} Mexican + ${caCities.length} Canadian cities`);

// GET /api/cities/suggest?q=search_term - Unified search for US, Mexico, and Canada
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

    // Search all three countries
    const usResults = searchUSLocations(trimmed, isZip, limit * 2);
    const mxResults = searchLocations(mxCities, trimmed, 'MX', limit * 2);
    const caResults = searchLocations(caCities, trimmed, 'CA', limit * 2);

    // Combine results
    const allResults = [...usResults, ...mxResults, ...caResults];
    const queryLower = trimmed.toLowerCase();

    // Filter results that match the query
    const filteredResults = allResults.filter(r => {
      const cityLower = r.city.toLowerCase();
      return cityLower.startsWith(queryLower) || cityLower.includes(queryLower);
    });

    // Sort by relevance: exact > starts with > population > state match > alphabetical
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

      // Population (for cities 50k+)
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

    const allSuggestions = filteredResults.slice(0, limit);

    return NextResponse.json({
      suggestions: allSuggestions,
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

// Search locations in a country database (MX or CA)
function searchLocations(cities, query, country, limit) {
  try {
    const queryLower = query.toLowerCase();

    // Search for cities that start with or contain the query
    const matches = cities.filter(c => {
      const cityLower = c.city.toLowerCase();
      return cityLower.startsWith(queryLower) || cityLower.includes(queryLower);
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
