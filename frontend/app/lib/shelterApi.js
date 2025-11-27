/**
 * Phase 9: Shelter API Integration
 *
 * Integration with external shelter APIs:
 * - PetFinder API
 * - Rescue Groups API
 * - ASPCA/Shelter databases
 * - Custom shelter endpoints
 */

// PetFinder API configuration
const PETFINDER_API_KEY = process.env.PETFINDER_API_KEY;
const PETFINDER_API_SECRET = process.env.PETFINDER_API_SECRET;
const PETFINDER_BASE_URL = 'https://api.petfinder.com/v2';

// RescueGroups API configuration
const RESCUE_GROUPS_API_KEY = process.env.RESCUE_GROUPS_API_KEY;
const RESCUE_GROUPS_BASE_URL = 'https://api.rescuegroups.org/v5';

// Token cache for PetFinder
let petfinderToken = null;
let petfinderTokenExpiry = null;

/**
 * Get PetFinder OAuth token
 */
async function getPetfinderToken() {
  // Return cached token if still valid
  if (petfinderToken && petfinderTokenExpiry && Date.now() < petfinderTokenExpiry) {
    return petfinderToken;
  }

  if (!PETFINDER_API_KEY || !PETFINDER_API_SECRET) {
    throw new Error('PetFinder API credentials not configured');
  }

  const response = await fetch(`${PETFINDER_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: PETFINDER_API_KEY,
      client_secret: PETFINDER_API_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get PetFinder token');
  }

  const data = await response.json();
  petfinderToken = data.access_token;
  petfinderTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

  return petfinderToken;
}

/**
 * Search PetFinder animals
 *
 * @param {Object} params - Search parameters
 * @returns {Promise<Array>} - Array of animals
 */
export async function searchPetfinder(params = {}) {
  const token = await getPetfinderToken();

  const searchParams = new URLSearchParams();

  // Map our params to PetFinder params
  if (params.type) searchParams.set('type', params.type);
  if (params.breed) searchParams.set('breed', params.breed);
  if (params.size) searchParams.set('size', params.size);
  if (params.gender) searchParams.set('gender', params.gender);
  if (params.age) searchParams.set('age', params.age);
  if (params.color) searchParams.set('color', params.color);
  if (params.coat) searchParams.set('coat', params.coat);
  if (params.status) searchParams.set('status', params.status || 'adoptable');
  if (params.location) searchParams.set('location', params.location);
  if (params.distance) searchParams.set('distance', params.distance || 100);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', Math.min(params.limit || 20, 100));

  const response = await fetch(`${PETFINDER_BASE_URL}/animals?${searchParams}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('PetFinder search failed');
  }

  const data = await response.json();

  // Normalize PetFinder data to our format
  return data.animals.map(normalizePetfinderAnimal);
}

/**
 * Get single PetFinder animal
 */
export async function getPetfinderAnimal(id) {
  const token = await getPetfinderToken();

  const response = await fetch(`${PETFINDER_BASE_URL}/animals/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('PetFinder animal not found');
  }

  const data = await response.json();
  return normalizePetfinderAnimal(data.animal);
}

/**
 * Search PetFinder organizations (shelters)
 */
export async function searchPetfinderOrganizations(params = {}) {
  const token = await getPetfinderToken();

  const searchParams = new URLSearchParams();
  if (params.name) searchParams.set('name', params.name);
  if (params.location) searchParams.set('location', params.location);
  if (params.distance) searchParams.set('distance', params.distance || 100);
  if (params.state) searchParams.set('state', params.state);
  if (params.country) searchParams.set('country', params.country || 'US');
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', Math.min(params.limit || 20, 100));

  const response = await fetch(`${PETFINDER_BASE_URL}/organizations?${searchParams}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('PetFinder organization search failed');
  }

  const data = await response.json();
  return data.organizations.map(normalizePetfinderOrganization);
}

/**
 * Normalize PetFinder animal data
 */
function normalizePetfinderAnimal(animal) {
  return {
    id: `petfinder_${animal.id}`,
    externalId: animal.id,
    source: 'petfinder',
    name: animal.name,
    type: animal.type?.toLowerCase(),
    species: animal.species?.toLowerCase(),
    breeds: {
      primary: animal.breeds?.primary,
      secondary: animal.breeds?.secondary,
      mixed: animal.breeds?.mixed,
      unknown: animal.breeds?.unknown,
    },
    colors: {
      primary: animal.colors?.primary,
      secondary: animal.colors?.secondary,
      tertiary: animal.colors?.tertiary,
    },
    age: animal.age?.toLowerCase(),
    gender: animal.gender?.toLowerCase(),
    size: animal.size?.toLowerCase(),
    coat: animal.coat?.toLowerCase(),
    status: animal.status,
    description: animal.description,
    photos: animal.photos?.map((p) => ({
      small: p.small,
      medium: p.medium,
      large: p.large,
      full: p.full,
    })) || [],
    videos: animal.videos || [],
    attributes: {
      spayedNeutered: animal.attributes?.spayed_neutered,
      houseTrained: animal.attributes?.house_trained,
      declawed: animal.attributes?.declawed,
      specialNeeds: animal.attributes?.special_needs,
      shotsCurrent: animal.attributes?.shots_current,
    },
    environment: {
      children: animal.environment?.children,
      dogs: animal.environment?.dogs,
      cats: animal.environment?.cats,
    },
    contact: {
      email: animal.contact?.email,
      phone: animal.contact?.phone,
      address: {
        address1: animal.contact?.address?.address1,
        address2: animal.contact?.address?.address2,
        city: animal.contact?.address?.city,
        state: animal.contact?.address?.state,
        postcode: animal.contact?.address?.postcode,
        country: animal.contact?.address?.country,
      },
    },
    organizationId: animal.organization_id,
    url: animal.url,
    publishedAt: animal.published_at,
    distance: animal.distance,
  };
}

/**
 * Normalize PetFinder organization data
 */
function normalizePetfinderOrganization(org) {
  return {
    id: `petfinder_org_${org.id}`,
    externalId: org.id,
    source: 'petfinder',
    name: org.name,
    email: org.email,
    phone: org.phone,
    url: org.url,
    website: org.website,
    address: {
      address1: org.address?.address1,
      address2: org.address?.address2,
      city: org.address?.city,
      state: org.address?.state,
      postcode: org.address?.postcode,
      country: org.address?.country,
    },
    hours: org.hours,
    photos: org.photos,
    socialMedia: {
      facebook: org.social_media?.facebook,
      twitter: org.social_media?.twitter,
      youtube: org.social_media?.youtube,
      instagram: org.social_media?.instagram,
      pinterest: org.social_media?.pinterest,
    },
    missionStatement: org.mission_statement,
    adoption: {
      policy: org.adoption?.policy,
      url: org.adoption?.url,
    },
    distance: org.distance,
  };
}

/**
 * Search RescueGroups animals
 */
export async function searchRescueGroups(params = {}) {
  if (!RESCUE_GROUPS_API_KEY) {
    throw new Error('RescueGroups API key not configured');
  }

  const filterRadius = [];
  if (params.location && params.distance) {
    filterRadius.push({
      fieldName: 'animals.locationDistance',
      operation: 'lessthan',
      criteria: params.distance,
    });
  }

  const filters = [];
  if (params.type) {
    filters.push({
      fieldName: 'animals.species',
      operation: 'equals',
      criteria: params.type,
    });
  }
  if (params.breed) {
    filters.push({
      fieldName: 'animals.breedPrimary',
      operation: 'contains',
      criteria: params.breed,
    });
  }
  if (params.status === 'found') {
    filters.push({
      fieldName: 'animals.isFound',
      operation: 'equals',
      criteria: 'Yes',
    });
  }

  const body = {
    data: {
      filterRadius: params.location ? {
        miles: params.distance || 100,
        postalcode: params.location,
      } : undefined,
      filters: filters.length > 0 ? filters : undefined,
    },
  };

  const response = await fetch(`${RESCUE_GROUPS_BASE_URL}/public/animals/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Authorization: RESCUE_GROUPS_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('RescueGroups search failed');
  }

  const data = await response.json();
  return (data.data || []).map(normalizeRescueGroupsAnimal);
}

/**
 * Normalize RescueGroups animal data
 */
function normalizeRescueGroupsAnimal(animal) {
  const attrs = animal.attributes || {};

  return {
    id: `rescuegroups_${animal.id}`,
    externalId: animal.id,
    source: 'rescuegroups',
    name: attrs.name,
    type: attrs.species?.toLowerCase(),
    species: attrs.species?.toLowerCase(),
    breeds: {
      primary: attrs.breedPrimary,
      secondary: attrs.breedSecondary,
      mixed: attrs.isMixedBreed === 'Yes',
    },
    colors: {
      primary: attrs.colorPrimary,
      secondary: attrs.colorSecondary,
    },
    age: attrs.ageGroup?.toLowerCase(),
    gender: attrs.sex?.toLowerCase(),
    size: attrs.sizeGroup?.toLowerCase(),
    description: attrs.descriptionText,
    photos: attrs.pictureUrl ? [{ full: attrs.pictureUrl, medium: attrs.pictureThumbnailUrl }] : [],
    status: attrs.isFound === 'Yes' ? 'found' : 'adoptable',
    isFound: attrs.isFound === 'Yes',
    foundDate: attrs.foundDate,
    foundLocation: attrs.foundLocation,
    contact: {
      email: attrs.email,
      phone: attrs.phone,
    },
    organizationId: attrs.orgID,
    url: attrs.url,
    distance: attrs.distance,
  };
}

/**
 * Match lost pet with shelter animals
 *
 * @param {Object} lostPet - Lost pet case data
 * @returns {Promise<Array>} - Potential matches
 */
export async function findPotentialMatches(lostPet) {
  const matches = [];

  // Search parameters based on lost pet
  const searchParams = {
    type: lostPet.petType,
    breed: lostPet.breed,
    color: lostPet.primaryColor,
    location: lostPet.lastSeenZipCode || lostPet.lastSeenLocation,
    distance: 50, // 50 mile radius
    status: 'found',
  };

  try {
    // Search PetFinder
    if (PETFINDER_API_KEY) {
      const petfinderResults = await searchPetfinder({
        ...searchParams,
        status: 'found',
      });
      matches.push(...petfinderResults.map((m) => ({ ...m, matchSource: 'petfinder' })));
    }
  } catch (error) {
    console.error('PetFinder search error:', error);
  }

  try {
    // Search RescueGroups
    if (RESCUE_GROUPS_API_KEY) {
      const rescueGroupsResults = await searchRescueGroups({
        ...searchParams,
        status: 'found',
      });
      matches.push(...rescueGroupsResults.map((m) => ({ ...m, matchSource: 'rescuegroups' })));
    }
  } catch (error) {
    console.error('RescueGroups search error:', error);
  }

  // Score and sort matches
  const scoredMatches = matches.map((match) => ({
    ...match,
    matchScore: calculateMatchScore(lostPet, match),
  }));

  return scoredMatches
    .filter((m) => m.matchScore > 0.3)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 20);
}

/**
 * Calculate match score between lost pet and found animal
 */
function calculateMatchScore(lostPet, foundAnimal) {
  let score = 0;
  let weights = 0;

  // Species match (required)
  if (lostPet.petType?.toLowerCase() !== foundAnimal.type?.toLowerCase()) {
    return 0;
  }
  score += 0.2;
  weights += 0.2;

  // Breed match
  if (lostPet.breed && foundAnimal.breeds?.primary) {
    const breedMatch = lostPet.breed.toLowerCase().includes(foundAnimal.breeds.primary.toLowerCase()) ||
                       foundAnimal.breeds.primary.toLowerCase().includes(lostPet.breed.toLowerCase());
    if (breedMatch) {
      score += 0.25;
    }
  }
  weights += 0.25;

  // Color match
  if (lostPet.primaryColor && foundAnimal.colors?.primary) {
    const colorMatch = lostPet.primaryColor.toLowerCase() === foundAnimal.colors.primary.toLowerCase();
    if (colorMatch) {
      score += 0.2;
    }
  }
  weights += 0.2;

  // Size match
  if (lostPet.size && foundAnimal.size) {
    const sizeMatch = lostPet.size.toLowerCase() === foundAnimal.size.toLowerCase();
    if (sizeMatch) {
      score += 0.15;
    }
  }
  weights += 0.15;

  // Gender match
  if (lostPet.gender && foundAnimal.gender) {
    const genderMatch = lostPet.gender.toLowerCase() === foundAnimal.gender.toLowerCase();
    if (genderMatch) {
      score += 0.1;
    }
  }
  weights += 0.1;

  // Distance bonus (closer is better)
  if (foundAnimal.distance !== undefined && foundAnimal.distance < 10) {
    score += 0.1;
  }
  weights += 0.1;

  return weights > 0 ? score / weights : 0;
}

/**
 * Get all configured shelter API sources
 */
export function getConfiguredSources() {
  const sources = [];

  if (PETFINDER_API_KEY && PETFINDER_API_SECRET) {
    sources.push({ id: 'petfinder', name: 'PetFinder', enabled: true });
  }

  if (RESCUE_GROUPS_API_KEY) {
    sources.push({ id: 'rescuegroups', name: 'RescueGroups', enabled: true });
  }

  return sources;
}

export default {
  searchPetfinder,
  getPetfinderAnimal,
  searchPetfinderOrganizations,
  searchRescueGroups,
  findPotentialMatches,
  getConfiguredSources,
};
