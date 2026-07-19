/**
 * Flyers action — renders the 3 print PDFs and stores them on the CDN.
 * Each variant is isolated: one failed variant doesn't sink the others. The
 * step SUCCEEDS if at least one flyer stored, else FAILS.
 */

import { generateFlyerPdf, FLYER_VARIANTS } from '../render/flyers/index.js';
import { buildFlyerMapSpec, zoomForSpecies } from '../render/staticMap.js';
import { uploadBufferToCdn } from '@/app/lib/cdnUpload';

export async function runFlyers(ctx) {
  const shared = await ctx.getShared();

  // Last-seen map with a pinned location: one spec at the largest size any
  // variant needs; smaller variants crop it centered. Voyager tiles + z15
  // match the poster design system. Best-effort only.
  const map = await buildFlyerMapSpec(ctx.case.lastSeenLatitude, ctx.case.lastSeenLongitude, {
    width: 680,
    height: 220,
    zoom: 15,
    style: 'voyager',
  }).catch(() => null);

  const flyerShared = {
    qrDataUrl: shared.qrDataUrl,
    photoDataUrls: shared.photoDataUrls,
    photoDataUrl: shared.photoDataUrl,
    headline: ctx.results.ai_copy?.headline,
    plea: ctx.results.ai_copy?.plea,
    description: ctx.results.ai_copy?.description,
    map,
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
