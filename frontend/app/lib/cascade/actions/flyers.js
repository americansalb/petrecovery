/**
 * Flyers action - renders the 3 print PDFs and stores them on the CDN.
 * Each variant is isolated: one failed variant doesn't sink the others. The
 * step SUCCEEDS if at least one flyer stored, else FAILS.
 */

import { generateFlyerPdf, FLYER_VARIANTS } from '../render/flyers/index.js';
import { RENDERER_VERSION } from '../render/version';
import { uploadBufferToCdn } from '@/app/lib/cdnUpload';

// Which renderer drew the row. refresh.js redraws cases whose stamp is older.
const stamp = { rendererVersion: RENDERER_VERSION };

export async function runFlyers(ctx) {
  const shared = await ctx.getShared();

  const flyerShared = {
    qrDataUrl: shared.qrDataUrl,
    photos: shared.photos,
    photoDataUrls: shared.photoDataUrls,
    photoDataUrl: shared.photoDataUrl,
    headline: ctx.results.ai_copy?.headline,
    plea: ctx.results.ai_copy?.plea,
    description: ctx.results.ai_copy?.description,
    map: shared.map,
  };

  let ready = 0;
  for (const [kind, spec] of Object.entries(FLYER_VARIANTS)) {
    try {
      const buf = await generateFlyerPdf(ctx.case, kind, flyerShared);
      const { url, sizeBytes } = await uploadBufferToCdn(buf, {
        key: `cases/${ctx.case.id}/${kind.toLowerCase()}.pdf`,
        contentType: 'application/pdf',
      });
      await ctx.upsertAsset(kind, {
        status: 'ready',
        url,
        mimeType: 'application/pdf',
        label: spec.label,
        sizeBytes,
        meta: stamp,
      });
      ready += 1;
    } catch (err) {
      // Loud: the asset row keeps the error, but the host's log is where
      // anyone looks when every flyer of every pet is failing.
      console.error(`[cascade.flyers] ${kind} failed for ${ctx.case.caseNumber}:`, err?.message || err);
      await ctx.upsertAsset(kind, { status: 'failed', error: String(err.message || err), meta: stamp });
    }
  }

  if (ready === 0) throw new Error('No flyer could be stored (all variants failed)');
  return { count: ready, result: { ready } };
}
