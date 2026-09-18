/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RoomClient from '@/app/geo/components/RoomClient';
import { ensureProfile } from '@/app/geo/lib/profile';
const join = jest.fn(async () => ({}));
let preset = '';
let identity = null;
const state = { room: { code: 'ABC123', name: 'Test', status: 'lobby', phase: 'lobby', config: { game: 'script' } }, players: [], me: null };
jest.mock('next/navigation', () => ({ useSearchParams: () => ({ get: () => preset }) }));
jest.mock('next/dynamic', () => () => function Empty() { return null; });
jest.mock('@/app/geo/lib/useRoom', () => ({ useRoom: () => ({ state, error: null, identity, ready: true, refresh: jest.fn(), act: jest.fn(), join, serverNow: () => Date.now() }), useNow: jest.fn(), loadName: () => 'Old browser name', saveIdentity: jest.fn() }));
jest.mock('@/app/geo/lib/profile', () => ({ ensureProfile: jest.fn(async () => ({ name: 'Account name' })) }));
jest.mock('@/app/geo/lib/serverConfig', () => ({ loadGeoConfig: async () => ({ countries: [], providers: { apple: { configured: true } } }), configErrorMessage: (e) => e.message }));
jest.mock('@/app/geo/components/AccountDialog', () => function Gate({ onAuthenticated, onClose }) {
  return <div role="dialog"><button onClick={onAuthenticated}>Finish signup</button><button onClick={onClose}>Cancel signup</button></div>;
});
jest.mock('@/app/geo/components/rooms/RoomPanels', () => ({
  JoinPanel: ({ defaultName, onJoin }) => <div><span data-testid="default-name">{defaultName}</span><button onClick={() => onJoin('Guest name')}>Join room</button></div>,
  ReactionToasts: () => null,
}));
beforeEach(() => { jest.clearAllMocks(); preset = ''; identity = null; global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ signedIn: false }) })); });
test('finishing signup continues the pending join with the verified account name', async () => {
  await act(async () => render(<RoomClient code="ABC123" />));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Join room' })));
  expect(join).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Finish signup' })));
  expect(join).toHaveBeenCalledTimes(1);
  expect(join).toHaveBeenCalledWith('Account name');
  expect(ensureProfile).toHaveBeenCalledWith('');
});
test('a fresh browser prefills the account name without requiring local storage', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ signedIn: true }) });
  await act(async () => render(<RoomClient code="ABC123" />));
  expect(screen.getByTestId('default-name')).toHaveTextContent('Account name');
  expect(join).not.toHaveBeenCalled();
});
test('a rematch query cannot rename the signed-in profile', async () => {
  preset = 'Untrusted link name';
  fetch.mockResolvedValue({ ok: true, json: async () => ({ signedIn: true }) });
  await act(async () => render(<RoomClient code="ABC123" />));
  expect(join).toHaveBeenCalledWith('Account name');
  expect(ensureProfile.mock.calls.every(([name]) => name === '')).toBe(true);
});
test('a previous account token does not block automatic join after signup', async () => {
  identity = { token: 'previous-account-token', playerId: 'previous-player' };
  preset = 'New signup name';
  fetch.mockResolvedValue({ ok: true, json: async () => ({ signedIn: true }) });
  await act(async () => render(<RoomClient code="ABC123" />));
  expect(join).toHaveBeenCalledTimes(1);
  expect(join).toHaveBeenCalledWith('Account name');
});
