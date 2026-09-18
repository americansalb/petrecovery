#!/usr/bin/env node
/* Exercise the real production build, not a custom server/config override.
 * Run only against an isolated local QA database. Never writes schema or sends
 * messages. The 120-second floor catches startup OOMs AFTER Next reports ready.
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { request } = require('node:http');
const path = require('node:path');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');

const port = Number(process.env.MEMORY_SMOKE_PORT || 3036);
const duration = Math.max(120000, Number(process.env.MEMORY_SMOKE_DURATION_MS) || 120000);
const db = new URL(process.env.DATABASE_URL || 'http://missing');
assert(['localhost', '127.0.0.1', '[::1]'].includes(db.hostname), 'Use an isolated loopback QA database');
assert(!process.env.NEXT_PUBLIC_SITE || process.env.NEXT_PUBLIC_SITE === 'pet', 'Test the shared two-site build');

function get(host, route, { method = 'GET', body, status = 200 } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: route, method,
      headers: { Host: host, 'Content-Type': 'application/json' } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('error', reject);
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        try {
          assert.equal(res.statusCode, status, `${host}${route}: ${text.slice(0, 200)}`);
          assert(text.length > 0, `${route} returned an empty body`);
          resolve({ text, headers: res.headers });
        } catch (error) { reject(error); }
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error(`Timeout: ${route}`)));
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

async function main() {
  const server = spawn(process.execPath, ['--max-old-space-size=256',
    require.resolve('next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', NODE_OPTIONS: '',
      NEXT_TELEMETRY_DISABLED: '1', GEO_TOKEN_SECRET: 'memory-smoke-qa-only-secret',
      NEXTAUTH_SECRET: 'memory-smoke-qa-only-auth', NEXTAUTH_URL: `http://localhost:${port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let failure;
  server.on('error', (error) => { failure = error; });
  server.on('exit', (code, signal) => { failure = new Error(`Production server exited: ${code ?? signal}`); });
  server.stdout.pipe(process.stdout);
  server.stderr.pipe(process.stderr);
  const alive = () => { if (failure) throw failure; };
  const started = Date.now();
  try {
    let ready = false;
    while (Date.now() - started < 45000) {
      alive();
      try { await get('probablyearth.com', '/api/geo/config'); ready = true; break; }
      catch { await delay(500); }
    }
    assert(ready, 'Production server did not become ready');
    let cycles = 0;
    do {
      alive();
      for (const route of ['/', '/login', '/lost-and-found', '/api/public/homepage']) {
        await get('www.reunitepets.org', route);
      }
      const home = await get('probablyearth.com', '/', { status: 302 });
      assert.equal(new URL(home.headers.location).pathname, '/geo');
      for (const route of ['/geo', '/geo/play', '/geo/script/play', '/geo/rooms',
        '/geo/signin', '/api/geo/config', '/api/geo/rooms']) {
        await get('probablyearth.com', route);
      }
      for (let roundIndex = 0; roundIndex < 3; roundIndex++) {
        const round = await get('probablyearth.com', '/api/geo/script/round', {
          method: 'POST', body: { config: { seed: 'memory-smoke', rounds: 3 }, roundIndex },
        });
        const payload = JSON.parse(round.text);
        assert.equal(payload.ok, true, 'Script gameplay must produce a round');
        const scored = await get('probablyearth.com', '/api/geo/script/guess', {
          method: 'POST', body: { token: payload.round.token, guess: { lat: 35, lng: 139 } },
        });
        assert.equal(JSON.parse(scored.text).ok, true, 'Script gameplay must score the guess');
      }
      cycles++;
      console.log(`[memory-smoke] Cycle ${cycles} passed; uptime ${Math.round((Date.now() - started) / 1000)}s at 256 MiB heap cap`);
      await delay(15000);
    } while (Date.now() - started < duration);
    alive();
    assert(cycles >= 2, 'Must exercise the server repeatedly');
    console.log(`[memory-smoke] PASS: both sites and dynamic APIs survived ${Math.round((Date.now() - started) / 1000)}s`);
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      const force = setTimeout(() => server.kill('SIGKILL'), 5000);
      force.unref();
      await exited;
      clearTimeout(force);
    }
  }
}
main().catch((error) => { console.error('[memory-smoke] FAIL', error); process.exitCode = 1; });
