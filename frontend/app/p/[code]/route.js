import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getBaseUrl } from '@/app/lib/config';
import { isShortCode } from '@/app/lib/caseShortLink';

/**
 * GET /p/:code - the short link printed on the flyers (app/lib/caseShortLink.js).
 *
 * HF27J2 is the suffix of MUN-2026-HF27J2; this finds that case and sends
 * the visitor to its page, where the sighting form and the family's
 * contact details are. The suffix is not unique by schema, so when two
 * cases share one the open case wins, then the newest. A code nobody has
 * goes to the lost-and-found listing rather than a dead end.
 */
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { code } = await params;
  const base = getBaseUrl();
  const clean = String(code || '').trim().toUpperCase();
  if (!isShortCode(clean)) return NextResponse.redirect(`${base}/lost-and-found`, 302);

  let rows = [];
  try {
    rows = await prisma.case.findMany({
      where: { OR: [{ caseNumber: { endsWith: `-${clean}` } }, { caseNumber: clean }] },
      select: { caseNumber: true, resolvedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  } catch (error) {
    console.error('[short-link] lookup failed:', error?.message || error);
  }
  const hit = rows.find((r) => !r.resolvedAt) || rows[0];
  if (!hit) return NextResponse.redirect(`${base}/lost-and-found`, 302);
  return NextResponse.redirect(`${base}/cases/${encodeURIComponent(hit.caseNumber)}`, 302);
}
