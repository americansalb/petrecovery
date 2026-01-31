// ZIP Code to City and Metro Area Mapping Database
// This maps ZIP code ranges to their corresponding cities and parent metro areas

export const ZIP_TO_METRO_MAPPING = [
  // Chicago Metro Area
  {
    metro: 'Chicago, IL',
    metroValue: 'CHICAGO_IL',
    zipRanges: [
      { start: 60001, end: 60007, city: 'Arlington Heights' },
      { start: 60008, end: 60008, city: 'Rolling Meadows' },
      { start: 60010, end: 60010, city: 'Barrington' },
      { start: 60015, end: 60015, city: 'Deerfield' },
      { start: 60016, end: 60018, city: 'Des Plaines' },
      { start: 60025, end: 60026, city: 'Glenview' },
      { start: 60029, end: 60029, city: 'Golf' },
      { start: 60043, end: 60043, city: 'Kenilworth' },
      { start: 60053, end: 60053, city: 'Morton Grove' },
      { start: 60056, end: 60056, city: 'Mount Prospect' },
      { start: 60062, end: 60065, city: 'Northbrook' },
      { start: 60068, end: 60068, city: 'Park Ridge' },
      { start: 60076, end: 60077, city: 'Skokie' },
      { start: 60091, end: 60091, city: 'Wilmette' },
      { start: 60093, end: 60093, city: 'Winnetka' },
      { start: 60101, end: 60101, city: 'Addison' },
      { start: 60103, end: 60103, city: 'Bartlett' },
      { start: 60106, end: 60106, city: 'Bensenville' },
      { start: 60110, end: 60110, city: 'Carpentersville' },
      { start: 60118, end: 60119, city: 'East Dundee' },
      { start: 60120, end: 60124, city: 'Elgin' },  // ⭐ FIXED: Extended range to include 60122, 60123, 60124
      { start: 60126, end: 60126, city: 'Elmhurst' },
      { start: 60131, end: 60131, city: 'Franklin Park' },
      { start: 60133, end: 60133, city: 'Hanover Park' },
      { start: 60137, end: 60139, city: 'Glen Ellyn' },
      { start: 60148, end: 60148, city: 'Lombard' },
      { start: 60153, end: 60154, city: 'Maywood' },
      { start: 60160, end: 60160, city: 'Melrose Park' },
      { start: 60164, end: 60165, city: 'Melrose Park' },
      { start: 60173, end: 60173, city: 'Schaumburg' },
      { start: 60176, end: 60177, city: 'Schiller Park' },
      { start: 60181, end: 60181, city: 'Villa Park' },
      { start: 60188, end: 60189, city: 'Carol Stream' },
      { start: 60193, end: 60194, city: 'Schaumburg' },
      { start: 60201, end: 60204, city: 'Evanston' },
      { start: 60301, end: 60305, city: 'Oak Park' },
      { start: 60401, end: 60401, city: 'Beecher' },
      { start: 60406, end: 60406, city: 'Blue Island' },
      { start: 60409, end: 60409, city: 'Calumet City' },
      { start: 60415, end: 60415, city: 'Chicago Heights' },
      { start: 60417, end: 60417, city: 'Crete' },
      { start: 60419, end: 60419, city: 'Dolton' },
      { start: 60422, end: 60422, city: 'Flossmoor' },
      { start: 60425, end: 60426, city: 'Glenwood' },
      { start: 60429, end: 60429, city: 'Hazel Crest' },
      { start: 60430, end: 60430, city: 'Homewood' },
      { start: 60443, end: 60443, city: 'Matteson' },
      { start: 60445, end: 60445, city: 'Midlothian' },
      { start: 60451, end: 60451, city: 'New Lenox' },
      { start: 60452, end: 60453, city: 'Oak Forest' },
      { start: 60455, end: 60455, city: 'Bridgeview' },
      { start: 60458, end: 60458, city: 'Justice' },
      { start: 60462, end: 60462, city: 'Orland Park' },
      { start: 60463, end: 60463, city: 'Palos Heights' },
      { start: 60464, end: 60465, city: 'Palos Park' },
      { start: 60467, end: 60467, city: 'Orland Park' },
      { start: 60472, end: 60472, city: 'Robbins' },
      { start: 60473, end: 60473, city: 'South Holland' },
      { start: 60475, end: 60475, city: 'Steger' },
      { start: 60477, end: 60477, city: 'Tinley Park' },
      { start: 60478, end: 60478, city: 'Country Club Hills' },
      { start: 60480, end: 60480, city: 'Willow Springs' },
      { start: 60501, end: 60501, city: 'Summit' },
      { start: 60513, end: 60513, city: 'Brookfield' },
      { start: 60525, end: 60526, city: 'La Grange' },
      { start: 60534, end: 60534, city: 'Lyons' },
      { start: 60546, end: 60546, city: 'Riverside' },
      { start: 60558, end: 60558, city: 'Western Springs' },
      { start: 60601, end: 60661, city: 'Chicago' },
      { start: 60701, end: 60701, city: 'Chicago' },
      { start: 60706, end: 60707, city: 'Harwood Heights' },
      { start: 60712, end: 60712, city: 'Lincolnwood' },
      { start: 60714, end: 60714, city: 'Niles' },
      { start: 60803, end: 60805, city: 'Alsip' },
      { start: 60827, end: 60827, city: 'Riverdale' }
    ]
  },

  // Los Angeles Metro Area
  {
    metro: 'Los Angeles, CA',
    metroValue: 'LOS_ANGELES_CA',
    zipRanges: [
      { start: 90001, end: 90089, city: 'Los Angeles' },
      { start: 90201, end: 90213, city: 'Bell' },
      { start: 90220, end: 90221, city: 'Compton' },
      { start: 90240, end: 90241, city: 'Downey' },
      { start: 90245, end: 90245, city: 'El Segundo' },
      { start: 90247, end: 90248, city: 'Gardena' },
      { start: 90254, end: 90254, city: 'Hermosa Beach' },
      { start: 90255, end: 90255, city: 'Huntington Park' },
      { start: 90260, end: 90262, city: 'Lawndale' },
      { start: 90265, end: 90265, city: 'Malibu' },
      { start: 90266, end: 90267, city: 'Manhattan Beach' },
      { start: 90270, end: 90270, city: 'Maywood' },
      { start: 90272, end: 90272, city: 'Pacific Palisades' },
      { start: 90274, end: 90275, city: 'Palos Verdes Peninsula' },
      { start: 90277, end: 90278, city: 'Redondo Beach' },
      { start: 90280, end: 90280, city: 'South Gate' },
      { start: 90290, end: 90296, city: 'Topanga' },
      { start: 90301, end: 90313, city: 'Inglewood' },
      { start: 90401, end: 90411, city: 'Santa Monica' },
      { start: 90501, end: 90510, city: 'Torrance' },
      { start: 90601, end: 90610, city: 'Whittier' },
      { start: 90650, end: 90652, city: 'Norwalk' },
      { start: 90660, end: 90662, city: 'Pico Rivera' },
      { start: 90670, end: 90670, city: 'Santa Fe Springs' },
      { start: 90701, end: 90703, city: 'Artesia' },
      { start: 90710, end: 90717, city: 'Harbor City' },
      { start: 90720, end: 90721, city: 'Los Alamitos' },
      { start: 90723, end: 90723, city: 'Paramount' },
      { start: 90731, end: 90734, city: 'San Pedro' },
      { start: 90740, end: 90743, city: 'Seal Beach' },
      { start: 90744, end: 90749, city: 'Wilmington' },
      { start: 90801, end: 90815, city: 'Long Beach' },
      { start: 91001, end: 91007, city: 'Altadena' },
      { start: 91010, end: 91010, city: 'Duarte' },
      { start: 91016, end: 91017, city: 'Monrovia' },
      { start: 91020, end: 91021, city: 'Montrose' },
      { start: 91024, end: 91025, city: 'Sierra Madre' },
      { start: 91030, end: 91031, city: 'South Pasadena' },
      { start: 91040, end: 91046, city: 'Sunland' },
      { start: 91101, end: 91109, city: 'Pasadena' },
      { start: 91201, end: 91210, city: 'Glendale' },
      { start: 91301, end: 91313, city: 'Agoura Hills' },
      { start: 91320, end: 91320, city: 'Newbury Park' },
      { start: 91321, end: 91322, city: 'Newhall' },
      { start: 91324, end: 91326, city: 'Northridge' },
      { start: 91330, end: 91331, city: 'Northridge' },
      { start: 91335, end: 91335, city: 'Reseda' },
      { start: 91340, end: 91346, city: 'San Fernando' },
      { start: 91350, end: 91355, city: 'Santa Clarita' },
      { start: 91360, end: 91362, city: 'Thousand Oaks' },
      { start: 91364, end: 91367, city: 'Woodland Hills' },
      { start: 91401, end: 91423, city: 'Van Nuys' },
      { start: 91501, end: 91510, city: 'Burbank' },
      { start: 91601, end: 91609, city: 'North Hollywood' },
      { start: 91701, end: 91710, city: 'Rancho Cucamonga' },
      { start: 91722, end: 91724, city: 'Covina' },
      { start: 91730, end: 91731, city: 'Rancho Cucamonga' },
      { start: 91740, end: 91741, city: 'Glendora' },
      { start: 91744, end: 91746, city: 'La Puente' },
      { start: 91748, end: 91749, city: 'Rowland Heights' },
      { start: 91750, end: 91752, city: 'La Verne' },
      { start: 91754, end: 91756, city: 'Monterey Park' },
      { start: 91765, end: 91768, city: 'Pomona' },
      { start: 91770, end: 91772, city: 'Rosemead' },
      { start: 91773, end: 91773, city: 'San Dimas' },
      { start: 91775, end: 91778, city: 'San Gabriel' },
      { start: 91780, end: 91780, city: 'Temple City' },
      { start: 91789, end: 91791, city: 'Walnut' },
      { start: 91801, end: 91804, city: 'Alhambra' }
    ]
  },

  // New York Metro Area
  {
    metro: 'New York, NY',
    metroValue: 'NEW_YORK_NY',
    zipRanges: [
      { start: 10001, end: 10286, city: 'Manhattan' },
      { start: 10301, end: 10314, city: 'Staten Island' },
      { start: 10451, end: 10475, city: 'Bronx' },
      { start: 11004, end: 11005, city: 'Glen Oaks' },
      { start: 11101, end: 11109, city: 'Long Island City' },
      { start: 11201, end: 11256, city: 'Brooklyn' },
      { start: 11351, end: 11380, city: 'Flushing' },
      { start: 11385, end: 11386, city: 'Ridgewood' },
      { start: 11411, end: 11412, city: 'Cambria Heights' },
      { start: 11414, end: 11416, city: 'Howard Beach' },
      { start: 11417, end: 11423, city: 'Ozone Park' },
      { start: 11426, end: 11429, city: 'Bellerose' },
      { start: 11432, end: 11436, city: 'Jamaica' },
      { start: 11691, end: 11694, city: 'Far Rockaway' }
    ]
  },

  // San Francisco Bay Area
  {
    metro: 'San Francisco, CA',
    metroValue: 'SAN_FRANCISCO_CA',
    zipRanges: [
      { start: 94002, end: 94005, city: 'Belmont' },
      { start: 94010, end: 94011, city: 'Burlingame' },
      { start: 94014, end: 94015, city: 'Daly City' },
      { start: 94019, end: 94019, city: 'Half Moon Bay' },
      { start: 94021, end: 94028, city: 'Atherton' },
      { start: 94030, end: 94030, city: 'Millbrae' },
      { start: 94037, end: 94038, city: 'Montara' },
      { start: 94044, end: 94044, city: 'Pacifica' },
      { start: 94061, end: 94063, city: 'Redwood City' },
      { start: 94065, end: 94066, city: 'Redwood City' },
      { start: 94070, end: 94070, city: 'San Carlos' },
      { start: 94074, end: 94074, city: 'San Gregorio' },
      { start: 94080, end: 94083, city: 'South San Francisco' },
      { start: 94101, end: 94188, city: 'San Francisco' },
      { start: 94301, end: 94309, city: 'Palo Alto' },
      { start: 94401, end: 94497, city: 'San Mateo' },
      { start: 94501, end: 94502, city: 'Alameda' },
      { start: 94536, end: 94539, city: 'Fremont' },
      { start: 94541, end: 94545, city: 'Hayward' },
      { start: 94555, end: 94557, city: 'Fremont' },
      { start: 94560, end: 94560, city: 'Newark' },
      { start: 94566, end: 94568, city: 'Pleasanton' },
      { start: 94577, end: 94580, city: 'San Leandro' },
      { start: 94586, end: 94588, city: 'Sunol' },
      { start: 94601, end: 94615, city: 'Oakland' },
      { start: 94618, end: 94621, city: 'Oakland' },
      { start: 94701, end: 94710, city: 'Berkeley' },
      { start: 94801, end: 94808, city: 'Richmond' },
      { start: 94901, end: 94915, city: 'San Rafael' },
      { start: 94920, end: 94920, city: 'Belvedere Tiburon' },
      { start: 94925, end: 94925, city: 'Corte Madera' },
      { start: 94930, end: 94930, city: 'Fairfax' },
      { start: 94939, end: 94940, city: 'Larkspur' },
      { start: 94941, end: 94942, city: 'Mill Valley' },
      { start: 94945, end: 94947, city: 'Novato' },
      { start: 94949, end: 94949, city: 'Novato' },
      { start: 94960, end: 94960, city: 'San Anselmo' },
      { start: 94965, end: 94965, city: 'Sausalito' },
      { start: 95002, end: 95003, city: 'Alviso' },
      { start: 95008, end: 95009, city: 'Campbell' },
      { start: 95014, end: 95014, city: 'Cupertino' },
      { start: 95032, end: 95033, city: 'Los Gatos' },
      { start: 95050, end: 95056, city: 'Santa Clara' },
      { start: 95070, end: 95071, city: 'Saratoga' },
      { start: 95110, end: 95113, city: 'San Jose' },
      { start: 95116, end: 95139, city: 'San Jose' }
    ]
  },

  // Houston Metro Area
  {
    metro: 'Houston, TX',
    metroValue: 'HOUSTON_TX',
    zipRanges: [
      { start: 77001, end: 77099, city: 'Houston' },
      { start: 77201, end: 77299, city: 'Houston' },
      { start: 77301, end: 77306, city: 'Conroe' },
      { start: 77316, end: 77318, city: 'Montgomery' },
      { start: 77325, end: 77325, city: 'Conroe' },
      { start: 77331, end: 77339, city: 'Humble' },
      { start: 77345, end: 77347, city: 'Kingwood' },
      { start: 77354, end: 77354, city: 'Magnolia' },
      { start: 77365, end: 77365, city: 'Porter' },
      { start: 77373, end: 77373, city: 'Tomball' },
      { start: 77375, end: 77377, city: 'Tomball' },
      { start: 77379, end: 77380, city: 'Spring' },
      { start: 77382, end: 77389, city: 'Spring' },
      { start: 77401, end: 77407, city: 'Bellaire' },
      { start: 77429, end: 77429, city: 'Cypress' },
      { start: 77433, end: 77433, city: 'Cypress' },
      { start: 77449, end: 77450, city: 'Katy' },
      { start: 77477, end: 77479, city: 'Stafford' },
      { start: 77489, end: 77489, city: 'Missouri City' },
      { start: 77494, end: 77494, city: 'Katy' },
      { start: 77502, end: 77503, city: 'Pasadena' },
      { start: 77505, end: 77508, city: 'Pasadena' },
      { start: 77510, end: 77511, city: 'Santa Fe' },
      { start: 77520, end: 77521, city: 'Baytown' },
      { start: 77530, end: 77536, city: 'Crosby' },
      { start: 77545, end: 77547, city: 'Friendswood' },
      { start: 77549, end: 77549, city: 'Alvin' },
      { start: 77562, end: 77563, city: 'League City' },
      { start: 77571, end: 77573, city: 'La Porte' },
      { start: 77578, end: 77578, city: 'Manvel' },
      { start: 77581, end: 77584, city: 'Pearland' },
      { start: 77587, end: 77588, city: 'South Houston' },
      { start: 77598, end: 77598, city: 'Webster' }
    ]
  },

  // Phoenix Metro Area
  {
    metro: 'Phoenix, AZ',
    metroValue: 'PHOENIX_AZ',
    zipRanges: [
      { start: 85001, end: 85099, city: 'Phoenix' },
      { start: 85201, end: 85213, city: 'Mesa' },
      { start: 85215, end: 85216, city: 'Mesa' },
      { start: 85224, end: 85226, city: 'Chandler' },
      { start: 85233, end: 85236, city: 'Gilbert' },
      { start: 85248, end: 85249, city: 'Chandler' },
      { start: 85250, end: 85259, city: 'Scottsdale' },
      { start: 85260, end: 85269, city: 'Scottsdale' },
      { start: 85281, end: 85287, city: 'Tempe' },
      { start: 85295, end: 85297, city: 'Gilbert' },
      { start: 85301, end: 85310, city: 'Glendale' },
      { start: 85320, end: 85323, city: 'Avondale' },
      { start: 85331, end: 85331, city: 'Cave Creek' },
      { start: 85338, end: 85340, city: 'Goodyear' },
      { start: 85351, end: 85355, city: 'Peoria' },
      { start: 85373, end: 85379, city: 'Sun City' },
      { start: 85381, end: 85387, city: 'Peoria' },
      { start: 85392, end: 85396, city: 'Avondale' }
    ]
  },

  // Philadelphia Metro Area
  {
    metro: 'Philadelphia, PA',
    metroValue: 'PHILADELPHIA_PA',
    zipRanges: [
      { start: 19019, end: 19019, city: 'Philadelphia' },
      { start: 19092, end: 19093, city: 'Philadelphia' },
      { start: 19101, end: 19155, city: 'Philadelphia' },
      { start: 19160, end: 19161, city: 'Philadelphia' },
      { start: 19171, end: 19173, city: 'Philadelphia' },
      { start: 19175, end: 19177, city: 'Philadelphia' },
      { start: 19178, end: 19179, city: 'Philadelphia' },
      { start: 19181, end: 19182, city: 'Philadelphia' },
      { start: 19187, end: 19187, city: 'Philadelphia' },
      { start: 19244, end: 19244, city: 'Philadelphia' }
    ]
  },

  // Dallas Metro Area
  {
    metro: 'Dallas, TX',
    metroValue: 'DALLAS_TX',
    zipRanges: [
      { start: 75001, end: 75002, city: 'Addison' },
      { start: 75006, end: 75007, city: 'Carrollton' },
      { start: 75010, end: 75010, city: 'Carrollton' },
      { start: 75013, end: 75013, city: 'Allen' },
      { start: 75019, end: 75019, city: 'Coppell' },
      { start: 75022, end: 75023, city: 'Flower Mound' },
      { start: 75024, end: 75025, city: 'Plano' },
      { start: 75028, end: 75029, city: 'Flower Mound' },
      { start: 75034, end: 75035, city: 'Frisco' },
      { start: 75038, end: 75039, city: 'Irving' },
      { start: 75040, end: 75043, city: 'Garland' },
      { start: 75044, end: 75048, city: 'Garland' },
      { start: 75050, end: 75052, city: 'Grand Prairie' },
      { start: 75054, end: 75054, city: 'Grand Prairie' },
      { start: 75056, end: 75057, city: 'The Colony' },
      { start: 75060, end: 75063, city: 'Irving' },
      { start: 75065, end: 75065, city: 'Lake Dallas' },
      { start: 75067, end: 75067, city: 'Lewisville' },
      { start: 75069, end: 75069, city: 'McKinney' },
      { start: 75070, end: 75071, city: 'McKinney' },
      { start: 75074, end: 75075, city: 'Plano' },
      { start: 75077, end: 75077, city: 'Lewisville' },
      { start: 75080, end: 75082, city: 'Richardson' },
      { start: 75089, end: 75089, city: 'Rowlett' },
      { start: 75093, end: 75094, city: 'Plano' },
      { start: 75098, end: 75098, city: 'Wylie' },
      { start: 75104, end: 75104, city: 'Cedar Hill' },
      { start: 75115, end: 75115, city: 'Desoto' },
      { start: 75116, end: 75116, city: 'Duncanville' },
      { start: 75134, end: 75134, city: 'Lancaster' },
      { start: 75137, end: 75137, city: 'Duncanville' },
      { start: 75146, end: 75146, city: 'Lancaster' },
      { start: 75149, end: 75150, city: 'Mesquite' },
      { start: 75159, end: 75160, city: 'Seagoville' },
      { start: 75172, end: 75172, city: 'Wilmer' },
      { start: 75180, end: 75182, city: 'Mesquite' },
      { start: 75201, end: 75398, city: 'Dallas' }
    ]
  }
];

/**
 * Find the city and metro area for a given ZIP code
 * @param {string} zipCode - The ZIP code to lookup
 * @returns {Object|null} - Object with city, metro, and metroValue or null if not found
 */
export function getZipCodeInfo(zipCode) {
  // Clean and normalize the ZIP code
  const cleaned = zipCode.replace(/[\s-]/g, '');
  const zipNum = parseInt(cleaned.substring(0, 5));

  if (isNaN(zipNum)) {
    return null;
  }

  // Search through our metro area database first
  for (const metroArea of ZIP_TO_METRO_MAPPING) {
    // Check each ZIP range in this metro area
    for (const range of metroArea.zipRanges) {
      if (zipNum >= range.start && zipNum <= range.end) {
        // Extract state from metro (e.g., "Chicago, IL" -> "IL")
        const state = metroArea.metro.split(', ')[1] || '';
        return {
          zipCode: cleaned.substring(0, 5),
          city: range.city,
          state: state,
          metro: metroArea.metro,
          metroValue: metroArea.metroValue
        };
      }
    }
  }

  // ZIP not in our mapping — return null so callers use their own fallback
  return null;
}

/**
 * Find all cities within a metro area
 * @param {string} metroValue - The metro area value (e.g., 'CHICAGO_IL')
 * @returns {Array} - Array of unique city names
 */
export function getCitiesInMetro(metroValue) {
  const metroArea = ZIP_TO_METRO_MAPPING.find(m => m.metroValue === metroValue);

  if (!metroArea) {
    return [];
  }

  // Get unique city names
  const cities = new Set();
  metroArea.zipRanges.forEach(range => {
    cities.add(range.city);
  });

  return Array.from(cities).sort();
}

/**
 * Check if a ZIP code falls within any metro area in our database
 * @param {string} zipCode - The ZIP code to check
 * @returns {boolean} - True if the ZIP is in a tracked metro area
 */
export function isZipInTrackedMetro(zipCode) {
  return getZipCodeInfo(zipCode) !== null;
}
