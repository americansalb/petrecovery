/**
 * cdnUpload - programmatic Bunny.net upload for server-generated binaries.
 *
 * The public /api/upload route is image-only (magic-byte + filename regex) and
 * can't carry a generated PDF or PNG. This helper extracts just the Bunny PUT
 * so the cascade can store flyers (application/pdf) and social cards (image/png)
 * under a deterministic key. Deterministic keys mean a re-run PUTs over the same
 * object - the CDN url is stable and idempotent, matching CaseAsset's
 * @@unique([caseId, kind]) contract.
 *
 * The returned URL carries `?v=<hash of the bytes>`. Bunny keys its cache
 * on the whole URL, query string included, and caches for thirty days, so
 * without it a redrawn flyer at the same key would stay hidden behind the
 * old copy at the edge (the kits redrawn on 2026-11-05 would have shown
 * the old design for a month). Same bytes, same URL; new bytes, new URL.
 * The storage key itself never changes.
 *
 * Node runtime only (uses Buffer + fetch to the storage host). Never import
 * from an edge route.
 */

import { createHash } from 'node:crypto';

/** Eight hex characters of the content's SHA-1: the `v` the URL carries. */
export function contentVersion(buffer) {
  return createHash('sha1').update(buffer).digest('hex').slice(0, 8);
}

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_STORAGE_URL = process.env.BUNNY_STORAGE_URL || 'https://storage.bunnycdn.com';

let BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;
if (BUNNY_CDN_URL && !BUNNY_CDN_URL.startsWith('http')) {
  BUNNY_CDN_URL = `https://${BUNNY_CDN_URL}`;
}

export function isCdnConfigured() {
  return Boolean(BUNNY_STORAGE_ZONE && BUNNY_API_KEY && BUNNY_CDN_URL);
}

/**
 * Sanitize a storage key: keep only safe path characters, collapse any traversal
 * (`..`, leading slashes), and never let caller input escape the prefix.
 */
function safeKey(key) {
  return String(key)
    .replace(/\\/g, '/')
    .split('/')
    .map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, ''))
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/');
}

/**
 * Upload a Buffer to Bunny storage and return its CDN url.
 *
 * @param {Buffer} buffer
 * @param {object} opts
 * @param {string} opts.key   full storage key, e.g. `cases/<caseId>/flyer-letter.pdf`
 *                            (mutually exclusive with keyPrefix+filename)
 * @param {string} [opts.keyPrefix]  e.g. `cases/<caseId>`
 * @param {string} [opts.filename]   e.g. `flyer-letter.pdf`
 * @param {string} opts.contentType  e.g. `application/pdf` | `image/png`
 * @returns {Promise<{ url: string, key: string, sizeBytes: number }>}
 * @throws if the CDN is unconfigured or the PUT fails (callers isolate per-asset)
 */
export async function uploadBufferToCdn(buffer, { key, keyPrefix, filename, contentType } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('CDN_EMPTY_BUFFER');
  }

  const rawKey = key || [keyPrefix, filename].filter(Boolean).join('/');
  const cleanKey = safeKey(rawKey);
  if (!cleanKey) {
    throw new Error('CDN_INVALID_KEY');
  }

  // Local dev fallback: when Bunny isn't configured but CASCADE_LOCAL_CDN is set,
  // write to public/_localcdn/<key> and return an app-served URL. Gated by env so
  // it never runs in production. Lets the full cascade be verified without creds.
  if (!isCdnConfigured() && process.env.CASCADE_LOCAL_CDN) {
    const { writeFile, mkdir } = await import('node:fs/promises');
    const { join, dirname } = await import('node:path');
    const { getBaseUrl } = await import('@/app/lib/config');
    const dest = join(process.cwd(), 'public', '_localcdn', cleanKey);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
    return { url: `${getBaseUrl()}/_localcdn/${cleanKey}?v=${contentVersion(buffer)}`, key: cleanKey, sizeBytes: buffer.length };
  }

  if (!isCdnConfigured()) {
    throw new Error('CDN_NOT_CONFIGURED');
  }

  const uploadUrl = `${BUNNY_STORAGE_URL}/${BUNNY_STORAGE_ZONE}/${cleanKey}`;
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      AccessKey: BUNNY_API_KEY,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: buffer,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`CDN_UPLOAD_FAILED ${res.status} ${body.slice(0, 200)}`);
  }

  return {
    url: `${BUNNY_CDN_URL}/${cleanKey}?v=${contentVersion(buffer)}`,
    key: cleanKey,
    sizeBytes: buffer.length,
  };
}
