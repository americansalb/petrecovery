/**
 * The pet site's address is built in, never read from the environment.
 *
 * Before launch it came from two settings, and both were wrong on the
 * live site. NEXTAUTH_URL was the Render hostname, so password resets,
 * sighting alerts and flyer QR codes all pointed at
 * petrecovery.onrender.com, and signing out landed people there.
 * NEXT_PUBLIC_BASE_URL was never set, so every canonical tag named
 * http://localhost:3000 as the real page.
 *
 * getBaseUrl() in app/lib/config.js is now the only source: SITE_URL from
 * app/lib/brand.js everywhere except `next dev`. This file holds that in
 * place, and fails on new code that reads the address from a setting or
 * falls back to localhost.
 *
 * The game is exempt. It has its own domain, built in the same way in
 * app/lib/geo/meta.js, with tests of its own under __tests__/geo.
 */

const fs = require('fs');
const path = require('path');

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: { user: {} } }));

const SITE = 'https://www.reunitepets.org';

/** Run fn with some variables set (undefined deletes one), then restore them. */
async function withEnv(vars, fn) {
  const saved = {};
  for (const [key, value] of Object.entries(vars)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('getBaseUrl', () => {
  const { getBaseUrl, getEmailBaseUrl } = require('@/app/lib/config');

  test('is the real address', () => {
    expect(require('@/app/lib/brand').SITE_URL).toBe(SITE);
  });

  test('ignores whatever the host has set, in production', () =>
    withEnv(
      {
        NODE_ENV: 'production',
        NEXTAUTH_URL: 'https://petrecovery.onrender.com',
        NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
      },
      () => {
        expect(getBaseUrl()).toBe(SITE);
        expect(getEmailBaseUrl()).toBe(SITE);
      }
    ));

  test('needs nothing set, in production', () =>
    withEnv({ NODE_ENV: 'production', NEXTAUTH_URL: undefined, NEXT_PUBLIC_BASE_URL: undefined }, () => {
      expect(getBaseUrl()).toBe(SITE);
    }));

  test('is the real address under test too, so tests see real links', () =>
    withEnv({ NODE_ENV: 'test', NEXTAUTH_URL: 'http://localhost:3000' }, () => {
      expect(getBaseUrl()).toBe(SITE);
    }));

  test('is the development server under next dev', async () => {
    await withEnv({ NODE_ENV: 'development', NEXTAUTH_URL: undefined }, () => {
      expect(getBaseUrl()).toBe('http://localhost:3000');
    });
    await withEnv({ NODE_ENV: 'development', NEXTAUTH_URL: 'http://localhost:5757/api/auth' }, () => {
      expect(getBaseUrl()).toBe('http://localhost:5757');
    });
    await withEnv({ NODE_ENV: 'development', NEXTAUTH_URL: 'not a url' }, () => {
      expect(getBaseUrl()).toBe('http://localhost:3000');
    });
  });
});

describe('link previews', () => {
  test('canonical URLs and relative images resolve against the real address', () =>
    withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_BASE_URL: undefined }, () => {
      const { shareMetadataBase, buildShareMetadata } = require('@/app/lib/shareMetadata');
      expect(shareMetadataBase().href).toBe(`${SITE}/`);

      const meta = buildShareMetadata({
        title: 'Help Find Linda',
        description: 'Lost dog',
        canonical: '/cases/CASE-2026-000001',
        index: true,
      });
      expect(new URL(meta.alternates.canonical, meta.metadataBase).href).toBe(
        `${SITE}/cases/CASE-2026-000001`
      );
    }));
});

describe('NextAuth', () => {
  test('is handed the real address, however NEXTAUTH_URL was set', () =>
    withEnv({ NEXTAUTH_URL: 'https://petrecovery.onrender.com' }, () => {
      let authOptions;
      jest.isolateModules(() => {
        ({ authOptions } = require('@/app/lib/auth'));
      });
      expect(process.env.NEXTAUTH_URL).toBe(SITE);
      // The __Secure- cookie name, which middleware.js reads as well.
      expect(authOptions.useSecureCookies).toBe(true);
    }));
});

describe('middleware', () => {
  const { getToken } = require('next-auth/jwt');
  const { middleware } = require('@/middleware');

  const request = (url) => ({
    url,
    method: 'GET',
    nextUrl: new URL(url),
    headers: new Headers({ host: new URL(url).host }),
  });

  beforeEach(() => {
    getToken.mockReset();
    getToken.mockResolvedValue(null);
  });

  test('301s the Render hostname to the real address, path and query intact', async () => {
    const res = await middleware(request('https://petrecovery.onrender.com/cases/CASE-2026-000001?ref=email'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(`${SITE}/cases/CASE-2026-000001?ref=email`);
  });

  test('still 301s the old domain', async () => {
    const res = await middleware(request('https://www.petrecovery.org/about'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(`${SITE}/about`);
  });

  test('answers the health check on the Render hostname instead of redirecting it', async () => {
    const res = await middleware(request('https://petrecovery.onrender.com/api/health'));
    expect(res.status).toBe(200);
  });

  test('does not redirect the real address', async () => {
    const res = await middleware(request(`${SITE}/about`));
    expect(res.headers.get('location')).toBeNull();
  });

  test('looks for the session cookie auth.js sets', async () => {
    await middleware(request(`${SITE}/dashboard`));
    expect(getToken).toHaveBeenCalledWith(expect.objectContaining({ secureCookie: true }));
  });
});

describe('no setting or localhost fallback decides the address', () => {
  const ROOT = path.join(__dirname, '..');
  const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');

  // The game's own address logic; its domain is built in at app/lib/geo/meta.js.
  const GAME = ['app/lib/geo/', 'app/geo/'];

  const SETTINGS = [
    'NEXTAUTH_URL',
    'NEXT_PUBLIC_BASE_URL',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_SITE_URL',
    // Set by the hosts themselves, to their own hostnames for the
    // service: exactly the petrecovery.onrender.com mistake again.
    'RENDER_EXTERNAL_URL',
    'RENDER_EXTERNAL_HOSTNAME',
    'VERCEL_URL',
  ].join('|');
  const READ = new RegExp(`(?:process\\.env|\\benv)\\s*(?:\\.\\s*|\\[\\s*['"\`])(${SETTINGS})\\b`, 'g');
  const DESTRUCTURED = new RegExp(`\\{[^}]*\\b(${SETTINGS})\\b[^}]*\\}\\s*=\\s*process\\.env`, 'g');
  const LOCALHOST = /['"`]https?:\/\/(?:localhost|127\.0\.0\.1)\b/g;

  // config.js reads NEXTAUTH_URL for `next dev` only, and owns the
  // development default; auth.js writes NEXTAUTH_URL for NextAuth.
  const MAY_NAME_SETTING = new Set(['app/lib/config.js', 'app/lib/auth.js']);
  const MAY_NAME_LOCALHOST = new Set(['app/lib/config.js']);

  function sources() {
    const out = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules') walk(full);
        } else if (/\.(js|jsx|ts|tsx|mjs)$/.test(entry.name)) {
          out.push(full);
        }
      }
    };
    for (const dir of ['app', 'lib', 'components']) walk(path.join(ROOT, dir));
    for (const file of ['middleware.js', 'instrumentation.js', 'next.config.js']) {
      if (fs.existsSync(path.join(ROOT, file))) out.push(path.join(ROOT, file));
    }
    return out.filter((file) => !GAME.some((prefix) => rel(file).startsWith(prefix)));
  }

  test('nothing reads the address from a setting', () => {
    const found = [];
    for (const file of sources()) {
      if (MAY_NAME_SETTING.has(rel(file))) continue;
      const src = fs.readFileSync(file, 'utf8');
      for (const re of [READ, DESTRUCTURED]) {
        for (const m of src.matchAll(re)) found.push(`${rel(file)}: ${m[1]}`);
      }
    }
    // Use getBaseUrl() from app/lib/config.js instead.
    expect(found).toEqual([]);
  });

  test('nothing falls back to localhost', () => {
    const found = [];
    for (const file of sources()) {
      if (MAY_NAME_LOCALHOST.has(rel(file))) continue;
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(LOCALHOST)) found.push(`${rel(file)}: ${m[0]}`);
    }
    // A localhost fallback ends up on the live site the day a setting is
    // missing. Use getBaseUrl() from app/lib/config.js instead.
    expect(found).toEqual([]);
  });
});
