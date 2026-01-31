/**
 * Single Post API
 *
 * PATCH /api/hub/posts/[id] - Update a post
 * DELETE /api/hub/posts/[id] - Delete a post (soft)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * PATCH /api/hub/posts/[id]
 * Update a post
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

    const { id } = await params;
    const post = await prisma.forumPost.findUnique({
      where: { id },
      include: { thread: true }
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check permissions
    const forumProfile = await prisma.forumProfile.findUnique({
      where: { userId: user.id }
    });

    const isAuthor = post.authorId === user.id;
    const isMod = forumProfile?.isModerator || user.role === 'ADMIN';

    if (!isAuthor && !isMod) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const updateData = {};

    // Authors can edit content
    if (isAuthor && body.content) {
      updateData.content = body.content;
      updateData.editedAt = new Date();
    }

    // Mods can hide/mark as solution
    if (isMod) {
      if (body.isHidden !== undefined) {
        updateData.isHidden = body.isHidden;
        updateData.hiddenBy = user.id;
        updateData.hiddenReason = body.hiddenReason;
      }
      if (body.isSolution !== undefined) {
        updateData.isSolution = body.isSolution;

        // If marking as solution, update thread
        if (body.isSolution) {
          await prisma.forumThread.update({
            where: { id: post.threadId },
            data: { isSolved: true }
          });

          // Notify post author
          if (post.authorId !== user.id) {
            await prisma.forumNotification.create({
              data: {
                userId: post.authorId,
                type: 'SOLUTION_MARKED',
                threadId: post.threadId,
                postId: post.id,
                title: 'Your answer was marked as solution!',
                body: `Your answer in "${post.thread.title.substring(0, 40)}..." was marked as the solution`,
                actorId: user.id,
              }
            });

            // Update user stats
            await prisma.forumProfile.update({
              where: { userId: post.authorId },
              data: { solutionsCount: { increment: 1 } }
            });
          }
        }
      }
    }

    const updatedPost = await prisma.forumPost.update({
      where: { id },
      data: updateData,
    });

    // Log mod action
    if (isMod && !isAuthor && body.isHidden) {
      await prisma.forumModAction.create({
        data: {
          moderatorId: user.id,
          actionType: 'HIDE_POST',
          targetPostId: post.id,
          targetUserId: post.authorId,
          reason: body.hiddenReason,
        }
      });
    }

    return NextResponse.json({
      success: true,
      post: updatedPost,
    });
  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json(
      { error: 'Failed to update post' },
      { status: 500 }
    );
  }
}
