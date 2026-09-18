const { selectSavedGame } = require('@/app/geo/lib/saveSelection');
test('newer cloud revision wins over a pending old tab, even with a fast client clock', () => {
  const local = { owner: 'A', pending: true, baseRevision: 1, at: 99999999 };
  const cloud = { at: 1 };
  expect(selectSavedGame(local, cloud, 'A', 2)).toBe(cloud);
});
test('unsynced local progress on the current revision can resume', () => {
  const local = { owner: 'A', pending: true, baseRevision: 2 };
  expect(selectSavedGame(local, {}, 'A', 2)).toBe(local);
});
test('shared browser and signed-out visitors never see another account checkpoint', () => {
  const local = { owner: 'A', pending: true, baseRevision: 0 };
  expect(selectSavedGame(local, null, 'B', 0)).toBeNull();
  expect(selectSavedGame(local, null, null, 0)).toBeNull();
});
test('only explicitly guest-owned saves are shown without a session', () => {
  const guest = { owner: null };
  expect(selectSavedGame(guest, null, null, 0)).toBe(guest);
  expect(selectSavedGame({}, null, null, 0)).toBeNull();
  expect(selectSavedGame(guest, null, 'A', 0)).toBeNull();
});

test('signup return may adopt a guest checkpoint only into an empty account', () => {
  const guest = { owner: null };
  expect(selectSavedGame(guest, null, 'A', 0, { adoptGuest: true })).toBe(guest);
  const cloud = { at: 5 };
  expect(selectSavedGame(guest, cloud, 'A', 1, { adoptGuest: true })).toBe(cloud);
});
