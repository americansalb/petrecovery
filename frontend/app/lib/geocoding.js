// Shared geocoding utility to avoid circular HTTP requests

export async function geocodeZipCode(zipCode) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&country=US&format=json&limit=1`,
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

    // Extract city name from address
    // Format is usually: "City, County, State, ZIP, Country"
    const addressParts = location.display_name.split(',');
    const cityName = addressParts[0].trim();

    return {
      zipCode,
      cityName,
      latitude: parseFloat(location.lat),
      longitude: parseFloat(location.lon),
      fullAddress: location.display_name
    };

  } catch (error) {
    console.error('Geocoding error:', error);
    return { error: error.message, zipCode };
  }
}
