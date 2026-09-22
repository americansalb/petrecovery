/** @jest-environment jsdom */

/**
 * The product is a game. The interface was a directory of features.
 *
 * Founder, 2026-09-22: "the entire interface feels poorly designed...
 * like the person that made it does not know the purpose of the app but
 * only each individual feature." Photographed on a production build,
 * that sentence has four screens behind it:
 *
 *   The front door carried two Multiplayer controls side by side - the
 *   navigation tab and an in-page Solo/Multiplayer toggle - both ending
 *   at /geo/rooms, on the one screen where the only thing a stranger
 *   should have to decide is Street or Script.
 *
 *   Profile's Record tab was five headings over five zeros for
 *   everybody who had not played: three identical "Unplaced, 0 of 5
 *   placement games" cards, one per ladder, then "No rated games yet",
 *   "None yet", "0 Street rounds today".
 *
 *   Rankings opened on a grid of six league emblems above a table with
 *   nobody in it, explaining a rating a first-time visitor has no way
 *   to have.
 *
 *   Opening a room refused until the host typed a name, with the button
 *   dead until they did, and then asked them to sign in anyway - the
 *   same "we don't make it easy" the sign-in card had.
 *
 * These pin the fixes. Each one fails if the screen goes back to
 * listing what exists instead of doing what it is for.
 */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import GameMenu from '@/app/geo/components/home/GameMenu';
import ProfileClient from '@/app/geo/components/ProfileClient';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/geo',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/app/geo/lib/profile', () => ({
  ensureProfile: jest.fn(async () => ({})),
  profileHeaders: () => ({}),
}));
jest.mock('@/app/geo/lib/savedGame', () => ({ latestSavedGame: async () => null }));
jest.mock('@/app/geo/lib/serverConfig', () => ({
  loadGeoConfig: async () => ({ providers: { apple: { configured: true } } }),
}));
jest.mock('@/app/geo/lib/appleMapKit', () => ({ initializeMapKit: jest.fn(async () => {}) }));
const { ensureProfile } = require('@/app/geo/lib/profile');

const answer = (data) => ({ ok: true, json: async () => data });

afterEach(() => { jest.clearAllMocks(); });

describe('the front door', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => answer({}));
  });

  test('offers multiplayer once, not twice', async () => {
    await act(async () => { render(<GameMenu />); });
    // The navigation owns the tab; the page used to hold a second
    // control with the same word going to the same place.
    const toggle = screen.queryByRole('group', { name: 'Play with' });
    expect(toggle).toBeNull();
    expect(screen.queryByRole('button', { name: /Multiplayer/ })).toBeNull();
  });

  test('the one decision on it is which game, and Play starts it', async () => {
    await act(async () => { render(<GameMenu />); });
    const choices = screen.getByRole('group', { name: 'Game' });
    expect(choices).toBeInTheDocument();
    // Street and Script, and Play names the one that is chosen.
    expect(screen.getByRole('button', { name: /Play Street/ })).toBeInTheDocument();
  });

  test('the way to play with somebody is named for what it does', async () => {
    await act(async () => { render(<GameMenu />); });
    const link = screen.getByRole('link', { name: /Play with a friend/ });
    expect(link).toHaveAttribute('href', '/geo/rooms');
  });
});

describe("a profile with nothing in it", () => {
  const blank = {
    ok: true,
    signedIn: false,
    name: 'Player',
    points: 0,
    ratings: {},
    recent: [],
    badges: [],
    usage: { rounds: 0 },
  };

  const renderProfile = async (profile) => {
    // The page asks ensureProfile for the player, not the API directly.
    ensureProfile.mockResolvedValue(profile);
    global.fetch = jest.fn(async () => answer({ shop: { points: 0, items: [] } }));
    await act(async () => { render(<ProfileClient />); });
  };

  test('says how a record is started instead of listing five empty sections', async () => {
    await renderProfile(blank);
    expect(await screen.findByText(/It starts with one game/)).toBeInTheDocument();
    // The three identical Unplaced cards, one per ladder, are the thing
    // this replaces.
    expect(screen.queryByText('Unplaced')).toBeNull();
    expect(screen.queryByText(/No rated games yet/)).toBeNull();
    expect(screen.getByRole('link', { name: /Play a game/ })).toHaveAttribute('href', '/geo');
  });

  test('the real record comes back the moment there is one', async () => {
    await renderProfile({ ...blank, usage: { rounds: 3 } });
    expect(await screen.findByText(/3/)).toBeInTheDocument();
    expect(screen.getAllByText('Unplaced').length).toBeGreaterThan(0);
    expect(screen.queryByText(/It starts with one game/)).toBeNull();
  });

  test('one badge is a record too', async () => {
    await renderProfile({
      ...blank,
      badges: [{ countryCode: 'JP', flag: '🇯🇵', name: 'Japan', bestKm: 12 }],
    });
    expect(await screen.findByText('Japan')).toBeInTheDocument();
    expect(screen.queryByText(/It starts with one game/)).toBeNull();
  });
});

test('Rankings opens on the board, not on a legend for a rating nobody has', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../app/geo/leaderboard/page.js'),
    'utf8',
  );
  // RankPath draws the six leagues. It belongs with the explanation it
  // is a legend for, inside the disclosure, not above the table.
  const details = src.indexOf('How rating works');
  const closes = src.indexOf('</details>', details);
  const emblems = src.indexOf('<RankPath />');
  expect(emblems).toBeGreaterThan(details);
  expect(emblems).toBeLessThan(closes);
  // And only there.
  expect(src.split('<RankPath />').length - 1).toBe(1);
});
