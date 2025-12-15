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

// Mexican States (Estados de México)
// All 32 states including CDMX
export const MX_STATES = [
  { code: 'AGS', name: 'Aguascalientes', postalPrefix: '20' },
  { code: 'BC', name: 'Baja California', postalPrefix: '21-22' },
  { code: 'BCS', name: 'Baja California Sur', postalPrefix: '23' },
  { code: 'CAM', name: 'Campeche', postalPrefix: '24' },
  { code: 'CHIS', name: 'Chiapas', postalPrefix: '29-30' },
  { code: 'CHIH', name: 'Chihuahua', postalPrefix: '31-33' },
  { code: 'CDMX', name: 'Ciudad de México', postalPrefix: '01-16' },
  { code: 'COAH', name: 'Coahuila', postalPrefix: '25-27' },
  { code: 'COL', name: 'Colima', postalPrefix: '28' },
  { code: 'DGO', name: 'Durango', postalPrefix: '34-35' },
  { code: 'GTO', name: 'Guanajuato', postalPrefix: '36-38' },
  { code: 'GRO', name: 'Guerrero', postalPrefix: '39-41' },
  { code: 'HGO', name: 'Hidalgo', postalPrefix: '42-43' },
  { code: 'JAL', name: 'Jalisco', postalPrefix: '44-49' },
  { code: 'MEX', name: 'Estado de México', postalPrefix: '50-57' },
  { code: 'MICH', name: 'Michoacán', postalPrefix: '58-61' },
  { code: 'MOR', name: 'Morelos', postalPrefix: '62' },
  { code: 'NAY', name: 'Nayarit', postalPrefix: '63' },
  { code: 'NL', name: 'Nuevo León', postalPrefix: '64-67' },
  { code: 'OAX', name: 'Oaxaca', postalPrefix: '68-71' },
  { code: 'PUE', name: 'Puebla', postalPrefix: '72-75' },
  { code: 'QRO', name: 'Querétaro', postalPrefix: '76' },
  { code: 'QROO', name: 'Quintana Roo', postalPrefix: '77' },
  { code: 'SLP', name: 'San Luis Potosí', postalPrefix: '78-79' },
  { code: 'SIN', name: 'Sinaloa', postalPrefix: '80-82' },
  { code: 'SON', name: 'Sonora', postalPrefix: '83-85' },
  { code: 'TAB', name: 'Tabasco', postalPrefix: '86' },
  { code: 'TAMPS', name: 'Tamaulipas', postalPrefix: '87-89' },
  { code: 'TLAX', name: 'Tlaxcala', postalPrefix: '90' },
  { code: 'VER', name: 'Veracruz', postalPrefix: '91-96' },
  { code: 'YUC', name: 'Yucatán', postalPrefix: '97' },
  { code: 'ZAC', name: 'Zacatecas', postalPrefix: '98-99' },
];

// Major Mexican Cities for quick selection
// These are the 100 most populous cities
export const MX_MAJOR_CITIES = [
  // CDMX Metro Area
  { city: 'Ciudad de México', state: 'CDMX', lat: 19.4326, lng: -99.1332, population: 9209944 },
  { city: 'Ecatepec de Morelos', state: 'MEX', lat: 19.6010, lng: -99.0600, population: 1655015 },
  { city: 'Nezahualcóyotl', state: 'MEX', lat: 19.4006, lng: -99.0086, population: 1077208 },
  { city: 'Naucalpan', state: 'MEX', lat: 19.4784, lng: -99.2397, population: 833779 },
  { city: 'Tlalnepantla', state: 'MEX', lat: 19.5370, lng: -99.1948, population: 672202 },

  // Guadalajara Metro
  { city: 'Guadalajara', state: 'JAL', lat: 20.6597, lng: -103.3496, population: 1495182 },
  { city: 'Zapopan', state: 'JAL', lat: 20.7167, lng: -103.4000, population: 1243756 },
  { city: 'Tlaquepaque', state: 'JAL', lat: 20.6408, lng: -103.3125, population: 608114 },
  { city: 'Tonalá', state: 'JAL', lat: 20.6244, lng: -103.2347, population: 478689 },

  // Monterrey Metro
  { city: 'Monterrey', state: 'NL', lat: 25.6866, lng: -100.3161, population: 1142952 },
  { city: 'Guadalupe', state: 'NL', lat: 25.6775, lng: -100.2597, population: 678006 },
  { city: 'San Nicolás de los Garza', state: 'NL', lat: 25.7500, lng: -100.2833, population: 443273 },
  { city: 'Apodaca', state: 'NL', lat: 25.7833, lng: -100.1833, population: 523370 },
  { city: 'General Escobedo', state: 'NL', lat: 25.8167, lng: -100.3167, population: 363436 },
  { city: 'Santa Catarina', state: 'NL', lat: 25.6733, lng: -100.4581, population: 296954 },
  { city: 'San Pedro Garza García', state: 'NL', lat: 25.6575, lng: -100.4025, population: 122659 },

  // Puebla
  { city: 'Puebla', state: 'PUE', lat: 19.0414, lng: -98.2063, population: 1539819 },

  // Tijuana
  { city: 'Tijuana', state: 'BC', lat: 32.5149, lng: -117.0382, population: 1696923 },
  { city: 'Mexicali', state: 'BC', lat: 32.6245, lng: -115.4523, population: 988417 },
  { city: 'Ensenada', state: 'BC', lat: 31.8667, lng: -116.5964, population: 486639 },

  // León Metro
  { city: 'León', state: 'GTO', lat: 21.1250, lng: -101.6860, population: 1578626 },
  { city: 'Irapuato', state: 'GTO', lat: 20.6736, lng: -101.3478, population: 529440 },
  { city: 'Celaya', state: 'GTO', lat: 20.5236, lng: -100.8156, population: 468469 },
  { city: 'Salamanca', state: 'GTO', lat: 20.5739, lng: -101.1956, population: 260732 },
  { city: 'Guanajuato', state: 'GTO', lat: 21.0190, lng: -101.2574, population: 184239 },

  // Juárez
  { city: 'Ciudad Juárez', state: 'CHIH', lat: 31.6904, lng: -106.4245, population: 1512354 },
  { city: 'Chihuahua', state: 'CHIH', lat: 28.6353, lng: -106.0889, population: 878062 },

  // Querétaro
  { city: 'Santiago de Querétaro', state: 'QRO', lat: 20.5888, lng: -100.3899, population: 878931 },

  // Mérida
  { city: 'Mérida', state: 'YUC', lat: 20.9674, lng: -89.5926, population: 892363 },

  // San Luis Potosí
  { city: 'San Luis Potosí', state: 'SLP', lat: 22.1565, lng: -100.9855, population: 824229 },

  // Aguascalientes
  { city: 'Aguascalientes', state: 'AGS', lat: 21.8853, lng: -102.2916, population: 863893 },

  // Cancún / Riviera Maya
  { city: 'Cancún', state: 'QROO', lat: 21.1619, lng: -86.8515, population: 628306 },
  { city: 'Playa del Carmen', state: 'QROO', lat: 20.6296, lng: -87.0739, population: 275928 },
  { city: 'Chetumal', state: 'QROO', lat: 18.5001, lng: -88.2961, population: 169028 },
  { city: 'Cozumel', state: 'QROO', lat: 20.4230, lng: -86.9223, population: 86415 },

  // Hermosillo
  { city: 'Hermosillo', state: 'SON', lat: 29.0729, lng: -110.9559, population: 884273 },
  { city: 'Ciudad Obregón', state: 'SON', lat: 27.4833, lng: -109.9333, population: 409310 },
  { city: 'Nogales', state: 'SON', lat: 31.3086, lng: -110.9431, population: 233952 },

  // Saltillo / Torreón
  { city: 'Saltillo', state: 'COAH', lat: 25.4232, lng: -101.0053, population: 807537 },
  { city: 'Torreón', state: 'COAH', lat: 25.5428, lng: -103.4068, population: 679288 },
  { city: 'Monclova', state: 'COAH', lat: 26.9072, lng: -101.4214, population: 231107 },

  // Morelia
  { city: 'Morelia', state: 'MICH', lat: 19.7060, lng: -101.1950, population: 784776 },
  { city: 'Uruapan', state: 'MICH', lat: 19.4167, lng: -102.0500, population: 315350 },
  { city: 'Zamora', state: 'MICH', lat: 19.9833, lng: -102.2833, population: 186102 },

  // Cuernavaca
  { city: 'Cuernavaca', state: 'MOR', lat: 18.9242, lng: -99.2216, population: 366321 },

  // Culiacán / Mazatlán
  { city: 'Culiacán', state: 'SIN', lat: 24.8091, lng: -107.3940, population: 905265 },
  { city: 'Mazatlán', state: 'SIN', lat: 23.2494, lng: -106.4111, population: 502547 },
  { city: 'Los Mochis', state: 'SIN', lat: 25.7903, lng: -108.9939, population: 256613 },

  // Villahermosa
  { city: 'Villahermosa', state: 'TAB', lat: 17.9892, lng: -92.9475, population: 640359 },

  // Tuxtla Gutiérrez
  { city: 'Tuxtla Gutiérrez', state: 'CHIS', lat: 16.7528, lng: -93.1167, population: 598710 },
  { city: 'Tapachula', state: 'CHIS', lat: 14.9039, lng: -92.2572, population: 320451 },
  { city: 'San Cristóbal de las Casas', state: 'CHIS', lat: 16.7370, lng: -92.6376, population: 185917 },

  // Reynosa / Matamoros
  { city: 'Reynosa', state: 'TAMPS', lat: 26.0508, lng: -98.2975, population: 608891 },
  { city: 'Matamoros', state: 'TAMPS', lat: 25.8697, lng: -97.5028, population: 489193 },
  { city: 'Nuevo Laredo', state: 'TAMPS', lat: 27.4778, lng: -99.5164, population: 399431 },
  { city: 'Tampico', state: 'TAMPS', lat: 22.2331, lng: -97.8611, population: 314418 },
  { city: 'Ciudad Victoria', state: 'TAMPS', lat: 23.7369, lng: -99.1411, population: 321953 },

  // Acapulco
  { city: 'Acapulco', state: 'GRO', lat: 16.8531, lng: -99.8237, population: 779566 },
  { city: 'Chilpancingo', state: 'GRO', lat: 17.5514, lng: -99.5006, population: 272574 },
  { city: 'Zihuatanejo', state: 'GRO', lat: 17.6417, lng: -101.5514, population: 124162 },

  // Oaxaca
  { city: 'Oaxaca de Juárez', state: 'OAX', lat: 17.0732, lng: -96.7266, population: 270955 },

  // Durango
  { city: 'Durango', state: 'DGO', lat: 24.0277, lng: -104.6532, population: 582267 },

  // La Paz / Los Cabos
  { city: 'La Paz', state: 'BCS', lat: 24.1426, lng: -110.3128, population: 290286 },
  { city: 'Los Cabos', state: 'BCS', lat: 22.8906, lng: -109.9167, population: 287817 },

  // Veracruz
  { city: 'Veracruz', state: 'VER', lat: 19.1738, lng: -96.1342, population: 552156 },
  { city: 'Xalapa', state: 'VER', lat: 19.5438, lng: -96.9102, population: 480841 },
  { city: 'Coatzacoalcos', state: 'VER', lat: 18.1500, lng: -94.4333, population: 305260 },
  { city: 'Córdoba', state: 'VER', lat: 18.8833, lng: -96.9333, population: 196541 },
  { city: 'Poza Rica', state: 'VER', lat: 20.5333, lng: -97.4500, population: 193311 },
  { city: 'Orizaba', state: 'VER', lat: 18.8500, lng: -97.1000, population: 120995 },

  // Campeche
  { city: 'Campeche', state: 'CAM', lat: 19.8301, lng: -90.5349, population: 259005 },

  // Colima
  { city: 'Colima', state: 'COL', lat: 19.2452, lng: -103.7241, population: 150673 },
  { city: 'Manzanillo', state: 'COL', lat: 19.0522, lng: -104.3158, population: 182428 },

  // Tepic
  { city: 'Tepic', state: 'NAY', lat: 21.5039, lng: -104.8946, population: 413608 },

  // Puerto Vallarta
  { city: 'Puerto Vallarta', state: 'JAL', lat: 20.6534, lng: -105.2253, population: 275640 },

  // Pachuca
  { city: 'Pachuca', state: 'HGO', lat: 20.1011, lng: -98.7591, population: 277375 },
  { city: 'Tulancingo', state: 'HGO', lat: 20.0833, lng: -98.3667, population: 151584 },

  // Tlaxcala
  { city: 'Tlaxcala', state: 'TLAX', lat: 19.3139, lng: -98.2404, population: 95051 },
  { city: 'Apizaco', state: 'TLAX', lat: 19.4167, lng: -98.1333, population: 78624 },

  // Zacatecas
  { city: 'Zacatecas', state: 'ZAC', lat: 22.7709, lng: -102.5832, population: 138176 },
  { city: 'Fresnillo', state: 'ZAC', lat: 23.1758, lng: -102.8678, population: 213139 },
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

// Geocode a postal code using Nominatim (supports US and MX)
export async function geocodePostalCode(postalCode, countryCode = 'US') {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&country=${countryCode}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'PetRecovery.org'
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

// Get Mexican state from postal code prefix
export function getMexicanStateFromPostalCode(postalCode) {
  if (!postalCode || postalCode.length < 2) return null;

  const prefix = parseInt(postalCode.substring(0, 2), 10);

  // Postal code ranges by state
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

// Search cities by name (for autocomplete)
export function searchMexicanCities(query, limit = 10) {
  if (!query || query.length < 2) return [];

  const lowerQuery = query.toLowerCase();
  return MX_MAJOR_CITIES
    .filter(city =>
      city.city.toLowerCase().includes(lowerQuery) ||
      city.state.toLowerCase().includes(lowerQuery)
    )
    .slice(0, limit);
}
