/**
 * generateFlyerPdf(caseData, kind, shared) -> Buffer
 *
 * Pure-JS print PDF via @react-pdf/renderer (no browser). react-pdf is
 * dynamic-imported inside the fn so it never lands in another module's webpack
 * trace and to keep cold start light. Node runtime only.
 *
 * The layout is planned first (./plan.js) so the photo can be cut to the
 * exact shape of its frame around the pet (render/photo.js) before the PDF is
 * drawn: the frame is never matted and never a void.
 *
 * The JSX here and in Flyer.jsx is compiled against `h` from ./pdfReact, the
 * React react-pdf itself loads; see that file for why.
 */

/** @jsxRuntime classic */
/** @jsx h */
import { h } from './pdfReact';
import { registerFlyerFonts } from './registerFonts';
import { normalizeFlyerData } from './normalize';
import { cropPhoto } from '../photo';

export { normalizeFlyerData } from './normalize';

export const FLYER_VARIANTS = {
  FLYER_LETTER: { variant: 'letter', label: 'Flyer with tear-off tabs (Letter)' },
  FLYER_HALF: { variant: 'half', label: 'Two half sheets (Letter)' },
  FLYER_POSTER: { variant: 'poster', label: 'Poster (11×17)' },
};

/**
 * @param {object} caseData a Case row (+ pet, + optional reward/contact overrides)
 * @param {'FLYER_LETTER'|'FLYER_HALF'|'FLYER_POSTER'} kind
 * @param {{photos?:Array, photoDataUrl?:string, qrDataUrl?:string, map?:object}} shared
 * @returns {Promise<Buffer>}
 */
export async function generateFlyerPdf(caseData, kind, shared = {}) {
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const { FlyerDocument, planFor } = await import('./Flyer.jsx');
  registerFlyerFonts();
  const spec = FLYER_VARIANTS[kind] || FLYER_VARIANTS.FLYER_LETTER;
  const data = normalizeFlyerData(caseData, shared);
  const plan = planFor(spec.variant, data);
  const photo = data.photos[0] || null;
  const photoSrc = photo && plan.frameAspect ? await cropPhoto(photo, plan.frameAspect) : photo?.src || null;
  return renderToBuffer(<FlyerDocument data={data} variant={spec.variant} plan={plan} photoSrc={photoSrc} />);
}
