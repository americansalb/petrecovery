/**
 * RescueGroups.org API Integration
 *
 * Fetches shelter and animal data from RescueGroups
 */

const RESCUEGROUPS_API_URL = 'https://api.rescuegroups.org/v5';
const RESCUEGROUPS_API_KEY = process.env.RESCUEGROUPS_API_KEY;

/**
 * Make API request to RescueGroups
 */
async function apiRequest(endpoint, method = 'GET', body = null) {
  if (!RESCUEGROUPS_API_KEY) {
    throw new Error('RescueGroups API key not configured');
  }

  const options = {
    method,
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Authorization: RESCUEGROUPS_API_KEY,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${RESCUEGROUPS_API_URL}${endpoint}`, options);

  if (!response.ok) {
    throw new Error(`RescueGroups API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Search for animals
 */
export async function searchAnimals({
  species,
  breed,
  color,
  location,
  distance = 50,
  status,
  page = 1,
  limit = 25,
}) {
  const filters = [];

  if (species) {
    filters.push({
      fieldName: 'animals.species',
      operation: 'equals',
      criteria: species,
    });
  }

  if (breed) {
    filters.push({
      fieldName: 'animals.breedPrimary',
      operation: 'contains',
      criteria: breed,
    });
  }

  if (color) {
    filters.push({
      fieldName: 'animals.colorPrimary',
      operation: 'contains',
      criteria: color,
    });
  }

  if (location) {
    filters.push({
      fieldName: 'animals.locationPostalcode',
      operation: 'radius',
      criteria: location,
      options: {
        distance,
      },
    });
  }

  if (status) {
    filters.push({
      fieldName: 'animals.status',
      operation: 'equals',
      criteria: status,
    });
  }

  const data = await apiRequest('/public/animals/search', 'POST', {
    data: {
      filterRadius: location ? { miles: distance, postalcode: location } : undefined,
      filters,
      page: page,
      limit: limit,
    },
  });

  return {
    animals: (data.data || []).map(normalizeAnimal),
    pagination: {
      page,
      limit,
      total: data.meta?.count || 0,
    },
  };
}

/**
 * Get animal by ID
 */
export async function getAnimal(id) {
  const data = await apiRequest(`/public/animals/${id}`);
  return normalizeAnimal(data.data);
}

/**
 * Search for organizations
 */
export async function searchOrganizations({
  location,
  distance = 50,
  state,
  page = 1,
  limit = 25,
}) {
  const filters = [];

  if (state) {
    filters.push({
      fieldName: 'orgs.state',
      operation: 'equals',
      criteria: state,
    });
  }

  const data = await apiRequest('/public/orgs/search', 'POST', {
    data: {
      filterRadius: location ? { miles: distance, postalcode: location } : undefined,
      filters,
      page,
      limit,
    },
  });

  return {
    organizations: (data.data || []).map(normalizeOrganization),
    pagination: {
      page,
      limit,
      total: data.meta?.count || 0,
    },
  };
}

/**
 * Get organization by ID
 */
export async function getOrganization(id) {
  const data = await apiRequest(`/public/orgs/${id}`);
  return normalizeOrganization(data.data);
}

/**
 * Normalize RescueGroups animal data
 */
function normalizeAnimal(animal) {
  const attrs = animal.attributes || {};

  return {
    externalId: animal.id,
    source: 'rescuegroups',
    name: attrs.name,
    species: attrs.species?.toLowerCase(),
    breed: attrs.breedPrimary,
    secondaryBreed: attrs.breedSecondary,
    isMixed: attrs.isMixedBreed || false,
    color: attrs.colorPrimary,
    secondaryColor: attrs.colorSecondary,
    age: attrs.ageGroup?.toLowerCase(),
    gender: attrs.sex?.toLowerCase(),
    size: attrs.sizeGroup?.toLowerCase(),
    status: attrs.status,
    description: attrs.descriptionText,
    photos: attrs.pictureThumbnailUrl
      ? [attrs.pictureThumbnailUrl]
      : [],
    primaryPhoto: attrs.pictureThumbnailUrl,
    location: {
      city: attrs.locationCityState,
      postcode: attrs.locationPostalcode,
    },
    url: attrs.url,
    publishedAt: attrs.createdDate,
    organizationId: attrs.orgID,
    attributes: {
      isHousetrained: attrs.isHousetrained,
      isDeclawed: attrs.isDeclawed,
      isNeutered: attrs.isAltered,
      hasSpecialNeeds: attrs.isSpecialNeeds,
    },
  };
}

/**
 * Normalize RescueGroups organization data
 */
function normalizeOrganization(org) {
  const attrs = org.attributes || {};

  return {
    externalId: org.id,
    source: 'rescuegroups',
    name: attrs.name,
    email: attrs.email,
    phone: attrs.phone,
    fax: attrs.fax,
    website: attrs.url,
    address: {
      street: attrs.street,
      city: attrs.city,
      state: attrs.state,
      postcode: attrs.postalcode,
      country: attrs.country,
    },
    about: attrs.about,
    services: attrs.services,
    type: attrs.type,
    isAdoptionOrg: attrs.isAdoptionOrg,
    isShelter: attrs.isShelter,
    isRescue: attrs.isRescue,
  };
}

/**
 * Find potential matches for a lost pet
 */
export async function findPotentialMatches(lostPet, location, radiusMiles = 50) {
  try {
    const { animals } = await searchAnimals({
      species: lostPet.species,
      color: lostPet.color,
      location,
      distance: radiusMiles,
      status: 'Found',
      limit: 50,
    });

    const matches = animals.map((animal) => ({
      ...animal,
      matchScore: calculateMatchScore(lostPet, animal),
    }));

    return matches
      .filter((m) => m.matchScore > 0.3)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
  } catch (error) {
    console.error('RescueGroups match search error:', error);
    return [];
  }
}

/**
 * Calculate match score
 */
function calculateMatchScore(lostPet, foundAnimal) {
  let score = 0;

  if (lostPet.species?.toLowerCase() !== foundAnimal.species) return 0;
  score += 0.2;

  if (lostPet.breed && foundAnimal.breed) {
    if (lostPet.breed.toLowerCase() === foundAnimal.breed.toLowerCase()) {
      score += 0.25;
    }
  }

  if (lostPet.color && foundAnimal.color) {
    if (lostPet.color.toLowerCase() === foundAnimal.color.toLowerCase()) {
      score += 0.2;
    }
  }

  if (lostPet.size && foundAnimal.size) {
    if (lostPet.size.toLowerCase() === foundAnimal.size.toLowerCase()) {
      score += 0.15;
    }
  }

  return Math.min(score, 1);
}
