/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RoomBrowser from '@/app/geo/components/rooms/RoomBrowser';
const push = jest.fn();
const router = { push };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('@/app/geo/lib/profile', () => ({ ensureProfile: jest.fn(async () => ({ name: 'Ada' })), profileHeaders: () => ({}) }));
jest.mock('@/app/geo/lib/useRoom', () => ({ listRecentRooms: () => [], loadName: () => 'Ada', saveName: jest.fn(), saveIdentity: jest.fn() }));
jest.mock('@/app/geo/lib/serverConfig', () => ({ loadGeoConfig: async () => ({ providers: { apple: { configured: true } }, countries: [] }), configErrorMessage: (error) => error.message }));
jest.mock('@/app/geo/components/rooms/Matchmaker', () => function MockMatchmaker() { return null; });
jest.mock('@/app/geo/components/AccountDialog', () => function Gate({ onAuthenticated, onClose, returnTo }) {
  return <div role="dialog"><a href={returnTo}>Return destination</a><button onClick={onAuthenticated}>Finish signup</button><button onClick={onClose}>Cancel signup</button></div>;
});
const requestId = 'room-creation-qa-12345';
const response = (body, ok = true) => ({ ok, json: async () => body });
const creates = () => fetch.mock.calls.filter(([url, options]) => url === '/api/geo/rooms' && options?.method === 'POST');
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => requestId });
  global.fetch = jest.fn(async (url, options) => response(url === '/api/geo/auth/me' ? { signedIn: false } : options?.method === 'POST' ? { code: 'ABC123', token: 'seat', playerId: 'p1' } : { rooms: [] }));
});
const click = async (name) => act(async () => fireEvent.click(screen.getByRole('button', { name, exact: true })));

test('signup resumes Create exactly once and does not use an unrelated typed join code', async () => {
  await act(async () => render(<RoomBrowser initialGame="script" />));
  fireEvent.change(screen.getByRole('textbox', { name: 'Room code' }), { target: { value: 'XYZ789' } });
  await click('Create room');
  expect(screen.getByRole('link', { name: 'Return destination' })).toHaveAttribute('href', `/geo/rooms?game=script&resumeRoom=${requestId}`);
  expect(creates()).toHaveLength(0);
  await click('Finish signup');
  expect(creates()).toHaveLength(1);
  expect(JSON.parse(creates()[0][1].body)).toMatchObject({ requestId, hostName: 'Ada', settings: { game: 'script', variant: 'duel' } });
  expect(push).toHaveBeenCalledWith('/geo/room/ABC123');
  expect(localStorage.getItem('geo:pending-room:v1')).toBeNull();
});

test('first email-return tab resumes the retained room rules and retry key', async () => {
  localStorage.setItem('geo:pending-room:v1', JSON.stringify({ name: 'Ada', form: { game: 'script', rounds: 3, visibility: 'private' }, action: 'create', requestId, savedAt: Date.now() }));
  fetch.mockImplementation(async (url, options) => response(url === '/api/geo/auth/me' ? { signedIn: true } : options?.method === 'POST' ? { code: 'ABC123', token: 'seat', playerId: 'p1' } : { rooms: [] }));
  await act(async () => render(<RoomBrowser initialGame="script" resumeRequest={requestId} />));
  expect(creates()).toHaveLength(1);
  expect(JSON.parse(creates()[0][1].body)).toMatchObject({ requestId, settings: { rounds: 3, visibility: 'private' } });
  expect(push).toHaveBeenCalledWith('/geo/room/ABC123');
});

test('a return tab arriving after creation opens the receipt instead of creating again', async () => {
  localStorage.setItem('geo:created-room:v1', JSON.stringify({ requestId, code: 'ABC123', at: Date.now() }));
  await act(async () => render(<RoomBrowser initialGame="script" resumeRequest={requestId} />));
  expect(creates()).toHaveLength(0);
  expect(push).toHaveBeenCalledWith('/geo/room/ABC123');
});

test('closing signup cancels the action without losing the room settings', async () => {
  await act(async () => render(<RoomBrowser initialGame="script" />));
  await click('Create room');
  await click('Cancel signup');
  const draft = JSON.parse(localStorage.getItem('geo:pending-room:v1'));
  expect(draft.action).toBeUndefined();
  expect(draft.form.game).toBe('script');
  expect(creates()).toHaveLength(0);
});
