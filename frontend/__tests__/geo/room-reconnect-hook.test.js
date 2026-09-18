/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { loadIdentity, useRoom } from '@/app/geo/lib/useRoom';
jest.mock('@/app/geo/lib/profile', () => ({ profileHeaders: () => ({}) }));
const state = { serverNow: Date.now(), room: { phase: 'guessing', code: 'ABC123' }, me: { id: 'p1', name: 'Player' }, players: [] };
const response = () => ({ ok: true, json: async () => ({ state }) });
beforeEach(() => { jest.useFakeTimers(); localStorage.clear(); global.fetch = jest.fn().mockImplementation(async () => response()); });
afterEach(() => jest.useRealTimers());
test('a fresh browser adopts the server-verified seat and uses it on the next action', async () => {
  const identity = { token: 'recovered-seat', playerId: 'p1', name: 'Player' };
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ state, identity }) });
  let hook;
  await act(async () => { hook = renderHook(() => useRoom('ABC123')); });
  expect(hook.result.current.identity).toMatchObject(identity);
  expect(loadIdentity('ABC123')).toMatchObject(identity);
  await act(async () => { await hook.result.current.act('guess', { lat: 1, lng: 2 }); });
  expect(fetch.mock.calls.at(-1)[1].headers['x-geo-player']).toBe('recovered-seat');
  hook.unmount();
});
test('a spectator response cannot create a cached identity', async () => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ state: { ...state, me: null }, identity: null }) });
  let hook;
  await act(async () => { hook = renderHook(() => useRoom('ABC123')); });
  expect(hook.result.current.identity).toBeNull();
  expect(loadIdentity('ABC123')).toBeNull();
  hook.unmount();
});
test('a failed heartbeat shows reconnecting without discarding the game, then clears on recovery', async () => {
  let hook;
  await act(async () => { hook = renderHook(() => useRoom('ABC123')); });
  expect(hook.result.current.state.me.id).toBe('p1');
  fetch.mockRejectedValueOnce(new Error('network failed'));
  await act(async () => { jest.advanceTimersByTime(1500); });
  expect(hook.result.current.error.code).toBe('connection');
  expect(hook.result.current.state.me.id).toBe('p1');
  await act(async () => { jest.advanceTimersByTime(1500); });
  expect(hook.result.current.error).toBeNull();
  hook.unmount();
});
test('offline is announced immediately and online triggers a refresh', async () => {
  let hook;
  await act(async () => { hook = renderHook(() => useRoom('ABC123')); });
  act(() => window.dispatchEvent(new Event('offline')));
  expect(hook.result.current.error.message).toContain('offline');
  const before = fetch.mock.calls.length;
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(fetch).toHaveBeenCalledTimes(before + 1);
  expect(hook.result.current.error).toBeNull();
  hook.unmount();
  window.dispatchEvent(new Event('online'));
  expect(fetch).toHaveBeenCalledTimes(before + 1);
});

test('a late heartbeat cannot roll back a completed guess', async () => {
  let hook, resolvePoll;
  await act(async () => { hook = renderHook(() => useRoom('ABC123')); });
  fetch.mockImplementationOnce(() => new Promise((resolve) => { resolvePoll = resolve; }));
  act(() => { hook.result.current.refresh(); });
  const guessed = { ...state, me: { ...state.me, guessed: true } };
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ state: guessed }) });
  await act(async () => { await hook.result.current.act('guess', { lat: 1, lng: 2 }); });
  expect(hook.result.current.state.me.guessed).toBe(true);
  await act(async () => { resolvePoll(response()); });
  expect(hook.result.current.state.me.guessed).toBe(true);
  hook.unmount();
});

test('a hanging heartbeat is aborted, announces reconnecting, and polling continues', async () => {
  let hook;
  await act(async () => { hook = renderHook(() => useRoom('ABC123')); });
  fetch.mockImplementationOnce((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  await act(async () => { jest.advanceTimersByTime(1500); });
  await act(async () => { jest.advanceTimersByTime(10000); });
  expect(hook.result.current.error.code).toBe('connection');
  expect(hook.result.current.state.me.id).toBe('p1');
  await act(async () => { jest.advanceTimersByTime(1500); });
  expect(hook.result.current.error).toBeNull();
  hook.unmount();
});
