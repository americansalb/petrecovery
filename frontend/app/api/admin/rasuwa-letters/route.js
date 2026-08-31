import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/admin/rasuwa-letters[?person=name]
 *
 * The families' record of generated letters, for organizers: newest
 * first, optionally filtered by the missing person's name, with a
 * per-person coverage summary so the campaign can see who has letters
 * going out and who does not yet. Admin-only: middleware.js gates every
 * /api/admin route on an ADMIN session.
 */

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const person = (searchParams.get('person') || '').trim();

  try {
    const [records, coverage] = await Promise.all([
      prisma.rasuwaLetterRecord.findMany({
        where: person ? { personName: { contains: person, mode: 'insensitive' } } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.rasuwaLetterRecord.groupBy({
        by: ['personName'],
        _count: { personName: true },
        orderBy: { _count: { personName: 'desc' } },
      }),
    ]);
    return NextResponse.json({
      coverage: coverage.map((c) => ({ personName: c.personName, records: c._count.personName })),
      records,
    });
  } catch {
    return NextResponse.json({ error: 'The letter records are unavailable right now.' }, { status: 503 });
  }
}
