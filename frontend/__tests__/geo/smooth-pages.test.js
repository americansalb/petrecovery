/** @jest-environment jsdom */

/**
 * Pages arrive; they do not swap, and they do not shove.
 *
 * Founder, 2026-09-23: "a smooth, enjoyable experience that has
 * beautiful animations and transitions rather than feeling like a
 * website from the 90s". Measured on the live site before these:
 *
 *   - every navigation between the game's pages was a single-frame swap;
 *   - Rankings shifted its own layout by 0.13 (Google calls over 0.1
 *     "poor"): the board landed three seconds in and pushed the page
 *     242px down while it was being read;
 *   - sign-in shifted by 0.12: a one-line "Checking your account" was
 *     replaced by a four-hundred-pixel form, shoving the footer 367px;
 *   - the loading curtain over a round vanished in a frame, so the
 *     panorama popped into being.
 *
 * After, on a production build: navigations animate over 22-25 frames,
 * Rankings shifts 0.002 and sign-in 0.007.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

jest.mock('next/navigation', () => ({ usePathname: jest.fn(() => '/geo/rooms'), useRouter: () => ({ push: jest.fn() }) }));
const { usePathname } = require('next/navigation');

describe('arriving on a page', () => {
  const GeoTemplate = require('@/app/geo/template').default;

  test('an ordinary page rises into place', () => {
    usePathname.mockReturnValue('/geo/leaderboard');
    const { container } = render(<GeoTemplate><p>board</p></GeoTemplate>);
    expect(container.firstChild).toHaveClass('pe-page-enter');
  });

  test('the round and the room only fade, because they are fixed to the viewport', () => {
    // A rise is a translate on the wrapper, and a transformed ancestor
    // becomes the containing block for `position: fixed` - it would
    // shrink the whole game screen to the wrapper while it played.
    for (const route of ['/geo/play', '/geo/room/ABC123', '/geo/script/play']) {
      usePathname.mockReturnValue(route);
      const { container, unmount } = render(<GeoTemplate><p>game</p></GeoTemplate>);
      expect({ route, cls: container.firstChild.className }).toEqual({ route, cls: 'pe-page-enter--takeover' });
      unmount();
    }
  });
});

describe('holding a shape while it loads', () => {
  test('Rankings loads under the empty board itself, not a one-line row', () => {
    // Same markup, invisible, so the two are the same height by
    // construction rather than by a number that drifts.
    const page = read('app/geo/leaderboard/page.js');
    const loading = page.slice(page.indexOf('board === null && !error ? (\n                <tr'));
    const row = loading.slice(0, loading.indexOf('</tr>'));
    expect(row).toMatch(/pe-ladder-empty invisible/);
    expect(row).toMatch(/pe-skeleton/);
    expect(page).not.toMatch(/>\s*Loading\s*<\/td>/);
  });

  test('the season line keeps its place before it knows the season', () => {
    const page = read('app/geo/leaderboard/page.js');
    expect(page).toMatch(/!error \? \(\s*<p className="mt-2 flex h-5 items-center" aria-hidden="true">/);
  });

  test("a player's own card is reserved before the first paint, and only for somebody with a profile", () => {
    const layout = read('app/geo/layout.js');
    expect(layout).toMatch(/geo:profile:v1/);
    expect(layout).toMatch(/data-geo-profile/);
    const motion = read('app/geo/motion.css');
    expect(motion).toMatch(/\.pe-you-skeleton \{\s*display: none;/);
    expect(motion).toMatch(/:root\[data-geo-profile\] \.geo-surface \.pe-you-skeleton \{\s*display: block;/);
  });
});

describe('sign-in, while it checks who you are', () => {
  jest.mock('@/app/geo/lib/profile', () => ({ ensureProfile: jest.fn(), profileHeaders: () => ({}) }));
  const SignInCard = require('@/app/geo/components/SignInCard').default;

  test('it holds the form\'s shape, with nothing in it that can be typed into', () => {
    global.fetch = jest.fn((url) => (String(url).endsWith('/options')
      ? Promise.resolve({ ok: true, json: async () => ({ phone: false }) })
      : new Promise(() => {})));
    const { container } = render(<SignInCard requireName />);
    expect(screen.getByRole('status')).toHaveTextContent('Checking your account');
    // The email step's shape: its label, field, button and the line under it.
    expect(container.querySelectorAll('.pe-skeleton').length).toBeGreaterThanOrEqual(4);
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });
});

describe('the loading curtain over a round', () => {
  const LoadingSpot = require('@/app/geo/components/LoadingSpot').default;

  test('while it is leaving it fades, stops announcing itself, and lets touches through', () => {
    const { container } = render(<LoadingSpot roundNumber={1} appleAttempt={0} appleTotal={5} leaving />);
    const curtain = container.firstChild;
    expect(curtain).toHaveClass('pe-fade-out');
    expect(curtain).not.toHaveAttribute('role', 'status');
    expect(read('app/geo/motion.css')).toMatch(/\.pe-fade-out \{[^}]*pointer-events: none;/);
  });

  test('while it is working it says so', () => {
    render(<LoadingSpot roundNumber={2} appleAttempt={1} appleTotal={5} />);
    expect(screen.getByRole('status')).toHaveTextContent('Round 2');
  });
});
