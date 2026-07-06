/**
 * QR action — warms the shared render inputs (QR data URL + pet photo) that
 * flyers/social embed, and stores a standalone downloadable QR PNG.
 *
 * The critical output is the QR data URL in getShared (pure local generation,
 * can't fail). The standalone CaseAsset upload is best-effort — if it fails,
 * the step still SUCCEEDS so flyers/social (which only need the data URL) run.
 */

import { qrPngBuffer } from '../render/qr.js';
import { uploadBufferToCdn } from '@/app/lib/cdnUpload';

export async function runQr(ctx) {
  const shared = await ctx.getShared(); // generates qrDataUrl + fetches photo(s)

  // standalone downloadable QR asset (best-effort)
  try {
    const buf = await qrPngBuffer(shared.caseUrl, { size: 640 });
    const { url, sizeBytes } = await uploadBufferToCdn(buf, {
      key: `cases/${ctx.case.id}/qr.png`,
      contentType: 'image/png',
    });
    await ctx.upsertAsset('QR', {
      status: 'ready',
      url,
      mimeType: 'image/png',
      label: 'QR code',
      width: 640,
      height: 640,
      sizeBytes,
    });
  } catch (err) {
    await ctx.upsertAsset('QR', { status: 'failed', error: String(err.message || err) });
  }

  return { result: { caseUrl: shared.caseUrl, photoEmbedded: Boolean(shared.photoDataUrl) } };
}
