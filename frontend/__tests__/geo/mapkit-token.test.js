/**
 * A token cut to the host the player is actually on.
 *
 * The bug: the shipped MapKit token is minted for `reunitepets.org`,
 * the site redirects the apex to `www.reunitepets.org`, and Apple
 * matches the origin exactly, so it answers 401 on the host every
 * visitor lands on. Pulled out of the live bundle and checked against
 * Apple's bootstrap on 2026-09-15: apex 200, www 401. Every Apple
 * surface in the game was blank, silently.
 *
 * Minting per request fixes it for every hostname at once, including
 * preview deployments, which get a new one on every push. The thing to
 * be careful about is the Host header, which anyone can set: a token
 * minted for somebody else's origin would let them spend this account's
 * Apple quota on their own site.
 */

import { mayMintFor, mintMapKitToken, canMint } from '@/app/lib/geo/server/mapKitToken';

describe('which hosts a token may be minted for', () => {
  test('the site and anything under it', () => {
    for (const host of [
      'reunitepets.org',
      'www.reunitepets.org',
      'WWW.REUNITEPETS.ORG',
      'staging.reunitepets.org',
      'www.rescueourfamily.org',
    ]) {
      expect({ host, allowed: mayMintFor(host) }).toEqual({ host, allowed: true });
    }
  });

  test('preview deployments and local development, which change hostname constantly', () => {
    expect(mayMintFor('petrecovery-git-abc123.vercel.app')).toBe(true);
    expect(mayMintFor('localhost')).toBe(true);
    expect(mayMintFor('localhost:3000')).toBe(true);
    expect(mayMintFor('127.0.0.1')).toBe(true);
  });

  test('nobody else, because the Host header is theirs to set', () => {
    for (const host of [
      'evil.example',
      'reunitepets.org.evil.example',
      'notreunitepets.org',
      'wwwreunitepets.org',
      '',
      null,
      undefined,
    ]) {
      expect({ host, allowed: mayMintFor(host) }).toEqual({ host, allowed: false });
    }
  });

  test('a trailing dot is the same host', () => {
    expect(mayMintFor('www.reunitepets.org.')).toBe(true);
  });
});

describe('minting', () => {
  test('says why it did not, instead of failing quietly', () => {
    // No signing key in the test environment, which is also the state
    // of any clone: the answer has to be a reason, not an exception.
    const result = mintMapKitToken('www.reunitepets.org');
    expect(result.token).toBeUndefined();
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
    expect(canMint()).toBe(false);
  });

  test('a host it will not sign for is refused by name', () => {
    expect(mintMapKitToken('evil.example').reason).toBeTruthy();
  });
});
