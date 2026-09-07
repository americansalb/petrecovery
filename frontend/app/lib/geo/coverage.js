/**
 * Where street-level imagery exists, by country, plus the city list the
 * "City streets" mode draws from.
 *
 * These lists are curated, not fetched: neither Google nor Apple
 * publishes a machine-readable coverage map. They only steer sampling;
 * the real test is the imagery probe, so a wrong entry costs a few
 * retries, never a wrong answer. Edit freely as coverage changes.
 *
 * Pure data, safe to import from client and server code.
 */

/**
 * Countries and territories with official Google Street View car or
 * trekker coverage (ISO 3166-1 alpha-2). Countries missing here can
 * still be picked in Country mode; the probe decides.
 */
export const GOOGLE_COVERAGE = new Set([
  // Americas
  'US', 'CA', 'MX', 'GT', 'CR', 'PA', 'CO', 'EC', 'PE', 'BO', 'CL', 'AR', 'UY', 'BR',
  'PR', 'VI', 'DO', 'CW', 'GP', 'MQ', 'BM', 'PM', 'GL',
  // Europe
  'AD', 'AL', 'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR',
  'GB', 'GI', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'ME',
  'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SK', 'SM', 'TR',
  'UA', 'FO', 'AX', 'GG', 'JE', 'IM', 'SJ',
  // Asia
  'JP', 'KR', 'TW', 'HK', 'MO', 'MN', 'SG', 'MY', 'TH', 'KH', 'LA', 'VN', 'PH', 'ID',
  'BD', 'BT', 'LK', 'IN', 'KG', 'KZ', 'IL', 'JO', 'PS', 'LB', 'AE', 'QA',
  // Africa
  'ZA', 'LS', 'SZ', 'BW', 'NG', 'GH', 'SN', 'KE', 'UG', 'RW', 'TZ', 'TN', 'MG', 'RE',
  // Oceania
  'AU', 'NZ', 'PF', 'NC', 'GU', 'MP', 'AS',
]);

/** Countries where Apple Look Around has coverage (mostly cities). */
export const APPLE_COVERAGE = new Set([
  'US', 'CA', 'GB', 'IE', 'JP', 'AU', 'NZ', 'SG', 'HK', 'FR', 'DE', 'IT', 'ES', 'PT',
  'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IL',
]);

/** The Apple list in plain words, for the lobby: where the free tier plays. */
export const APPLE_COVERAGE_NAMES = {
  US: 'the United States', CA: 'Canada', GB: 'the UK', IE: 'Ireland', JP: 'Japan', AU: 'Australia', NZ: 'New Zealand',
  SG: 'Singapore', HK: 'Hong Kong', FR: 'France', DE: 'Germany', IT: 'Italy', ES: 'Spain', PT: 'Portugal',
  NL: 'the Netherlands', BE: 'Belgium', AT: 'Austria', CH: 'Switzerland', SE: 'Sweden', NO: 'Norway', DK: 'Denmark',
  FI: 'Finland', IL: 'Israel',
};

/** "the United States, Canada, ... and Israel" */
export function appleCoverageSentence() {
  const names = [...APPLE_COVERAGE].map((cc) => APPLE_COVERAGE_NAMES[cc] || cc);
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Large cities with dense street-level coverage from both providers.
 * [name, country, lat, lng, radiusKm]. The radius is how far from the
 * centre a round may start; big metros get more room.
 */
const CITY_ROWS = [
  // United States
  ['New York', 'US', 40.7128, -74.006, 14], ['Los Angeles', 'US', 34.0522, -118.2437, 16],
  ['Chicago', 'US', 41.8781, -87.6298, 12], ['Houston', 'US', 29.7604, -95.3698, 14],
  ['Phoenix', 'US', 33.4484, -112.074, 12], ['Philadelphia', 'US', 39.9526, -75.1652, 10],
  ['San Antonio', 'US', 29.4241, -98.4936, 10], ['San Diego', 'US', 32.7157, -117.1611, 10],
  ['Dallas', 'US', 32.7767, -96.797, 12], ['San Jose', 'US', 37.3382, -121.8863, 8],
  ['Austin', 'US', 30.2672, -97.7431, 10], ['Jacksonville', 'US', 30.3322, -81.6557, 10],
  ['San Francisco', 'US', 37.7749, -122.4194, 6], ['Seattle', 'US', 47.6062, -122.3321, 8],
  ['Denver', 'US', 39.7392, -104.9903, 10], ['Boston', 'US', 42.3601, -71.0589, 8],
  ['Washington', 'US', 38.9072, -77.0369, 8], ['Nashville', 'US', 36.1627, -86.7816, 10],
  ['Portland', 'US', 45.5152, -122.6784, 8], ['Las Vegas', 'US', 36.1699, -115.1398, 10],
  ['Miami', 'US', 25.7617, -80.1918, 10], ['Atlanta', 'US', 33.749, -84.388, 10],
  ['Minneapolis', 'US', 44.9778, -93.265, 8], ['Detroit', 'US', 42.3314, -83.0458, 10],
  ['Salt Lake City', 'US', 40.7608, -111.891, 8], ['Honolulu', 'US', 21.3069, -157.8583, 6],
  ['New Orleans', 'US', 29.9511, -90.0715, 8], ['Kansas City', 'US', 39.0997, -94.5786, 10],
  ['St. Louis', 'US', 38.627, -90.1994, 8], ['Pittsburgh', 'US', 40.4406, -79.9959, 8],
  ['Cleveland', 'US', 41.4993, -81.6944, 8], ['Charlotte', 'US', 35.2271, -80.8431, 10],
  ['Indianapolis', 'US', 39.7684, -86.1581, 10], ['Columbus', 'US', 39.9612, -82.9988, 10],
  ['Milwaukee', 'US', 43.0389, -87.9065, 8], ['Baltimore', 'US', 39.2904, -76.6122, 8],
  ['Raleigh', 'US', 35.7796, -78.6382, 8], ['Tampa', 'US', 27.9506, -82.4572, 8],
  ['Orlando', 'US', 28.5383, -81.3792, 8], ['Sacramento', 'US', 38.5816, -121.4944, 8],
  ['Albuquerque', 'US', 35.0844, -106.6504, 8], ['Oklahoma City', 'US', 35.4676, -97.5164, 10],
  ['Omaha', 'US', 41.2565, -95.9345, 8], ['Boise', 'US', 43.615, -116.2023, 6],
  ['Anchorage', 'US', 61.2181, -149.9003, 6],
  // Canada
  ['Toronto', 'CA', 43.6532, -79.3832, 12], ['Montreal', 'CA', 45.5017, -73.5673, 10],
  ['Vancouver', 'CA', 49.2827, -123.1207, 10], ['Calgary', 'CA', 51.0447, -114.0719, 10],
  ['Edmonton', 'CA', 53.5461, -113.4938, 10], ['Ottawa', 'CA', 45.4215, -75.6972, 8],
  ['Winnipeg', 'CA', 49.8951, -97.1384, 8], ['Quebec City', 'CA', 46.8139, -71.208, 6],
  ['Halifax', 'CA', 44.6488, -63.5752, 6], ['Victoria', 'CA', 48.4284, -123.3656, 5],
  // United Kingdom and Ireland
  ['London', 'GB', 51.5074, -0.1278, 16], ['Manchester', 'GB', 53.4808, -2.2426, 8],
  ['Birmingham', 'GB', 52.4862, -1.8904, 8], ['Edinburgh', 'GB', 55.9533, -3.1883, 6],
  ['Glasgow', 'GB', 55.8642, -4.2518, 8], ['Liverpool', 'GB', 53.4084, -2.9916, 6],
  ['Leeds', 'GB', 53.8008, -1.5491, 6], ['Bristol', 'GB', 51.4545, -2.5879, 6],
  ['Cardiff', 'GB', 51.4816, -3.1791, 5], ['Newcastle', 'GB', 54.9783, -1.6178, 6],
  ['Belfast', 'GB', 54.5973, -5.9301, 6], ['Oxford', 'GB', 51.752, -1.2577, 4],
  ['Cambridge', 'GB', 52.2053, 0.1218, 4], ['Brighton', 'GB', 50.8225, -0.1372, 4],
  ['Dublin', 'IE', 53.3498, -6.2603, 8], ['Cork', 'IE', 51.8985, -8.4756, 5],
  ['Galway', 'IE', 53.2707, -9.0568, 4], ['Limerick', 'IE', 52.6638, -8.6267, 4],
  // Japan
  ['Tokyo', 'JP', 35.6762, 139.6503, 18], ['Osaka', 'JP', 34.6937, 135.5023, 12],
  ['Kyoto', 'JP', 35.0116, 135.7681, 8], ['Nagoya', 'JP', 35.1815, 136.9066, 10],
  ['Sapporo', 'JP', 43.0618, 141.3545, 8], ['Fukuoka', 'JP', 33.5904, 130.4017, 8],
  ['Kobe', 'JP', 34.6901, 135.1955, 6], ['Hiroshima', 'JP', 34.3853, 132.4553, 6],
  ['Sendai', 'JP', 38.2682, 140.8694, 6], ['Yokohama', 'JP', 35.4437, 139.638, 8],
  ['Nara', 'JP', 34.6851, 135.8048, 4], ['Kanazawa', 'JP', 36.5613, 136.6562, 4],
  // Australia and New Zealand
  ['Sydney', 'AU', -33.8688, 151.2093, 16], ['Melbourne', 'AU', -37.8136, 144.9631, 16],
  ['Brisbane', 'AU', -27.4698, 153.0251, 12], ['Perth', 'AU', -31.9505, 115.8605, 12],
  ['Adelaide', 'AU', -34.9285, 138.6007, 10], ['Canberra', 'AU', -35.2809, 149.13, 8],
  ['Hobart', 'AU', -42.8821, 147.3272, 6], ['Gold Coast', 'AU', -28.0167, 153.4, 10],
  ['Darwin', 'AU', -12.4634, 130.8456, 6],
  ['Auckland', 'NZ', -36.8485, 174.7633, 12], ['Wellington', 'NZ', -41.2865, 174.7762, 6],
  ['Christchurch', 'NZ', -43.5321, 172.6362, 8], ['Queenstown', 'NZ', -45.0312, 168.6626, 4],
  ['Dunedin', 'NZ', -45.8788, 170.5028, 5],
  // Singapore and Hong Kong
  ['Singapore', 'SG', 1.3521, 103.8198, 10], ['Hong Kong', 'HK', 22.3193, 114.1694, 10],
  // France
  ['Paris', 'FR', 48.8566, 2.3522, 12], ['Lyon', 'FR', 45.764, 4.8357, 8],
  ['Marseille', 'FR', 43.2965, 5.3698, 8], ['Toulouse', 'FR', 43.6047, 1.4442, 8],
  ['Nice', 'FR', 43.7102, 7.262, 6], ['Bordeaux', 'FR', 44.8378, -0.5792, 8],
  ['Nantes', 'FR', 47.2184, -1.5536, 6], ['Strasbourg', 'FR', 48.5734, 7.7521, 6],
  ['Lille', 'FR', 50.6292, 3.0573, 6], ['Montpellier', 'FR', 43.6108, 3.8767, 6],
  // Germany
  ['Berlin', 'DE', 52.52, 13.405, 14], ['Munich', 'DE', 48.1351, 11.582, 10],
  ['Hamburg', 'DE', 53.5511, 9.9937, 10], ['Frankfurt', 'DE', 50.1109, 8.6821, 8],
  ['Cologne', 'DE', 50.9375, 6.9603, 8], ['Stuttgart', 'DE', 48.7758, 9.1829, 8],
  ['Dusseldorf', 'DE', 51.2277, 6.7735, 6], ['Leipzig', 'DE', 51.3397, 12.3731, 6],
  ['Dresden', 'DE', 51.0504, 13.7373, 6], ['Nuremberg', 'DE', 49.4521, 11.0767, 6],
  ['Hanover', 'DE', 52.3759, 9.732, 6], ['Bremen', 'DE', 53.0793, 8.8017, 6],
  // Italy
  ['Rome', 'IT', 41.9028, 12.4964, 12], ['Milan', 'IT', 45.4642, 9.19, 10],
  ['Naples', 'IT', 40.8518, 14.2681, 8], ['Turin', 'IT', 45.0703, 7.6869, 8],
  ['Florence', 'IT', 43.7696, 11.2558, 6], ['Bologna', 'IT', 44.4949, 11.3426, 6],
  ['Venice', 'IT', 45.4408, 12.3155, 4], ['Genoa', 'IT', 44.4056, 8.9463, 6],
  ['Palermo', 'IT', 38.1157, 13.3615, 6], ['Verona', 'IT', 45.4384, 10.9916, 5],
  // Spain and Portugal
  ['Madrid', 'ES', 40.4168, -3.7038, 12], ['Barcelona', 'ES', 41.3874, 2.1686, 10],
  ['Valencia', 'ES', 39.4699, -0.3763, 8], ['Seville', 'ES', 37.3891, -5.9845, 8],
  ['Bilbao', 'ES', 43.263, -2.935, 6], ['Malaga', 'ES', 36.7213, -4.4214, 6],
  ['Zaragoza', 'ES', 41.6488, -0.8891, 6], ['Palma', 'ES', 39.5696, 2.6502, 5],
  ['Lisbon', 'PT', 38.7223, -9.1393, 8], ['Porto', 'PT', 41.1579, -8.6291, 6],
  ['Coimbra', 'PT', 40.2033, -8.4103, 4], ['Faro', 'PT', 37.0194, -7.9322, 4],
  // Benelux
  ['Amsterdam', 'NL', 52.3676, 4.9041, 8], ['Rotterdam', 'NL', 51.9244, 4.4777, 8],
  ['The Hague', 'NL', 52.0705, 4.3007, 6], ['Utrecht', 'NL', 52.0907, 5.1214, 6],
  ['Eindhoven', 'NL', 51.4416, 5.4697, 6],
  ['Brussels', 'BE', 50.8503, 4.3517, 8], ['Antwerp', 'BE', 51.2194, 4.4025, 6],
  ['Ghent', 'BE', 51.0543, 3.7174, 5], ['Bruges', 'BE', 51.2093, 3.2247, 4],
  ['Liege', 'BE', 50.6326, 5.5797, 5],
  // Austria and Switzerland
  ['Vienna', 'AT', 48.2082, 16.3738, 10], ['Salzburg', 'AT', 47.8095, 13.055, 5],
  ['Graz', 'AT', 47.0707, 15.4395, 6], ['Innsbruck', 'AT', 47.2692, 11.4041, 4],
  ['Linz', 'AT', 48.3069, 14.2858, 5],
  ['Zurich', 'CH', 47.3769, 8.5417, 8], ['Geneva', 'CH', 46.2044, 6.1432, 6],
  ['Bern', 'CH', 46.948, 7.4474, 5], ['Basel', 'CH', 47.5596, 7.5886, 5],
  ['Lausanne', 'CH', 46.5197, 6.6323, 5], ['Lucerne', 'CH', 47.0502, 8.3093, 4],
  // Nordics
  ['Stockholm', 'SE', 59.3293, 18.0686, 10], ['Gothenburg', 'SE', 57.7089, 11.9746, 8],
  ['Malmo', 'SE', 55.605, 13.0038, 6], ['Uppsala', 'SE', 59.8586, 17.6389, 5],
  ['Oslo', 'NO', 59.9139, 10.7522, 8], ['Bergen', 'NO', 60.3913, 5.3221, 6],
  ['Trondheim', 'NO', 63.4305, 10.3951, 5], ['Stavanger', 'NO', 58.97, 5.7331, 5],
  ['Copenhagen', 'DK', 55.6761, 12.5683, 10], ['Aarhus', 'DK', 56.1629, 10.2039, 6],
  ['Odense', 'DK', 55.4038, 10.4024, 5], ['Aalborg', 'DK', 57.0488, 9.9217, 5],
  ['Helsinki', 'FI', 60.1699, 24.9384, 8], ['Tampere', 'FI', 61.4978, 23.761, 6],
  ['Turku', 'FI', 60.4518, 22.2666, 5], ['Oulu', 'FI', 65.0121, 25.4651, 5],
  // Israel
  ['Tel Aviv', 'IL', 32.0853, 34.7818, 8], ['Jerusalem', 'IL', 31.7683, 35.2137, 6],
  ['Haifa', 'IL', 32.794, 34.9896, 6],
];

export const CITIES = CITY_ROWS.map(([name, country, lat, lng, radiusKm]) => ({
  name,
  country,
  lat,
  lng,
  radiusKm,
}));

/** Cities usable for a provider. */
export function citiesFor(provider) {
  const set = provider === 'apple' ? APPLE_COVERAGE : GOOGLE_COVERAGE;
  return CITIES.filter((city) => set.has(city.country));
}

export function hasGoogleCoverage(cca2) {
  return GOOGLE_COVERAGE.has(String(cca2 || '').toUpperCase());
}

export function hasAppleCoverage(cca2) {
  return APPLE_COVERAGE.has(String(cca2 || '').toUpperCase());
}
