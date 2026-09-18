/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ScriptPlayClient from '@/app/geo/components/script/ScriptPlayClient';

let params = new URLSearchParams('ladder=alphabets&rounds=3&timer=30&seed=replay-test');
jest.mock('next/navigation', () => ({ useSearchParams: () => params }));
jest.mock('next/dynamic', () => () => function Map({ onPin }) {
  return <button onClick={() => onPin({ lat: 35, lng: 135 })}>Place test pin</button>;
});
jest.mock('@/app/geo/lib/appleMapKit', () => ({ initializeMapKit: async () => { throw new Error('keyless test'); }, mapKitAuth: () => 'failed', onMapKitAuth: jest.fn() }));
jest.mock('@/app/geo/lib/savedGame', () => ({ useSavedGame: () => ({ ready: true, saveError: '' }) }));
jest.mock('@/app/geo/components/KeepThis', () => () => null);
jest.mock('@/app/geo/components/SaveGameButton', () => () => null);
jest.mock('@/app/geo/components/script/ScriptSample', () => function Sample({ text }) { return <p>{text}</p>; });
afterEach(() => jest.useRealTimers());

test('finishing then replaying the same set resets the component but preserves its seed and rules', async () => {
  jest.useFakeTimers();
  const requests = [];
  global.fetch = jest.fn(async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/round')) {
      requests.push(body);
      return { ok: true, json: async () => ({ round: { token: `token-${body.roundIndex}`, text: `Sentence ${body.roundIndex}`, script: 'Latn' } }) };
    }
    return { ok: true, json: async () => ({ result: { score: 1000, guess: body.guess, distanceKm: 100,
      answer: { name: 'Test language', endonym: 'Test', scriptName: 'Latin', branch: 'Test', family: 'Test', speakers: 1, regions: [] } } }) };
  });
  let view;
  await act(async () => { view = render(<ScriptPlayClient />); });
  for (let i = 0; i < 3; i++) {
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Place test pin' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lock in your guess' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: i === 2 ? 'See the results' : 'Next round' })));
  }
  expect(screen.getByRole('heading', { name: '3,000 points' })).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(31000); });
  expect(screen.getByRole('heading', { name: '3,000 points' })).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/guess'))).toHaveLength(3);
  const replay = new URL(screen.getByRole('link', { name: 'Replay this set' }).getAttribute('href'), 'http://localhost');
  expect(replay.searchParams.get('replay')).toBeTruthy();
  expect(replay.searchParams.get('seed')).toBe('replay-test');
  expect(replay.searchParams.get('rounds')).toBe('3');
  expect(replay.searchParams.get('timer')).toBe('30');
  params = replay.searchParams;
  await act(async () => view.rerender(<ScriptPlayClient />));
  expect(screen.getByText('Round 1 of 3')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '3,000 points' })).toBeNull();
  expect(requests.at(-1)).toEqual(requests[0]);
});
