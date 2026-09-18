/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ScriptDetectiveClient from '@/app/geo/components/script/ScriptDetectiveClient';

jest.mock('next/dynamic', () => () => function Map({ onPin }) {
  return onPin ? <button onClick={() => onPin({ lat: 35, lng: 135 })}>Place test pin</button> : <div>Answer map</div>;
});
jest.mock('@/app/geo/lib/savedGame', () => ({ useSavedGame: () => ({ ready: true, saveError: '' }) }));
jest.mock('@/app/geo/components/KeepThis', () => () => null);
jest.mock('@/app/geo/components/SaveGameButton', () => () => null);
jest.mock('@/app/geo/components/script/ScriptSample', () => function Sample({ text }) { return <p>{text}</p>; });

beforeEach(() => {
  global.fetch = jest.fn(async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/round')) return { ok: true, json: async () => ({ round: {
      token: `token-${body.roundIndex}`, text: `Sentence ${body.roundIndex}`, script: 'latn',
      choices: [{ id: '1', name: 'French' }, { id: '2', name: 'Spanish' }, { id: '3', name: 'Italian' }, { id: '4', name: 'Portuguese' }],
    } }) };
    const correct = body.guess.choice === '1';
    return { ok: true, json: async () => ({ result: {
      score: (correct ? 4000 : 0) + (body.guess.pin ? 1000 : 0), languagePoints: correct ? 4000 : 0, mapPoints: body.guess.pin ? 1000 : 0,
      guess: body.guess.pin, choice: body.guess.choice ? { name: correct ? 'French' : 'Spanish', correct } : null,
      answer: { name: 'French', endonym: 'Français', regions: [{ name: 'France' }], markers: [{ text: 'eau', note: 'This spelling is a clue.' }] },
    } }) };
  });
});
afterEach(() => jest.useRealTimers());
const mount = async (timer = 0) => {
  const params = new URLSearchParams(`experience=detective&rounds=3&seed=ui-test&timer=${timer}`);
  await act(async () => render(<ScriptDetectiveClient params={params} />));
};

test('complete three choices with optional map bonus, reveal one clue, and generate working replay links', async () => {
  await mount();
  expect(screen.getByRole('button', { name: 'Check answer' })).toBeDisabled();
  for (let index = 0; index < 3; index++) {
    fireEvent.click(screen.getByRole('button', { name: index === 1 ? '2 Spanish' : '1 French' }));
    if (index === 0) {
      fireEvent.click(screen.getByRole('button', { name: /Add a map pin/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Place test pin' }));
      fireEvent.click(screen.getByRole('button', { name: 'Keep pin' }));
    }
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Check answer' })));
    expect(screen.getByText('This spelling is a clue.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'French Français' })).toHaveFocus();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: index === 2 ? 'Results' : 'Next round' })));
  }
  expect(screen.getByRole('heading', { name: '2 of 3 languages' })).toBeInTheDocument();
  expect(screen.getByText('9,000 points')).toBeInTheDocument();
  const replay = new URL(screen.getByRole('link', { name: 'Replay this set' }).href);
  expect(replay.searchParams.get('experience')).toBe('detective');
  expect(replay.searchParams.get('seed')).toBe('ui-test');
  expect(replay.searchParams.get('replay')).toBeTruthy();
  const guesses = fetch.mock.calls.filter(([url]) => url.endsWith('/guess')).map(([, options]) => JSON.parse(options.body).guess);
  expect(guesses).toEqual([{ choice: '1', pin: { lat: 35, lng: 135 } }, { choice: '2', pin: null }, { choice: '1', pin: null }]);
});

test('keyboard shortcuts do not steal native button activation', async () => {
  await mount();
  fireEvent.keyDown(window, { key: '2' });
  expect(screen.getByRole('button', { name: '2 Spanish' })).toHaveAttribute('aria-pressed', 'true');
  const first = screen.getByRole('button', { name: '1 French' });
  fireEvent.keyDown(first, { key: 'Enter' });
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/guess'))).toHaveLength(0);
  await act(async () => fireEvent.keyDown(window, { key: 'Enter' }));
  expect(screen.getByText('You chose Spanish')).toBeInTheDocument();
});

test('timer skips unanswered rounds once and never appends duplicate results after completion', async () => {
  jest.useFakeTimers();
  await mount(30);
  for (let index = 0; index < 3; index++) {
    await act(async () => jest.advanceTimersByTime(31000));
    expect(screen.getByText('Time’s up')).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: index === 2 ? 'Results' : 'Next round' })));
  }
  await act(async () => jest.advanceTimersByTime(61000));
  expect(screen.getByRole('heading', { name: '0 of 3 languages' })).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/guess'))).toHaveLength(3);
});

test('failed guess retains selection for retry and double-click cannot score twice', async () => {
  await mount();
  const original = fetch.getMockImplementation();
  let fails = true;
  fetch.mockImplementation(async (url, options) => {
    if (url.endsWith('/guess') && fails) { fails = false; return { ok: false, json: async () => ({ error: 'Connection lost' }) }; }
    return original(url, options);
  });
  fireEvent.click(screen.getByRole('button', { name: '1 French' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Check answer' })));
  expect(screen.getByRole('alert')).toHaveTextContent('Connection lost');
  await act(async () => {
    const retry = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(retry); fireEvent.click(retry);
  });
  expect(screen.getByText('+4,000')).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/guess'))).toHaveLength(2);
});
