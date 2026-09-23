/** @jest-environment jsdom */

/**
 * Opening a room is one hurdle, not two.
 *
 * The Create room button was dead until the host typed a player name -
 * and then the click asked them to sign in anyway, so a guest who only
 * wanted to send a friend a link met two gates where the code needs
 * one, the first of them silent, because a disabled button explains
 * nothing.
 *
 * This is the same defect the sign-in card had, in a second place:
 * founder, 2026-09-19, "we dont let them... WE don't make it easy", and
 * 2026-09-22, "the person that made it does not know the purpose of the
 * app but only each individual feature".
 *
 * So the name is optional here too. Signing in fills it from the
 * account, anybody who types one keeps it, and anybody who does not is
 * a Player until they choose one on the profile page.
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RoomBrowser from '@/app/geo/components/rooms/RoomBrowser';
import { DEFAULT_PLAYER_NAME } from '@/app/lib/geo/rooms';

const router = { push: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('@/app/geo/lib/profile', () => ({ ensureProfile: jest.fn(async () => ({ name: '' })), profileHeaders: () => ({}) }));
const { ensureProfile } = require('@/app/geo/lib/profile');
// A browser that has never been given a name, which is every browser
// the first time somebody opens the page.
jest.mock('@/app/geo/lib/useRoom', () => ({ listRecentRooms: () => [], loadName: () => '', saveName: jest.fn(), saveIdentity: jest.fn() }));
jest.mock('@/app/geo/lib/serverConfig', () => ({ loadGeoConfig: async () => ({ providers: { apple: { configured: true } }, countries: [] }), configErrorMessage: (error) => error.message }));
jest.mock('@/app/geo/components/rooms/Matchmaker', () => function MockMatchmaker() { return null; });
jest.mock('@/app/geo/components/AccountDialog', () => function Gate({ onAuthenticated }) {
  return <div role="dialog"><button onClick={onAuthenticated}>Finish signup</button></div>;
});

const response = (body, ok = true) => ({ ok, json: async () => body });
const creates = () => fetch.mock.calls.filter(([url, options]) => url === '/api/geo/rooms' && options?.method === 'POST');

function arrive({ signedIn }) {
  jest.clearAllMocks();
  localStorage.clear();
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => 'open-a-room-test' });
  global.fetch = jest.fn(async (url, options) =>
    response(
      url === '/api/geo/auth/me'
        ? { signedIn }
        : options?.method === 'POST'
          ? { code: 'ABC123', token: 'seat', playerId: 'p1' }
          : { rooms: [] },
    ),
  );
}

const click = async (name) => act(async () => fireEvent.click(screen.getByRole('button', { name, exact: true })));

test('the button is live before anybody has typed a name', async () => {
  arrive({ signedIn: true });
  await act(async () => render(<RoomBrowser />));
  expect(screen.getByRole('button', { name: 'Create room', exact: true })).toBeEnabled();
});

test('a host who types nothing still gets a room, under the default name', async () => {
  arrive({ signedIn: true });
  await act(async () => render(<RoomBrowser />));
  await click('Create room');
  expect(creates()).toHaveLength(1);
  expect(JSON.parse(creates()[0][1].body).hostName).toBe(DEFAULT_PLAYER_NAME);
  // It used to refuse here instead.
  expect(screen.queryByText(/Type your name first/)).toBeNull();
  expect(router.push).toHaveBeenCalledWith('/geo/room/ABC123');
});

test("a signed-in host plays under their account's name, with nothing to type", async () => {
  arrive({ signedIn: true });
  ensureProfile.mockResolvedValueOnce({ name: 'Kevin' });
  await act(async () => render(<RoomBrowser />));
  await click('Create room');
  expect(JSON.parse(creates()[0][1].body).hostName).toBe('Kevin');
});

test('a guest meets the account gate, and only that', async () => {
  arrive({ signedIn: false });
  await act(async () => render(<RoomBrowser />));
  await click('Create room');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(creates()).toHaveLength(0);
  await click('Finish signup');
  expect(creates()).toHaveLength(1);
  expect(JSON.parse(creates()[0][1].body).hostName).toBe(DEFAULT_PLAYER_NAME);
});

test('there is no name field here at all: a name is asked once, when somebody signs in', async () => {
  // It was an "(optional)" field beside Create room, on the page the
  // founder called "extremely confusing" (2026-09-23). The name is the
  // account's, asked for once in sign-in (returning-player.test.js).
  arrive({ signedIn: true });
  await act(async () => render(<RoomBrowser />));
  expect(screen.queryByLabelText(/player name/i)).toBeNull();
});
