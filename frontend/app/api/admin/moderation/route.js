import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { getModerationQueue, moderateContent } from '@/app/lib/moderation';
import prisma from '@/app/lib/prisma';

// GET - Get moderation queue
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const queue = await getModerationQueue({ status, limit });

    return NextResponse.json({ reports: queue });
  } catch (error) {
    console.error('Moderation queue error:', error);
    return NextResponse.json({ error: 'Failed to get queue' }, { status: 500 });
  }
}

// POST - Take moderation action
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { contentType, contentId, action, reason } = await request.json();

    if (!contentType || !contentId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await moderateContent({
      moderatorId: session.user.id,
      contentType,
      contentId,
      action,
      reason,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Moderation action error:', error);
    return NextResponse.json({ error: 'Moderation action failed' }, { status: 500 });
  }
}
