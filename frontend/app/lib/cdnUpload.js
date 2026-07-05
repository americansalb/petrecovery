/**
 * cdnUpload — programmatic Bunny.net upload for server-generated binaries.
 *
 * The public /api/upload route is image-only (magic-byte + filename regex) and
 * can't carry a generated PDF or PNG. This helper extracts just the Bunny PUT
 * so the cascade can store flyers (application/pdf) and social cards (image/png)
 * under a deterministic key. Deterministic keys mean a re-run PUTs over the same
 * object — the CDN url is stable and idempotent, matching CaseAsset's
 * @@unique([caseId, kind]) contract.
 *
 * Node runtime only (uses Buffer + fetch to the storage host). Never import
 * from an edge route.
 */

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
  if (!isCdnConfigured()) {
    throw new Error('CDN_NOT_CONFIGURED');
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('CDN_EMPTY_BUFFER');
  }

  const rawKey = key || [keyPrefix, filename].filter(Boolean).join('/');
  const cleanKey = safeKey(rawKey);
  if (!cleanKey) {
    throw new Error('CDN_INVALID_KEY');
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
    url: `${BUNNY_CDN_URL}/${cleanKey}`,
    key: cleanKey,
    sizeBytes: buffer.length,
  };
}
