/**
 * Canonical shelter roster vocabulary. The single source for the status
 * and intake-type strings stored on Pet (shelterStatus / intakeType), so
 * API validation and UI chips never drift apart.
 */

export const SHELTER_STATUSES = ['AVAILABLE', 'ADOPTION_PENDING', 'ADOPTED', 'RECLAIMED'];

export const SHELTER_STATUS_LABELS = {
  AVAILABLE: 'Available',
  ADOPTION_PENDING: 'Adoption pending',
  ADOPTED: 'Adopted',
  RECLAIMED: 'Reclaimed by owner',
};

export const INTAKE_TYPES = ['STRAY', 'SURRENDER', 'TRANSFER'];

export const INTAKE_TYPE_LABELS = {
  STRAY: 'Stray',
  SURRENDER: 'Owner surrender',
  TRANSFER: 'Transfer in',
};

export function isShelterStatus(value) {
  return SHELTER_STATUSES.includes(value);
}

export function isIntakeType(value) {
  return INTAKE_TYPES.includes(value);
}

/**
 * Legal stray-hold window. Shelters must hold strays a jurisdiction-set
 * number of days before adopting out; the shelter configures its own
 * length (ShelterProfile.strayHoldDays). Everything renders from this
 * one function so chips and queue items can never disagree.
 * Returns the Date the hold ends, or null when it doesn't apply.
 */
export const STRAY_HOLD_MAX_DAYS = 30;

export function strayHoldEndsAt(pet, holdDays) {
  if (!holdDays || pet?.intakeType !== 'STRAY' || !pet?.intakeDate) return null;
  const start = new Date(pet.intakeDate).getTime();
  if (Number.isNaN(start)) return null;
  return new Date(start + holdDays * 86400e3);
}
