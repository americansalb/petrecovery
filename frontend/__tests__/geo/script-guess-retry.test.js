/** @jest-environment jsdom */
/**
 * A guess that does not reach the server keeps the round. It used to
 * replace the sentence with "Failed to fetch" and a Back to Script
 * button, so one dropped packet on a phone ended the game.
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ScriptPlayClient from '@/app/geo/components/script/ScriptPlayClient';
import { OFFLINE_MESSAGE } from '@/app/geo/lib/networkError';

const params = new URLSearchParams('ladder=alphabets&rounds=3&seed=retry-test');
jest.mock('next/navigation', () => ({ useSearchParams: () => params }));
jest.mock('next/dynamic', () => () => function Map(props) {
  return <button onClick={() => props.onPin({ lat: 35, lng: 135 })}>Place test pin</button>;
});
jest.mock('@/app/geo/lib/appleMapKit', () => ({ initializeMapKit: async () => { throw new Error('keyless test'); }, mapKitAuth: () => 'failed', onMapKitAuth: jest.fn() }));
jest.mock('@/app/geo/lib/savedGame', () => ({ useSavedGame: () => ({ ready: true, saveError: '' }) }));
jest.mock('@/app/geo/components/KeepThis', () => () => null);
jest.mock('@/app/geo/components/SaveGameButton', () => () => null);

const answer = { name: 'Japanese', endonym: '日本語', scriptName: 'Japanese', regions: [{ name: 'Honshu', rings: [[[135, 35], [136, 35], [136, 36], [135, 35]]] }] };

test('a guess lost on the way keeps the round and the pin, and sends again', async () => {
  let guesses = 0;
  global.fetch = jest.fn(async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/round')) return { ok: true, json: async () => ({ round: { token: `token-${body.roundIndex}`, text: 'これは日本語です', script: 'Jpan' } }) };
    guesses += 1;
    if (guesses === 1) throw new TypeError('Failed to fetch');
    return { ok: true, json: async () => ({ result: { score: 5000, guess: body.guess, inRegion: true, answer } }) };
  });
  await act(async () => render(<ScriptPlayClient />));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Place test pin' })));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lock in your guess' })));
  expect(screen.getByRole('alert')).toHaveTextContent(OFFLINE_MESSAGE);
  expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  // The sentence is still there, and so is the pin: the button still locks it in.
  expect(screen.getByText('これは日本語です')).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lock in your guess' })));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Next round/ })).toBeInTheDocument();
});

test('a round that did not arrive can be asked for again', async () => {
  let rounds = 0;
  global.fetch = jest.fn(async (url, options) => {
    const body = JSON.parse(options.body);
    rounds += 1;
    if (rounds === 1) throw new TypeError('Load failed');
    return { ok: true, json: async () => ({ round: { token: `token-${body.roundIndex}`, text: 'これは日本語です', script: 'Jpan' } }) };
  });
  await act(async () => render(<ScriptPlayClient />));
  expect(screen.getByRole('alert')).toHaveTextContent(OFFLINE_MESSAGE);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Try again' })));
  expect(screen.getByText('これは日本語です')).toBeInTheDocument();
});
