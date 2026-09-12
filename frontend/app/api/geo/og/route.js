/**
 * GET /api/geo/og?s=<share code>
 *
 * The 1200x630 link-preview image for a shared game, rendered from the
 * share code alone (no database): satori for layout, resvg for the PNG,
 * the same pipeline and bundled fonts as the lost-pet social cards.
 * Anything unrenderable falls back to the site logo so a preview always
 * shows something.
 */

import { decodeShare, summaryHeadline, averageMissKm } from '@/app/lib/geo/share';
import { describeConfig } from '@/app/lib/geo/modes';
import { formatDistance } from '@/app/lib/geo/distance';
import { FALLBACK_SHARE_IMAGE, GAME_NAME } from '@/app/lib/geo/meta';
import { geoMetadataBase } from '@/app/lib/geo/server/siteBase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Response.redirect throws on anything that is not an absolute URL, and
 * both graceful exits here redirect to the fallback card. A relative
 * NEXT_PUBLIC_GEO_SHARE_IMAGE is a reasonable thing to set - every
 * other share surface resolves relative images through metadataBase -
 * and it turned both of this route's fallbacks into a 500.
 */
/**
 * The host line on the card: wherever this request was served from, so
 * a preview from the game's own domain points back at it.
 */
function cardSite(request) {
  try {
    const url = geoMetadataBase();
    return `${url.host}${url.host.includes('reunitepets') ? '/geo' : ''}`;
  } catch {
    try {
      return new URL(request.url).host;
    } catch {
      return '';
    }
  }
}

function fallbackCard(request) {
  try {
    const base = (() => {
      try {
        return geoMetadataBase();
      } catch {
        return new URL(request.url);
      }
    })();
    return Response.redirect(new URL(FALLBACK_SHARE_IMAGE, base).toString(), 302);
  } catch (error) {
    console.error('[geo/og] fallback image is not resolvable', error?.message || error);
    return new Response('', { status: 204 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const summary = decodeShare(searchParams.get('s') || '');
  if (!summary) return fallbackCard(request);

  try {
    const [{ default: satori }, { Resvg }, { ShareCard }, fonts, { countryByCode }] = await Promise.all([
      import('satori'),
      import('@resvg/resvg-js'),
      import('@/app/lib/geo/server/ShareCard.jsx'),
      import('@/app/lib/geo/server/fonts/index.js'),
      import('@/app/lib/geo/server/countries'),
    ]);

    const regionLabel = summary.config.mode === 'country' ? countryByCode(summary.config.region)?.name : undefined;
    const avg = averageMissKm(summary);
    const subline =
      summary.config.mode === 'streak'
        ? `${summary.rounds.length} countries named before the first miss`
        : avg !== null
          ? `${summary.rounds.length} rounds, average miss ${formatDistance(avg)}`
          : `${summary.rounds.length} rounds`;
    const footer = [describeConfig(summary.config, { regionLabel }).replace(/\.$/, ''), summary.date].filter(Boolean).join('  ·  ');

    const svg = await satori(
      <ShareCard
        headline={summaryHeadline(summary)}
        subline={subline}
        rounds={summary.rounds}
        footer={footer}
        mode={summary.config.mode}
        wordmark={GAME_NAME}
        site={cardSite(request)}
      />,
      { width: WIDTH, height: HEIGHT, fonts: fonts.SATORI_FONTS.filter((f) => f.name === 'Inter') }
    );
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH }, font: fonts.RESVG_FONT }).render().asPng();

    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(png.length),
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('[geo/og] render failed', error?.message || error);
    return fallbackCard(request);
  }
}
