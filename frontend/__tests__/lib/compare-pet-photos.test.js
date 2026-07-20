/**
 * comparePetPhotos: the two-photo Claude vision call behind stray-vs-lost
 * matching. The contract is "null on ANY failure" so matching always
 * degrades to attribute-only, and the paid call never happens without
 * passing the global spend ceiling first.
 */

const mockCheckGlobalLimitAsync = jest.fn();
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  checkGlobalLimitAsync: (...args) => mockCheckGlobalLimitAsync(...args),
}));

import { comparePetPhotos } from '@/app/lib/ai/comparePetPhotos';

const ALLOWED_HOST = 'cdn.example.com';
const PHOTO_A = `https://${ALLOWED_HOST}/a.jpg`;
const PHOTO_B = `https://${ALLOWED_HOST}/b.jpg`;

function imageResponse() {
  return new Response(new ArrayBuffer(1024), {
    status: 200,
    headers: { 'content-type': 'image/jpeg', 'content-length': '1024' },
  });
}

function anthropicResponse(text, { status = 200 } = {}) {
  return new Response(JSON.stringify({ content: [{ text }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function wireFetch(anthropicText = '{"verdict":"SAME","confidence":0.85,"reason":"matching tabby markings"}') {
  global.fetch = jest.fn(async (url) => {
    const u = String(url);
    if (u.includes('api.anthropic.com')) {
      return typeof anthropicText === 'function' ? anthropicText() : anthropicResponse(anthropicText);
    }
    return imageResponse();
  });
}

function anthropicCalls() {
  return global.fetch.mock.calls.filter(([u]) => String(u).includes('api.anthropic.com')).length;
}

describe('comparePetPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckGlobalLimitAsync.mockResolvedValue({ success: true });
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.AI_IMAGE_HOST_ALLOWLIST = ALLOWED_HOST;
    wireFetch();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_IMAGE_HOST_ALLOWLIST;
  });

  test('happy path returns a normalized verdict', async () => {
    const result = await comparePetPhotos(PHOTO_A, PHOTO_B);
    expect(result).toEqual({
      verdict: 'SAME',
      confidence: 0.85,
      reason: 'matching tabby markings',
    });
  });

  test('missing ANTHROPIC_API_KEY returns null without any fetch', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await comparePetPhotos(PHOTO_A, PHOTO_B);
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('photo on a non-allowlisted host returns null without any fetch', async () => {
    const result = await comparePetPhotos('https://evil.example.com/a.jpg', PHOTO_B);
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('global spend ceiling short-circuits BEFORE the paid call', async () => {
    mockCheckGlobalLimitAsync.mockResolvedValue({ success: false });
    const result = await comparePetPhotos(PHOTO_A, PHOTO_B);
    expect(result).toBeNull();
    expect(anthropicCalls()).toBe(0);
  });

  test('malformed model output returns null', async () => {
    wireFetch('sorry, I cannot help with that');
    const result = await comparePetPhotos(PHOTO_A, PHOTO_B);
    expect(result).toBeNull();
  });

  test('unknown verdict value returns null', async () => {
    wireFetch('{"verdict":"MAYBE","confidence":0.5,"reason":"hmm"}');
    const result = await comparePetPhotos(PHOTO_A, PHOTO_B);
    expect(result).toBeNull();
  });

  test('Anthropic error status returns null', async () => {
    wireFetch(() => anthropicResponse('overloaded', { status: 529 }));
    const result = await comparePetPhotos(PHOTO_A, PHOTO_B);
    expect(result).toBeNull();
  });

  test('confidence is clamped into [0,1]', async () => {
    wireFetch('{"verdict":"DIFFERENT","confidence":7,"reason":"wrong species"}');
    const result = await comparePetPhotos(PHOTO_A, PHOTO_B);
    expect(result.verdict).toBe('DIFFERENT');
    expect(result.confidence).toBe(1);
  });
});
