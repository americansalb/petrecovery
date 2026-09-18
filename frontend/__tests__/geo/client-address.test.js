const { clientAddress } = require('@/app/lib/geo/clientAddress');
const req = (headers) => ({ headers: new Headers(headers) });
const env = { RATELIMIT_TRUSTED_IP_HEADER: 'CF-Connecting-IP' };

test('the configured edge address wins over forged forwarded headers', () => {
  for (let i = 0; i < 8; i++) expect(clientAddress(req({ 'cf-connecting-ip': '203.0.113.7', 'x-real-ip': `198.51.100.${i}`, 'x-forwarded-for': `192.0.2.${i}` }), env)).toBe('203.0.113.7');
});
test('a missing trusted header never falls back to spoofable headers', () => {
  expect(clientAddress(req({ 'x-forwarded-for': '192.0.2.1', 'x-real-ip': '192.0.2.2' }), env)).toBe('unknown');
});
test('local fallback remains usable with IPv4 and IPv6', () => {
  expect(clientAddress(req({ 'x-forwarded-for': '203.0.113.8, 10.0.0.1' }), {})).toBe('203.0.113.8');
  expect(clientAddress(req({ 'x-real-ip': '2001:db8::1' }), {})).toBe('2001:db8::1');
});
