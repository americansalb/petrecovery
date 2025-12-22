/**
 * Forum Posts API
 *
 * POST /api/hub/posts - Create a new reply/post
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/hub/posts
 * Create a reply to a thread
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

    // Get or create forum profile
    let forumProfile = await prisma.forumProfile.findUnique({
      where: { userId: user.id }
    });

    if (!forumProfile) {
      forumProfile = await prisma.forumProfile.create({
        data: { userId: user.id }
      });
    }

    // Check if banned
    if (forumProfile.isBanned) {
      return NextResponse.json(
        { error: 'You are banned from posting' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      threadId,
      content,
      replyToId,
      embeddedPetId,
      embeddedShelterId,
      imageUrls,
    } = body;

    if (!threadId || !content) {
      return NextResponse.json(
        { error: 'Thread ID and content are required' },
        { status: 400 }
      );
    }

    // Get the thread
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: {
        category: true,
      }
    });

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    if (thread.isLocked) {
      return NextResponse.json(
        { error: 'This thread is locked' },
        { status: 403 }
      );
    }

    if (thread.isHidden) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Check trust level
    if (forumProfile.trustLevel < thread.category.requiredTrustLevel) {
      return NextResponse.json(
        { error: `Trust level ${thread.category.requiredTrustLevel} required` },
        { status: 403 }
      );
    }

    // If replying to a specific post, verify it exists
    if (replyToId) {
      const parentPost = await prisma.forumPost.findUnique({
        where: { id: replyToId }
      });
      if (!parentPost || parentPost.threadId !== threadId) {
        return NextResponse.json(
          { error: 'Invalid reply target' },
          { status: 400 }
        );
      }
    }

    // Create the post
    const post = await prisma.forumPost.create({
      data: {
        threadId,
        authorId: user.id,
        content,
        replyToId,
        embeddedPetId,
        embeddedShelterId,
        imageUrls: imageUrls ? JSON.stringify(imageUrls) : '[]',
      }
    });

    // Update thread stats
    await prisma.forumThread.update({
      where: { id: threadId },
      data: {
        replyCount: { increment: 1 },
        lastActivityAt: new Date(),
      }
    });

    // Update category stats
    await prisma.forumCategory.update({
      where: { id: thread.categoryId },
      data: {
        postCount: { increment: 1 },
        lastActivityAt: new Date(),
      }
    });

    // Update user stats
    await prisma.forumProfile.update({
      where: { userId: user.id },
      data: {
        postsCount: { increment: 1 },
        // Level up if first post
        trustLevel: forumProfile.trustLevel === 0 ? 1 : forumProfile.trustLevel,
      }
    });

    // Create notification for thread author (if not replying to self)
    if (thread.authorId !== user.id) {
      await prisma.forumNotification.create({
        data: {
          userId: thread.authorId,
          type: 'REPLY_TO_THREAD',
          threadId: thread.id,
          postId: post.id,
          title: `New reply to "${thread.title.substring(0, 50)}..."`,
          body: `${user.firstName} replied to your thread`,
          actorId: user.id,
        }
      });
    }

    // If replying to a specific post, notify that author too
    if (replyToId) {
      const parentPost = await prisma.forumPost.findUnique({
        where: { id: replyToId }
      });
      if (parentPost && parentPost.authorId !== user.id && parentPost.authorId !== thread.authorId) {
        await prisma.forumNotification.create({
          data: {
            userId: parentPost.authorId,
            type: 'REPLY_TO_POST',
            threadId: thread.id,
            postId: post.id,
            title: 'Someone replied to your comment',
            body: `${user.firstName} replied to your comment`,
            actorId: user.id,
          }
        });
      }
    }

    // Return post with author info
    return NextResponse.json({
      success: true,
      post: {
        ...post,
        author: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImage: user.profileImage,
        },
        authorProfile: forumProfile,
        reactions: [],
      }
    });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
