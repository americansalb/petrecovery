/**
 * Security & contract tests for POST /api/ai/analyze-pet
 *
 * This route is intentionally unauthenticated (it runs in the report-creation /
 * finder funnel), so it is safe-by-construction instead of safe-behind-a-login.
 * These tests pin the acceptance criteria the team ratified in Delphi discussion 1:
 *   (a) SSRF host allowlist — only our own image host(s), never arbitrary URLs
 *   (b) request timeout + image size cap
 *   (c) anonymous rate limit
 *   (d) model output validated/normalized to Prisma enums
 *   (e) hard per-window spend ceiling on the paid Anthropic call
 *
 * Verified-but-unfixed residual gaps (see Tester msg 318) are encoded with
 * `test.failing` / `test.todo` so CI stays green today AND turns red the moment
 * a gap is fixed (prompting removal of the marker). They are NOT silent.
 */

import { NextRequest } from 'next/server';

// Rate limit: default to "allowed". Individual tests override.
// Two limiters: per-IP (withRateLimitAsync) and the global spend ceiling
// (checkGlobalLimitAsync — the AC-e fix that defends total Anthropic cost).
const mockWithRateLimitAsync = jest.fn();
const mockCheckGlobalLimitAsync = jest.fn();
const mockRateLimitResponse = jest.fn(() =>
  new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
);
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: (...args) => mockWithRateLimitAsync(...args),
  checkGlobalLimitAsync: (...args) => mockCheckGlobalLimitAsync(...args),
  rateLimitResponse: (...args) => mockRateLimitResponse(...args),
}));

import { POST } from '@/app/api/ai/analyze-pet/route';

const ALLOWED_HOST = 'cdn.example.com';
const ALLOWED_IMAGE_URL = `https://${ALLOWED_HOST}/uploads/pet.jpg`;

function req(body) {
  return new NextRequest('http://localhost:3000/api/ai/analyze-pet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// A real Response for the image fetch (realm-safe across jest workers, unlike a
// plain object — the route reads .ok/.headers.get()/.arrayBuffer()).
function imageResponse({ contentType = 'image/jpeg', contentLength = '2048', bytes = 2048, status = 200 } = {}) {
  const headers = {};
  if (contentType !== null) headers['content-type'] = contentType;
  if (contentLength !== null) headers['content-length'] = String(contentLength);
  return new Response(new ArrayBuffer(bytes), { status, headers });
}

// A real Response for the Anthropic messages call.
function anthropicResponse(text, { status = 200 } = {}) {
  return new Response(JSON.stringify({ content: [{ text }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Route makes two outbound fetches: the image, then Anthropic. Branch on URL.
function wireFetch({ image, anthropicText = '{"species":"dog","colors":["brown"],"size":"MEDIUM","confidence":0.9,"isIndoor":null}' } = {}) {
  global.fetch = jest.fn(async (url) => {
    const u = String(url);
    if (u.includes('api.anthropic.com')) return anthropicResponse(anthropicText);
    // Fresh Response per call (a Response body can only be read once).
    return image ? image() : imageResponse();
  });
}

describe('POST /api/ai/analyze-pet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithRateLimitAsync.mockResolvedValue({ success: true });
    mockCheckGlobalLimitAsync.mockResolvedValue({ success: true });
    process.env.AI_IMAGE_HOST_ALLOWLIST = ALLOWED_HOST;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.BUNNY_CDN_URL;
  });

  describe('(a) SSRF host allowlist — must reject non-allowlisted URLs WITHOUT fetching', () => {
    const ssrfPayloads = [
      ['link-local metadata (http)', 'http://169.254.169.254/latest/meta-data/'],
      ['link-local metadata (https)', 'https://169.254.169.254/latest/meta-data/'],
      ['loopback internal port', 'http://localhost:5432/'],
      ['internal service by name', 'http://redis:6379/'],
      ['file scheme', 'file:///etc/passwd'],
      ['arbitrary external host', 'https://evil.example.com/pet.jpg'],
      ['non-https allowlisted host', `http://${ALLOWED_HOST}/pet.jpg`],
    ];

    test.each(ssrfPayloads)('rejects %s with 400 and no outbound fetch', async (_label, imageUrl) => {
      wireFetch();
      const res = await POST(req({ imageUrl }));
      expect(res.status).toBe(400);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('fails closed when no allowlist is configured', async () => {
      delete process.env.AI_IMAGE_HOST_ALLOWLIST;
      delete process.env.BUNNY_CDN_URL;
      wireFetch();
      const res = await POST(req({ imageUrl: ALLOWED_IMAGE_URL }));
      expect(res.status).toBe(400);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('(b) image fetch guards — media type + size', () => {
    test('rejects unsupported media type (text/html passthrough) with 400', async () => {
      wireFetch({ image: () => imageResponse({ contentType: 'text/html' }) });
      const res = await POST(req({ imageUrl: ALLOWED_IMAGE_URL }));
      expect(res.status).toBe(400);
    });

    test('rejects oversize image declared via Content-Length with 413', async () => {
      wireFetch({ image: () => imageResponse({ contentLength: String(20 * 1024 * 1024) }) });
      const res = await POST(req({ imageUrl: ALLOWED_IMAGE_URL }));
      expect(res.status).toBe(413);
    });

    test('rejects oversize image when Content-Length is absent (streamed byte ceiling)', async () => {
      // G2 fix: body is streamed with a running byte ceiling, so an absent/lying
      // Content-Length cannot force unbounded buffering — and oversize still 413s.
      wireFetch({ image: () => imageResponse({ contentLength: null, bytes: 20 * 1024 * 1024 }) });
      const res = await POST(req({ imageUrl: ALLOWED_IMAGE_URL }));
      expect(res.status).toBe(413);
    });
  });

  describe('(c) rate limiting', () => {
    test('returns the rate-limit response when the limiter blocks', async () => {
      mockWithRateLimitAsync.mockResolvedValue({ success: false });
      wireFetch();
      const res = await POST(req({ imageUrl: ALLOWED_IMAGE_URL }));
      expect(res.status).toBe(429);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('(d) model output is normalized/clamped to Prisma enums', () => {
    test('lowercase + dirty model output is coerced to enums', async () => {
      wireFetch({
        anthropicText:
          'Here you go: {"species":"dog","colors":["Brown ","WHITE",42],"size":"medium","confidence":1.7,"isIndoor":"yes"}',
      });
      const res = await POST(req({ imageUrl: ALLOWED_IMAGE_URL }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.species).toBe('DOG');
      expect(body.size).toBe('MEDIUM');
      expect(body.colors).toEqual(['brown', 'white']); // non-strings dropped, lowercased
      expect(body.confidence).toBe(1); // clamped to [0,1]
      expect(body.isIndoor).toBeNull(); // non-boolean -> null
    });

    test('unknown species falls back to OTHER, never an invalid enum', async () => {
      wireFetch({ anthropicText: '{"species":"dragon","colors":[],"size":"HUGE","confidence":0.5}' });
      const res = await POST(req({ imageUrl: ALLOWED_IMAGE_URL }));
      const body = await res.json();
      expect(body.species).toBe('OTHER');
      expect(body.size).toBe(''); // unknown size -> empty, not invalid enum
    });

    test('malformed (non-JSON) model output fails soft: 200 + empty OTHER analysis, never a crash', async () => {
      // Intentional contract: photo analysis only auto-fills optional fields, so a
      // model hiccup degrades to an empty analysis rather than failing the report flow.
      wireFetch({ anthropicText: 'I cannot analyze this image.' });
      const res = await POST(req({ imageUrl: ALLOWED_IMAGE_URL }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ species: 'OTHER', colors: [], size: '', confidence: 0, isIndoor: null });
    });
  });

  describe('input validation', () => {
    test('missing imageUrl -> 400', async () => {
      wireFetch();
      const res = await POST(req({}));
      expect(res.status).toBe(400);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    test('allowlisted image + valid model output -> 200 with normalized analysis', async () => {
      wireFetch();
      const res = await POST(req({ imageUrl: ALLOWED_IMAGE_URL }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        species: 'DOG',
        colors: ['brown'],
        size: 'MEDIUM',
        confidence: 0.9,
        isIndoor: null,
      });
      // Two fetches: image, then Anthropic.
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Residual gaps I reported (Tester msg 318) — now FIXED by the developer.
  // These regression tests lock the fixes so they can't silently regress.
  // ---------------------------------------------------------------------------
  describe('hardening regressions (G1/G3 fixes — keep them fixed)', () => {
    test('G1 [AC-a]: image fetch disables redirect-following so an allowlisted host cannot 302 to an internal IP', async () => {
      wireFetch();
      await POST(req({ imageUrl: ALLOWED_IMAGE_URL }));
      const imageCall = global.fetch.mock.calls.find(([u]) => !String(u).includes('anthropic'));
      expect(imageCall).toBeDefined();
      // 'error' (reject) or 'manual' (don't follow) both close the open-redirect SSRF.
      expect(imageCall[1].redirect).toMatch(/^(error|manual)$/);
    });

    test('G3 [AC-e]: a tripped GLOBAL spend ceiling returns 503 and never calls Anthropic', async () => {
      mockCheckGlobalLimitAsync.mockResolvedValue({ success: false });
      wireFetch();
      const res = await POST(req({ imageUrl: ALLOWED_IMAGE_URL }));
      expect(res.status).toBe(503);
      // The image may be fetched, but the paid Anthropic call must NOT happen.
      const anthropicCalled = global.fetch.mock.calls.some(([u]) => String(u).includes('anthropic'));
      expect(anthropicCalled).toBe(false);
    });
  });
});
