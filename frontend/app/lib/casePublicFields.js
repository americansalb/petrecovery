/**
 * The fields of a pet's report that its own page shows to anyone, as a
 * Prisma `select`.
 *
 * A route that hands a report to someone who is not its owner asks for
 * these and nothing else. Asked for whole (`include`, or a bare
 * `findMany`), a report comes back with the owner's email, phone, full
 * name and account id and the answers to the questionnaire, microchip
 * number among them; three routes that list pets for a Rescue Force did
 * exactly that, and joining a force is one tap.
 *
 * The owner is a first name here (`reporter.firstName`). The number to
 * call is the one on the pet's page (/api/public/missions/[caseNumber]).
 */
export const PUBLIC_CASE_FIELDS = Object.freeze({
  id: true,
  caseNumber: true,
  reportType: true,
  status: true,
  priority: true,
  petName: true,
  petSpecies: true,
  petBreed: true,
  petColor: true,
  petSize: true,
  petPhotoUrl: true,
  petDescription: true,
  lastSeenAt: true,
  lastSeenAddress: true,
  lastSeenLatitude: true,
  lastSeenLongitude: true,
  searchRadius: true,
  hasReward: true,
  createdAt: true,
  reporter: { select: { firstName: true } },
});

/** Field names that never belong in an answer about someone else's pet. */
export const PRIVATE_CASE_FIELDS = Object.freeze(['ownerName', 'ownerPhone', 'ownerEmail', 'reporterId', 'details']);
