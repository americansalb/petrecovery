/**
 * POST /api/rescue-forces/[id]/needs/[needId]  { action: 'take' | 'drop' | 'done' }
 *
 * A member takes a need, gives it back, or marks it done
 * (app/lib/forceNeeds.js has the rules). Members of the force only.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { actOnNeed, NeedError } from '@/app/lib/forceNeeds';

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { id, needId } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await actOnNeed({ forceId: id, needId, userId: session.user.id, action: body.action });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NeedError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Need action failed:', error);
    return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
  }
}
