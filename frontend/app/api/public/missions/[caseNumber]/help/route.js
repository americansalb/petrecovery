/**
 * GET /api/public/missions/[caseNumber]/help
 *
 * What the pet's page lists under "How you can help" and around it
 * (app/lib/petRoom.js): the Rescue Force looking for the pet, its needs for
 * the pet and the ones done, the next search party, how many people are
 * searching now, and the force's other pets. Public; a member of the force
 * also gets need notes, where they stand on each need, and where a search
 * party meets. Taking a need and "I am going" use the force's own routes.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { getPetRoom } from '@/app/lib/petRoom';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { caseNumber } = await params;
    const session = await getServerSession(authOptions);
    const room = await getPetRoom(caseNumber, { userId: session?.user?.id || null });
    if (!room) return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    return NextResponse.json(room);
  } catch (error) {
    console.error('Pet help failed:', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}
