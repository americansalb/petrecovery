/**
 * POST /api/reports/[id]/redraw
 *
 * Draw a lost report's flyer and share images again, when the first try
 * did not make them. The page after posting used to say "The flyer is on
 * the page when it is ready" when the drawing had failed, with nothing
 * coming and no way to try again; now it says it did not draw and offers
 * this.
 *
 * For the owner only: the details token from the create response
 * (app/lib/detailsToken.js, the success screen has it), a session that
 * filed the report, or the key to it this browser holds. Once in ten
 * minutes for a report, and only while a flyer or share image is missing:
 * one redraw costs what filing a report costs (app/lib/cascade/refresh.js).
 * It never sends anything to anyone.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { verifyDetailsToken, DETAILS_TOKEN_HEADER } from '@/app/lib/detailsToken';
import { holdsOwnerKey } from '@/app/lib/ownerKey';
import { checkRateLimitForKeyAsync, rateLimitResponse } from '@/app/lib/rateLimit';
import { scheduleKitRedraw } from '@/app/lib/cascade/redrawLater';

export const dynamic = 'force-dynamic';

const ONCE_IN_TEN_MINUTES = { windowMs: 10 * 60 * 1000, maxRequests: 1, blockDurationMs: 10 * 60 * 1000 };
/** The pieces the page after posting shows. One of them missing is a reason to draw again. */
const KIT_KINDS = ['FLYER_LETTER', 'SOCIAL_SQUARE'];

export async function POST(request, { params }) {
  const id = (await params)?.id;
  const c = id
    ? await prisma.case
        .findUnique({ where: { id: String(id) }, select: { id: true, reportType: true, reporterId: true, resolvedAt: true, ownerKeyHash: true, ownerKeyAt: true } })
        .catch(() => null)
    : null;
  if (!c || c.reportType !== 'LOST') return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  const session = await getServerSession(authOptions).catch(() => null);
  const owner =
    verifyDetailsToken(request.headers.get(DETAILS_TOKEN_HEADER), c.id) ||
    (session?.user?.id && session.user.id === c.reporterId) ||
    holdsOwnerKey(request, c);
  if (!owner) return NextResponse.json({ error: 'Only the owner can do this.' }, { status: 403 });
  if (c.resolvedAt) return NextResponse.json({ error: 'This search is closed.', code: 'CLOSED' }, { status: 409 });

  const ready = await prisma.caseAsset
    .findMany({ where: { caseId: c.id, kind: { in: KIT_KINDS }, status: 'ready' }, select: { kind: true } })
    .catch(() => []);
  if (KIT_KINDS.every((kind) => ready.some((a) => a.kind === kind))) {
    return NextResponse.json({ started: false, code: 'ALREADY_DRAWN' });
  }

  const limit = await checkRateLimitForKeyAsync(`reports:redraw:${c.id}`, ONCE_IN_TEN_MINUTES);
  if (!limit.success) return rateLimitResponse(limit);

  // Now, or as soon as a first drawing still going has finished (app/lib/cascade/redrawLater.js).
  scheduleKitRedraw(c.id, { delayMs: 0 });
  return NextResponse.json({ started: true }, { status: 202 });
}
