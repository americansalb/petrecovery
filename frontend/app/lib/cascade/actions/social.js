/**
 * Social action - renders the 3 PNG share cards and stores them on the CDN.
 * The SOCIAL_OG asset doubles as the case page's og:image. Each size is
 * isolated; step SUCCEEDS if at least one card stored.
 */

import { generateSocialCard, SOCIAL_SIZES } from '../render/social/index.js';
import { RENDERER_VERSION } from '../render/version';
import { uploadBufferToCdn } from '@/app/lib/cdnUpload';

// Which renderer drew the row. refresh.js redraws cases whose stamp is older.
const stamp = { rendererVersion: RENDERER_VERSION };

/**
 * Free what the last image left behind before the next is drawn. Each
 * image leaves an SVG with the photo in it, a PNG and a JPEG for V8 to
 * collect; drawn three in a row with no collection between, the third
 * ran the production instance out of memory (2026-11-06). scripts/boot.js
 * exposes gc; without it this is a short pause.
 */
export const BETWEEN_IMAGES_MS = Number(process.env.SOCIAL_BETWEEN_IMAGES_MS ?? 300);
export async function freeMemory() {
  if (typeof global.gc === 'function') global.gc();
  if (BETWEEN_IMAGES_MS > 0) await new Promise((r) => setTimeout(r, BETWEEN_IMAGES_MS));
}

export async function runSocial(ctx) {
  const shared = await ctx.getShared();
  const cardShared = {
    qrDataUrl: shared.qrDataUrl,
    photos: shared.photos,
    photoDataUrl: shared.photoDataUrl,
    headline: ctx.results.ai_copy?.headline,
    plea: ctx.results.ai_copy?.plea,
    map: shared.map,
  };

  let ready = 0;
  for (const [kind, spec] of Object.entries(SOCIAL_SIZES)) {
    await freeMemory();
    try {
      const { buffer, width, height, mimeType = 'image/png', ext = 'png' } = await generateSocialCard(ctx.case, kind, cardShared);
      const { url, sizeBytes } = await uploadBufferToCdn(buffer, {
        key: `cases/${ctx.case.id}/${kind.toLowerCase()}.${ext}`,
        contentType: mimeType,
      });
      await ctx.upsertAsset(kind, {
        status: 'ready',
        url,
        mimeType,
        label: spec.label,
        width,
        height,
        sizeBytes,
        meta: stamp,
      });
      ready += 1;
    } catch (err) {
      console.error(`[cascade.social] ${kind} failed for ${ctx.case.caseNumber}:`, err?.message || err);
      await ctx.upsertAsset(kind, { status: 'failed', error: String(err.message || err), meta: stamp });
    }
  }

  if (ready === 0) throw new Error('No social card could be stored (all sizes failed)');
  return { count: ready, result: { ready } };
}
