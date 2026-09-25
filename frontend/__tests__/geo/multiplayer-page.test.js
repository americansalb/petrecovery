/** @jest-environment jsdom */

/**
 * The multiplayer page, rebuilt (founder, 2026-09-23, on this screen:
 * "Extremely poorly designed, extremely confusing, extremely ugly").
 *
 * It had two identical Street/Script switches side by side - one on
 * Find an opponent, one on Create a room - an "(optional)" name field,
 * decorative compass badges, and an empty room list whose "No open
 * rooms" was the largest text on the page. Now: one switch for the
 * page, two clear choices (Quick match, Play with friends), a code box,
 * and a quiet list.
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RoomBrowser from '@/app/geo/components/rooms/RoomBrowser';

const router = { push: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('@/app/geo/lib/profile', () => ({ ensureProfile: jest.fn(async () => ({ name: '' })), profileHeaders: () => ({}) }));
jest.mock('@/app/geo/lib/useRoom', () => ({ listRecentRooms: () => [], loadName: () => '', saveName: jest.fn(), saveIdentity: jest.fn() }));
jest.mock('@/app/geo/lib/serverConfig', () => ({ loadGeoConfig: async () => ({ providers: { apple: { configured: true } }, countries: [] }), configErrorMessage: (error) => error.message }));
// A stand-in quick-match card that can say it is searching, the way the
// real one does through onActiveChange.
jest.mock('@/app/geo/components/rooms/Matchmaker', () => function MockMatchmaker({ game, onActiveChange }) {
  return <section data-testid="quick-match" data-game={game}><button type="button" onClick={() => onActiveChange(true)}>Search now</button></section>;
});
jest.mock('@/app/geo/components/AccountDialog', () => function Gate() { return <div role="dialog" />; });

const response = (body) => ({ ok: true, json: async () => body });

async function arrive(rooms = []) {
  jest.clearAllMocks();
  localStorage.clear();
  global.fetch = jest.fn(async (url) => response(url === '/api/geo/auth/me' ? { signedIn: true } : { rooms }));
  await act(async () => render(<RoomBrowser />));
}

test('one Street/Script switch for the whole page, and it chooses for both ways to play', async () => {
  await arrive();
  expect(screen.getAllByRole('button', { name: 'Street', exact: true })).toHaveLength(1);
  // Script is the game the page opens on (founder, 2026-09-25).
  expect(screen.getByRole('button', { name: 'Script', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByTestId('quick-match')).toHaveAttribute('data-game', 'script');
  fireEvent.click(screen.getByRole('button', { name: 'Street', exact: true }));
  expect(screen.getByRole('button', { name: 'Street', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByTestId('quick-match')).toHaveAttribute('data-game', 'street');
});

test('the switch is locked while a quick-match search is running', async () => {
  await arrive();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Search now' })));
  expect(screen.getByRole('button', { name: 'Street', exact: true })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Script', exact: true })).toBeDisabled();
});

test('two named ways to play, and a box for a code somebody sent you', async () => {
  await arrive();
  expect(screen.getByRole('heading', { name: 'Play with friends' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Create room', exact: true })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Room code' })).toBeInTheDocument();
});

test('no open rooms is one quiet line, not the biggest thing on the page', async () => {
  await arrive([]);
  const empty = screen.getByText(/No open rooms right now/);
  expect(empty.tagName).toBe('P');
  expect(screen.queryByRole('heading', { name: /No open rooms/ })).toBeNull();
});

test('an open room is listed with a way in', async () => {
  await arrive([{ code: 'ABC123', name: "Kevin's room", variant: 'duel', players: 1, maxPlayers: 8, status: 'lobby' }]);
  expect(screen.getByText("Kevin's room")).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '/geo/room/ABC123');
});
