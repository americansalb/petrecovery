/**
 * generateFlyerPdf(caseData, kind, shared) -> Buffer
 *
 * Pure-JS print PDF via @react-pdf/renderer (no browser). react-pdf is
 * dynamic-imported inside the fn so it never lands in another module's webpack
 * trace and to keep cold start light. Node runtime only.
 */

import { registerFlyerFonts } from './registerFonts';
import { normalizeFlyerData } from './normalize';

export { normalizeFlyerData } from './normalize';

export const FLYER_VARIANTS = {
  FLYER_LETTER: { variant: 'classic', label: 'Classic poster (Letter)' },
  FLYER_HALF: { variant: 'tabs', label: 'Tear-off tabs (Letter)' },
  FLYER_POSTER: { variant: 'poster', label: 'Yard poster (11×17)' },
};

/**
 * @param {object} caseData a Case row (+ optional reward/contact overrides)
 * @param {'FLYER_LETTER'|'FLYER_HALF'|'FLYER_POSTER'} kind
 * @param {{photoDataUrl?:string, qrDataUrl?:string, description?:string}} shared
 * @returns {Promise<Buffer>}
 */
export async function generateFlyerPdf(caseData, kind, shared = {}) {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const { FlyerDocument } = await import('./Flyer.jsx');
  registerFlyerFonts();
  const spec = FLYER_VARIANTS[kind] || FLYER_VARIANTS.FLYER_LETTER;
  const data = normalizeFlyerData(caseData, shared);
  return renderToBuffer(<FlyerDocument data={data} variant={spec.variant} />);
}
