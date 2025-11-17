// Valid US locations for community creation
// Includes major metro areas and counties

export const US_LOCATIONS = [
  // Metro Areas
  { value: 'New York, NY', label: 'New York Metro Area', type: 'METRO_AREA', state: 'NY' },
  { value: 'Los Angeles, CA', label: 'Los Angeles Metro Area', type: 'METRO_AREA', state: 'CA' },
  { value: 'Chicago, IL', label: 'Chicago Metro Area', type: 'METRO_AREA', state: 'IL' },
  { value: 'Dallas, TX', label: 'Dallas-Fort Worth Metro Area', type: 'METRO_AREA', state: 'TX' },
  { value: 'Houston, TX', label: 'Houston Metro Area', type: 'METRO_AREA', state: 'TX' },
  { value: 'Washington, DC', label: 'Washington DC Metro Area', type: 'METRO_AREA', state: 'DC' },
  { value: 'Miami, FL', label: 'Miami Metro Area', type: 'METRO_AREA', state: 'FL' },
  { value: 'Philadelphia, PA', label: 'Philadelphia Metro Area', type: 'METRO_AREA', state: 'PA' },
  { value: 'Atlanta, GA', label: 'Atlanta Metro Area', type: 'METRO_AREA', state: 'GA' },
  { value: 'Phoenix, AZ', label: 'Phoenix Metro Area', type: 'METRO_AREA', state: 'AZ' },
  { value: 'Boston, MA', label: 'Boston Metro Area', type: 'METRO_AREA', state: 'MA' },
  { value: 'San Francisco, CA', label: 'San Francisco Bay Area', type: 'METRO_AREA', state: 'CA' },
  { value: 'Riverside, CA', label: 'Riverside-San Bernardino Metro', type: 'METRO_AREA', state: 'CA' },
  { value: 'Detroit, MI', label: 'Detroit Metro Area', type: 'METRO_AREA', state: 'MI' },
  { value: 'Seattle, WA', label: 'Seattle Metro Area', type: 'METRO_AREA', state: 'WA' },
  { value: 'Minneapolis, MN', label: 'Minneapolis-St. Paul Metro', type: 'METRO_AREA', state: 'MN' },
  { value: 'San Diego, CA', label: 'San Diego Metro Area', type: 'METRO_AREA', state: 'CA' },
  { value: 'Tampa, FL', label: 'Tampa-St. Petersburg Metro', type: 'METRO_AREA', state: 'FL' },
  { value: 'Denver, CO', label: 'Denver Metro Area', type: 'METRO_AREA', state: 'CO' },
  { value: 'St. Louis, MO', label: 'St. Louis Metro Area', type: 'METRO_AREA', state: 'MO' },
  { value: 'Baltimore, MD', label: 'Baltimore Metro Area', type: 'METRO_AREA', state: 'MD' },
  { value: 'Charlotte, NC', label: 'Charlotte Metro Area', type: 'METRO_AREA', state: 'NC' },
  { value: 'Orlando, FL', label: 'Orlando Metro Area', type: 'METRO_AREA', state: 'FL' },
  { value: 'San Antonio, TX', label: 'San Antonio Metro Area', type: 'METRO_AREA', state: 'TX' },
  { value: 'Portland, OR', label: 'Portland Metro Area', type: 'METRO_AREA', state: 'OR' },
  { value: 'Sacramento, CA', label: 'Sacramento Metro Area', type: 'METRO_AREA', state: 'CA' },
  { value: 'Pittsburgh, PA', label: 'Pittsburgh Metro Area', type: 'METRO_AREA', state: 'PA' },
  { value: 'Las Vegas, NV', label: 'Las Vegas Metro Area', type: 'METRO_AREA', state: 'NV' },
  { value: 'Austin, TX', label: 'Austin Metro Area', type: 'METRO_AREA', state: 'TX' },
  { value: 'Cincinnati, OH', label: 'Cincinnati Metro Area', type: 'METRO_AREA', state: 'OH' },
  { value: 'Kansas City, MO', label: 'Kansas City Metro Area', type: 'METRO_AREA', state: 'MO' },
  { value: 'Columbus, OH', label: 'Columbus Metro Area', type: 'METRO_AREA', state: 'OH' },
  { value: 'Indianapolis, IN', label: 'Indianapolis Metro Area', type: 'METRO_AREA', state: 'IN' },
  { value: 'Cleveland, OH', label: 'Cleveland Metro Area', type: 'METRO_AREA', state: 'OH' },
  { value: 'Nashville, TN', label: 'Nashville Metro Area', type: 'METRO_AREA', state: 'TN' },

  // Additional Major Metros
  { value: 'Milwaukee, WI', label: 'Milwaukee Metro Area', type: 'METRO_AREA', state: 'WI' },
  { value: 'Jacksonville, FL', label: 'Jacksonville Metro Area', type: 'METRO_AREA', state: 'FL' },
  { value: 'Memphis, TN', label: 'Memphis Metro Area', type: 'METRO_AREA', state: 'TN' },
  { value: 'Oklahoma City, OK', label: 'Oklahoma City Metro Area', type: 'METRO_AREA', state: 'OK' },
  { value: 'Louisville, KY', label: 'Louisville Metro Area', type: 'METRO_AREA', state: 'KY' },
  { value: 'Richmond, VA', label: 'Richmond Metro Area', type: 'METRO_AREA', state: 'VA' },
  { value: 'New Orleans, LA', label: 'New Orleans Metro Area', type: 'METRO_AREA', state: 'LA' },
  { value: 'Raleigh, NC', label: 'Raleigh-Durham Metro Area', type: 'METRO_AREA', state: 'NC' },
  { value: 'Salt Lake City, UT', label: 'Salt Lake City Metro Area', type: 'METRO_AREA', state: 'UT' },
  { value: 'Birmingham, AL', label: 'Birmingham Metro Area', type: 'METRO_AREA', state: 'AL' },
  { value: 'Buffalo, NY', label: 'Buffalo Metro Area', type: 'METRO_AREA', state: 'NY' },
  { value: 'Rochester, NY', label: 'Rochester Metro Area', type: 'METRO_AREA', state: 'NY' },
  { value: 'Tucson, AZ', label: 'Tucson Metro Area', type: 'METRO_AREA', state: 'AZ' },
  { value: 'Fresno, CA', label: 'Fresno Metro Area', type: 'METRO_AREA', state: 'CA' },
  { value: 'Albuquerque, NM', label: 'Albuquerque Metro Area', type: 'METRO_AREA', state: 'NM' },

  // Major Counties
  { value: 'Cook County, IL', label: 'Cook County, Illinois', type: 'COUNTY', state: 'IL' },
  { value: 'Los Angeles County, CA', label: 'Los Angeles County, California', type: 'COUNTY', state: 'CA' },
  { value: 'Harris County, TX', label: 'Harris County, Texas', type: 'COUNTY', state: 'TX' },
  { value: 'Maricopa County, AZ', label: 'Maricopa County, Arizona', type: 'COUNTY', state: 'AZ' },
  { value: 'San Diego County, CA', label: 'San Diego County, California', type: 'COUNTY', state: 'CA' },
  { value: 'Orange County, CA', label: 'Orange County, California', type: 'COUNTY', state: 'CA' },
  { value: 'Miami-Dade County, FL', label: 'Miami-Dade County, Florida', type: 'COUNTY', state: 'FL' },
  { value: 'Kings County, NY', label: 'Kings County (Brooklyn), New York', type: 'COUNTY', state: 'NY' },
  { value: 'Queens County, NY', label: 'Queens County, New York', type: 'COUNTY', state: 'NY' },
  { value: 'Dallas County, TX', label: 'Dallas County, Texas', type: 'COUNTY', state: 'TX' },
  { value: 'Wayne County, MI', label: 'Wayne County, Michigan', type: 'COUNTY', state: 'MI' },
  { value: 'King County, WA', label: 'King County, Washington', type: 'COUNTY', state: 'WA' },
  { value: 'Santa Clara County, CA', label: 'Santa Clara County, California', type: 'COUNTY', state: 'CA' },
  { value: 'Broward County, FL', label: 'Broward County, Florida', type: 'COUNTY', state: 'FL' },
  { value: 'Alameda County, CA', label: 'Alameda County, California', type: 'COUNTY', state: 'CA' },
  { value: 'Riverside County, CA', label: 'Riverside County, California', type: 'COUNTY', state: 'CA' },
  { value: 'Clark County, NV', label: 'Clark County, Nevada', type: 'COUNTY', state: 'NV' },
  { value: 'Tarrant County, TX', label: 'Tarrant County, Texas', type: 'COUNTY', state: 'TX' },
  { value: 'Bexar County, TX', label: 'Bexar County, Texas', type: 'COUNTY', state: 'TX' },
  { value: 'Suffolk County, NY', label: 'Suffolk County, New York', type: 'COUNTY', state: 'NY' },
  { value: 'New York County, NY', label: 'New York County (Manhattan), New York', type: 'COUNTY', state: 'NY' },
  { value: 'Middlesex County, MA', label: 'Middlesex County, Massachusetts', type: 'COUNTY', state: 'MA' },
  { value: 'Palm Beach County, FL', label: 'Palm Beach County, Florida', type: 'COUNTY', state: 'FL' },
  { value: 'Hillsborough County, FL', label: 'Hillsborough County, Florida', type: 'COUNTY', state: 'FL' },
  { value: 'Franklin County, OH', label: 'Franklin County, Ohio', type: 'COUNTY', state: 'OH' },
  { value: 'Cuyahoga County, OH', label: 'Cuyahoga County, Ohio', type: 'COUNTY', state: 'OH' },
  { value: 'Hennepin County, MN', label: 'Hennepin County, Minnesota', type: 'COUNTY', state: 'MN' },
  { value: 'Fulton County, GA', label: 'Fulton County, Georgia', type: 'COUNTY', state: 'GA' },
  { value: 'Marion County, IN', label: 'Marion County, Indiana', type: 'COUNTY', state: 'IN' },
  { value: 'Mecklenburg County, NC', label: 'Mecklenburg County, North Carolina', type: 'COUNTY', state: 'NC' },
];

// Helper function to search locations
export function searchLocations(query) {
  if (!query || query.length < 2) return US_LOCATIONS;

  const searchTerm = query.toLowerCase();
  return US_LOCATIONS.filter(location =>
    location.label.toLowerCase().includes(searchTerm) ||
    location.value.toLowerCase().includes(searchTerm) ||
    location.state.toLowerCase().includes(searchTerm)
  );
}

// Helper function to get location by value
export function getLocation(value) {
  return US_LOCATIONS.find(loc => loc.value === value);
}

// Helper function to validate location exists
export function isValidLocation(value) {
  return US_LOCATIONS.some(loc => loc.value === value);
}

// Group locations by state
export function getLocationsByState() {
  const grouped = {};
  US_LOCATIONS.forEach(location => {
    if (!grouped[location.state]) {
      grouped[location.state] = [];
    }
    grouped[location.state].push(location);
  });
  return grouped;
}
