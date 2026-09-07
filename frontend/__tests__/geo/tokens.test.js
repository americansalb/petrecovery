/**
 * Sealed round tokens: the answer rides along with the client but the
 * client cannot read it, change it, or reuse it after expiry.
 */

const { sealToken, openToken, GeoTokenError } = require('@/app/lib/geo/server/tokens');

const secret = 'a-long-enough-test-secret';

describe('sealed tokens', () => {
  test('round-trips a payload', () => {
    const token = sealToken({ lat: 48.8566, lng: 2.3522, cc: 'FR' }, { secret });
    expect(token.startsWith('g1.')).toBe(true);
    expect(token).not.toMatch(/48\.8566/);
    const opened = openToken(token, { secret });
    expect(opened.lat).toBe(48.8566);
    expect(opened.cc).toBe('FR');
    expect(typeof opened.exp).toBe('number');
  });

  test('a flipped character is rejected', () => {
    const token = sealToken({ lat: 1, lng: 2 }, { secret });
    const body = token.slice(3);
    const flipped = body[10] === 'A' ? 'B' : 'A';
    const tampered = `g1.${body.slice(0, 10)}${flipped}${body.slice(11)}`;
    expect(() => openToken(tampered, { secret })).toThrow(GeoTokenError);
    try {
      openToken(tampered, { secret });
    } catch (error) {
      expect(error.code).toBe('invalid');
    }
  });

  test('the wrong secret cannot open it', () => {
    const token = sealToken({ lat: 1, lng: 2 }, { secret });
    expect(() => openToken(token, { secret: 'another-long-secret' })).toThrow(GeoTokenError);
  });

  test('expired tokens are refused', () => {
    const token = sealToken({ lat: 1, lng: 2 }, { secret, ttlMs: 1000, now: 1000 });
    expect(openToken(token, { secret, now: 1500 }).lat).toBe(1);
    expect(() => openToken(token, { secret, now: 2001 })).toThrow(/expired/);
  });

  test('garbage and missing secrets fail loudly', () => {
    expect(() => openToken('nope', { secret })).toThrow(GeoTokenError);
    expect(() => openToken('g1.!!!', { secret })).toThrow(GeoTokenError);
    expect(() => sealToken({}, { secret: '' })).toThrow(/secret/);
  });
});
