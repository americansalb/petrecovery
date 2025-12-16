import { NextResponse } from 'next/server';
import { getCitySuggestions, getCitiesByZip, isValidCity } from '@/app/lib/cities';
import { COUNTRIES, MX_STATES, getMexicanStateFromPostalCode } from '@/app/lib/states';

// GET /api/cities/suggest?q=search_term&country=US|MX
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const country = searchParams.get('country') || 'US';
    const limit = parseInt(searchParams.get('limit')) || 10;

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const trimmed = query.trim();

    // Check if it's a ZIP/postal code (5 digits for both US and MX)
    const isZip = /^\d{5}$/.test(trimmed);

    if (country === 'MX') {
      // Mexican city/postal code search via Nominatim
      return await searchMexicanLocations(trimmed, isZip, limit);
    }

    // US city/ZIP search using local database
    if (isZip) {
      const cities = getCitiesByZip(trimmed);
      return NextResponse.json({
        suggestions: cities.slice(0, limit),
        isZip: true,
        isValid: cities.length > 0,
        country: 'US'
      });
    }

    // US city name search
    const suggestions = getCitySuggestions(trimmed, limit);
    const isValid = isValidCity(trimmed);

    return NextResponse.json({
      suggestions,
      isZip: false,
      isValid,
      country: 'US'
    });
  } catch (error) {
    console.error('City suggest error:', error);
    return NextResponse.json({ suggestions: [], error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}

// Search Mexican locations using Nominatim
async function searchMexicanLocations(query, isPostalCode, limit) {
  try {
    let nominatimUrl;

    if (isPostalCode) {
      // Search by postal code
      nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${query}&country=MX&format=json&limit=${limit}&addressdetails=1`;
    } else {
      // Search by city name in Mexico
      nominatimUrl = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(query)}&country=MX&format=json&limit=${limit}&addressdetails=1`;
    }

    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'PetRecovery.org' }
    });

    if (!response.ok) {
      return NextResponse.json({
        suggestions: [],
        isZip: isPostalCode,
        isValid: false,
        country: 'MX'
      });
    }

    const data = await response.json();

    if (data.length === 0) {
      return NextResponse.json({
        suggestions: [],
        isZip: isPostalCode,
        isValid: false,
        country: 'MX'
      });
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
    const uniqueSuggestions = suggestions.filter(s => {
      const key = `${s.city}-${s.state_id}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      suggestions: uniqueSuggestions.slice(0, limit),
      isZip: isPostalCode,
      isValid: uniqueSuggestions.length > 0,
      country: 'MX'
    });
  } catch (error) {
    console.error('Nominatim search error:', error);
    return NextResponse.json({
      suggestions: [],
      isZip: isPostalCode,
      isValid: false,
      country: 'MX',
      error: 'Search failed'
    });
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
