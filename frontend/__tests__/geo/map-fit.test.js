const { revealMapPadding } = require('@/app/geo/lib/mapFit');
test.each([[390, 210], [320, 180], [1200, 800], [32, 32]])('reveal padding leaves positive dimensions on %s x %s', (width, height) => {
  const padding = revealMapPadding(width, height);
  expect(padding.paddingTopLeft[0] + padding.paddingBottomRight[0]).toBeLessThan(width);
  expect(padding.paddingTopLeft[1] + padding.paddingBottomRight[1]).toBeLessThan(height);
});
test.each([[0, 0], [390, 0], [NaN, 200]])('hidden or invalid maps are not animated', (width, height) => {
  expect(revealMapPadding(width, height)).toBeNull();
});
