// Shared geocoding utility to avoid circular HTTP requests

// US state abbreviations map
const STATE_ABBREV = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

export async function geocodeZipCode(zipCode) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&country=US&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'PetRecovery.org/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();

    if (data.length === 0) {
      return { error: 'ZIP code not found', zipCode };
    }

    const location = data[0];
    const address = location.address || {};

    // Extract city name (try city, town, village, hamlet)
    const cityName = address.city || address.town || address.village || address.hamlet || 'Unknown';

    // Extract state name and convert to abbreviation
    const stateName = address.state || '';
    const stateAbbrev = STATE_ABBREV[stateName] || stateName;

    return {
      zipCode,
      cityName,
      state: stateAbbrev,
      stateName,
      latitude: parseFloat(location.lat),
      longitude: parseFloat(location.lon),
      fullAddress: location.display_name
    };

  } catch (error) {
    console.error('Geocoding error:', error);
    return { error: error.message, zipCode };
  }
}
