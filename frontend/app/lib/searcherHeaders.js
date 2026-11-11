/**
 * The two headers a helper without an account sends to prove who they are
 * to the board (app/lib/searcher.js reads them; the search screen sends
 * them). Their own file because the browser bundle needs the names and
 * must not pull in the server's database client to get them.
 */
export const VOLUNTEER_ID_HEADER = 'x-volunteer-id';
export const VOLUNTEER_KEY_HEADER = 'x-volunteer-key';
