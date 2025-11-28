/**
 * Microchip Registry Integration
 *
 * Integrates with major pet microchip registries to search for lost pets
 */

const REGISTRY_APIS = {
  AAHA: {
    name: 'AAHA Universal Pet Microchip Lookup',
    baseUrl: 'https://www.petmicrochiplookup.org/api',
    apiKey: process.env.AAHA_API_KEY,
  },
  FOUNDANIMALS: {
    name: 'Found Animals Registry',
    baseUrl: 'https://microchipregistry.foundanimals.org/api',
    apiKey: process.env.FOUNDANIMALS_API_KEY,
  },
  HOMEAGAIN: {
    name: 'HomeAgain',
    baseUrl: 'https://api.homeagain.com/v1',
    apiKey: process.env.HOMEAGAIN_API_KEY,
  },
  PETLINK: {
    name: 'PetLink',
    baseUrl: 'https://api.petlink.net/v1',
    apiKey: process.env.PETLINK_API_KEY,
  },
};

/**
 * Search for a pet by microchip number
 */
export async function searchMicrochip(chipNumber) {
  const results = [];
  const errors = [];

  // Search all configured registries in parallel
  const searches = Object.entries(REGISTRY_APIS)
    .filter(([_, config]) => config.apiKey)
    .map(async ([registry, config]) => {
      try {
        const result = await searchRegistry(registry, chipNumber, config);
        if (result) {
          results.push({ registry, ...result });
        }
      } catch (error) {
        errors.push({ registry, error: error.message });
      }
    });

  await Promise.all(searches);

  return {
    chipNumber,
    found: results.length > 0,
    results,
    errors: errors.length > 0 ? errors : undefined,
    searchedRegistries: Object.keys(REGISTRY_APIS).filter(r => REGISTRY_APIS[r].apiKey),
  };
}

/**
 * Search a specific registry
 */
async function searchRegistry(registry, chipNumber, config) {
  const response = await fetch(`${config.baseUrl}/lookup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ microchipNumber: chipNumber }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null; // Not found in this registry
    }
    throw new Error(`Registry ${registry} returned ${response.status}`);
  }

  const data = await response.json();

  if (!data.found) {
    return null;
  }

  return {
    registryName: config.name,
    petName: data.petName,
    species: data.species,
    breed: data.breed,
    color: data.color,
    registrationDate: data.registrationDate,
    ownerCity: data.ownerCity, // Limited info for privacy
    ownerState: data.ownerState,
    contactAvailable: data.contactAvailable,
  };
}

/**
 * Register a found pet's microchip for owner notification
 */
export async function reportFoundMicrochip(options) {
  const { chipNumber, finderName, finderPhone, finderEmail, location, caseId } = options;

  const results = [];

  for (const [registry, config] of Object.entries(REGISTRY_APIS)) {
    if (!config.apiKey) continue;

    try {
      const response = await fetch(`${config.baseUrl}/found-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          microchipNumber: chipNumber,
          finderInfo: {
            name: finderName,
            phone: finderPhone,
            email: finderEmail,
          },
          foundLocation: location,
          referenceId: caseId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        results.push({
          registry,
          success: true,
          ownerNotified: data.ownerNotified,
          referenceNumber: data.referenceNumber,
        });
      }
    } catch (error) {
      results.push({
        registry,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Validate microchip number format
 */
export function validateMicrochipNumber(chipNumber) {
  // Remove spaces and dashes
  const cleaned = chipNumber.replace(/[\s-]/g, '');

  // ISO standard: 15 digits
  if (/^\d{15}$/.test(cleaned)) {
    return { valid: true, format: 'ISO', cleaned };
  }

  // AVID: 9-10 digits
  if (/^\d{9,10}$/.test(cleaned)) {
    return { valid: true, format: 'AVID', cleaned };
  }

  // HomeAgain: 10 digits
  if (/^\d{10}$/.test(cleaned)) {
    return { valid: true, format: 'HomeAgain', cleaned };
  }

  // 24PetWatch: 15 alphanumeric
  if (/^[A-Z0-9]{15}$/i.test(cleaned)) {
    return { valid: true, format: '24PetWatch', cleaned };
  }

  return {
    valid: false,
    error: 'Invalid microchip format. Expected 9-15 digit number.',
  };
}

/**
 * Get microchip manufacturer from number prefix
 */
export function identifyMicrochipManufacturer(chipNumber) {
  const cleaned = chipNumber.replace(/[\s-]/g, '');

  const prefixes = {
    '900': 'AVID',
    '956': 'Trovan',
    '981': 'HomeAgain/Schering-Plough',
    '982': 'Bayer/Tracer',
    '985': 'HomeAgain/Merck',
    '991': 'Datamars',
  };

  const prefix = cleaned.substring(0, 3);
  return prefixes[prefix] || 'Unknown';
}
