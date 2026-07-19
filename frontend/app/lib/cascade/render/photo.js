/**
 * Load a pet photo once, as a data URL, for embedding into both the react-pdf
 * flyers (<Image src>) and the satori social cards (<img src>). satori cannot
 * fetch remote images, so a data URL is required; fetching once and sharing it
 * (via the cascade's getShared cache) avoids re-downloading per asset.
 *
 * Neither renderer can decode WebP/GIF/HEIC, and neither honors EXIF
 * orientation — so when sharp is available every photo is normalized through
 * it: auto-rotated, capped at 2000px, re-encoded as JPEG. Without sharp,
 * only JPEG/PNG pass through untouched; other formats return null (branded
 * placeholder) instead of silently rendering a blank photo box.
 *
 * Returns null on any failure. Node runtime.
 */

const MAX_BYTES = 12 * 1024 * 1024;

let sharpPromise = null;
function getSharp() {
  if (!sharpPromise) {
    sharpPromise = import('sharp').then((m) => m.default).catch(() => null);
  }
  return sharpPromise;
}

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

    let buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;

    const sharp = await getSharp();
    if (sharp) {
      try {
        buf = await sharp(buf)
          .rotate() // apply EXIF orientation — the renderers ignore it
          .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 88 })
          .toBuffer();
        return `data:image/jpeg;base64,${buf.toString('base64')}`;
      } catch {
        /* fall through to the passthrough path */
      }
    }

    // No sharp: only formats both renderers can actually decode.
    if (contentType !== 'image/jpeg' && contentType !== 'image/png') return null;
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
