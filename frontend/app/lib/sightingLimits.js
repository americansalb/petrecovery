/**
 * The limits a sighting is held to, kept on their own so that every way a
 * sighting comes in, and every screen that sets one's place, holds to the
 * same numbers (app/lib/witness.js, /api/assignments/[id]/sightings, the
 * search screen and the place picker on its sighting form). Nothing here
 * reads the database, so a page can import it as well as a route.
 *
 * How many sightings one pet takes in an hour, from everyone together. A
 * route counts each connection (ten a minute on the pet's page), which
 * still let one sender put six hundred on a pet's map in an hour, each one
 * an email and a push to the owner; and a sender can come from many
 * connections. A real search does not come near this number: the same
 * place a few minutes later is the same sighting and is not counted again.
 */
export const SIGHTINGS_PER_HOUR = 40;
/** How many of those are also emailed to the owner. Every one still rings the bell and is pushed. */
export const OWNER_EMAILS_PER_HOUR = 8;

/**
 * A phone's reading rougher than this, in metres, is not a place. A phone
 * with precise location turned off answers with a point that can be
 * kilometres out, and a sighting pinned there sends the owner to the wrong
 * street. Past this the witness types the street or puts the pin on the
 * map by hand. It holds for every way the phone sets a sighting's place:
 * the reading the search screen takes when the form opens, and the place
 * picker's own "Use my location" button.
 */
export const SIGHTING_ACCURACY_METERS = 150;

/**
 * How far from where the pet was lost a sighting can be and still be
 * taken, in kilometres. Lost pets are mostly found close by (the findings
 * the search cites: dogs, 70% within a mile; cats, 3 in 4 within 500 m),
 * and a dog that runs for a day, or a pet someone picked up and drove to
 * the next town, can still turn up tens of kilometres off. 80 km (about 50
 * miles) takes all of that. A sighting further away is a pin put in the
 * wrong place or a street picked in the wrong city (2026-11-16: a phone in
 * Chicago sent one for a cat lost in Austin, 1,578 km away), and taking it
 * alerts the owner and every force looking and moves the search there.
 */
export const SIGHTING_MAX_KM = 80;
