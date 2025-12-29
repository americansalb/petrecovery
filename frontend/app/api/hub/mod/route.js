/**
 * Forum Moderation API
 *
 * POST /api/hub/mod - Perform moderation actions
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/hub/mod
 * Perform a moderation action
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        forumProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is moderator or admin
    const isMod = user.role === 'ADMIN' || user.role === 'MODERATOR' || user.forumProfile?.isModerator;
    if (!isMod) {
      return NextResponse.json({ error: 'Moderator access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, threadId, postId, reason, categoryId } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    let result = {};
    let actionType = action.toUpperCase();

    switch (action) {
      case 'lock_thread': {
        if (!threadId) {
          return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
        }

        await prisma.forumThread.update({
          where: { id: threadId },
          data: { isLocked: true },
        });

        await logModAction(user.id, 'LOCK_THREAD', { targetThreadId: threadId, reason });
        result = { message: 'Thread locked successfully' };
        break;
      }

      case 'unlock_thread': {
        if (!threadId) {
          return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
        }

        await prisma.forumThread.update({
          where: { id: threadId },
          data: { isLocked: false },
        });

        await logModAction(user.id, 'UNLOCK_THREAD', { targetThreadId: threadId, reason });
        result = { message: 'Thread unlocked successfully' };
        break;
      }

      case 'pin_thread': {
        if (!threadId) {
          return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
        }

        await prisma.forumThread.update({
          where: { id: threadId },
          data: { isPinned: true },
        });

        await logModAction(user.id, 'PIN_THREAD', { targetThreadId: threadId, reason });
        result = { message: 'Thread pinned successfully' };
        break;
      }

      case 'unpin_thread': {
        if (!threadId) {
          return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
        }

        await prisma.forumThread.update({
          where: { id: threadId },
          data: { isPinned: false },
        });

        await logModAction(user.id, 'UNPIN_THREAD', { targetThreadId: threadId, reason });
        result = { message: 'Thread unpinned successfully' };
        break;
      }

      case 'delete_thread': {
        if (!threadId) {
          return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
        }

        const thread = await prisma.forumThread.findUnique({
          where: { id: threadId },
        });

        if (!thread) {
          return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
        }

        // Soft delete
        await prisma.forumThread.update({
          where: { id: threadId },
          data: { isDeleted: true, isHidden: true },
        });

        // Update category counts
        await prisma.forumCategory.update({
          where: { id: thread.categoryId },
          data: { threadCount: { decrement: 1 } },
        });

        await logModAction(user.id, 'DELETE_THREAD', {
          targetThreadId: threadId,
          reason,
          details: JSON.stringify({ title: thread.title }),
        });
        result = { message: 'Thread deleted successfully' };
        break;
      }

      case 'restore_thread': {
        if (!threadId) {
          return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
        }

        const thread = await prisma.forumThread.findUnique({
          where: { id: threadId },
        });

        if (!thread) {
          return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
        }

        await prisma.forumThread.update({
          where: { id: threadId },
          data: { isDeleted: false, isHidden: false },
        });

        await prisma.forumCategory.update({
          where: { id: thread.categoryId },
          data: { threadCount: { increment: 1 } },
        });

        await logModAction(user.id, 'RESTORE_THREAD', { targetThreadId: threadId, reason });
        result = { message: 'Thread restored successfully' };
        break;
      }

      case 'move_thread': {
        if (!threadId || !categoryId) {
          return NextResponse.json({ error: 'Thread ID and category ID are required' }, { status: 400 });
        }

        const thread = await prisma.forumThread.findUnique({
          where: { id: threadId },
        });

        if (!thread) {
          return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
        }

        const newCategory = await prisma.forumCategory.findUnique({
          where: { id: categoryId },
        });

        if (!newCategory) {
          return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        const oldCategoryId = thread.categoryId;

        // Move thread
        await prisma.forumThread.update({
          where: { id: threadId },
          data: { categoryId },
        });

        // Update category counts
        await prisma.forumCategory.update({
          where: { id: oldCategoryId },
          data: { threadCount: { decrement: 1 } },
        });

        await prisma.forumCategory.update({
          where: { id: categoryId },
          data: { threadCount: { increment: 1 } },
        });

        await logModAction(user.id, 'MOVE_THREAD', {
          targetThreadId: threadId,
          reason,
          details: JSON.stringify({ from: oldCategoryId, to: categoryId }),
        });
        result = { message: 'Thread moved successfully' };
        break;
      }

      case 'delete_post': {
        if (!postId) {
          return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
        }

        const post = await prisma.forumPost.findUnique({
          where: { id: postId },
          include: { thread: true },
        });

        if (!post) {
          return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        // Soft delete
        await prisma.forumPost.update({
          where: { id: postId },
          data: { isDeleted: true },
        });

        // Update counts
        await prisma.forumThread.update({
          where: { id: post.threadId },
          data: { replyCount: { decrement: 1 } },
        });

        await logModAction(user.id, 'DELETE_POST', {
          targetPostId: postId,
          targetThreadId: post.threadId,
          reason,
        });
        result = { message: 'Post deleted successfully' };
        break;
      }

      case 'restore_post': {
        if (!postId) {
          return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
        }

        const post = await prisma.forumPost.findUnique({
          where: { id: postId },
        });

        if (!post) {
          return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        await prisma.forumPost.update({
          where: { id: postId },
          data: { isDeleted: false },
        });

        await prisma.forumThread.update({
          where: { id: post.threadId },
          data: { replyCount: { increment: 1 } },
        });

        await logModAction(user.id, 'RESTORE_POST', {
          targetPostId: postId,
          targetThreadId: post.threadId,
          reason,
        });
        result = { message: 'Post restored successfully' };
        break;
      }

      case 'mark_solution': {
        if (!postId) {
          return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
        }

        const post = await prisma.forumPost.findUnique({
          where: { id: postId },
          include: { thread: true },
        });

        if (!post) {
          return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        // Unmark any existing solutions
        await prisma.forumPost.updateMany({
          where: { threadId: post.threadId, isSolution: true },
          data: { isSolution: false },
        });

        // Mark this post as solution
        await prisma.forumPost.update({
          where: { id: postId },
          data: { isSolution: true },
        });

        // Mark thread as solved
        await prisma.forumThread.update({
          where: { id: post.threadId },
          data: { isSolved: true },
        });

        // Update author's solution count
        await prisma.forumProfile.upsert({
          where: { userId: post.authorId },
          create: { userId: post.authorId, solutionsCount: 1 },
          update: { solutionsCount: { increment: 1 } },
        });

        await logModAction(user.id, 'MARK_SOLUTION', {
          targetPostId: postId,
          targetThreadId: post.threadId,
        });
        result = { message: 'Post marked as solution' };
        break;
      }

      case 'unmark_solution': {
        if (!postId) {
          return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
        }

        const post = await prisma.forumPost.findUnique({
          where: { id: postId },
        });

        if (!post) {
          return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        await prisma.forumPost.update({
          where: { id: postId },
          data: { isSolution: false },
        });

        // Check if any other solutions exist
        const otherSolutions = await prisma.forumPost.count({
          where: { threadId: post.threadId, isSolution: true },
        });

        if (otherSolutions === 0) {
          await prisma.forumThread.update({
            where: { id: post.threadId },
            data: { isSolved: false },
          });
        }

        await logModAction(user.id, 'UNMARK_SOLUTION', {
          targetPostId: postId,
          targetThreadId: post.threadId,
        });
        result = { message: 'Solution unmarked' };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Moderation error:', error);
    return NextResponse.json({ error: 'Moderation action failed' }, { status: 500 });
  }
}

async function logModAction(moderatorId, actionType, data) {
  try {
    await prisma.forumModAction.create({
      data: {
        moderatorId,
        actionType,
        targetUserId: data.targetUserId,
        targetThreadId: data.targetThreadId,
        targetPostId: data.targetPostId,
        reason: data.reason,
        details: data.details,
      },
    });
  } catch (error) {
    console.error('Failed to log mod action:', error);
  }
}

/**
 * GET /api/hub/mod
 * Get categories for move dropdown
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { forumProfile: true },
    });

    const isMod = user?.role === 'ADMIN' || user?.role === 'MODERATOR' || user?.forumProfile?.isModerator;
    if (!isMod) {
      return NextResponse.json({ error: 'Moderator access required' }, { status: 403 });
    }

    const categories = await prisma.forumCategory.findMany({
      where: { isReadOnly: false },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching categories for mod:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
