import { NextResponse } from 'next/server';
import { getCitySuggestions, getCitiesByZip, isValidCity } from '@/app/lib/cities';

// GET /api/cities/suggest?q=search_term - Unified search for US and Mexico
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit')) || 10;

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const trimmed = query.trim();
    const isZip = /^\d{5}$/.test(trimmed);

    // Search both US and Mexico in parallel
    const [usResults, mxResults] = await Promise.all([
      searchUSLocations(trimmed, isZip, limit * 2), // Get more results for sorting
      searchMexicanLocations(trimmed, isZip, limit)
    ]);

    // Combine and sort by relevance
    const allResults = [...usResults, ...mxResults];
    const queryLower = trimmed.toLowerCase();

    // Sort by relevance: exact match > starts with > contains
    allResults.sort((a, b) => {
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

    const allSuggestions = allResults.slice(0, limit);

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

// Search Mexican locations using Nominatim
async function searchMexicanLocations(query, isPostalCode, limit) {
  try {
    let nominatimUrl;

    if (isPostalCode) {
      nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${query}&country=MX&format=json&limit=${limit}&addressdetails=1`;
    } else {
      nominatimUrl = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(query)}&country=MX&format=json&limit=${limit}&addressdetails=1`;
    }

    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'PetRecovery.org' }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (data.length === 0) {
      return [];
    }

    // Transform Nominatim results to match our format
    const suggestions = data.map(place => {
      const address = place.address || {};
      const city = address.city || address.town || address.village || address.municipality || address.county || query;
      const stateCode = getMexicanStateCodeFromName(address.state);
      const postalCode = address.postcode || (isPostalCode ? query : null);

      return {
        city: city,
        state_id: stateCode,
        state_name: address.state || 'México',
        zips: postalCode ? [postalCode] : [],
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lon),
        country: 'MX'
      };
    });

    // Deduplicate by city+state
    const seen = new Set();
    return suggestions.filter(s => {
      const key = `${s.city}-${s.state_id}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (error) {
    console.error('Nominatim search error:', error);
    return [];
  }
}

// Map Mexican state names to state codes
function getMexicanStateCodeFromName(stateName) {
  if (!stateName) return 'MX';

  const nameToCode = {
    'aguascalientes': 'AGS',
    'baja california': 'BC',
    'baja california sur': 'BCS',
    'campeche': 'CAM',
    'chiapas': 'CHIS',
    'chihuahua': 'CHIH',
    'ciudad de méxico': 'CDMX',
    'coahuila': 'COAH',
    'coahuila de zaragoza': 'COAH',
    'colima': 'COL',
    'durango': 'DGO',
    'guanajuato': 'GTO',
    'guerrero': 'GRO',
    'hidalgo': 'HGO',
    'jalisco': 'JAL',
    'méxico': 'MEX',
    'estado de méxico': 'MEX',
    'michoacán': 'MICH',
    'michoacán de ocampo': 'MICH',
    'morelos': 'MOR',
    'nayarit': 'NAY',
    'nuevo león': 'NL',
    'oaxaca': 'OAX',
    'puebla': 'PUE',
    'querétaro': 'QRO',
    'quintana roo': 'QROO',
    'san luis potosí': 'SLP',
    'sinaloa': 'SIN',
    'sonora': 'SON',
    'tabasco': 'TAB',
    'tamaulipas': 'TAMPS',
    'tlaxcala': 'TLAX',
    'veracruz': 'VER',
    'veracruz de ignacio de la llave': 'VER',
    'yucatán': 'YUC',
    'zacatecas': 'ZAC',
  };

  const normalized = stateName.toLowerCase().trim();
  return nameToCode[normalized] || 'MX';
}
