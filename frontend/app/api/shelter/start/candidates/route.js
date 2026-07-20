/**
 * GET /api/shelter/start/candidates?name=&city=&state=
 *
 * The onboarding wizard's dedupe step: "is your shelter already in our
 * directory?" Public on purpose (it runs before signup) and returns only
 * public directory fields plus a claimed flag, never contact details or
 * API config. Rate limited like any public surface that hits the DB.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { withRateLimitAsync, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';

export async function GET(request) {
  try {
    const rl = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_WRITE, 'shelter:start-candidates');
    if (!rl.success) return rateLimitResponse(rl);

    const { searchParams } = new URL(request.url);
    const name = (searchParams.get('name') || '').trim();
    const city = (searchParams.get('city') || '').trim();
    const state = (searchParams.get('state') || '').trim();

    if (name.length < 3) {
      return NextResponse.json({ candidates: [] });
    }

    const shelters = await prisma.shelter.findMany({
      where: {
        name: { contains: name, mode: 'insensitive' },
        ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
        ...(state ? { state: { equals: state, mode: 'insensitive' } } : {}),
      },
      take: 5,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, address: true, city: true, state: true },
    });

    if (shelters.length === 0) {
      return NextResponse.json({ candidates: [] });
    }

    const claimed = await prisma.shelterProfile.findMany({
      where: { shelterId: { in: shelters.map((s) => s.id) }, claimedById: { not: null } },
      select: { shelterId: true },
    });
    const claimedIds = new Set(claimed.map((c) => c.shelterId));

    return NextResponse.json({
      candidates: shelters.map((s) => ({ ...s, claimed: claimedIds.has(s.id) })),
    });
  } catch (error) {
    console.error('[SHELTER-START] candidates failed:', error);
    return NextResponse.json({ candidates: [] });
  }
}
