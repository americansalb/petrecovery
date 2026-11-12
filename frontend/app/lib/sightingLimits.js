/**
 * How many sightings one pet takes in an hour, from everyone together.
 *
 * A route counts each connection (ten a minute on the pet's page), which
 * still let one sender put six hundred on a pet's map in an hour, each one
 * an email and a push to the owner; and a sender can come from many
 * connections. A real search does not come near this number: the same
 * place a few minutes later is the same sighting and is not counted again.
 *
 * Kept on their own so that every way a sighting comes in holds to the same
 * numbers (app/lib/witness.js, /api/assignments/[id]/sightings).
 */
export const SIGHTINGS_PER_HOUR = 40;
/** How many of those are also emailed to the owner. Every one still rings the bell and is pushed. */
export const OWNER_EMAILS_PER_HOUR = 8;
