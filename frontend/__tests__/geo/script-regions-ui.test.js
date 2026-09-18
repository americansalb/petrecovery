/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ScriptPlayClient from '@/app/geo/components/script/ScriptPlayClient';

const params = new URLSearchParams('experience=detective&ladder=alphabets&rounds=3&seed=regions-test');
let mockMapProps;
jest.mock('next/navigation', () => ({ useSearchParams: () => params }));
jest.mock('next/dynamic', () => () => function Map(props) {
  mockMapProps = props;
  return <button onClick={() => props.onPin({ lat: 35, lng: 135 })}>Place test pin</button>;
});
jest.mock('@/app/geo/lib/appleMapKit', () => ({ initializeMapKit: async () => { throw new Error('keyless test'); }, mapKitAuth: () => 'failed', onMapKitAuth: jest.fn() }));
jest.mock('@/app/geo/lib/savedGame', () => ({ useSavedGame: () => ({ ready: true, saveError: '' }) }));
jest.mock('@/app/geo/components/KeepThis', () => () => null);
jest.mock('@/app/geo/components/SaveGameButton', () => () => null);

test('even old prototype links use pin gameplay, reveal all regions and focus without starting a new page', async () => {
  global.fetch = jest.fn(async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/round')) return { ok: true, json: async () => ({ round: { token: `token-${body.roundIndex}`, text: 'これは日本語です', script: 'Jpan' } }) };
    return { ok: true, json: async () => ({ result: { score: 5000, guess: body.guess, inRegion: true,
      answer: { name: 'Japanese', endonym: '日本語', scriptName: 'Japanese', regions: [
        { name: 'Honshu', rings: [[[135, 35], [136, 35], [136, 36], [135, 35]]] },
        { name: 'Hokkaido', lat: 43, lng: 142, radiusKm: 200 },
      ] } } }) };
  });
  await act(async () => render(<ScriptPlayClient />));
  expect(screen.getByText('Tap the map where that language is used')).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Place test pin' })));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lock in your guess' })));
  expect(mockMapProps.answer.regions).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Hokkaido' }));
  expect(mockMapProps.selectedRegion).toBe(1);
  expect(screen.getByRole('button', { name: 'Hokkaido' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'All regions' }));
  expect(mockMapProps.selectedRegion).toBeNull();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Next round' })));
  expect(screen.getByText('Round 2 of 3')).toBeInTheDocument();
  expect(mockMapProps.mode).toBe('guess');
  expect(mockMapProps.answer).toBeNull();
  expect(mockMapProps.selectedRegion).toBeNull();
  expect(fetch.mock.calls.some(([url]) => url.includes('detective'))).toBe(false);
});
