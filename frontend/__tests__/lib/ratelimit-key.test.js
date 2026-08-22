/**
 * The rate-limit key must not be forgeable.
 *
 * getClientIP falls back to the leftmost X-Forwarded-For entry, which is
 * set by the client. An attacker varying it per request mints a fresh
 * bucket every time and is never limited - which makes every cap in the
 * app advisory, including the one meant to stop the flood that put 87,003
 * junk rows in the database.
 *
 * Reproduced against a running build: 10 requests then 429 from one honest
 * IP, and 14 straight through when each carried a different forged header.
 * With RATELIMIT_TRUSTED_IP_HEADER set, the forged header is ignored and
 * the limit holds at 10.
 *
 * This cannot be fixed in code alone - only the operator knows which
 * header their proxy injects - so the job here is to make the gap loud
 * rather than silent.
 */

describe('rate limit key derivation', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.RATELIMIT_TRUSTED_IP_HEADER;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('reports the key as spoofable when no trusted header is configured', () => {
    const { rateLimitKeyIsSpoofable } = require('@/app/lib/rateLimit');
    expect(rateLimitKeyIsSpoofable()).toBe(true);
  });

  it('reports it as safe once a trusted header is named', () => {
    process.env.RATELIMIT_TRUSTED_IP_HEADER = 'x-real-ip';
    jest.resetModules();
    const { rateLimitKeyIsSpoofable } = require('@/app/lib/rateLimit');
    expect(rateLimitKeyIsSpoofable()).toBe(false);
  });

  it('is documented in every env template, so it is not discovered in an incident', () => {
    const fs = require('fs');
    const path = require('path');
    for (const file of ['.env.example', '.env.production.example', '.env.staging.example']) {
      const contents = fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
      expect(contents).toContain('RATELIMIT_TRUSTED_IP_HEADER');
    }
  });

  it('boot warns about it in production', () => {
    const fs = require('fs');
    const path = require('path');
    const boot = fs.readFileSync(path.join(__dirname, '..', '..', 'instrumentation.js'), 'utf8');
    expect(boot).toMatch(/rateLimitKeyIsSpoofable/);
    expect(boot).toMatch(/RATELIMIT_TRUSTED_IP_HEADER is not set/);
  });
});
