/**
 * Forum Bookmarks API
 *
 * GET /api/hub/bookmarks - Get user's bookmarks
 * POST /api/hub/bookmarks - Add a bookmark
 * DELETE /api/hub/bookmarks - Remove a bookmark
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/hub/bookmarks
 * Get user's bookmarked threads
 */
export async function GET(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const bookmarks = await prisma.forumBookmark.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        thread: {
          include: {
            category: {
              select: { name: true, slug: true, icon: true, color: true }
            }
          }
        }
      }
    });

    // Filter out hidden threads
    const validBookmarks = bookmarks.filter(b => !b.thread.isHidden);

    return NextResponse.json({
      success: true,
      bookmarks: validBookmarks,
    });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hub/bookmarks
 * Add a bookmark
 */
export async function POST(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { threadId } = body;

    if (!threadId) {
      return NextResponse.json(
        { error: 'Thread ID is required' },
        { status: 400 }
      );
    }

    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId }
    });

    if (!thread || thread.isHidden) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Check if already bookmarked
    const existing = await prisma.forumBookmark.findUnique({
      where: {
        threadId_userId: {
          threadId,
          userId: user.id,
        }
      }
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Already bookmarked',
      });
    }

    const bookmark = await prisma.forumBookmark.create({
      data: {
        threadId,
        userId: user.id,
      }
    });

    return NextResponse.json({
      success: true,
      bookmark,
    });
  } catch (error) {
    console.error('Error creating bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to create bookmark' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hub/bookmarks
 * Remove a bookmark
 */
export async function DELETE(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get('threadId');

    if (!threadId) {
      return NextResponse.json(
        { error: 'Thread ID is required' },
        { status: 400 }
      );
    }

    await prisma.forumBookmark.deleteMany({
      where: {
        threadId,
        userId: user.id,
      }
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to delete bookmark' },
      { status: 500 }
    );
  }
}
