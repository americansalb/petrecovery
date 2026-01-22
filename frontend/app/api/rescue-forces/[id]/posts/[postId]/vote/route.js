import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/rescue-forces/[id]/posts/[postId]/vote
 *
 * Vote on a post (upvote or downvote)
 * Body: { vote: 1 | -1 }
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id, postId } = params;
    const body = await request.json();
    const { vote } = body;

    if (vote !== 1 && vote !== -1) {
      return NextResponse.json(
        { error: 'Vote must be 1 (upvote) or -1 (downvote)' },
        { status: 400 }
      );
    }

    // Check if user is a member of this force
    const membership = await prisma.rescueForceMember.findUnique({
      where: {
        rescueForceId_userId: {
          rescueForceId: id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You must be a force member to vote' },
        { status: 403 }
      );
    }

    // Check if post exists and belongs to this force
    const post = await prisma.squadPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        rescueForceId: true,
        upvotes: true,
        downvotes: true,
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    if (post.rescueForceId !== id) {
      return NextResponse.json(
        { error: 'Post does not belong to this force' },
        { status: 403 }
      );
    }

    // Check if user has already voted
    const existingVote = await prisma.squadPostVote.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: session.user.id,
        },
      },
    });

    let updatedPost;

    if (existingVote) {
      if (existingVote.vote === vote) {
        // Remove vote (user clicked same button again)
        await prisma.squadPostVote.delete({
          where: {
            postId_userId: {
              postId,
              userId: session.user.id,
            },
          },
        });

        // Update post counts
        updatedPost = await prisma.squadPost.update({
          where: { id: postId },
          data: {
            upvotes: vote === 1 ? post.upvotes - 1 : post.upvotes,
            downvotes: vote === -1 ? post.downvotes - 1 : post.downvotes,
          },
        });

        return NextResponse.json({
          success: true,
          vote: 0,
          upvotes: updatedPost.upvotes,
          downvotes: updatedPost.downvotes,
        });
      } else {
        // Change vote (upvote -> downvote or vice versa)
        await prisma.squadPostVote.update({
          where: {
            postId_userId: {
              postId,
              userId: session.user.id,
            },
          },
          data: { vote },
        });

        // Update post counts
        updatedPost = await prisma.squadPost.update({
          where: { id: postId },
          data: {
            upvotes: vote === 1 ? post.upvotes + 1 : post.upvotes - 1,
            downvotes: vote === -1 ? post.downvotes + 1 : post.downvotes - 1,
          },
        });

        return NextResponse.json({
          success: true,
          vote,
          upvotes: updatedPost.upvotes,
          downvotes: updatedPost.downvotes,
        });
      }
    } else {
      // Create new vote
      await prisma.squadPostVote.create({
        data: {
          postId,
          userId: session.user.id,
          vote,
        },
      });

      // Update post counts
      updatedPost = await prisma.squadPost.update({
        where: { id: postId },
        data: {
          upvotes: vote === 1 ? post.upvotes + 1 : post.upvotes,
          downvotes: vote === -1 ? post.downvotes + 1 : post.downvotes,
        },
      });

      return NextResponse.json({
        success: true,
        vote,
        upvotes: updatedPost.upvotes,
        downvotes: updatedPost.downvotes,
      });
    }
  } catch (error) {
    console.error('[POST_VOTE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to vote on post' },
      { status: 500 }
    );
  }
}
