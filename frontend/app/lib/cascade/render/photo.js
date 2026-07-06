/**
 * Load a pet photo once, as a data URL, for embedding into both the react-pdf
 * flyers (<Image src>) and the satori social cards (<img src>). satori cannot
 * fetch remote images, so a data URL is required; fetching once and sharing it
 * (via the cascade's getShared cache) avoids re-downloading per asset.
 *
 * Returns null on any failure (missing url, network/proxy block, non-image) —
 * templates render a branded species block instead. Node runtime.
 */

const MAX_BYTES = 8 * 1024 * 1024;

export async function loadPetImageDataUrl(url) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!contentType.startsWith('image/')) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;

    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
