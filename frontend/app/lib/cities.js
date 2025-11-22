// US Cities database - inline data instead of JSON import for better compatibility
const citiesData = {
  cities: [
    // Illinois cities (including multi-city ZIPs)
    {"city": "Lynwood", "state": "IL", "zip": "60411"},
    {"city": "Chicago Heights", "state": "IL", "zip": "60411"},
    {"city": "Chicago", "state": "IL", "zip": "60601"},
    {"city": "Chicago", "state": "IL", "zip": "60613"},
    {"city": "Chicago", "state": "IL", "zip": "60614"},
    {"city": "Carpentersville", "state": "IL", "zip": "60110"},
    {"city": "Cortland", "state": "IL", "zip": "60112"},
    {"city": "Aurora", "state": "IL", "zip": "60505"},
    {"city": "Naperville", "state": "IL", "zip": "60540"},
    {"city": "Joliet", "state": "IL", "zip": "60435"},
    {"city": "Rockford", "state": "IL", "zip": "61101"},
    {"city": "Springfield", "state": "IL", "zip": "62701"},
    {"city": "Elgin", "state": "IL", "zip": "60120"},
    {"city": "Peoria", "state": "IL", "zip": "61602"},
    {"city": "Champaign", "state": "IL", "zip": "61820"},
    {"city": "Waukegan", "state": "IL", "zip": "60085"},
    {"city": "Cicero", "state": "IL", "zip": "60804"},
    {"city": "Bloomington", "state": "IL", "zip": "61701"},
    {"city": "Evanston", "state": "IL", "zip": "60201"},
    {"city": "Decatur", "state": "IL", "zip": "62521"},
    {"city": "Arlington Heights", "state": "IL", "zip": "60004"},
    {"city": "Schaumburg", "state": "IL", "zip": "60193"},
    {"city": "Bolingbrook", "state": "IL", "zip": "60440"},
    {"city": "Palatine", "state": "IL", "zip": "60067"},
    {"city": "Skokie", "state": "IL", "zip": "60076"},
    {"city": "Des Plaines", "state": "IL", "zip": "60016"},
    {"city": "Orland Park", "state": "IL", "zip": "60462"},
    {"city": "Tinley Park", "state": "IL", "zip": "60477"},
    {"city": "Oak Lawn", "state": "IL", "zip": "60453"},
    {"city": "Berwyn", "state": "IL", "zip": "60402"},
    {"city": "Oak Park", "state": "IL", "zip": "60301"},
    {"city": "Normal", "state": "IL", "zip": "61761"},
    {"city": "Wheaton", "state": "IL", "zip": "60187"},
    {"city": "Hoffman Estates", "state": "IL", "zip": "60169"},
    {"city": "DeKalb", "state": "IL", "zip": "60115"},

    // California cities
    {"city": "Los Angeles", "state": "CA", "zip": "90001"},
    {"city": "Los Angeles", "state": "CA", "zip": "90013"},
    {"city": "Lynwood", "state": "CA", "zip": "90262"},
    {"city": "San Diego", "state": "CA", "zip": "92101"},
    {"city": "San Jose", "state": "CA", "zip": "95101"},
    {"city": "San Francisco", "state": "CA", "zip": "94101"},
    {"city": "Fresno", "state": "CA", "zip": "93650"},
    {"city": "Sacramento", "state": "CA", "zip": "94203"},
    {"city": "Long Beach", "state": "CA", "zip": "90801"},
    {"city": "Oakland", "state": "CA", "zip": "94601"},
    {"city": "Bakersfield", "state": "CA", "zip": "93301"},
    {"city": "Anaheim", "state": "CA", "zip": "92801"},
    {"city": "Santa Ana", "state": "CA", "zip": "92701"},
    {"city": "Riverside", "state": "CA", "zip": "92501"},
    {"city": "Stockton", "state": "CA", "zip": "95201"},
    {"city": "Chula Vista", "state": "CA", "zip": "91910"},
    {"city": "Irvine", "state": "CA", "zip": "92602"},
    {"city": "Fremont", "state": "CA", "zip": "94536"},
    {"city": "San Bernardino", "state": "CA", "zip": "92401"},
    {"city": "Modesto", "state": "CA", "zip": "95350"},
    {"city": "Fontana", "state": "CA", "zip": "92335"},
    {"city": "Oxnard", "state": "CA", "zip": "93030"},
    {"city": "Moreno Valley", "state": "CA", "zip": "92553"},
    {"city": "Huntington Beach", "state": "CA", "zip": "92646"},
    {"city": "Glendale", "state": "CA", "zip": "91201"},
    {"city": "Santa Clarita", "state": "CA", "zip": "91350"},
    {"city": "Garden Grove", "state": "CA", "zip": "92840"},
    {"city": "Oceanside", "state": "CA", "zip": "92054"},
    {"city": "Rancho Cucamonga", "state": "CA", "zip": "91701"},
    {"city": "Santa Rosa", "state": "CA", "zip": "95401"},
    {"city": "Ontario", "state": "CA", "zip": "91761"},
    {"city": "Lancaster", "state": "CA", "zip": "93534"},
    {"city": "Elk Grove", "state": "CA", "zip": "95624"},
    {"city": "Corona", "state": "CA", "zip": "92877"},
    {"city": "Palmdale", "state": "CA", "zip": "93550"},
    {"city": "Salinas", "state": "CA", "zip": "93901"},
    {"city": "Pomona", "state": "CA", "zip": "91766"},
    {"city": "Hayward", "state": "CA", "zip": "94541"},
    {"city": "Sunnyvale", "state": "CA", "zip": "94085"},
    {"city": "Pasadena", "state": "CA", "zip": "91101"},
    {"city": "Torrance", "state": "CA", "zip": "90501"},

    // Texas cities
    {"city": "Houston", "state": "TX", "zip": "77001"},
    {"city": "San Antonio", "state": "TX", "zip": "78201"},
    {"city": "Dallas", "state": "TX", "zip": "75201"},
    {"city": "Austin", "state": "TX", "zip": "78701"},
    {"city": "Fort Worth", "state": "TX", "zip": "76101"},
    {"city": "El Paso", "state": "TX", "zip": "79901"},
    {"city": "Arlington", "state": "TX", "zip": "76010"},
    {"city": "Corpus Christi", "state": "TX", "zip": "78401"},
    {"city": "Plano", "state": "TX", "zip": "75023"},
    {"city": "Laredo", "state": "TX", "zip": "78040"},
    {"city": "Lubbock", "state": "TX", "zip": "79401"},
    {"city": "Garland", "state": "TX", "zip": "75040"},
    {"city": "Irving", "state": "TX", "zip": "75060"},
    {"city": "Amarillo", "state": "TX", "zip": "79101"},
    {"city": "Grand Prairie", "state": "TX", "zip": "75050"},
    {"city": "Brownsville", "state": "TX", "zip": "78520"},
    {"city": "Pasadena", "state": "TX", "zip": "77501"},
    {"city": "McKinney", "state": "TX", "zip": "75069"},
    {"city": "Mesquite", "state": "TX", "zip": "75149"},
    {"city": "McAllen", "state": "TX", "zip": "78501"},
    {"city": "Killeen", "state": "TX", "zip": "76540"},
    {"city": "Waco", "state": "TX", "zip": "76701"},
    {"city": "Carrollton", "state": "TX", "zip": "75006"},
    {"city": "Beaumont", "state": "TX", "zip": "77701"},

    // New York cities
    {"city": "New York", "state": "NY", "zip": "10001"},
    {"city": "New York", "state": "NY", "zip": "10002"},
    {"city": "Buffalo", "state": "NY", "zip": "14201"},
    {"city": "Rochester", "state": "NY", "zip": "14602"},
    {"city": "Yonkers", "state": "NY", "zip": "10701"},
    {"city": "Syracuse", "state": "NY", "zip": "13202"},
    {"city": "Albany", "state": "NY", "zip": "12201"},
    {"city": "New Rochelle", "state": "NY", "zip": "10801"},
    {"city": "Mount Vernon", "state": "NY", "zip": "10550"},
    {"city": "Schenectady", "state": "NY", "zip": "12305"},
    {"city": "Utica", "state": "NY", "zip": "13501"},
    {"city": "White Plains", "state": "NY", "zip": "10601"},
    {"city": "Troy", "state": "NY", "zip": "12180"},
    {"city": "Niagara Falls", "state": "NY", "zip": "14301"},
    {"city": "Binghamton", "state": "NY", "zip": "13901"},

    // Florida cities
    {"city": "Jacksonville", "state": "FL", "zip": "32099"},
    {"city": "Miami", "state": "FL", "zip": "33101"},
    {"city": "Tampa", "state": "FL", "zip": "33601"},
    {"city": "Orlando", "state": "FL", "zip": "32801"},
    {"city": "St. Petersburg", "state": "FL", "zip": "33701"},
    {"city": "Hialeah", "state": "FL", "zip": "33010"},
    {"city": "Tallahassee", "state": "FL", "zip": "32301"},
    {"city": "Fort Lauderdale", "state": "FL", "zip": "33301"},
    {"city": "Port St. Lucie", "state": "FL", "zip": "34952"},
    {"city": "Cape Coral", "state": "FL", "zip": "33904"},
    {"city": "Pembroke Pines", "state": "FL", "zip": "33024"},
    {"city": "Hollywood", "state": "FL", "zip": "33019"},
    {"city": "Miramar", "state": "FL", "zip": "33023"},
    {"city": "Gainesville", "state": "FL", "zip": "32601"},
    {"city": "Coral Springs", "state": "FL", "zip": "33065"},
    {"city": "Miami Gardens", "state": "FL", "zip": "33056"},
    {"city": "Clearwater", "state": "FL", "zip": "33755"},
    {"city": "Palm Bay", "state": "FL", "zip": "32905"},
    {"city": "Pompano Beach", "state": "FL", "zip": "33060"},
    {"city": "West Palm Beach", "state": "FL", "zip": "33401"},

    // Pennsylvania cities
    {"city": "Philadelphia", "state": "PA", "zip": "19019"},
    {"city": "Pittsburgh", "state": "PA", "zip": "15201"},
    {"city": "Allentown", "state": "PA", "zip": "18101"},
    {"city": "Erie", "state": "PA", "zip": "16501"},
    {"city": "Reading", "state": "PA", "zip": "19601"},
    {"city": "Scranton", "state": "PA", "zip": "18503"},
    {"city": "Bethlehem", "state": "PA", "zip": "18015"},
    {"city": "Lancaster", "state": "PA", "zip": "17601"},
    {"city": "Harrisburg", "state": "PA", "zip": "17101"},

    // Ohio cities
    {"city": "Columbus", "state": "OH", "zip": "43004"},
    {"city": "Cleveland", "state": "OH", "zip": "44101"},
    {"city": "Cincinnati", "state": "OH", "zip": "45201"},
    {"city": "Toledo", "state": "OH", "zip": "43601"},
    {"city": "Akron", "state": "OH", "zip": "44301"},
    {"city": "Dayton", "state": "OH", "zip": "45401"},
    {"city": "Parma", "state": "OH", "zip": "44129"},
    {"city": "Canton", "state": "OH", "zip": "44701"},
    {"city": "Youngstown", "state": "OH", "zip": "44501"},
    {"city": "Lorain", "state": "OH", "zip": "44052"},

    // Arizona cities
    {"city": "Phoenix", "state": "AZ", "zip": "85001"},
    {"city": "Tucson", "state": "AZ", "zip": "85701"},
    {"city": "Mesa", "state": "AZ", "zip": "85201"},
    {"city": "Chandler", "state": "AZ", "zip": "85224"},
    {"city": "Glendale", "state": "AZ", "zip": "85301"},
    {"city": "Scottsdale", "state": "AZ", "zip": "85251"},
    {"city": "Gilbert", "state": "AZ", "zip": "85233"},
    {"city": "Tempe", "state": "AZ", "zip": "85281"},
    {"city": "Peoria", "state": "AZ", "zip": "85345"},
    {"city": "Surprise", "state": "AZ", "zip": "85374"},

    // North Carolina cities
    {"city": "Charlotte", "state": "NC", "zip": "28201"},
    {"city": "Raleigh", "state": "NC", "zip": "27601"},
    {"city": "Greensboro", "state": "NC", "zip": "27401"},
    {"city": "Durham", "state": "NC", "zip": "27701"},
    {"city": "Winston-Salem", "state": "NC", "zip": "27101"},
    {"city": "Fayetteville", "state": "NC", "zip": "28301"},
    {"city": "Cary", "state": "NC", "zip": "27511"},
    {"city": "Wilmington", "state": "NC", "zip": "28401"},
    {"city": "High Point", "state": "NC", "zip": "27260"},
    {"city": "Asheville", "state": "NC", "zip": "28801"},

    // Washington cities
    {"city": "Seattle", "state": "WA", "zip": "98101"},
    {"city": "Spokane", "state": "WA", "zip": "99201"},
    {"city": "Tacoma", "state": "WA", "zip": "98401"},
    {"city": "Vancouver", "state": "WA", "zip": "98660"},
    {"city": "Bellevue", "state": "WA", "zip": "98004"},
    {"city": "Kent", "state": "WA", "zip": "98030"},
    {"city": "Everett", "state": "WA", "zip": "98201"},
    {"city": "Renton", "state": "WA", "zip": "98055"},
    {"city": "Yakima", "state": "WA", "zip": "98901"},
    {"city": "Federal Way", "state": "WA", "zip": "98003"},

    // Colorado cities
    {"city": "Denver", "state": "CO", "zip": "80201"},
    {"city": "Colorado Springs", "state": "CO", "zip": "80809"},
    {"city": "Aurora", "state": "CO", "zip": "80010"},
    {"city": "Fort Collins", "state": "CO", "zip": "80521"},
    {"city": "Lakewood", "state": "CO", "zip": "80226"},
    {"city": "Thornton", "state": "CO", "zip": "80229"},
    {"city": "Arvada", "state": "CO", "zip": "80001"},
    {"city": "Westminster", "state": "CO", "zip": "80030"},
    {"city": "Pueblo", "state": "CO", "zip": "81003"},
    {"city": "Centennial", "state": "CO", "zip": "80112"},

    // Massachusetts cities
    {"city": "Boston", "state": "MA", "zip": "02101"},
    {"city": "Worcester", "state": "MA", "zip": "01601"},
    {"city": "Springfield", "state": "MA", "zip": "01101"},
    {"city": "Lowell", "state": "MA", "zip": "01850"},
    {"city": "Cambridge", "state": "MA", "zip": "02138"},
    {"city": "New Bedford", "state": "MA", "zip": "02740"},
    {"city": "Brockton", "state": "MA", "zip": "02301"},
    {"city": "Quincy", "state": "MA", "zip": "02169"},
    {"city": "Lynn", "state": "MA", "zip": "01901"},
    {"city": "Fall River", "state": "MA", "zip": "02720"},

    // Tennessee cities
    {"city": "Nashville", "state": "TN", "zip": "37201"},
    {"city": "Memphis", "state": "TN", "zip": "37501"},
    {"city": "Knoxville", "state": "TN", "zip": "37901"},
    {"city": "Chattanooga", "state": "TN", "zip": "37402"},
    {"city": "Clarksville", "state": "TN", "zip": "37040"},
    {"city": "Murfreesboro", "state": "TN", "zip": "37127"},
    {"city": "Jackson", "state": "TN", "zip": "38301"},
    {"city": "Franklin", "state": "TN", "zip": "37064"},

    // Michigan cities
    {"city": "Detroit", "state": "MI", "zip": "48201"},
    {"city": "Grand Rapids", "state": "MI", "zip": "49503"},
    {"city": "Warren", "state": "MI", "zip": "48088"},
    {"city": "Sterling Heights", "state": "MI", "zip": "48310"},
    {"city": "Ann Arbor", "state": "MI", "zip": "48103"},
    {"city": "Lansing", "state": "MI", "zip": "48901"},
    {"city": "Flint", "state": "MI", "zip": "48502"},
    {"city": "Dearborn", "state": "MI", "zip": "48120"},
    {"city": "Livonia", "state": "MI", "zip": "48150"},

    // Indiana cities
    {"city": "Indianapolis", "state": "IN", "zip": "46201"},
    {"city": "Fort Wayne", "state": "IN", "zip": "46801"},
    {"city": "Evansville", "state": "IN", "zip": "47708"},
    {"city": "South Bend", "state": "IN", "zip": "46601"},
    {"city": "Carmel", "state": "IN", "zip": "46032"},
    {"city": "Fishers", "state": "IN", "zip": "46037"},
    {"city": "Bloomington", "state": "IN", "zip": "47401"},

    // Wisconsin cities
    {"city": "Milwaukee", "state": "WI", "zip": "53201"},
    {"city": "Madison", "state": "WI", "zip": "53701"},
    {"city": "Green Bay", "state": "WI", "zip": "54301"},
    {"city": "Kenosha", "state": "WI", "zip": "53140"},
    {"city": "Racine", "state": "WI", "zip": "53401"},
    {"city": "Appleton", "state": "WI", "zip": "54911"},

    // Georgia cities
    {"city": "Atlanta", "state": "GA", "zip": "30301"},
    {"city": "Augusta", "state": "GA", "zip": "30901"},
    {"city": "Columbus", "state": "GA", "zip": "31901"},
    {"city": "Macon", "state": "GA", "zip": "31201"},
    {"city": "Savannah", "state": "GA", "zip": "31401"},
    {"city": "Athens", "state": "GA", "zip": "30601"},
    {"city": "Sandy Springs", "state": "GA", "zip": "30328"},

    // Other major cities across remaining states
    {"city": "Washington", "state": "DC", "zip": "20001"},
    {"city": "Oklahoma City", "state": "OK", "zip": "73101"},
    {"city": "Portland", "state": "OR", "zip": "97201"},
    {"city": "Las Vegas", "state": "NV", "zip": "89101"},
    {"city": "Louisville", "state": "KY", "zip": "40201"},
    {"city": "Baltimore", "state": "MD", "zip": "21201"},
    {"city": "Albuquerque", "state": "NM", "zip": "87101"},
    {"city": "Kansas City", "state": "MO", "zip": "64101"},
    {"city": "Omaha", "state": "NE", "zip": "68101"},
    {"city": "Virginia Beach", "state": "VA", "zip": "23450"},
    {"city": "Minneapolis", "state": "MN", "zip": "55401"},
    {"city": "Tulsa", "state": "OK", "zip": "74101"},
    {"city": "New Orleans", "state": "LA", "zip": "70112"},
    {"city": "Wichita", "state": "KS", "zip": "67201"},
    {"city": "Reno", "state": "NV", "zip": "89501"},
    {"city": "Henderson", "state": "NV", "zip": "89002"},
    {"city": "Lincoln", "state": "NE", "zip": "68501"},
    {"city": "St. Louis", "state": "MO", "zip": "63101"},
    {"city": "St. Paul", "state": "MN", "zip": "55101"},
    {"city": "Jersey City", "state": "NJ", "zip": "07302"},
    {"city": "Newark", "state": "NJ", "zip": "07102"},
    {"city": "Paterson", "state": "NJ", "zip": "07501"},
    {"city": "Elizabeth", "state": "NJ", "zip": "07201"},
    {"city": "Boise", "state": "ID", "zip": "83701"},
    {"city": "Des Moines", "state": "IA", "zip": "50301"},
    {"city": "Cedar Rapids", "state": "IA", "zip": "52401"},
    {"city": "Richmond", "state": "VA", "zip": "23218"},
    {"city": "Norfolk", "state": "VA", "zip": "23501"},
    {"city": "Chesapeake", "state": "VA", "zip": "23320"},
    {"city": "Arlington", "state": "VA", "zip": "22201"},
    {"city": "Providence", "state": "RI", "zip": "02901"},
    {"city": "Salt Lake City", "state": "UT", "zip": "84101"},
    {"city": "West Valley City", "state": "UT", "zip": "84119"},
    {"city": "Provo", "state": "UT", "zip": "84601"},
    {"city": "Bridgeport", "state": "CT", "zip": "06604"},
    {"city": "New Haven", "state": "CT", "zip": "06510"},
    {"city": "Hartford", "state": "CT", "zip": "06101"},
    {"city": "Birmingham", "state": "AL", "zip": "35203"},
    {"city": "Montgomery", "state": "AL", "zip": "36101"},
    {"city": "Mobile", "state": "AL", "zip": "36601"},
    {"city": "Little Rock", "state": "AR", "zip": "72201"},
    {"city": "Fayetteville", "state": "AR", "zip": "72701"},
    {"city": "Portland", "state": "ME", "zip": "04101"},
    {"city": "Manchester", "state": "NH", "zip": "03101"},
    {"city": "Nashua", "state": "NH", "zip": "03060"},
    {"city": "Burlington", "state": "VT", "zip": "05401"},
    {"city": "Charleston", "state": "SC", "zip": "29401"},
    {"city": "Columbia", "state": "SC", "zip": "29201"},
    {"city": "North Charleston", "state": "SC", "zip": "29405"},
    {"city": "Jackson", "state": "MS", "zip": "39201"},
    {"city": "Baton Rouge", "state": "LA", "zip": "70801"},
    {"city": "Shreveport", "state": "LA", "zip": "71101"},
    {"city": "Lexington", "state": "KY", "zip": "40502"},
    {"city": "Anchorage", "state": "AK", "zip": "99501"},
    {"city": "Honolulu", "state": "HI", "zip": "96801"},
    {"city": "Sioux Falls", "state": "SD", "zip": "57101"},
    {"city": "Rapid City", "state": "SD", "zip": "57701"},
    {"city": "Fargo", "state": "ND", "zip": "58102"},
    {"city": "Bismarck", "state": "ND", "zip": "58501"},
    {"city": "Billings", "state": "MT", "zip": "59101"},
    {"city": "Missoula", "state": "MT", "zip": "59801"},
    {"city": "Cheyenne", "state": "WY", "zip": "82001"},
    {"city": "Casper", "state": "WY", "zip": "82601"},
    {"city": "Eugene", "state": "OR", "zip": "97401"},
    {"city": "Salem", "state": "OR", "zip": "97301"},
    {"city": "Gresham", "state": "OR", "zip": "97030"},
    {"city": "Wilmington", "state": "DE", "zip": "19801"},
    {"city": "Dover", "state": "DE", "zip": "19901"},
    {"city": "Charleston", "state": "WV", "zip": "25301"},
    {"city": "Huntington", "state": "WV", "zip": "25701"}
  ]
};

// Get all unique city names (across all states)
export const ALL_CITIES = Array.from(
  new Set(citiesData.cities.map(c => c.city))
).sort();

// Get all cities with their state info
export const CITIES_WITH_STATES = citiesData.cities;

// Find cities by ZIP code
export function getCitiesByZip(zipCode) {
  return citiesData.cities.filter(c => c.zip === zipCode);
}

// Find city data by name (case-insensitive)
export function getCityByName(cityName) {
  if (!cityName) return null;
  const normalized = cityName.trim();
  return citiesData.cities.find(
    c => c.city.toLowerCase() === normalized.toLowerCase()
  );
}

// Check if a city name is valid
export function isValidCity(cityName) {
  if (!cityName) return false;
  const normalized = cityName.trim();
  return citiesData.cities.some(
    c => c.city.toLowerCase() === normalized.toLowerCase()
  );
}

// Get autocomplete suggestions for city names
export function getCitySuggestions(query, limit = 10) {
  if (!query || query.trim().length < 2) return [];

  const normalized = query.trim().toLowerCase();
  const matches = citiesData.cities.filter(c =>
    c.city.toLowerCase().includes(normalized)
  );

  // Remove duplicates (same city name in multiple states)
  const uniqueCities = new Map();
  matches.forEach(city => {
    const key = `${city.city}, ${city.state}`;
    if (!uniqueCities.has(key)) {
      uniqueCities.set(key, city);
    }
  });

  return Array.from(uniqueCities.values()).slice(0, limit);
}

// Get city and state from ZIP code (returns first match)
export function getCityFromZip(zipCode) {
  const cities = getCitiesByZip(zipCode);
  return cities.length > 0 ? cities[0] : null;
}
