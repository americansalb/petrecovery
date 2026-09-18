/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import ScriptPlayClient from '@/app/geo/components/script/ScriptPlayClient';
import { normalizeScriptConfig, scriptConfigToQuery } from '@/app/lib/geo/script';

let params;
jest.mock('next/navigation', () => ({ useSearchParams: () => params }));
jest.mock('next/dynamic', () => () => function Map() { return <div>Map</div>; });
jest.mock('@/app/geo/lib/appleMapKit', () => ({ initializeMapKit: async () => { throw new Error('keyless'); }, mapKitAuth: () => 'failed', onMapKitAuth: jest.fn() }));
jest.mock('@/app/geo/lib/session', () => ({ isSignedIn: () => false }));
jest.mock('@/app/geo/components/KeepThis', () => () => null);
jest.mock('@/app/geo/components/SaveGameButton', () => () => null);
jest.mock('@/app/geo/components/script/ScriptSample', () => function Sample({ text }) { return <p>{text}</p>; });

test('plain refresh restores the scored round; a fresh replay key starts over', async () => {
  params = new URLSearchParams('ladder=alphabets&rounds=3&seed=refresh-test');
  const config = normalizeScriptConfig(Object.fromEntries(params));
  const answer = { name: 'Japanese', endonym: '日本語', regions: [{ name: 'Japan', lat: 36, lng: 138, radiusKm: 300 }] };
  const result = { score: 1500, answer, guess: { lat: 30, lng: 130 }, distanceKm: 100 };
  const row = { ...result, text: 'Saved sentence', script: 'jpan' };
  const saved = { kind: 'script', url: `/geo/script/play?${scriptConfigToQuery(config)}&resume=1`, owner: null, snapshot: { config, roundIndex: 1, history: [row, row], result } };
  localStorage.setItem('geo:saved-game:v2', JSON.stringify(saved));
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ round: { token: 'new', text: 'New sentence', script: 'latn' } }) }));
  let view;
  await act(async () => { view = render(<ScriptPlayClient />); });
  expect(screen.getByText('Round 2 of 3')).toBeInTheDocument();
  expect(screen.getByText('3,000')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => { view = render(<ScriptPlayClient />); });
  expect(screen.getByText('Round 2 of 3')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  params = new URLSearchParams(params);
  params.set('replay', 'fresh-playthrough');
  await act(async () => view.rerender(<ScriptPlayClient />));
  expect(screen.getByText('Round 1 of 3')).toBeInTheDocument();
  expect(screen.getByText('New sentence')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ roundIndex: 0, config: { seed: 'refresh-test' } });
});
