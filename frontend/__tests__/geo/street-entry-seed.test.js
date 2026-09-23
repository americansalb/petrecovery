/** @jest-environment jsdom */
/**
 * Play Street opened the last game's results.
 *
 * The front page, /play and each mode's own row start Street with no
 * seed, so every game played the same way had the same saved-game
 * address, and a finished one matched it and was restored. Seen on the
 * live site: after one game, Play Street showed "1,785 of 25,000" again,
 * and Choose another game then Play Street came back to the same page.
 * A seedless link now gets a game of its own before anything mounts,
 * as Script's links already did (script-entry-seed.test.js).
 */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import PlayClient from '@/app/geo/components/PlayClient';
import { configFromParams } from '@/app/lib/geo/modes';

let params;
jest.mock('next/navigation', () => ({ useSearchParams: () => params, useRouter: () => ({ push: jest.fn() }) }));

beforeEach(() => {
  global.fetch = jest.fn(() => new Promise(() => {}));
});

test.each([
  ['the front page', '/geo/play?provider=apple&mode=balanced&rounds=5&time=0&move=1&pan=1&zoom=1&radius=standard'],
  ['a short link', '/geo/play'],
  ['a mode row', '/geo/play?mode=continent&region=europe'],
])('%s gets a seed of its own before the game starts', async (_, link) => {
  window.history.replaceState(null, '', link);
  params = new URLSearchParams(window.location.search);
  await act(async () => { render(<PlayClient />); });
  const seed = new URL(window.location.href).searchParams.get('seed');
  expect(seed).toBeTruthy();
  // Nothing was asked of the server under the old, shared address.
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Opening game');
});

test('two seedless starts are two games', async () => {
  const seeds = [];
  for (let i = 0; i < 2; i += 1) {
    window.history.replaceState(null, '', '/geo/play');
    params = new URLSearchParams(window.location.search);
    let view;
    await act(async () => { view = render(<PlayClient />); });
    seeds.push(new URL(window.location.href).searchParams.get('seed'));
    view.unmount();
  }
  expect(seeds[0]).not.toBe(seeds[1]);
});

test("a challenge keeps the calendar's seed, so today's daily still reopens as today's daily", () => {
  expect(configFromParams(new URLSearchParams('mode=daily')).seed).toMatch(/^daily-/);
  expect(configFromParams(new URLSearchParams('mode=ranked')).seed).toMatch(/^ranked-/);
  expect(configFromParams(new URLSearchParams('mode=cup')).seed).toMatch(/^cup-/);
});
