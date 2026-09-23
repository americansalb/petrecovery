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
  const cta = await screen.findByRole('link', { name: 'Sign in' });
  expect(cta).toHaveAttribute('href', '/geo/signin');
});

test('a signed-in player gets their account, not another invitation to sign up', async () => {
  answer({ ok: true, signedIn: true, email: 'kevin@example.test', account: { email: 'kevin@example.test' } });
  await act(async () => { render(<GeoHeader />); });
  const who = await screen.findByRole('link', { name: /kevin/i });
  expect(who).toHaveAttribute('href', '/geo/me');
  expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
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
  expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();

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
  expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  isSignedIn.mockReturnValue(false);
});

test('signing in without a navigation updates the bar', async () => {
  answer({ ok: true, signedIn: false, email: null, account: null });
  await act(async () => { render(<GeoHeader />); });
  await screen.findByRole('link', { name: 'Sign in' });

  answer({ ok: true, signedIn: true, email: 'kevin@example.test', account: { email: 'kevin@example.test' } });
  await act(async () => { window.dispatchEvent(new Event('geo:session-changed')); });
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull());
  expect(screen.getByRole('link', { name: /kevin/i })).toBeInTheDocument();
});

test('the bar does not offer to take you to the page you are reading', async () => {
  // A control whose whole job is to navigate to the current screen is
  // one more thing on the bar that does nothing.
  const nav = require('next/navigation');
  const was = nav.usePathname;
  nav.usePathname = () => '/geo/signin';
  answer({ ok: true, signedIn: false, email: null, account: null });
  await act(async () => { render(<GeoHeader />); });
  expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  nav.usePathname = was;
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

/**
 * The links do not move when the account control changes. The slot was
 * only there when it held something, so the links jumped sideways once
 * the session was read on every page load, and again on the sign-in
 * page, which has no Sign in button.
 */
test('the account slot is there whether or not it holds anything', async () => {
  const nav = require('next/navigation');
  const was = nav.usePathname;
  nav.usePathname = () => '/geo/signin';
  answer({ ok: true, signedIn: false, email: null, account: null });
  let container;
  await act(async () => { ({ container } = render(<GeoHeader />)); });
  const slot = container.querySelector('[data-account-slot]');
  expect(slot).toBeInTheDocument();
  expect(slot).toBeEmptyDOMElement();
  nav.usePathname = was;

  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.resolve(__dirname, '../../app/geo/theme.css'), 'utf8');
  // A fixed width where the links are beside it (the desktop bar).
  expect(css).toMatch(/\.ui-account-slot \{\s*width: \d+px;/);
});
