/**
 * comparePetPhotos(photoUrlA, photoUrlB) - the first real image-to-image
 * comparison in the app (lib/ai/imageMatching.js and petRecognition.js
 * are mocks; do not use them). Sends both photos to Claude Haiku and
 * asks one question: could these be the same animal?
 *
 * Returns { verdict: 'SAME'|'DIFFERENT'|'UNSURE', confidence: 0..1,
 * reason } or null on ANY failure or unavailability, so callers always
 * degrade to attribute-only matching. Never throws.
 *
 * Cost controls (server-internal call, no per-IP limit applies):
 *  - global per-minute ceiling via checkGlobalLimitAsync, checked
 *    BEFORE the paid call (AI_COMPARE_GLOBAL_MAX_PER_MIN, default 60)
 *  - callers cap how many pairs they compare (see shelterMatching.js)
 *  - results are persisted on ShelterStrayMatch so no pair is ever
 *    scored twice
 */

import { checkGlobalLimitAsync } from '@/app/lib/rateLimit';
import { validateImageUrl, fetchImageAsBase64 } from '@/app/lib/ai/imageFetch';

const ANTHROPIC_TIMEOUT_MS = 20000;
const GLOBAL_MAX_PER_MIN = parseInt(process.env.AI_COMPARE_GLOBAL_MAX_PER_MIN || '60', 10);
const VERDICTS = new Set(['SAME', 'DIFFERENT', 'UNSURE']);

const PROMPT = `These are two photos of pets. Photo 1 is an animal a shelter took in. Photo 2 is from a lost-pet report. Could they be the same animal?

Consider species, breed, coat colors and pattern, markings, ear and tail shape, size cues, and any distinctive features. Lighting, angle, grooming, and weight can differ between photos of the same animal.

Return ONLY valid JSON:
{
  "verdict": "SAME" | "DIFFERENT" | "UNSURE",
  "confidence": 0.0 to 1.0,
  "reason": "one short sentence"
}

Use "SAME" only when markings genuinely correspond. Use "DIFFERENT" only when a clearly visible feature rules it out (wrong species, incompatible coat pattern). Otherwise "UNSURE". Return ONLY the JSON, no other text.`;

export async function comparePetPhotos(photoUrlA, photoUrlB) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return null;

    const urlA = validateImageUrl(photoUrlA);
    const urlB = validateImageUrl(photoUrlB);
    if (!urlA || !urlB) return null;

    const [a, b] = await Promise.all([
      fetchImageAsBase64(urlA),
      fetchImageAsBase64(urlB),
    ]);
    if (a.error || b.error) return null;

    // Global spend ceiling, checked before the paid call.
    const globalLimit = await checkGlobalLimitAsync('ai:compare-pets', {
      windowMs: 60 * 1000,
      maxRequests: GLOBAL_MAX_PER_MIN,
      blockDurationMs: 60 * 1000,
    });
    if (!globalLimit.success) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);
    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: a.mediaType, data: a.base64 } },
                { type: 'image', source: { type: 'base64', media_type: b.mediaType, data: b.base64 } },
                { type: 'text', text: PROMPT },
              ],
            },
          ],
        }),
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      console.error('[compare-pets] Anthropic error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      return null;
    }

    const verdict = typeof parsed.verdict === 'string' ? parsed.verdict.trim().toUpperCase() : '';
    if (!VERDICTS.has(verdict)) return null;
    const conf = typeof parsed.confidence === 'number' ? parsed.confidence : parseFloat(parsed.confidence);
    return {
      verdict,
      confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0,
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : '',
    };
  } catch (err) {
    console.error('[compare-pets] failed:', err?.message);
    return null;
  }
}
