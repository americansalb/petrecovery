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

    // Filter results that match the query (accent-insensitive)
    const filteredResults = allResults.filter(r => {
      const cityNorm = normalizeText(r.city);
      return cityNorm.startsWith(queryNorm) || cityNorm.includes(queryNorm);
    });

    // Sort by relevance: exact > starts with > population > state match > alphabetical
    filteredResults.sort((a, b) => {
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
