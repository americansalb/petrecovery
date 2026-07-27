/**
 * generateSocialCard(caseData, kind, shared) -> { buffer, width, height }
 *
 * satori (JSX -> SVG) + @resvg/resvg-js (SVG -> PNG). Both are dynamic-imported
 * inside the fn so webpack never tries to bundle the resvg native `.node`
 * (which it can't parse). Node runtime only. Callers isolate a resvg load
 * failure and simply omit the social asset - the flyers (pure JS) still work.
 */

import { normalizeFlyerData } from '../flyers/normalize';

export const SOCIAL_SIZES = {
  SOCIAL_OG: { size: 'og', width: 1200, height: 630, label: 'Link preview (1200×630)' },
  SOCIAL_SQUARE: { size: 'square', width: 1080, height: 1080, label: 'Instagram square (1080×1080)' },
  SOCIAL_STORY: { size: 'story', width: 1080, height: 1920, label: 'Instagram story (1080×1920)' },
};

/**
 * @param {object} caseData Case row
 * @param {'SOCIAL_OG'|'SOCIAL_SQUARE'|'SOCIAL_STORY'} kind
 * @param {{photoDataUrl?:string, qrDataUrl?:string, description?:string}} shared
 * @returns {Promise<{buffer:Buffer, width:number, height:number}>}
 */
export async function generateSocialCard(caseData, kind, shared = {}) {
  const [{ default: satori }, { Resvg }, { SocialCard }, fonts] = await Promise.all([
    import('satori'),
    import('@resvg/resvg-js'),
    import('./Card.jsx'),
    import('../fonts/index.js'),
  ]);

  const spec = SOCIAL_SIZES[kind] || SOCIAL_SIZES.SOCIAL_OG;
  const norm = normalizeFlyerData(caseData, shared);
  const data = { ...norm, chips: norm.chips.join('  •  ') };

  const svg = await satori(<SocialCard data={data} size={spec.size} />, {
    width: spec.width,
    height: spec.height,
    fonts: fonts.SATORI_FONTS,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: spec.width },
    font: fonts.RESVG_FONT,
  });
  const png = resvg.render().asPng();

  return { buffer: png, width: spec.width, height: spec.height };
}
