/**
 * Single Thread API
 *
 * GET /api/hub/threads/[slug] - Get thread with posts
 * PATCH /api/hub/threads/[slug] - Update thread
 * DELETE /api/hub/threads/[slug] - Delete thread (soft)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/hub/threads/[slug]
 * Get a thread with all its posts
 */
export async function GET(request, { params }) {
  try {
    const { slug } = await params;

    const thread = await prisma.forumThread.findUnique({
      where: { slug },
      include: {
        category: {
          select: { name: true, slug: true, icon: true, color: true }
        },
        posts: {
          where: { isHidden: false },
          orderBy: { createdAt: 'asc' },
          include: {
            reactions: true,
            replies: {
              where: { isHidden: false },
              orderBy: { createdAt: 'asc' },
            }
          }
        },
        bookmarks: {
          select: { userId: true }
        }
      }
    });

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    if (thread.isHidden) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Increment view count (async, don't wait)
    prisma.forumThread.update({
      where: { id: thread.id },
      data: { viewCount: { increment: 1 } }
    }).catch(() => {});

    // Get author info
    const author = await prisma.user.findUnique({
      where: { id: thread.authorId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImage: true,
      }
    });

    // Get forum profile for author
    const authorProfile = await prisma.forumProfile.findUnique({
      where: { userId: thread.authorId }
    });

    // Get all post author IDs
    const postAuthorIds = [...new Set(thread.posts.map(p => p.authorId))];
    const postAuthors = await prisma.user.findMany({
      where: { id: { in: postAuthorIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImage: true,
      }
    });
    const postAuthorMap = Object.fromEntries(postAuthors.map(a => [a.id, a]));

    // Get forum profiles for post authors
    const postAuthorProfiles = await prisma.forumProfile.findMany({
      where: { userId: { in: postAuthorIds } }
    });
    const profileMap = Object.fromEntries(postAuthorProfiles.map(p => [p.userId, p]));

    // Enrich posts with author info
    const postsWithAuthors = thread.posts.map(post => ({
      ...post,
      author: postAuthorMap[post.authorId] || { firstName: 'Unknown', lastName: '' },
      authorProfile: profileMap[post.authorId] || null,
    }));

    // Check if current user is logged in
    const session = await getServerSession(authOptions);
    let currentUserId = null;
    let isBookmarked = false;

    if (session?.user?.email) {
      const currentUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      });
      if (currentUser) {
        currentUserId = currentUser.id;
        isBookmarked = thread.bookmarks.some(b => b.userId === currentUser.id);
      }
    }

    return NextResponse.json({
      success: true,
      thread: {
        ...thread,
        author,
        authorProfile,
        posts: postsWithAuthors,
        isBookmarked,
        bookmarks: undefined, // Don't expose full bookmark list
      },
      currentUserId,
    });
  } catch (error) {
    console.error('Error fetching thread:', error);
    return NextResponse.json(
      { error: 'Failed to fetch thread' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hub/threads/[slug]
 * Update a thread (author or mod only)
 */
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { slug } = await params;
    const thread = await prisma.forumThread.findUnique({
      where: { slug }
    });

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Check permissions
    const forumProfile = await prisma.forumProfile.findUnique({
      where: { userId: user.id }
    });

    const isAuthor = thread.authorId === user.id;
    const isMod = forumProfile?.isModerator || user.role === 'ADMIN';

    if (!isAuthor && !isMod) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const allowedFields = ['title', 'content', 'locationTag', 'isSolved'];
    const modOnlyFields = ['isPinned', 'isLocked', 'isHidden', 'hiddenReason', 'urgencyLevel'];

    const updateData = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (isMod) {
      for (const field of modOnlyFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
          if (field === 'isHidden' && body[field]) {
            updateData.hiddenBy = user.id;
          }
        }
      }
    }

    updateData.updatedAt = new Date();

    const updatedThread = await prisma.forumThread.update({
      where: { id: thread.id },
      data: updateData,
    });

    // Log mod actions
    if (isMod && !isAuthor) {
      await prisma.forumModAction.create({
        data: {
          moderatorId: user.id,
          actionType: body.isHidden ? 'HIDE_POST' :
                      body.isPinned ? 'PIN_THREAD' :
                      body.isLocked ? 'LOCK_THREAD' : 'MOVE_THREAD',
          targetThreadId: thread.id,
          reason: body.reason,
        }
      });
    }

    return NextResponse.json({
      success: true,
      thread: updatedThread,
    });
  } catch (error) {
    console.error('Error updating thread:', error);
    return NextResponse.json(
      { error: 'Failed to update thread' },
      { status: 500 }
    );
  }
}
