/** @jest-environment jsdom */

/**
 * There has to be a way to make an account from the navigation.
 *
 * For the game's whole life there was not one. The right-hand slot of
 * the bar held a decorative FREE TO PLAY badge, and that badge is
 * `display: none` under 800px, so on a phone the slot was empty. The
 * only ways to an account were a row on the profile page and a prompt
 * at the end of a game, and the lobby said "No account needed" under
 * the only button anybody presses. Players did not decline an account;
 * they were never offered one (founder, 2026-09-19: "we dont let them...
 * WE don't make it easy").
 *
 * The chrome rule allows exactly one session-dependent slot, "Sign
 * in/Join vs the account menu" (CLAUDE.md). This is that slot, so these
 * tests pin both of its states.
 */
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import GeoHeader from '@/app/geo/components/GeoHeader';

jest.mock('next/navigation', () => ({ usePathname: () => '/geo' }));
jest.mock('@/app/geo/lib/session', () => ({ isSignedIn: jest.fn(() => false) }));
const { isSignedIn } = require('@/app/geo/lib/session');

const answer = (body) => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => body }));
};

afterEach(() => { jest.clearAllMocks(); });

test('a signed-out player is offered an account, from the navigation, on every screen', async () => {
  answer({ ok: true, signedIn: false, email: null, account: null });
  await act(async () => { render(<GeoHeader />); });
  const cta = await screen.findByRole('link', { name: 'Create account' });
  expect(cta).toHaveAttribute('href', '/geo/signin');
});

test('a signed-in player gets their account, not another invitation to sign up', async () => {
  answer({ ok: true, signedIn: true, email: 'kevin@example.test', account: { email: 'kevin@example.test' } });
  await act(async () => { render(<GeoHeader />); });
  const who = await screen.findByRole('link', { name: /kevin/i });
  expect(who).toHaveAttribute('href', '/geo/me');
  expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull();
});

test('the cookie answers before the network does', async () => {
  // /api/geo/auth/me is a round trip. On a phone that is long enough for
  // the one thing we want a new player to do to be missing from the bar,
  // so the readable companion cookie settles it first.
  isSignedIn.mockReturnValue(true);
  global.fetch = jest.fn(() => new Promise(() => {}));
  await act(async () => { render(<GeoHeader />); });
  // No email yet, so the control names itself "Account" until one arrives.
  expect(await screen.findByRole('link', { name: 'Account' })).toHaveAttribute('href', '/geo/me');
  expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull();

  isSignedIn.mockReturnValue(false);
});

test('a refused auth/me never demotes a signed-in player to a signup prompt', async () => {
  // Sixty a minute per address, and an address is a household. A 429 used
  // to read as "signed out" and put Create account in front of somebody
  // who is already signed in.
  isSignedIn.mockReturnValue(true);
  global.fetch = jest.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
  await act(async () => { render(<GeoHeader />); });
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull();
  isSignedIn.mockReturnValue(false);
});

test('signing in without a navigation updates the bar', async () => {
  answer({ ok: true, signedIn: false, email: null, account: null });
  await act(async () => { render(<GeoHeader />); });
  await screen.findByRole('link', { name: 'Create account' });

  answer({ ok: true, signedIn: true, email: 'kevin@example.test', account: { email: 'kevin@example.test' } });
  await act(async () => { window.dispatchEvent(new Event('geo:session-changed')); });
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull());
  expect(screen.getByRole('link', { name: /kevin/i })).toBeInTheDocument();
});

test('the lobby no longer talks players out of an account', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '../..');
  for (const rel of ['app/geo/components/home/GameMenu.js', 'app/geo/components/script/ScriptLobby.js']) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    expect(src).not.toMatch(/No account needed/i);
  }
});
