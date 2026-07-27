/**
 * Real QR codes for flyers + social cards - replaces the fake `'QR'` text
 * placeholder in the legacy flyerGenerator. Node runtime.
 */

import QRCode from 'qrcode';
import { getBaseUrl } from '@/app/lib/config';

/** Canonical public case URL a scanned QR should open. */
export function caseUrl(caseNumber) {
  return `${getBaseUrl()}/cases/${caseNumber}`;
}

/**
 * PNG data URL for embedding in react-pdf <Image src> and satori <img>.
 * High error-correction (H) so the code still scans when printed small or
 * partially smudged on a flyer.
 */
export async function qrDataUrl(url, { size = 512 } = {}) {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: size,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

/** Raw PNG buffer (for storing the QR as its own CaseAsset). */
export async function qrPngBuffer(url, { size = 512 } = {}) {
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: size,
    type: 'png',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}
