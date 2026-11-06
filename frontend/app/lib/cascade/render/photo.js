/**
 * Pet photos for the flyers and the share images.
 *
 * `loadPetPhoto` fetches a photo once and returns it as a JPEG data URL with
 * its size and its focal point: where sharp's attention crop finds the most
 * detail, which on a pet photo is the pet. `cropPhoto` cuts the photo to the
 * shape a frame needs, around that point (app/lib/cascade/render/flyers/plan.js
 * `cropRect`), so a photo always fills its frame and the pet stays in it.
 *
 * satori cannot fetch remote images and neither renderer decodes WebP, GIF
 * or HEIC or honors EXIF orientation, so every photo goes through sharp:
 * auto-rotated, capped at 1600 px, re-encoded as JPEG. Without sharp only
 * JPEG and PNG pass through, uncropped, with a centered focal point.
 *
 * Returns null on any failure. Node runtime.
 */

import { cropRect } from './flyers/plan';

const MAX_BYTES = 12 * 1024 * 1024;
// 1600 px across is 213 dpi on a Letter sheet's 7.5 in frame: a sharp print.
// The share images need no more than their own width (SOCIAL_FRAMES). Every
// pixel here is paid for four times over: the JPEG buffer, its base64 data
// URL on the heap, the SVG satori builds around it, and the bitmap resvg
// draws, and the server's memory is small (see refresh.js on pacing).
const PHOTO_MAX = 1600;
const CROP_MAX_W = 1600;
const JPEG_QUALITY = 84;

let sharpPromise = null;
export function getSharp() {
  if (!sharpPromise) {
    sharpPromise = import('sharp')
      .then((m) => {
        const sharp = m.default;
        // libvips keeps recent operations in memory for reuse; nothing here is
        // ever reused, and that cache (50 MB by default) counts against the
        // instance, not the heap.
        try {
          sharp.cache(false);
          sharp.concurrency(1);
        } catch {
          /* older sharp */
        }
        return sharp;
      })
      .catch(() => null);
  }
  return sharpPromise;
}

function dataUrl(buf, type = 'image/jpeg') {
  return `data:${type};base64,${buf.toString('base64')}`;
}

function bufferOf(src) {
  const m = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(src || '');
  return m ? Buffer.from(m[1], 'base64') : null;
}

/**
 * Where the pet is: the center of the square sharp's attention strategy
 * keeps, as fractions of the photo's width and height.
 */
async function findFocal(sharp, buf, w, h) {
  try {
    const s = Math.min(w, h);
    if (s === w && s === h) return { x: 0.5, y: 0.5 };
    const { info } = await sharp(buf)
      .resize({ width: s, height: s, fit: 'cover', position: sharp.strategy.attention })
      .toBuffer({ resolveWithObject: true });
    const left = Math.abs(info.cropOffsetLeft || 0);
    const top = Math.abs(info.cropOffsetTop || 0);
    return { x: w > h ? (left + s / 2) / w : 0.5, y: h > w ? (top + s / 2) / h : 0.5 };
  } catch {
    return { x: 0.5, y: 0.45 };
  }
}

/** A photo from its bytes: rotated, capped, JPEG, with its size and focal point. */
export async function photoFromBuffer(raw, contentType = 'image/jpeg') {
  if (!raw || raw.length === 0 || raw.length > MAX_BYTES) return null;
  const sharp = await getSharp();
  if (sharp) {
    try {
      const { data, info } = await sharp(raw)
        .rotate()
        .resize({ width: PHOTO_MAX, height: PHOTO_MAX, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer({ resolveWithObject: true });
      const focal = await findFocal(sharp, data, info.width, info.height);
      return { dataUrl: dataUrl(data), w: info.width, h: info.height, aspect: info.width / info.height, focal };
    } catch {
      /* fall through to the passthrough path */
    }
  }
  if (contentType !== 'image/jpeg' && contentType !== 'image/png') return null;
  return { dataUrl: dataUrl(raw, contentType), w: 0, h: 0, aspect: null, focal: { x: 0.5, y: 0.45 } };
}

/** @returns {Promise<null | {dataUrl:string, w:number, h:number, aspect:number, focal:{x:number,y:number}}>} */
export async function loadPetPhoto(url) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!contentType.startsWith('image/')) return null;
    return await photoFromBuffer(Buffer.from(await res.arrayBuffer()), contentType);
  } catch {
    return null;
  }
}

/** The old shape, for callers that only want the data URL. */
export async function loadPetImageDataUrl(url) {
  const photo = await loadPetPhoto(url);
  return photo ? photo.dataUrl : null;
}

const cropCache = new WeakMap();

/**
 * The photo cut to `aspect` (width over height) around its focal point,
 * which sits `focalAt` of the way down the frame, as a data URL no wider
 * than `maxW` (the frame's own width, for a share image). The photo itself when it already has that shape and fits, or
 * when sharp is not there. Cached per photo, shape and width.
 */
export async function cropPhoto(photo, aspect, { maxW = CROP_MAX_W, focalAt = 0.5 } = {}) {
  if (!photo?.dataUrl) return null;
  const rect = cropRect(photo.w, photo.h, photo.focal, aspect, focalAt) || { left: 0, top: 0, width: photo.w, height: photo.h };
  if (rect.width === photo.w && rect.height === photo.h && !(photo.w > maxW)) return photo.dataUrl;
  const key = `${aspect.toFixed(3)}@${maxW}@${focalAt}`;
  let byAspect = cropCache.get(photo);
  if (!byAspect) {
    byAspect = new Map();
    cropCache.set(photo, byAspect);
  }
  if (byAspect.has(key)) return byAspect.get(key);
  const sharp = await getSharp();
  const buf = bufferOf(photo.dataUrl);
  if (!sharp || !buf) return photo.dataUrl;
  try {
    const out = await sharp(buf)
      .extract(rect)
      .resize({ width: Math.min(rect.width, maxW), withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    const url = dataUrl(out);
    byAspect.set(key, url);
    return url;
  } catch {
    return photo.dataUrl;
  }
}
