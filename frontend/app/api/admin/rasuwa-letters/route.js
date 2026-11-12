import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { isAdmin } from '@/app/lib/authz';

/**
 * GET /api/admin/rasuwa-letters[?person=name]
 *
 * The families' record of generated letters, for organizers: newest
 * first, optionally filtered by the missing person's name, with a
 * per-person coverage summary so the campaign can see who has letters
 * going out and who does not yet. Admin-only: middleware.js gates every
 * /api/admin route on an ADMIN session, and the handler asks the database
 * itself (`staffOnly` below). The middleware reads the role out of the
 * sign-in cookie as it stands, so it is not the only check.
 */

export const dynamic = 'force-dynamic';

/** Null for staff, by the role the database has now. Otherwise the refusal to send. */
async function staffOnly() {
  const session = await getServerSession(authOptions).catch(() => null);
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  return null;
}

export async function GET(request) {
  const refusal = await staffOnly();
  if (refusal) return refusal;
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
