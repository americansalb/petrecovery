/**
 * A request that never reaches the server rejects with the browser's own
 * words, and "Failed to fetch" was the whole of what a player on a
 * dropped connection was told. Seen on a phone: one failed guess in a
 * Script round replaced the sentence with it and a way out of the game.
 */
import { OFFLINE_MESSAGE, isNetworkError, playerMessage } from '@/app/geo/lib/networkError';

test("each browser's words for a request that never arrived read as a connection problem", () => {
  for (const words of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', 'Network request failed']) {
    const error = new TypeError(words);
    expect(isNetworkError(error)).toBe(true);
    expect(playerMessage(error, 'fallback')).toBe(OFFLINE_MESSAGE);
  }
});

test("the server's own message, and the caller's fallback, are kept", () => {
  expect(playerMessage(new Error('That round has expired'), 'fallback')).toBe('That round has expired');
  expect(playerMessage(new Error(''), 'Could not score the guess')).toBe('Could not score the guess');
  // A TypeError from a bug is a bug, not a connection problem.
  expect(isNetworkError(new TypeError("Cannot read properties of undefined (reading 'token')"))).toBe(false);
});
