/**
 * Social action — renders the 3 PNG share cards and stores them on the CDN.
 * The SOCIAL_OG asset doubles as the case page's og:image. Each size is
 * isolated; step SUCCEEDS if at least one card stored.
 */

import { generateSocialCard, SOCIAL_SIZES } from '../render/social/index.js';
import { uploadBufferToCdn } from '@/app/lib/cdnUpload';

export async function runSocial(ctx) {
  const shared = await ctx.getShared();
  const cardShared = {
    qrDataUrl: shared.qrDataUrl,
    photoDataUrl: shared.photoDataUrl,
    headline: ctx.results.ai_copy?.headline,
    plea: ctx.results.ai_copy?.plea,
    map: shared.map,
  };

  let ready = 0;
  for (const [kind, spec] of Object.entries(SOCIAL_SIZES)) {
    try {
      const { buffer, width, height } = await generateSocialCard(ctx.case, kind, cardShared);
      const { url, sizeBytes } = await uploadBufferToCdn(buffer, {
        key: `cases/${ctx.case.id}/${kind.toLowerCase()}.png`,
        contentType: 'image/png',
      });
      await ctx.upsertAsset(kind, {
        status: 'ready',
        url,
        mimeType: 'image/png',
        label: spec.label,
        width,
        height,
        sizeBytes,
      });
      ready += 1;
    } catch (err) {
      await ctx.upsertAsset(kind, { status: 'failed', error: String(err.message || err) });
    }
  }

  if (ready === 0) throw new Error('No social card could be stored (all sizes failed)');
  return { count: ready, result: { ready } };
}
