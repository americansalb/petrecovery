// Location reference data for supported countries
// Used for dropdowns, validation, and geocoding

// Supported countries
export const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸', postalCodeName: 'ZIP Code', postalCodeLength: 5, postalCodePattern: /^\d{5}$/ },
  { code: 'MX', name: 'México', flag: '🇲🇽', postalCodeName: 'Código Postal', postalCodeLength: 5, postalCodePattern: /^\d{5}$/ },
];

// US States
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'Washington, D.C.' },
];

// Mexican States (Estados de México) - All 32 states
// Used for display/filtering, NOT to limit city selection
export const MX_STATES = [
  { code: 'AGS', name: 'Aguascalientes' },
  { code: 'BC', name: 'Baja California' },
  { code: 'BCS', name: 'Baja California Sur' },
  { code: 'CAM', name: 'Campeche' },
  { code: 'CHIS', name: 'Chiapas' },
  { code: 'CHIH', name: 'Chihuahua' },
  { code: 'CDMX', name: 'Ciudad de México' },
  { code: 'COAH', name: 'Coahuila' },
  { code: 'COL', name: 'Colima' },
  { code: 'DGO', name: 'Durango' },
  { code: 'GTO', name: 'Guanajuato' },
  { code: 'GRO', name: 'Guerrero' },
  { code: 'HGO', name: 'Hidalgo' },
  { code: 'JAL', name: 'Jalisco' },
  { code: 'MEX', name: 'Estado de México' },
  { code: 'MICH', name: 'Michoacán' },
  { code: 'MOR', name: 'Morelos' },
  { code: 'NAY', name: 'Nayarit' },
  { code: 'NL', name: 'Nuevo León' },
  { code: 'OAX', name: 'Oaxaca' },
  { code: 'PUE', name: 'Puebla' },
  { code: 'QRO', name: 'Querétaro' },
  { code: 'QROO', name: 'Quintana Roo' },
  { code: 'SLP', name: 'San Luis Potosí' },
  { code: 'SIN', name: 'Sinaloa' },
  { code: 'SON', name: 'Sonora' },
  { code: 'TAB', name: 'Tabasco' },
  { code: 'TAMPS', name: 'Tamaulipas' },
  { code: 'TLAX', name: 'Tlaxcala' },
  { code: 'VER', name: 'Veracruz' },
  { code: 'YUC', name: 'Yucatán' },
  { code: 'ZAC', name: 'Zacatecas' },
];

// Get states by country code
export function getStatesByCountry(countryCode) {
  switch (countryCode) {
    case 'US':
      return US_STATES;
    case 'MX':
      return MX_STATES;
    default:
      return US_STATES;
  }
}

// Get country info by code
export function getCountryByCode(code) {
  return COUNTRIES.find(c => c.code === code) || COUNTRIES[0];
}

// Validate postal code for a country
export function validatePostalCode(postalCode, countryCode) {
  const country = getCountryByCode(countryCode);
  if (!country) return false;
  return country.postalCodePattern.test(postalCode);
}

// Get state name by code
export function getStateName(stateCode, countryCode = 'US') {
  const states = getStatesByCountry(countryCode);
  const state = states.find(s => s.code === stateCode);
  return state?.name || stateCode;
}

// Geocode a postal code using Nominatim (supports US, MX, and all countries)
// This works for ANY postal code - no predefined city list needed
export async function geocodePostalCode(postalCode, countryCode = 'US') {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&country=${countryCode}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'ReunitePets'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();

    if (data.length > 0) {
      const result = data[0];
      return {
        success: true,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
      };
    }

    return { success: false, error: 'Postal code not found' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Get Mexican state code from postal code prefix
export function getMexicanStateFromPostalCode(postalCode) {
  if (!postalCode || postalCode.length < 2) return null;

  const prefix = parseInt(postalCode.substring(0, 2), 10);

  if (prefix >= 1 && prefix <= 16) return 'CDMX';
  if (prefix === 20) return 'AGS';
  if (prefix >= 21 && prefix <= 22) return 'BC';
  if (prefix === 23) return 'BCS';
  if (prefix === 24) return 'CAM';
  if (prefix >= 25 && prefix <= 27) return 'COAH';
  if (prefix === 28) return 'COL';
  if (prefix >= 29 && prefix <= 30) return 'CHIS';
  if (prefix >= 31 && prefix <= 33) return 'CHIH';
  if (prefix >= 34 && prefix <= 35) return 'DGO';
  if (prefix >= 36 && prefix <= 38) return 'GTO';
  if (prefix >= 39 && prefix <= 41) return 'GRO';
  if (prefix >= 42 && prefix <= 43) return 'HGO';
  if (prefix >= 44 && prefix <= 49) return 'JAL';
  if (prefix >= 50 && prefix <= 57) return 'MEX';
  if (prefix >= 58 && prefix <= 61) return 'MICH';
  if (prefix === 62) return 'MOR';
  if (prefix === 63) return 'NAY';
  if (prefix >= 64 && prefix <= 67) return 'NL';
  if (prefix >= 68 && prefix <= 71) return 'OAX';
  if (prefix >= 72 && prefix <= 75) return 'PUE';
  if (prefix === 76) return 'QRO';
  if (prefix === 77) return 'QROO';
  if (prefix >= 78 && prefix <= 79) return 'SLP';
  if (prefix >= 80 && prefix <= 82) return 'SIN';
  if (prefix >= 83 && prefix <= 85) return 'SON';
  if (prefix === 86) return 'TAB';
  if (prefix >= 87 && prefix <= 89) return 'TAMPS';
  if (prefix === 90) return 'TLAX';
  if (prefix >= 91 && prefix <= 96) return 'VER';
  if (prefix === 97) return 'YUC';
  if (prefix >= 98 && prefix <= 99) return 'ZAC';

  return null;
}
