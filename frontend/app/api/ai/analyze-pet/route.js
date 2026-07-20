import { NextResponse } from 'next/server';
import { withRateLimitAsync, checkGlobalLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';
import { validateImageUrl, fetchImageAsBase64 } from '@/app/lib/ai/imageFetch';

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

// Image guards (SSRF allowlist, size/type caps, timeouts) live in the
// shared lib app/lib/ai/imageFetch.js, also used by comparePetPhotos.
const ANTHROPIC_TIMEOUT_MS = 20000;

// Hard global ceiling on paid Anthropic calls per minute, across ALL callers.
// Circuit-breaker for total spend; defends cost even if the per-IP limit is
// evaded via IP rotation / spoofed x-forwarded-for. Tune via env.
const GLOBAL_MAX_PER_MIN = parseInt(process.env.AI_ANALYZE_GLOBAL_MAX_PER_MIN || '100', 10);

// Prisma enums (frontend/prisma/schema.prisma).
const SPECIES_ENUM = new Set(['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER']);
const SIZE_ENUM = new Set(['TINY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT']);

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

    // Fetch the image through the shared guards (timeout + size + media type).
    const fetched = await fetchImageAsBase64(validatedUrl);
    if (fetched.error === 'type') {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
    }
    if (fetched.error === 'size') {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }
    if (fetched.error) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 400 });
    }
    const base64Image = fetched.base64;
    const imageMediaType = fetched.mediaType;

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
