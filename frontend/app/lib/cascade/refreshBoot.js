/**
 * Kick off the stale-kit redraw after the server boots.
 *
 * instrumentation.js is compiled for the edge runtime as well as Node, and
 * the renderers (sharp, react-pdf, satori) cannot be bundled there, so this
 * file imports none of them. Instead it asks the server's own regenerate
 * route to do the work, over loopback, with a token that exists only in
 * this process: the route accepts that token for the stale pass alone
 * (app/api/cascade/regenerate/route.js), and the route's bundle is a Node
 * bundle, where the renderers belong.
 */

const TOKEN_KEY = '__reunitepets_kit_refresh_token';

/** The one-process token that authorizes the boot redraw. Same value every call. */
export function bootRefreshToken() {
  if (!globalThis[TOKEN_KEY]) globalThis[TOKEN_KEY] = globalThis.crypto.randomUUID();
  return globalThis[TOKEN_KEY];
}

/**
 * After `delayMs` (three minutes: the health check and the first visitors
 * are served, and memory has settled, before the renderers start), POST
 * the stale pass to this server. The
 * route answers at once and redraws in the background, logging a summary
 * line when it is done. Every failure here is a log line, never a crash.
 */
export function scheduleStaleKitRefresh({ delayMs = 3 * 60 * 1000, limit = 200 } = {}) {
  const token = bootRefreshToken();
  const port = process.env.PORT || '3000';
  const url = `http://127.0.0.1:${port}/api/cascade/regenerate?stale=1&limit=${limit}&wait=0`;
  const timer = setTimeout(async () => {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'x-kit-refresh-token': token } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(`[kits] boot redraw refused: ${res.status} ${body.error || ''}`);
        return;
      }
      console.log(`[kits] ${body.stale ?? '?'} open case(s) drawn by an older renderer; redrawing with ${body.version}`);
    } catch (err) {
      console.error('[kits] boot redraw could not start:', String(err?.message || err));
    }
  }, delayMs);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}
