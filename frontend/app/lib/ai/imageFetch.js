/**
 * Shared safe image fetching for AI vision calls.
 *
 * Extracted from api/ai/analyze-pet (whose behavior is pinned by
 * __tests__/api/analyze-pet.test.js): SSRF host allowlist, https only,
 * no redirects, media-type check, streamed read with a hard byte
 * ceiling, and an AbortController timeout that stays armed through the
 * body read so a stalled stream also aborts.
 */

// Anthropic accepts only these image media types.
export const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// Anthropic caps images at ~5MB; keep our own ceiling at 8MB before that.
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_FETCH_TIMEOUT_MS = 8000;

/**
 * Build the allowlist of hosts we will fetch images from.
 * Primary source is BUNNY_CDN_URL (where /api/upload stores photos). An
 * optional comma-separated AI_IMAGE_HOST_ALLOWLIST env can add hosts
 * (e.g. local dev storage). Fail closed: if nothing is configured we
 * reject all URLs rather than allow SSRF.
 */
export function getAllowedImageHosts() {
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
export function validateImageUrl(imageUrl) {
  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;

  const allowed = getAllowedImageHosts();
  if (allowed.size === 0) return null; // fail closed, not configured
  if (!allowed.has(parsed.host.toLowerCase())) return null;

  return parsed;
}

/**
 * Fetch a validated image URL with all the guards.
 * Returns { base64, mediaType } on success, or { error } where error is
 * 'fetch' | 'type' | 'size' so callers can map to their own responses.
 */
export async function fetchImageAsBase64(validatedUrl, {
  timeoutMs = IMAGE_FETCH_TIMEOUT_MS,
  maxBytes = MAX_IMAGE_BYTES,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response;
    try {
      // redirect: 'error' prevents a redirect on the allowlisted CDN host
      // from bouncing the fetch to an internal/arbitrary URL.
      response = await fetch(validatedUrl, {
        signal: controller.signal,
        redirect: 'error',
      });
    } catch {
      return { error: 'fetch' };
    }

    if (!response.ok) return { error: 'fetch' };

    const mediaType = (response.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) return { error: 'type' };

    // Reject oversized images up front via Content-Length when present.
    const declaredLength = parseInt(response.headers.get('content-length') || '', 10);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return { error: 'size' };
    }

    // Stream the body with a hard running byte ceiling, so an absent or
    // lying Content-Length (chunked transfer) can't force unbounded buffering.
    const reader = response.body?.getReader();
    if (!reader) return { error: 'fetch' };
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        return { error: 'size' };
      }
      chunks.push(Buffer.from(value));
    }
    return { base64: Buffer.concat(chunks).toString('base64'), mediaType };
  } catch {
    return { error: 'fetch' };
  } finally {
    clearTimeout(timer);
  }
}
