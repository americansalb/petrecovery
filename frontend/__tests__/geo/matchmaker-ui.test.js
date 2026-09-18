/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import Matchmaker from '@/app/geo/components/rooms/Matchmaker';
import { saveIdentity } from '@/app/geo/lib/useRoom';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/app/geo/lib/profile', () => ({ ensureProfile: jest.fn(), profileHeaders: () => ({}) }));
jest.mock('@/app/geo/lib/useRoom', () => ({ saveIdentity: jest.fn(), saveName: jest.fn() }));
jest.mock('@/app/geo/components/AccountDialog', () => function Gate({ onAuthenticated }) {
  return <button onClick={onAuthenticated}>Finish signup</button>;
});
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });
const waiting = () => response({ status: 'waiting', game: 'script', joinedAt: Date.now() });
const props = () => ({ game: 'script', name: 'Player', onNameChange: jest.fn(), onGameChange: jest.fn(), onActiveChange: jest.fn() });
const click = async (name) => act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); sessionStorage.clear(); });
afterEach(() => { jest.useRealTimers(); });

test('signup continues the original matchmaking intent', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(response({}, 401)).mockImplementation(waiting);
  render(<Matchmaker {...props()} />);
  await click(/Find match/);
  await click('Finish signup');
  expect(screen.getByRole('button', { name: 'Cancel search' }).disabled).toBe(false);
  expect(fetch.mock.calls.map(([, options]) => JSON.parse(options.body).action)).toEqual(['join', 'join']);
});

test('search disables game switching and tells the room browser it is active', async () => {
  global.fetch = jest.fn().mockImplementationOnce(waiting).mockResolvedValueOnce(response({ status: 'cancelled' }));
  const callbacks = props();
  render(<Matchmaker {...callbacks} />);
  await click(/Find match/);
  expect(screen.getByRole('button', { name: 'Street', exact: true }).disabled).toBe(true);
  expect(callbacks.onActiveChange).toHaveBeenLastCalledWith(true);
  await click('Cancel search');
  expect(callbacks.onActiveChange).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole('button', { name: 'Street', exact: true }).disabled).toBe(false);
});

test('lost cancellation response polls the existing ticket without joining again', async () => {
  global.fetch = jest.fn().mockImplementationOnce(waiting)
    .mockRejectedValueOnce(new Error('Network interrupted'))
    .mockResolvedValueOnce(response({ status: 'idle' }));
  render(<Matchmaker {...props()} />);
  await click(/Find match/);
  await click('Cancel search');
  expect(screen.getByRole('alert').textContent).toContain('Network interrupted');
  await act(async () => { jest.advanceTimersByTime(4000); });
  expect(fetch.mock.calls.map(([, options]) => JSON.parse(options.body).action)).toEqual(['join', 'cancel', 'poll']);
  expect(screen.getByRole('button', { name: /Find match/ }).disabled).toBe(false);
});

test('a cancel that races a completed pairing opens the assigned match', async () => {
  global.fetch = jest.fn().mockImplementationOnce(waiting)
    .mockResolvedValueOnce(response({ status: 'matched', code: 'ABC123', token: 'seat-secret', playerId: 'p1' }));
  render(<Matchmaker {...props()} />);
  await click(/Find match/);
  await click('Cancel search');
  expect(saveIdentity).toHaveBeenCalledWith('ABC123', { token: 'seat-secret', playerId: 'p1', name: 'Player' });
  expect(push).toHaveBeenCalledWith('/geo/room/ABC123');
  expect(sessionStorage.getItem('geo:matchmaking:pending')).toBeNull();
});

test('a hanging queue request times out and recovers the existing ticket, not a second join', async () => {
  global.fetch = jest.fn().mockImplementationOnce((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  })).mockImplementation(waiting);
  render(<Matchmaker {...props()} />);
  await click(/Find match/);
  await act(async () => { jest.advanceTimersByTime(10000); });
  expect(screen.getByRole('alert').textContent).toContain('Reconnecting');
  expect(screen.getByRole('button', { name: 'Cancel search' }).disabled).toBe(false);
  await act(async () => { jest.advanceTimersByTime(4000); });
  expect(fetch.mock.calls.map(([, options]) => JSON.parse(options.body).action)).toEqual(['join', 'poll']);
  expect(screen.queryByRole('alert')).toBeNull();
});

test('a lost join response can recover the already assigned match', async () => {
  global.fetch = jest.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(response({ status: 'matched', code: 'ABC123', token: 'seat-secret', playerId: 'p1' }));
  render(<Matchmaker {...props()} />);
  await click(/Find match/);
  await act(async () => { jest.advanceTimersByTime(4000); });
  expect(push).toHaveBeenCalledWith('/geo/room/ABC123');
  expect(fetch.mock.calls.map(([, options]) => JSON.parse(options.body).action)).toEqual(['join', 'poll']);
});
