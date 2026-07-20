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
