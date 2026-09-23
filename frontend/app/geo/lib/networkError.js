/**
 * What to tell a player when a request fails.
 *
 * A request that never reaches the server rejects with the browser's own
 * words, and those were shown as they came: "Failed to fetch" (Chrome),
 * "Load failed" (Safari), "NetworkError when attempting to fetch
 * resource." (Firefox). On a phone that drops signal for a second that is
 * the whole message, in developer's English, with nothing to say what to
 * do next. A message the server sent, or the caller's own, is kept.
 */

export const OFFLINE_MESSAGE = 'Could not reach the game. Check your connection and try again.';

const NETWORK = /failed to fetch|load failed|networkerror|network request failed|network connection was lost/i;

export function isNetworkError(error) {
  return Boolean(error) && (error.name === 'TypeError' || error instanceof TypeError) && NETWORK.test(String(error.message || ''));
}

export function playerMessage(error, fallback = 'Something went wrong. Try again.') {
  if (isNetworkError(error)) return OFFLINE_MESSAGE;
  return (error && error.message) || fallback;
}
