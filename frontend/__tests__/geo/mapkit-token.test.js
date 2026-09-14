/**
 * Which MapKit token goes to Apple, and what the game says when Apple
 * says no.
 *
 * A MapKit token carries one origin and Apple matches it exactly. A
 * token for reunitepets.org is refused with a 401 on
 * www.reunitepets.org, and a refused token does not throw: MapKit
 * loads, the pane is built, and no tile ever arrives. That is how every
 * Apple surface on the live site went blank while every test passed,
 * on 2026-09-14.
 *
 * Which hosts Apple actually accepts is not a question a test can
 * answer, because only Apple knows. `npm run geo:check-mapkit` asks it.
 * What is checkable here is the part that was missing: shipping more
 * than one token, and picking the right one for the host.
 */

const TOKEN_PATH = '../../app/geo/lib/appleMapKit';

/** A JWT that is real enough: the payload is what anything here reads. */
function tokenFor(origin) {
  const head = Buffer.from(JSON.stringify({ kid: 'test', typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(origin ? { iss: 'TEAM', iat: 1, origin } : { iss: 'TEAM', iat: 1 })).toString('base64url');
  return `${head}.${body}.signature`;
}

function load({ tokens, hostname }) {
  jest.resetModules();
  if (tokens === null) delete process.env.NEXT_PUBLIC_APPLE_MAPKIT_TOKEN;
  else process.env.NEXT_PUBLIC_APPLE_MAPKIT_TOKEN = tokens;
  global.window = { location: { hostname } };
  // eslint-disable-next-line global-require
  return require(TOKEN_PATH);
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APPLE_MAPKIT_TOKEN;
  delete global.window;
  jest.resetModules();
});

describe('the token the browser is given', () => {
  test('the shipped literal covers the apex and nothing else', () => {
    const { mapKitOrigins } = load({ tokens: null, hostname: 'reunitepets.org' });
    expect(mapKitOrigins()).toEqual(['reunitepets.org']);
  });

  test('a list of tokens covers every origin in it', () => {
    const { mapKitOrigins } = load({
      tokens: `${tokenFor('reunitepets.org')}, ${tokenFor('www.reunitepets.org')}`,
      hostname: 'www.reunitepets.org',
    });
    expect(mapKitOrigins()).toEqual(['reunitepets.org', 'www.reunitepets.org']);
  });

  test('whitespace separates them too, so a pasted list works', () => {
    const { mapKitOrigins } = load({
      tokens: `${tokenFor('a.example')}\n${tokenFor('b.example')}`,
      hostname: 'a.example',
    });
    expect(mapKitOrigins()).toEqual(['a.example', 'b.example']);
  });

  test('a token minted for no origin claims none, and covers anything', () => {
    const { mapKitOrigins, mapKitRefusalMessage } = load({ tokens: tokenFor(''), hostname: 'anywhere.example' });
    expect(mapKitOrigins()).toEqual([]);
    // Nothing to blame the host for: the message falls back to quota.
    expect(mapKitRefusalMessage()).toMatch(/quota|expired/);
  });
});

describe('what the game says when Apple refuses', () => {
  test('it names the host that was refused and the origins the tokens cover', () => {
    const { mapKitRefusalMessage } = load({
      tokens: tokenFor('reunitepets.org'),
      hostname: 'www.reunitepets.org',
    });
    const message = mapKitRefusalMessage();
    expect(message).toContain('www.reunitepets.org');
    expect(message).toContain('reunitepets.org');
    // This is the sentence that would have saved a day: the host is not
    // covered, and the covered one is named next to it.
    expect(message).toMatch(/matches the host exactly/);
  });

  test('a covered host gets the general message, not the origin one', () => {
    const { mapKitRefusalMessage } = load({
      tokens: tokenFor('reunitepets.org'),
      hostname: 'reunitepets.org',
    });
    expect(mapKitRefusalMessage()).toMatch(/quota|expired/);
  });
});
