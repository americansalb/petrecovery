/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import GameMenu from '@/app/geo/components/home/GameMenu';
import ScriptPlayClient from '@/app/geo/components/script/ScriptPlayClient';

let params;
const push = jest.fn();
jest.mock('next/navigation', () => ({ useSearchParams: () => params, useRouter: () => ({ push }) }));
jest.mock('next/dynamic', () => () => function Map({ onPin }) {
  return <button onClick={() => onPin({ lat: 35, lng: 135 })}>Place test pin</button>;
});
jest.mock('@/app/geo/lib/appleMapKit', () => ({ initializeMapKit: async () => { throw new Error('keyless'); }, mapKitAuth: () => 'failed', onMapKitAuth: jest.fn() }));
jest.mock('@/app/geo/lib/session', () => ({ isSignedIn: () => false }));
jest.mock('@/app/geo/lib/profile', () => ({ profileHeaders: () => ({}) }));
jest.mock('@/app/geo/lib/serverConfig', () => ({ loadGeoConfig: async () => ({ providers: { apple: { configured: true } } }) }));
jest.mock('@/app/geo/components/KeepThis', () => () => null);
jest.mock('@/app/geo/components/SaveGameButton', () => () => null);
jest.mock('@/app/geo/components/script/ScriptSample', () => function Sample({ text }) { return <p>{text}</p>; });

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  window.history.replaceState(null, '', '/geo/script/play?ladder=world&rounds=5');
  params = new URLSearchParams(window.location.search);
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => {
    if (url.endsWith('/round')) return { round: { token: 'test-token', text: 'Original sentence', script: 'Latn' } };
    if (url.endsWith('/guess')) return { result: { score: 1234, guess: { lat: 35, lng: 135 }, distanceKm: 100,
      answer: { name: 'Japanese', endonym: '日本語', regions: [] } } };
    return {};
  } }));
});

test('homepage Script play starts with a stable seed in the URL', async () => {
  await act(async () => render(<GameMenu />));
  fireEvent.click(screen.getByRole('button', { name: /Script Written languages/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Play Script', exact: true }));
  const url = new URL(push.mock.calls[0][0], 'http://localhost');
  expect(url.pathname).toBe('/geo/script/play');
  expect(url.searchParams.get('seed')).toBeTruthy();
});

test('an old seedless link is canonicalized before play and restores a scored round on refresh', async () => {
  let view;
  await act(async () => { view = render(<ScriptPlayClient />); });
  const canonical = new URL(window.location.href);
  expect(canonical.searchParams.get('seed')).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
  // Next's native-history integration updates useSearchParams in the browser.
  params = canonical.searchParams;
  await act(async () => view.rerender(<ScriptPlayClient />));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Place test pin' })));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lock in your guess' })));
  const saved = JSON.parse(localStorage.getItem('geo:saved-game:v2'));
  expect(saved.snapshot.history).toHaveLength(1);
  expect(saved.snapshot.config.seed).toBe(canonical.searchParams.get('seed'));
  view.unmount();
  await act(async () => { view = render(<ScriptPlayClient />); });
  expect(screen.getByText('1,234')).toBeInTheDocument();
  expect(screen.getByText('Original sentence')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next round' })).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/round'))).toHaveLength(1);
});
