import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { sweepArea } from '@/app/lib/cascade/actions/shareTargets';

/**
 * POST /api/admin/groups/sweep  { city, state }
 *
 * Manually run group discovery for an area: the same search + rank + persist
 * pipeline the cascade uses on a cache miss, on demand. Lets an admin
 * pre-warm the directory for a city before anyone reports there, or force a
 * refresh without waiting out the 30-day window. Requires
 * BRAVE_SEARCH_API_KEY; admin only.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim();
    if (!city) {
      return NextResponse.json({ error: 'City is required' }, { status: 400 });
    }

    const sweep = await sweepArea(city, state);
    if (!sweep.ok) {
      return NextResponse.json({ error: sweep.reason }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      city,
      state,
      candidates: sweep.candidates,
      groups: sweep.groups,
    });
  } catch (error) {
    console.error('Admin groups sweep error:', error);
    return NextResponse.json({ error: 'Sweep failed', details: error.message }, { status: 500 });
  }
}
