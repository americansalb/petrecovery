/**
 * Three screens change the address without a navigation: Street and
 * Script give a seedless link a seed of its own, and the sign-in page
 * takes the emailed token out of the bar.
 *
 * Next.js integrates history.replaceState with its router, but it skips
 * any call whose state carries its own marker (__NA): it takes that for
 * one of its own. All three passed history.state, which carries it. So:
 *
 * - useSearchParams never heard of the seed, and a seedless Script link
 *   (and now Street's) sat on "Opening game" for good, in a real
 *   browser. The unit test for it rerendered by hand, which hid it.
 * - The router kept the address with the sign-in token in it, and wrote
 *   it back into the bar on its next update: checked in a browser with
 *   one router.refresh().
 *
 * Passing null lets Next copy its own state across and hear the change.
 */
const fs = require('fs');
const path = require('path');

const files = [
  'app/geo/components/PlayClient.js',
  'app/geo/components/script/ScriptPlayClient.js',
  'app/geo/components/SignInCard.js',
];

test.each(files)('%s changes the address in a way the router hears', (file) => {
  const source = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
  const calls = source.match(/history\.replaceState\(([^,]+),/g) || [];
  expect(calls.length).toBeGreaterThan(0);
  for (const call of calls) expect(call).toBe('history.replaceState(null,');
});
