/**
 * Flyers action — renders the 3 print PDFs and stores them on the CDN.
 * Each variant is isolated: one failed variant doesn't sink the others. The
 * step SUCCEEDS if at least one flyer stored, else FAILS.
 */

import { generateFlyerPdf, FLYER_VARIANTS } from '../render/flyers/index.js';
import { uploadBufferToCdn } from '@/app/lib/cdnUpload';

export async function runFlyers(ctx) {
  const shared = await ctx.getShared();
  const flyerShared = {
    qrDataUrl: shared.qrDataUrl,
    photoDataUrls: shared.photoDataUrls,
    photoDataUrl: shared.photoDataUrl,
    headline: ctx.results.ai_copy?.headline,
    plea: ctx.results.ai_copy?.plea,
    description: ctx.results.ai_copy?.description,
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
      });
      ready += 1;
    } catch (err) {
      await ctx.upsertAsset(kind, { status: 'failed', error: String(err.message || err) });
    }
  }

  if (ready === 0) throw new Error('No flyer could be stored (all variants failed)');
  return { count: ready, result: { ready } };
}
