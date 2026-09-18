const { safeReturnTo } = require('@/app/lib/geo/authReturn');

test('only game paths survive URL normalization', () => {
  expect(safeReturnTo('/geo/rooms?variant=duel')).toBe('/geo/rooms?variant=duel');
  expect(safeReturnTo('/geo/room/ABC123?name=Ada')).toBe('/geo/room/ABC123?name=Ada');
  for (const bad of ['//evil.test', 'https://evil.test', '/geo/../../api/auth/delete', '/geo/%2e%2e/api', '/geography', '/geo\\evil', '/geo\n/rooms']) {
    expect(safeReturnTo(bad)).toBe('/geo/me');
  }
});
