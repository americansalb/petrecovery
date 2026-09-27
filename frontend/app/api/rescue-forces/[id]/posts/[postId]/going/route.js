/**
 * POST /api/rescue-forces/[id]/posts/[postId]/going  { going: true | false }
 *
 * "I am going" to a search party (a post with topic SEARCH_PARTY), or "I
 * can't go after all". Members of the force only; a party that ended more
 * than a few hours ago takes no new names.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

const OVER_AFTER = 3 * 3600e3;

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  try {
    const { id, postId } = await params;
    const body = await request.json().catch(() => ({}));
    const going = body.going === true;

    const member = await prisma.rescueForceMember.findFirst({
      where: { rescueSquadId: id, userId, isActive: true },
      select: { id: true },
    });
    if (!member) return NextResponse.json({ error: 'Join this Rescue Force to go to its search parties.' }, { status: 403 });

    const post = await prisma.squadPost.findFirst({
      where: { id: postId, rescueSquadId: id, isDeleted: false, topic: 'SEARCH_PARTY' },
      select: { id: true, eventAt: true },
    });
    if (!post) return NextResponse.json({ error: 'That search party was not found.' }, { status: 404 });

    if (going) {
      if (post.eventAt && post.eventAt.getTime() < Date.now() - OVER_AFTER) {
        return NextResponse.json({ error: 'This search party is over.' }, { status: 409 });
      }
      await prisma.squadPostGoing.upsert({
        where: { postId_userId: { postId: post.id, userId } },
        update: {},
        create: { postId: post.id, userId },
      });
    } else {
      await prisma.squadPostGoing.deleteMany({ where: { postId: post.id, userId } });
    }

    const goingCount = await prisma.squadPostGoing.count({ where: { postId: post.id } });
    return NextResponse.json({ going, goingCount });
  } catch (error) {
    console.error('Search party going failed:', error);
    return NextResponse.json({ error: 'That did not go through. Try again in a moment.' }, { status: 500 });
  }
}
