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

    // Combine and filter by relevance
    const allResults = [...usResults, ...mxResults];
    const queryLower = trimmed.toLowerCase();

    // Filter out results that don't actually match the query
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

// Search Mexican locations using Photon (OSM autocomplete service)
async function searchMexicanLocations(query, isPostalCode, limit) {
  try {
    // For postal codes, use Nominatim (Photon doesn't support postal code search well)
    if (isPostalCode) {
      return searchMexicanByPostalCode(query, limit);
    }

    // Use Photon for autocomplete - it supports prefix matching unlike Nominatim
    // bbox: Mexico's approximate bounding box (west, south, east, north)
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=es&limit=${limit * 3}&bbox=-118.5,14.5,-86.5,32.8`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(photonUrl, {
      headers: { 'User-Agent': 'PetRecovery.org' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const features = data.features || [];

    if (features.length === 0) {
      return [];
    }

    // Filter to only Mexican places and transform to our format
    const suggestions = features
      .filter(f => {
        const props = f.properties || {};
        // Only include Mexican results
        return props.country === 'Mexico' || props.country === 'México';
      })
      .filter(f => {
        const props = f.properties || {};
        // Only include cities, towns, villages, municipalities
        const validTypes = ['city', 'town', 'village', 'municipality', 'district', 'locality'];
        return validTypes.includes(props.type) || props.name;
      })
      .map(f => {
        const props = f.properties || {};
        const coords = f.geometry?.coordinates || [0, 0];
        const city = props.name || props.city || props.town || props.village || query;
        const stateCode = getMexicanStateCodeFromName(props.state);

        return {
          city: city,
          state_id: stateCode,
          state_name: props.state || 'México',
          zips: props.postcode ? [props.postcode] : [],
          lat: coords[1],
          lng: coords[0],
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
    console.error('Photon search error:', error);
    return [];
  }
}

// Fallback to Nominatim for postal code searches
async function searchMexicanByPostalCode(postalCode, limit) {
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&country=MX&format=json&limit=${limit}&addressdetails=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'PetRecovery.org' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    return data.map(place => {
      const address = place.address || {};
      const city = address.city || address.town || address.village || address.municipality || address.county || postalCode;
      const stateCode = getMexicanStateCodeFromName(address.state);

      return {
        city: city,
        state_id: stateCode,
        state_name: address.state || 'México',
        zips: [postalCode],
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lon),
        country: 'MX'
      };
    });
  } catch (error) {
    console.error('Nominatim postal code search error:', error);
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
