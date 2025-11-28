/**
 * PetFinder API Integration
 *
 * Fetches shelter and animal data from PetFinder's public API
 */

const PETFINDER_API_URL = 'https://api.petfinder.com/v2';
const PETFINDER_API_KEY = process.env.PETFINDER_API_KEY;
const PETFINDER_API_SECRET = process.env.PETFINDER_API_SECRET;

let accessToken = null;
let tokenExpiry = null;

/**
 * Get OAuth2 access token
 */
async function getAccessToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  if (!PETFINDER_API_KEY || !PETFINDER_API_SECRET) {
    throw new Error('PetFinder API credentials not configured');
  }

  const response = await fetch(`${PETFINDER_API_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: PETFINDER_API_KEY,
      client_secret: PETFINDER_API_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with PetFinder API');
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

  return accessToken;
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, params = {}) {
  const token = await getAccessToken();

  const url = new URL(`${PETFINDER_API_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`PetFinder API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Search for animals
 */
export async function searchAnimals({
  type,
  breed,
  size,
  color,
  age,
  gender,
  location,
  distance = 25,
  status = 'adoptable,found',
  page = 1,
  limit = 20,
}) {
  const data = await apiRequest('/animals', {
    type,
    breed,
    size,
    color,
    age,
    gender,
    location,
    distance,
    status,
    page,
    limit,
  });

  return {
    animals: data.animals.map(normalizeAnimal),
    pagination: data.pagination,
  };
}

/**
 * Get animal by ID
 */
export async function getAnimal(id) {
  const data = await apiRequest(`/animals/${id}`);
  return normalizeAnimal(data.animal);
}

/**
 * Search for shelters/organizations
 */
export async function searchOrganizations({
  location,
  distance = 50,
  state,
  country = 'US',
  page = 1,
  limit = 20,
}) {
  const data = await apiRequest('/organizations', {
    location,
    distance,
    state,
    country,
    page,
    limit,
  });

  return {
    organizations: data.organizations.map(normalizeOrganization),
    pagination: data.pagination,
  };
}

/**
 * Get organization by ID
 */
export async function getOrganization(id) {
  const data = await apiRequest(`/organizations/${id}`);
  return normalizeOrganization(data.organization);
}

/**
 * Get animals from a specific organization
 */
export async function getOrganizationAnimals(orgId, params = {}) {
  return searchAnimals({ ...params, organization: orgId });
}

/**
 * Normalize PetFinder animal data to our format
 */
function normalizeAnimal(animal) {
  return {
    externalId: animal.id.toString(),
    source: 'petfinder',
    name: animal.name,
    species: animal.type?.toLowerCase() || 'unknown',
    breed: animal.breeds?.primary,
    secondaryBreed: animal.breeds?.secondary,
    isMixed: animal.breeds?.mixed || false,
    color: animal.colors?.primary,
    secondaryColor: animal.colors?.secondary,
    age: animal.age?.toLowerCase(),
    gender: animal.gender?.toLowerCase(),
    size: animal.size?.toLowerCase(),
    status: animal.status,
    description: animal.description,
    photos: animal.photos?.map((p) => p.large || p.medium || p.small).filter(Boolean) || [],
    primaryPhoto: animal.primary_photo_cropped?.large || animal.photos?.[0]?.large,
    location: {
      city: animal.contact?.address?.city,
      state: animal.contact?.address?.state,
      postcode: animal.contact?.address?.postcode,
      country: animal.contact?.address?.country,
    },
    contact: {
      email: animal.contact?.email,
      phone: animal.contact?.phone,
    },
    url: animal.url,
    publishedAt: animal.published_at,
    organization: {
      id: animal.organization_id,
      name: animal.organization?.name,
    },
    attributes: {
      spayedNeutered: animal.attributes?.spayed_neutered,
      houseTrained: animal.attributes?.house_trained,
      specialNeeds: animal.attributes?.special_needs,
      shotsCurrent: animal.attributes?.shots_current,
    },
    tags: animal.tags || [],
  };
}

/**
 * Normalize PetFinder organization data
 */
function normalizeOrganization(org) {
  return {
    externalId: org.id,
    source: 'petfinder',
    name: org.name,
    email: org.email,
    phone: org.phone,
    website: org.website,
    address: {
      street: org.address?.address1,
      city: org.address?.city,
      state: org.address?.state,
      postcode: org.address?.postcode,
      country: org.address?.country,
    },
    hours: org.hours,
    url: org.url,
    photos: org.photos?.map((p) => p.large || p.medium).filter(Boolean) || [],
    socialMedia: org.social_media || {},
    missionStatement: org.mission_statement,
    adoption: org.adoption || {},
  };
}

/**
 * Find potential matches for a lost pet
 */
export async function findPotentialMatches(lostPet, location, radiusMiles = 50) {
  try {
    const { animals } = await searchAnimals({
      type: lostPet.species,
      color: lostPet.color,
      location,
      distance: radiusMiles,
      status: 'found',
      limit: 50,
    });

    // Score each match
    const matches = animals.map((animal) => ({
      ...animal,
      matchScore: calculateMatchScore(lostPet, animal),
    }));

    // Sort by match score
    return matches
      .filter((m) => m.matchScore > 0.3)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
  } catch (error) {
    console.error('PetFinder match search error:', error);
    return [];
  }
}

/**
 * Calculate match score between lost pet and found animal
 */
function calculateMatchScore(lostPet, foundAnimal) {
  let score = 0;
  let factors = 0;

  // Species must match
  if (lostPet.species?.toLowerCase() !== foundAnimal.species) {
    return 0;
  }
  score += 0.2;
  factors++;

  // Breed similarity
  if (lostPet.breed && foundAnimal.breed) {
    if (lostPet.breed.toLowerCase() === foundAnimal.breed.toLowerCase()) {
      score += 0.25;
    } else if (foundAnimal.isMixed) {
      score += 0.1;
    }
    factors++;
  }

  // Color match
  if (lostPet.color && foundAnimal.color) {
    if (lostPet.color.toLowerCase() === foundAnimal.color.toLowerCase()) {
      score += 0.2;
    }
    factors++;
  }

  // Size match
  if (lostPet.size && foundAnimal.size) {
    if (lostPet.size.toLowerCase() === foundAnimal.size.toLowerCase()) {
      score += 0.15;
    }
    factors++;
  }

  // Gender match
  if (lostPet.sex && foundAnimal.gender) {
    if (lostPet.sex.toLowerCase() === foundAnimal.gender.toLowerCase()) {
      score += 0.1;
    }
    factors++;
  }

  return factors > 0 ? score / factors * 2 : 0;
}

export { getAccessToken };
