/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import RoomClient from '@/app/geo/components/RoomClient';

const action = jest.fn(async () => ({}));
let guessed = false;
const me = { id: 'p1', name: 'Player', you: true, hp: 6000 };
const state = () => ({
  room: { code: 'ABC123', phase: 'guessing', status: 'playing', config: { game: 'script', time: 60 }, roundIndex: 0, roundsTotal: 5 },
  me, players: [{ ...me, guessed }, { id: 'p2', name: 'Peer', hp: 6000 }],
  round: { index: 0, text: 'A shared language clue.', script: 'latn', deadline: Date.now() + 60000 },
});
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock('next/dynamic', () => () => function TestMap({ onPin }) {
  return <div role="group" aria-label="Test geographic map"><button disabled={!onPin} onClick={() => onPin({ lat: 10, lng: 20 })}>Place test pin</button></div>;
});
jest.mock('@/app/geo/lib/useRoom', () => ({ useRoom: () => ({ state: state(), error: null, identity: { playerId: 'p1' }, ready: true, refresh: jest.fn(), act: action, join: jest.fn(), serverNow: () => Date.now() }), useNow: jest.fn(), loadName: () => 'Player', saveIdentity: jest.fn() }));
jest.mock('@/app/geo/lib/profile', () => ({ ensureProfile: async () => ({ name: 'Player' }) }));
jest.mock('@/app/geo/lib/serverConfig', () => ({ loadGeoConfig: async () => ({ providers: {} }), configErrorMessage: (e) => e.message }));
jest.mock('@/app/geo/components/script/ScriptSample', () => function Clue({ text }) { return <p>{text}</p>; });
jest.mock('@/app/geo/components/rooms/MatchHud', () => function Hud() { return <div>Match HUD</div>; });
jest.mock('@/app/geo/components/rooms/RoomPanels', () => ({ ReactionsBar: () => null, ReactionToasts: () => null }));
beforeEach(() => { guessed = false; action.mockClear(); global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ signedIn: true }) })); });

test('Script keeps clue and geographic map together, with no mobile drawer step', async () => {
  await act(async () => render(<RoomClient code="ABC123" />));
  expect(screen.getByText('A shared language clue.')).toBeTruthy();
  const map = screen.getByRole('group', { name: 'Test geographic map' }).closest('.geo-map-frame');
  expect(map.className).toContain('pe-room-script-map');
  expect(map.className).not.toMatch(/invisible|9999|pointer-events-none/);
  expect(screen.queryByRole('button', { name: 'Map', exact: true })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Place test pin' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lock in guess' })));
  expect(action).toHaveBeenCalledWith('guess', { lat: 10, lng: 20 });
});

test('locking a Script guess keeps the map visible but prevents another pin', async () => {
  guessed = true;
  await act(async () => render(<RoomClient code="ABC123" />));
  expect(screen.getByRole('button', { name: 'Place test pin' }).disabled).toBe(true);
  expect(screen.getByRole('status').textContent).toContain('Guess locked in');
  expect(screen.getByRole('group', { name: 'Test geographic map' }).closest('.geo-map-frame').className).not.toContain('invisible');
});
