import { NextResponse } from 'next/server';
import { withRateLimitAsync, checkGlobalLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/analyze-pet
 * Analyzes a pet photo using Claude Haiku vision to detect species, colors, size, and breed.
 *
 * No login required — this runs during the report-creation flow (including the finder
 * funnel), so we keep it unauthenticated but make it safe by construction:
 *  - SSRF guard: imageUrl MUST be on our own image host allowlist. The client always
 *    passes a URL returned by /api/upload (Bunny CDN), so arbitrary URLs are rejected.
 *    This blocks cloud-metadata / internal-network fetches without an auth wall.
 *  - Rate limit (Redis-backed when available) to cap abuse / paid-API cost.
 *  - Size + media-type caps on the fetched image.
 *  - AbortController timeouts on both outbound fetches.
 *  - Model output is normalized/clamped to our Prisma enums before returning.
 */

// Anthropic accepts only these image media types.
const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// Anthropic caps images at ~5MB; keep our own ceiling at 8MB before that.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 8000;
const ANTHROPIC_TIMEOUT_MS = 20000;

// Hard global ceiling on paid Anthropic calls per minute, across ALL callers.
// Circuit-breaker for total spend; defends cost even if the per-IP limit is
// evaded via IP rotation / spoofed x-forwarded-for. Tune via env.
const GLOBAL_MAX_PER_MIN = parseInt(process.env.AI_ANALYZE_GLOBAL_MAX_PER_MIN || '100', 10);

// Prisma enums (frontend/prisma/schema.prisma).
const SPECIES_ENUM = new Set(['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER']);
const SIZE_ENUM = new Set(['TINY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT']);

/**
 * Build the allowlist of hosts we will fetch images from.
 * Primary source is BUNNY_CDN_URL (where /api/upload stores photos). An optional
 * comma-separated AI_IMAGE_HOST_ALLOWLIST env can add hosts (e.g. local dev storage).
 * Fail closed: if nothing is configured we reject all URLs rather than allow SSRF.
 */
function getAllowedImageHosts() {
  const hosts = new Set();

  const cdn = process.env.BUNNY_CDN_URL;
  if (cdn) {
    try {
      const normalized = cdn.startsWith('http') ? cdn : `https://${cdn}`;
      hosts.add(new URL(normalized).host.toLowerCase());
    } catch {
      /* ignore malformed env */
    }
  }

  const extra = process.env.AI_IMAGE_HOST_ALLOWLIST;
  if (extra) {
    for (const h of extra.split(',')) {
      const trimmed = h.trim().toLowerCase();
      if (trimmed) hosts.add(trimmed);
    }
  }

  return hosts;
}

/**
 * Validate that imageUrl is an https URL on an allowlisted host.
 * Returns the parsed URL on success, or null if it must be rejected.
 */
function validateImageUrl(imageUrl) {
  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;

  const allowed = getAllowedImageHosts();
  if (allowed.size === 0) return null; // fail closed — not configured
  if (!allowed.has(parsed.host.toLowerCase())) return null;

  return parsed;
}

function normalizeSpecies(value) {
  if (typeof value !== 'string') return 'OTHER';
  const upper = value.trim().toUpperCase();
  return SPECIES_ENUM.has(upper) ? upper : 'OTHER';
}

function normalizeSize(value) {
  if (typeof value !== 'string') return '';
  const upper = value.trim().toUpperCase();
  return SIZE_ENUM.has(upper) ? upper : '';
}

function normalizeColors(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c) => typeof c === 'string')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeConfidence(value) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(1, Math.max(0, num));
}

function normalizeIsIndoor(value) {
  if (value === true || value === false) return value;
  return null;
}

export async function POST(request) {
  try {
    // Rate limit (Redis-backed when REDIS_URL is set; in-memory fallback otherwise).
    // AI calls are paid, so this is stricter than a normal public write.
    const rateLimitResult = await withRateLimitAsync(
      request,
      { windowMs: 60 * 1000, maxRequests: 8, blockDurationMs: 5 * 60 * 1000 },
      'ai:analyze-pet'
    );
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json().catch(() => null);
    const imageUrl = body?.imageUrl;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    // SSRF guard — only fetch from our own image host(s).
    const validatedUrl = validateImageUrl(imageUrl);
    if (!validatedUrl) {
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('analyze-pet: ANTHROPIC_API_KEY not configured');
      return NextResponse.json({ error: 'AI analysis unavailable' }, { status: 503 });
    }

    // Fetch the image (timeout + size + media-type guards). The timer stays armed
    // through the streaming body read so a slow/stalled stream also aborts.
    const imageController = new AbortController();
    const imageTimer = setTimeout(() => imageController.abort(), IMAGE_FETCH_TIMEOUT_MS);

    let base64Image;
    let imageMediaType;
    try {
      let imageResponse;
      try {
        // redirect: 'error' prevents a redirect on the allowlisted CDN host from
        // bouncing the fetch to an internal/arbitrary URL (SSRF-via-open-redirect).
        imageResponse = await fetch(validatedUrl, {
          signal: imageController.signal,
          redirect: 'error',
        });
      } catch {
        return NextResponse.json({ error: 'Failed to fetch image' }, { status: 400 });
      }

      if (!imageResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch image' }, { status: 400 });
      }

      imageMediaType = (imageResponse.headers.get('content-type') || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED_MEDIA_TYPES.has(imageMediaType)) {
        return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
      }

      // Reject oversized images up front via Content-Length when present.
      const declaredLength = parseInt(imageResponse.headers.get('content-length') || '', 10);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: 'Image too large' }, { status: 413 });
      }

      // Stream the body with a hard running byte ceiling, so an absent or lying
      // Content-Length (e.g. chunked transfer) can't force unbounded buffering.
      const reader = imageResponse.body?.getReader();
      if (!reader) {
        return NextResponse.json({ error: 'Failed to fetch image' }, { status: 400 });
      }
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_IMAGE_BYTES) {
          await reader.cancel().catch(() => {});
          return NextResponse.json({ error: 'Image too large' }, { status: 413 });
        }
        chunks.push(Buffer.from(value));
      }
      base64Image = Buffer.concat(chunks).toString('base64');
    } catch {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 400 });
    } finally {
      clearTimeout(imageTimer);
    }

    // Hard global ceiling on paid Anthropic calls — defends total spend even if
    // the per-IP limit is evaded via IP rotation / spoofed x-forwarded-for.
    const globalLimit = await checkGlobalLimitAsync('ai:analyze-pet', {
      windowMs: 60 * 1000,
      maxRequests: GLOBAL_MAX_PER_MIN,
      blockDurationMs: 60 * 1000,
    });
    if (!globalLimit.success) {
      return NextResponse.json({ error: 'AI analysis temporarily at capacity' }, { status: 503 });
    }

    // Call Anthropic (with timeout).
    const aiController = new AbortController();
    const aiTimer = setTimeout(() => aiController.abort(), ANTHROPIC_TIMEOUT_MS);

    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: aiController.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: imageMediaType,
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: `Analyze this pet photo. Return ONLY valid JSON with these fields:
{
  "species": "dog" | "cat" | "bird" | "other",
  "colors": ["color1", "color2"],
  "size": "TINY" | "SMALL" | "MEDIUM" | "LARGE" | "GIANT",
  "confidence": 0.0 to 1.0,
  "isIndoor": true | false | null
}

For colors, use simple common pet color names like: black, white, brown, tan, golden, red, orange, gray, cream, spotted, tricolor. Keep it simple - just the visible colors.
For size, estimate based on appearance: TINY (<10lbs), SMALL (10-25), MEDIUM (25-60), LARGE (60-90), GIANT (90+). Only for dogs.
For isIndoor, only answer for cats if there are clues in the photo. Otherwise null.
If the image is not a pet, return {"species":"other","colors":[],"size":"","confidence":0,"isIndoor":null}.
Return ONLY the JSON, no other text.`,
                },
              ],
            },
          ],
        }),
      });
    } catch {
      return NextResponse.json({ error: 'AI analysis failed' }, { status: 504 });
    } finally {
      clearTimeout(aiTimer);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return NextResponse.json({ error: 'AI analysis failed' }, { status: 502 });
    }

    const data = await response.json();
    const responseText = data.content?.[0]?.text || '';

    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      // Malformed/non-JSON model output is best-effort, not a hard error: photo
      // analysis only auto-fills optional fields, so degrade to an empty analysis
      // (HTTP 200) rather than a 5xx that could surface as a failure to the user.
      console.error('Failed to parse AI response:', responseText);
      return NextResponse.json({
        species: 'OTHER',
        colors: [],
        size: '',
        confidence: 0,
        isIndoor: null,
      });
    }

    // Normalize/clamp untrusted model output to our Prisma enums before returning.
    return NextResponse.json({
      species: normalizeSpecies(analysis.species),
      colors: normalizeColors(analysis.colors),
      size: normalizeSize(analysis.size),
      confidence: normalizeConfidence(analysis.confidence),
      isIndoor: normalizeIsIndoor(analysis.isIndoor),
    });
  } catch (error) {
    console.error('Pet analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
