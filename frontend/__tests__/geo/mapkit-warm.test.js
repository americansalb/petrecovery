/** @jest-environment jsdom */

/**
 * Apple's SDK starts on the lobby, not on the round screen.
 *
 * Measured on the live site, broken down per stage:
 *
 *   ~3.5s  MapKit initialising, before the first spot is even tried
 *    4.2s  each spot with no imagery (the full PER_CANDIDATE_MS. That
 *          silence was a page the timeout itself had wedged; a healthy
 *          page answers a miss in about 1.5s: lib/lookAround.js, STALL_MS)
 *   ~2.9s  the spot that works
 *
 * The first line is the one that is free to remove. initializeMapKit
 * memoises on a module-level promise, and the lobby reaches the round by
 * a client navigation, so work done while somebody is still choosing is
 * work the round does not repeat. It loads the script and mints a token
 * and looks up no imagery, so it costs nothing against the Look Around
 * quota.
 */
import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';

const push = jest.fn();
const initializeMapKit = jest.fn(async () => ({}));
let config = { providers: { apple: { configured: true } } };

jest.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams() }));
jest.mock('@/app/geo/lib/appleMapKit', () => ({ initializeMapKit: (...a) => initializeMapKit(...a), mapKitAuth: () => 'ok', onMapKitAuth: jest.fn() }));
jest.mock('@/app/geo/lib/serverConfig', () => ({ loadGeoConfig: async () => config }));
jest.mock('@/app/geo/lib/profile', () => ({ profileHeaders: () => ({}) }));
jest.mock('@/app/geo/lib/savedGame', () => ({ latestSavedGame: async () => null }));
jest.mock('@/app/geo/components/home/ScriptArtwork', () => function Art() { return null; });

const GameMenu = require('@/app/geo/components/home/GameMenu').default;

beforeEach(() => {
  jest.clearAllMocks();
  config = { providers: { apple: { configured: true } } };
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
});

test('the lobby starts Apple’s SDK so the round does not pay for it', async () => {
  await act(async () => { render(<GameMenu />); });
  expect(initializeMapKit).toHaveBeenCalled();
});

test('a deployment without Apple imagery is not asked to load it', async () => {
  config = { providers: { apple: { configured: false } } };
  await act(async () => { render(<GameMenu />); });
  expect(initializeMapKit).not.toHaveBeenCalled();
});

test('a failure to warm up never reaches the player', async () => {
  // The lobby must render whatever Apple does; the round screen has its
  // own handling for an SDK that will not start.
  initializeMapKit.mockRejectedValueOnce(new Error('no token'));
  await act(async () => { render(<GameMenu />); });
  expect(initializeMapKit).toHaveBeenCalled();
});
