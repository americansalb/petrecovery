/** @jest-environment jsdom */
const { renderHook, waitFor, act } = require('@testing-library/react');
const { useSavedGame } = require('@/app/geo/lib/savedGame');
const { isSignedIn } = require('@/app/geo/lib/session');
jest.mock('@/app/geo/lib/session', () => ({ isSignedIn: jest.fn(() => true) }));
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });
const config = { kind: 'script', url: '/geo/script/play?seed=test&resume=1', snapshot: { history: [{ score: 100 }] }, enabled: true, resume: false, restore: jest.fn() };
beforeEach(() => { localStorage.clear(); isSignedIn.mockReturnValue(true); });

test('restores the newer cloud save instead of stale local progress', async () => {
  const cloud = { ...config, snapshot: { history: [{ score: 900 }] } };
  localStorage.setItem('geo:saved-game:v2', JSON.stringify({ ...config, owner: 'A', baseRevision: 0, pending: true }));
  global.fetch = jest.fn(async () => response({ accountId: 'A', revision: 2, savedGame: cloud }));
  const restore = jest.fn();
  renderHook(() => useSavedGame({ ...config, enabled: false, resume: true, restore }));
  await waitFor(() => expect(restore).toHaveBeenCalledWith(cloud.snapshot));
});

test('focus does not repeatedly resave unchanged progress', async () => {
  global.fetch = jest.fn(async (_, options) => options?.method === 'POST' ? response({ revision: 1, savedGame: config }) : response({ accountId: 'A', revision: 0 }));
  renderHook(() => useSavedGame(config));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('a changed account cannot inherit the currently open game', async () => {
  let accountId = 'A';
  global.fetch = jest.fn(async (_, options) => options?.method === 'POST' ? response({ revision: 1, savedGame: config }) : response({ accountId, revision: 0 }));
  const { result } = renderHook(() => useSavedGame(config));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  accountId = 'B';
  await act(async () => { window.dispatchEvent(new Event('geo:session-changed')); });
  await waitFor(() => expect(result.current.saveError).toMatch(/account changed/));
  const writes = fetch.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0][1].body).accountId).toBe('A');
});

test('guest progress is saved locally and syncs after contextual signup', async () => {
  isSignedIn.mockReturnValue(false);
  global.fetch = jest.fn(async (_, options) => options?.method === 'POST' ? response({ revision: 1, savedGame: config }) : response({ accountId: 'A', revision: 0 }));
  renderHook(() => useSavedGame(config));
  await waitFor(() => expect(JSON.parse(localStorage.getItem('geo:saved-game:v2')).owner).toBeNull());
  expect(fetch).not.toHaveBeenCalled();
  isSignedIn.mockReturnValue(true);
  await act(async () => { window.dispatchEvent(new Event('geo:authenticated')); });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  const write = JSON.parse(fetch.mock.calls[1][1].body);
  expect(write.snapshot).toEqual(config.snapshot);
  expect(write.accountId).toBe('A');
});

test('signup return re-reads when the original tab acknowledged a save during the GET', async () => {
  const saved = { ...config, owner: 'A', baseRevision: 1, pending: false };
  localStorage.setItem('geo:saved-game:v2', JSON.stringify(saved));
  global.fetch = jest.fn().mockResolvedValueOnce(response({ accountId: 'A', revision: 0, savedGame: null }))
    .mockResolvedValueOnce(response({ accountId: 'A', revision: 1, savedGame: saved }));
  const restore = jest.fn();
  renderHook(() => useSavedGame({ ...config, enabled: false, resume: true, restore }));
  await waitFor(() => expect(restore).toHaveBeenCalledWith(config.snapshot));
  expect(fetch).toHaveBeenCalledTimes(2);
});
