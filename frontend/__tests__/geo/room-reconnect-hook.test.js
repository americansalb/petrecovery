/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useRoom } from '@/app/geo/lib/useRoom';
jest.mock('@/app/geo/lib/profile', () => ({ profileHeaders: () => ({}) }));
const state = { serverNow: Date.now(), room: { phase: 'guessing', code: 'ABC123' }, me: { id: 'p1', name: 'Player' }, players: [] };
const response = () => ({ ok: true, json: async () => ({ state }) });
beforeEach(() => { jest.useFakeTimers(); localStorage.clear(); global.fetch = jest.fn().mockImplementation(async () => response()); });
afterEach(() => jest.useRealTimers());
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
