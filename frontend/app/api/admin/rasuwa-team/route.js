import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * Moderation for the family task force board. Admin-only: middleware.js
 * gates every /api/admin route on an ADMIN session.
 *
 * GET -> { admin: true } plus row counts. The board probes this once:
 * a 200 means the person is also signed in as a site admin, and the
 * board then shows its remove buttons.
 *
 * DELETE ?type=post|need|claim&id=... -> removes one row. The board is
 * a closed trusted group; moderation exists for mistakes and the rare
 * bad actor who got hold of the code, not for day-to-day use.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function GET() {
  try {
    const [posts, needs, claims] = await Promise.all([
      prisma.rasuwaTeamPost.count(),
      prisma.rasuwaTeamNeed.count(),
      prisma.rasuwaPersonClaim.count(),
    ]);
    return NextResponse.json({ admin: true, counts: { posts, needs, claims } }, NO_STORE);
  } catch {
    return NextResponse.json({ error: 'Counts are unavailable right now.' }, { status: 503, ...NO_STORE });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';
  const id = searchParams.get('id') || '';
  const table =
    type === 'post' ? prisma.rasuwaTeamPost
    : type === 'need' ? prisma.rasuwaTeamNeed
    : type === 'claim' ? prisma.rasuwaPersonClaim
    : null;
  if (!table || !id) {
    return NextResponse.json(
      { error: 'Removal needs type=post|need|claim and an id.' },
      { status: 400, ...NO_STORE }
    );
  }
  try {
    const { count } = await table.deleteMany({ where: { id } });
    return NextResponse.json({ ok: true, deleted: count }, NO_STORE);
  } catch {
    return NextResponse.json(
      { error: 'The removal did not go through. Try again in a moment.' },
      { status: 503, ...NO_STORE }
    );
  }
}
