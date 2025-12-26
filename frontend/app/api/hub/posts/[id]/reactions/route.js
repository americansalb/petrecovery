/**
 * Post Reactions API
 *
 * POST /api/hub/posts/[id]/reactions - Add a reaction
 * DELETE /api/hub/posts/[id]/reactions - Remove a reaction
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

const VALID_REACTIONS = ['HELPFUL', 'HEART', 'THANKS'];

/**
 * POST /api/hub/posts/[id]/reactions
 * Add a reaction to a post
 */
export async function POST(request, { params }) {
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

    const { id: postId } = await params;
    const body = await request.json();
    const { type } = body;

    if (!type || !VALID_REACTIONS.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid reaction type' },
        { status: 400 }
      );
    }

    const post = await prisma.forumPost.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Can't react to your own post
    if (post.authorId === user.id) {
      return NextResponse.json(
        { error: 'Cannot react to your own post' },
        { status: 400 }
      );
    }

    // Check if reaction already exists
    const existingReaction = await prisma.forumReaction.findUnique({
      where: {
        postId_userId_type: {
          postId,
          userId: user.id,
          type,
        }
      }
    });

    if (existingReaction) {
      return NextResponse.json({
        success: true,
        message: 'Reaction already exists',
      });
    }

    // Create reaction
    await prisma.forumReaction.create({
      data: {
        postId,
        userId: user.id,
        type,
      }
    });

    // Update post count
    const countField = type === 'HELPFUL' ? 'helpfulCount' :
                       type === 'HEART' ? 'heartCount' : 'thanksCount';

    await prisma.forumPost.update({
      where: { id: postId },
      data: { [countField]: { increment: 1 } }
    });

    // Update author's helpful received count
    if (type === 'HELPFUL') {
      await prisma.forumProfile.upsert({
        where: { userId: post.authorId },
        update: { helpfulReceived: { increment: 1 } },
        create: { userId: post.authorId, helpfulReceived: 1 }
      });

      // Notify post author
      await prisma.forumNotification.create({
        data: {
          userId: post.authorId,
          type: 'REACTION',
          postId,
          title: 'Your post was marked helpful!',
          body: `${user.firstName} found your post helpful`,
          actorId: user.id,
        }
      });
    }

    return NextResponse.json({
      success: true,
      reaction: { type },
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    return NextResponse.json(
      { error: 'Failed to add reaction' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hub/posts/[id]/reactions
 * Remove a reaction from a post
 */
export async function DELETE(request, { params }) {
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

    const { id: postId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type || !VALID_REACTIONS.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid reaction type' },
        { status: 400 }
      );
    }

    const post = await prisma.forumPost.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Delete reaction
    const deleted = await prisma.forumReaction.deleteMany({
      where: {
        postId,
        userId: user.id,
        type,
      }
    });

    if (deleted.count > 0) {
      // Update post count
      const countField = type === 'HELPFUL' ? 'helpfulCount' :
                         type === 'HEART' ? 'heartCount' : 'thanksCount';

      await prisma.forumPost.update({
        where: { id: postId },
        data: { [countField]: { decrement: 1 } }
      });

      // Update author's helpful received count
      if (type === 'HELPFUL') {
        await prisma.forumProfile.update({
          where: { userId: post.authorId },
          data: { helpfulReceived: { decrement: 1 } }
        });
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    return NextResponse.json(
      { error: 'Failed to remove reaction' },
      { status: 500 }
    );
  }
}
