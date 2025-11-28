/**
 * Veterinary Clinic Network Integration
 *
 * Connect with vet clinics for lost pet alerts and found pet notifications
 */

/**
 * Search for nearby vet clinics
 */
export async function findNearbyVetClinics(latitude, longitude, radiusMiles = 25) {
  const clinics = [];

  // Search Google Places API for vet clinics
  if (process.env.GOOGLE_PLACES_API_KEY) {
    const googleClinics = await searchGooglePlaces(latitude, longitude, radiusMiles);
    clinics.push(...googleClinics);
  }

  // Search our partner database
  const partnerClinics = await searchPartnerClinics(latitude, longitude, radiusMiles);
  clinics.push(...partnerClinics);

  // Deduplicate by name and location
  const unique = deduplicateClinics(clinics);

  // Sort by distance
  return unique.sort((a, b) => a.distance - b.distance);
}

/**
 * Search Google Places for vet clinics
 */
async function searchGooglePlaces(lat, lng, radiusMiles) {
  const radiusMeters = radiusMiles * 1609.34;

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
    `location=${lat},${lng}&radius=${radiusMeters}&type=veterinary_care&key=${process.env.GOOGLE_PLACES_API_KEY}`
  );

  if (!response.ok) {
    console.error('Google Places API error:', response.status);
    return [];
  }

  const data = await response.json();

  return (data.results || []).map(place => ({
    source: 'google',
    name: place.name,
    address: place.vicinity,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    rating: place.rating,
    placeId: place.place_id,
    isOpen: place.opening_hours?.open_now,
    distance: calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng),
    isPartner: false,
  }));
}

/**
 * Search partner clinic database
 */
async function searchPartnerClinics(lat, lng, radiusMiles) {
  // In production, this would query our database of partner clinics
  // For now, return placeholder

  return [];
}

/**
 * Send lost pet alert to partner clinics
 */
export async function sendLostPetAlertToClinics(caseData, clinics) {
  const results = [];

  for (const clinic of clinics) {
    if (!clinic.isPartner || !clinic.alertEmail) continue;

    try {
      // Send email alert to clinic
      const result = await sendClinicAlert(clinic, caseData, 'LOST');
      results.push({ clinicId: clinic.id, success: true });
    } catch (error) {
      results.push({ clinicId: clinic.id, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Send found pet notification to clinics
 */
export async function sendFoundPetNotification(petData, clinics) {
  const results = [];

  for (const clinic of clinics) {
    if (!clinic.isPartner) continue;

    try {
      const result = await sendClinicAlert(clinic, petData, 'FOUND');
      results.push({ clinicId: clinic.id, success: true });
    } catch (error) {
      results.push({ clinicId: clinic.id, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Send alert email to clinic
 */
async function sendClinicAlert(clinic, petData, type) {
  const subject = type === 'LOST'
    ? `Lost Pet Alert: ${petData.petName} - ${petData.petSpecies}`
    : `Found Pet Report: ${petData.petSpecies} found near your clinic`;

  const body = generateClinicAlertEmail(clinic, petData, type);

  // In production, send via email service
  console.log(`Would send email to ${clinic.alertEmail}: ${subject}`);

  return { sent: true };
}

/**
 * Generate clinic alert email content
 */
function generateClinicAlertEmail(clinic, petData, type) {
  if (type === 'LOST') {
    return `
Dear ${clinic.name} Staff,

A pet has been reported lost near your location. Please be on the lookout:

Pet Name: ${petData.petName}
Species: ${petData.petSpecies}
Breed: ${petData.petBreed || 'Unknown'}
Color: ${petData.petColor}
Last Seen: ${petData.lastSeenAddress}
Date: ${new Date(petData.lastSeenAt).toLocaleDateString()}

Description: ${petData.petDescription || 'No additional description'}

If this pet is brought to your clinic, please contact:
Owner: ${petData.ownerName}
Phone: ${petData.ownerPhone}
Email: ${petData.ownerEmail}

Case Reference: ${petData.caseNumber}
View case online: ${process.env.NEXT_PUBLIC_BASE_URL}/cases/${petData.caseNumber}

Thank you for your help in reuniting pets with their families!

PetRecovery.org
    `.trim();
  }

  return `
Dear ${clinic.name} Staff,

A ${petData.petSpecies} has been found near your location:

Species: ${petData.petSpecies}
Breed: ${petData.petBreed || 'Unknown'}
Color: ${petData.petColor}
Found Location: ${petData.foundLocation}

If anyone has reported a missing pet matching this description, please direct them to:
${process.env.NEXT_PUBLIC_BASE_URL}/cases/${petData.caseNumber}

Thank you!
PetRecovery.org
  `.trim();
}

/**
 * Register clinic as partner
 */
export async function registerPartnerClinic(clinicData) {
  // In production, store in database
  return {
    id: `clinic_${Date.now()}`,
    ...clinicData,
    isPartner: true,
    registeredAt: new Date(),
  };
}

/**
 * Calculate distance between two points
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Deduplicate clinics by name similarity
 */
function deduplicateClinics(clinics) {
  const seen = new Map();

  return clinics.filter(clinic => {
    const key = `${clinic.name.toLowerCase()}_${Math.round(clinic.latitude * 100)}_${Math.round(clinic.longitude * 100)}`;
    if (seen.has(key)) {
      // Prefer partner clinics
      if (clinic.isPartner && !seen.get(key).isPartner) {
        seen.set(key, clinic);
        return true;
      }
      return false;
    }
    seen.set(key, clinic);
    return true;
  });
}
