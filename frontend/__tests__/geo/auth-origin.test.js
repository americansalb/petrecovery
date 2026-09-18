const { geoAuthOrigin } = require('@/app/lib/geo/authOrigin');

test('authentication links reject forged forwarded hosts and insecure production origins', () => {
  for (const origin of ['https://attacker.test', 'https://probablyearth.com.attacker.test', 'http://probablyearth.com', 'http://localhost:3031', 'https://user@probablyearth.com', 'javascript:alert(1)']) {
    expect(geoAuthOrigin(origin, { NODE_ENV: 'production' })).toBe('https://probablyearth.com');
  }
});
test('preserves known host cookies, explicit deployment origins, and local development', () => {
  expect(geoAuthOrigin('https://www.probablyearth.com')).toBe('https://www.probablyearth.com');
  expect(geoAuthOrigin('http://127.0.0.1:3031', { NODE_ENV: 'development' })).toBe('http://127.0.0.1:3031');
  expect(geoAuthOrigin('http://localhost.attacker.test', { NODE_ENV: 'development' })).toBe('https://probablyearth.com');
  expect(geoAuthOrigin('https://preview.example.test', { NODE_ENV: 'production', NEXT_PUBLIC_BASE_URL: 'https://preview.example.test' })).toBe('https://preview.example.test');
  expect(geoAuthOrigin('https://untrusted.test', { GEO_AUTH_ORIGIN: 'https://game.example.test' })).toBe('https://game.example.test');
});
