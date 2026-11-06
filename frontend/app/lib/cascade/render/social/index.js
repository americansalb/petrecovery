/**
 * generateSocialCard(caseData, kind, shared) -> { buffer, width, height }
 *
 * satori (JSX -> SVG) + @resvg/resvg-js (SVG -> PNG). Both are dynamic-imported
 * inside the fn so webpack never tries to bundle the resvg native `.node`
 * (which it can't parse). Node runtime only. Callers isolate a resvg load
 * failure and simply omit the social asset - the flyers (pure JS) still work.
 *
 * The photo is cut to its frame's shape around the pet first (render/photo.js,
 * SOCIAL_FRAMES in ../flyers/plan.js): satori has no object-position.
 */

import { normalizeFlyerData } from '../flyers/normalize';
import { planSocial, printInner } from '../flyers/plan';
import { cropPhoto, getSharp } from '../photo';
import { groundOverlayDataUrl } from '../ground';

const JPEG_QUALITY = 86;
// The link preview is drawn at one and a half times the board (1800 by 945),
// so it stays crisp where a messenger shows it large. The square and the
// story stay at the board's size: Instagram serves them at 1080 wide
// whatever is uploaded. The raster is the ceiling: on the production
// instance a 4.7-megapixel draw (the square at twice, the story at one and
// a half) ran it out of memory mid-redraw on 2026-11-06 and the server
// restarted; 2.1 megapixels (the story at its size) has always drawn.
const SCALE = { og: 1.5, square: 1, story: 1 };

export const SOCIAL_SIZES = {
  SOCIAL_OG: { size: 'og', width: 1200, height: 630, label: 'Link preview (1200×630)' },
  SOCIAL_SQUARE: { size: 'square', width: 1080, height: 1080, label: 'Instagram square (1080×1080)' },
  SOCIAL_STORY: { size: 'story', width: 1080, height: 1920, label: 'Instagram story (1080×1920)' },
};

/**
 * @param {object} caseData Case row (+ pet)
 * @param {'SOCIAL_OG'|'SOCIAL_SQUARE'|'SOCIAL_STORY'} kind
 * @param {{photos?:Array, photoDataUrl?:string, qrDataUrl?:string, description?:string}} shared
 * @returns {Promise<{buffer:Buffer, width:number, height:number, mimeType:string, ext:string}>}
 */
export async function generateSocialCard(caseData, kind, shared = {}) {
  const [{ default: satori }, { Resvg }, { SocialCard }, fonts] = await Promise.all([
    import('satori'),
    import('@resvg/resvg-js'),
    import('./Card.jsx'),
    import('../fonts/index.js'),
  ]);

  const spec = SOCIAL_SIZES[kind] || SOCIAL_SIZES.SOCIAL_OG;
  const scale = SCALE[spec.size] || 2;
  const data = normalizeFlyerData(caseData, shared);
  const photo = data.photos[0] || null;
  const plan = planSocial(spec.size, photo?.aspect, data);
  const frame = plan.frame;
  const inner = printInner(frame.w, frame.h, 1.5);
  const [photoSrc, groundSrc] = await Promise.all([
    photo ? cropPhoto(photo, inner.w / inner.h, { maxW: Math.round(frame.w * scale), focalAt: frame.focalAt }) : null,
    // The ground's rays and stripes, lit from behind the print (../ground.js); drawn once per size.
    groundOverlayDataUrl({ w: spec.width, h: spec.height, cx: frame.x + frame.w / 2, cy: frame.y + frame.h / 2, band: frame.band }),
  ]);

  const svg = await satori(<SocialCard data={data} size={spec.size} photoSrc={photoSrc} groundSrc={groundSrc} plan={plan} />, {
    width: spec.width,
    height: spec.height,
    fonts: fonts.SATORI_FONTS,
  });

  // resvg-js 2.6 ignores fitTo once font buffers are given, so the SVG's own
  // size is doubled instead; its viewBox stays, and everything scales with it.
  const scaled = svg.replace(/^<svg width="(\d+)" height="(\d+)"/, (m, w, h) => `<svg width="${Math.round(Number(w) * scale)}" height="${Math.round(Number(h) * scale)}"`);
  const resvg = new Resvg(scaled, {
    fitTo: { mode: 'original' },
    font: fonts.RESVG_FONT,
  });
  const png = resvg.render().asPng();

  // A photo on a grained sheet is a JPEG's job: the same image is a fifth
  // of the PNG, and a link preview loads in a moment on a phone. PNG only
  // when sharp is not there to convert.
  const sharp = await getSharp();
  if (sharp) {
    try {
      const jpeg = await sharp(png).jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true }).toBuffer();
      return { buffer: jpeg, width: Math.round(spec.width * scale), height: Math.round(spec.height * scale), mimeType: 'image/jpeg', ext: 'jpg' };
    } catch {
      /* the PNG below */
    }
  }
  return { buffer: png, width: Math.round(spec.width * scale), height: Math.round(spec.height * scale), mimeType: 'image/png', ext: 'png' };
}
